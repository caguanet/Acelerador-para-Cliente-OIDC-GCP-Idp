import express from 'express';
import cors from 'cors';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import admin from 'firebase-admin';

const app = express();
const PORT = process.env.PORT || 8080;

function sanitizeCspReportField(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
        const parsed = new URL(value);
        return `${parsed.origin}${parsed.pathname}`;
    } catch {
        return value.slice(0, 180);
    }
}

function normalizeCspReport(body) {
    try {
        const parsed = JSON.parse(body || '{}');
        const report = Array.isArray(parsed)
            ? parsed[0]
            : parsed['csp-report'] || parsed;

        return {
            documentUri: sanitizeCspReportField(report['document-uri'] || report.url),
            blockedUri: sanitizeCspReportField(report['blocked-uri'] || report.blockedURL),
            violatedDirective: String(report['violated-directive'] || report.effectiveDirective || '').slice(0, 120),
            disposition: String(report.disposition || '').slice(0, 40),
        };
    } catch {
        return { parseError: true, rawLength: String(body || '').length };
    }
}

function getDefaultCspReportOnlyPolicy() {
    const reportUri = getTrimmedEnv('CSP_REPORT_URI') || '/api/security/csp-report';
    return [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "script-src 'self' https://www.gstatic.com https://www.google.com https://www.recaptcha.net",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self' data:",
        "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://www.google.com https://www.recaptcha.net",
        "frame-src 'self' https://*.firebaseapp.com https://www.google.com https://www.recaptcha.net",
        "worker-src 'self' blob:",
        `report-uri ${reportUri}`,
    ].join('; ');
}

function getCspReportOnlyPolicy() {
    const override = getTrimmedEnv('CONTENT_SECURITY_POLICY_REPORT_ONLY');
    if (override) return override;
    if (!getBooleanEnv('CSP_REPORT_ONLY')) return '';
    return getDefaultCspReportOnlyPolicy();
}

// Cloud Run terminates TLS/proxying at Google Frontend; trust the first proxy
// so rate limiters use the real client IP from X-Forwarded-For.
app.set('trust proxy', 1);

app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    const cspReportOnly = getCspReportOnlyPolicy();
    if (cspReportOnly) {
        res.setHeader('Content-Security-Policy-Report-Only', cspReportOnly);
    }
    next();
});

app.post(
    '/api/security/csp-report',
    express.text({
        type: ['application/csp-report', 'application/reports+json', 'application/json', 'text/plain'],
        limit: '16kb'
    }),
    (req, res) => {
        console.warn(JSON.stringify({
            event: 'security.csp_report',
            ip: req.ip,
            userAgent: String(req.get('user-agent') || '').slice(0, 180),
            report: normalizeCspReport(req.body),
        }));
        res.status(204).end();
    }
);

// --- Security: Limit JSON Payload size to 10KB (DoS protection) ---
app.use(express.json({ limit: '10kb' }));

function parseOriginList(value = '') {
    return value
        .split(/[|,]/)
        .map(origin => origin.trim())
        .filter(Boolean);
}

function getTrimmedEnv(...names) {
    for (const name of names) {
        const value = process.env[name];
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }
    return '';
}

function getEnvValueOrFallback(name, fallback = '') {
    if (Object.prototype.hasOwnProperty.call(process.env, name)) {
        return String(process.env[name] || '').trim();
    }
    return fallback;
}

function getBooleanEnv(name, fallback = false) {
    const value = getTrimmedEnv(name);
    if (!value) return fallback;
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

const PUBLIC_APP_CONFIG_FORBIDDEN_PATTERNS = [
    /MULESOFT/i,
    /CLIENT_SECRET/i,
    /OAUTH_CLIENT_SECRET/i,
    /RECAPTCHA_API_KEY/i,
    /GOOGLE_APPLICATION_CREDENTIALS/i,
    /FIREBASE_CONFIG/i,
    /FIREBASE_SERVICE_ACCOUNT/i,
    /PRIVATE_KEY/i,
    /SERVICE_ACCOUNT/i,
    /PASSWORD/i,
    /ACCESS_TOKEN/i,
    /REFRESH_TOKEN/i,
    /BEARER/i,
];

function assertPublicAppConfigSafe(appConfig) {
    const serializedConfig = JSON.stringify(appConfig);
    const leakedPatterns = PUBLIC_APP_CONFIG_FORBIDDEN_PATTERNS
        .filter(pattern => pattern.test(serializedConfig))
        .map(pattern => pattern.source);

    if (leakedPatterns.length > 0) {
        throw new Error(`Public APP_CONFIG contains forbidden private fields: ${leakedPatterns.join(', ')}`);
    }
}

const configuredCorsOrigins = parseOriginList(process.env.CORS_ALLOWED_ORIGINS || process.env.VITE_ALLOWED_ORIGINS || '');

// Enable CORS. Production must be explicit; local simulation remains permissive.
app.use(cors({
    origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (configuredCorsOrigins.length === 0 && process.env.NODE_ENV !== 'production') {
            return callback(null, true);
        }
        if (configuredCorsOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(null, false);
    }
}));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- In-Memory Session Store with TTL (Anti-Scraping/PII Protection) ---
// Production must replace this with Firestore + TTL indexes, per architecture docs.
const sessionStore = new Map();
const SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutes
const VERIFICATION_TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_OTP_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 3);
const OTP_LOCK_MS = Number(process.env.OTP_LOCK_MS || 2 * 60 * 60 * 1000);
const LOOKUP_RATE_LIMIT_MAX = Number(process.env.LOOKUP_RATE_LIMIT_MAX || 10);
const OTP_SEND_RATE_LIMIT_MAX = Number(process.env.OTP_SEND_RATE_LIMIT_MAX || 5);
const OTP_VALIDATE_RATE_LIMIT_MAX = Number(process.env.OTP_VALIDATE_RATE_LIMIT_MAX || 15);
const OTP_VALIDATE_SESSION_RATE_LIMIT_MAX = Number(process.env.OTP_VALIDATE_SESSION_RATE_LIMIT_MAX || 5);
const RECAPTCHA_MIN_SCORE = Number(process.env.RECAPTCHA_MIN_SCORE || 0.5);
const ID_QUERY_MAX_PER_HOUR = Number(process.env.ID_QUERY_MAX_PER_HOUR || 5);
const otpLockStore = new Map();
const OTP_LOCK_STORE_FILE = getTrimmedEnv('OTP_LOCK_STORE_FILE') || path.join(__dirname, '..', 'tmp', 'otp-locks.json');
const MULESOFT_APP_ID = 'IDP-MiETB';
const MULESOFT_SERVICE_NAMES = {
    ms1: 'Consulta de cliente y correo registrado',
    ms2: 'Envio de codigo OTP por correo',
    ms3: 'Validacion de codigo OTP',
    ms4: 'Registro de identidad digital ETB'
};

function getOtpLockStoreKey(rawKey) {
    if (!rawKey) return '';
    const value = String(rawKey);
    if (value.startsWith('OTP_LOCK:')) return value;
    return `OTP_LOCK:${hashSecret(value)}`;
}

function persistOtpLocks() {
    if (!OTP_LOCK_STORE_FILE || OTP_LOCK_STORE_FILE === 'off') return;
    try {
        const now = Date.now();
        const locks = [];
        for (const [key, lock] of otpLockStore.entries()) {
            if (lock && Number(lock.lockedUntil) > now) {
                locks.push({ key, lockedUntil: Number(lock.lockedUntil) });
            }
        }
        fs.mkdirSync(path.dirname(OTP_LOCK_STORE_FILE), { recursive: true });
        fs.writeFileSync(OTP_LOCK_STORE_FILE, JSON.stringify({ version: 1, locks }, null, 2), { mode: 0o600 });
    } catch (err) {
        console.warn('Could not persist OTP lock store:', err.message);
    }
}

function loadPersistedOtpLocks() {
    if (!OTP_LOCK_STORE_FILE || OTP_LOCK_STORE_FILE === 'off' || !fs.existsSync(OTP_LOCK_STORE_FILE)) return;
    try {
        const parsed = JSON.parse(fs.readFileSync(OTP_LOCK_STORE_FILE, 'utf8'));
        const locks = Array.isArray(parsed?.locks) ? parsed.locks : [];
        const now = Date.now();
        for (const lock of locks) {
            const key = typeof lock?.key === 'string' ? lock.key : '';
            const lockedUntil = Number(lock?.lockedUntil || 0);
            if (key.startsWith('OTP_LOCK:') && lockedUntil > now) {
                otpLockStore.set(key, { lockedUntil });
            }
        }
    } catch (err) {
        console.warn('Could not load OTP lock store:', err.message);
    }
}

function setOtpLock(rawKey, lockedUntil) {
    const key = getOtpLockStoreKey(rawKey);
    if (!key) return;
    otpLockStore.set(key, { lockedUntil });
}

loadPersistedOtpLocks();

// Periodic Session Cleanup to avoid memory leaks
const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [sid, session] of sessionStore.entries()) {
        if (now > session.expiresAt || now - session.createdAt > SESSION_TTL_MS) {
            sessionStore.delete(sid);
        }
    }
    let changedLocks = false;
    for (const [key, lock] of otpLockStore.entries()) {
        if (now > lock.lockedUntil) {
            otpLockStore.delete(key);
            changedLocks = true;
        }
    }
    if (changedLocks) persistOtpLocks();
}, 5 * 60 * 1000); // Clean every 5 minutes
cleanupInterval.unref?.();

// --- Security: Rate Limiters by IP ---
const lookupLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 mins
    max: LOOKUP_RATE_LIMIT_MAX,
    message: { error: 'Límite de búsquedas excedido. Por favor intenta más tarde.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const otpSendLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 mins
    max: OTP_SEND_RATE_LIMIT_MAX,
    message: { error: 'Límite de envío de OTP excedido. Por favor intenta más tarde.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const otpValidateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 mins
    max: OTP_VALIDATE_RATE_LIMIT_MAX,
    message: { error: 'Límite de intentos de validación excedido. Por favor intenta más tarde.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const otpValidateSessionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 mins
    max: OTP_VALIDATE_SESSION_RATE_LIMIT_MAX,
    keyGenerator: (req) => `OTP_VALIDATE_SESSION:${hashSecret(String(req.body?.sessionId || 'missing'))}`,
    message: { error: 'Límite de intentos de validación excedido. Por favor intenta más tarde.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// --- Security: Brute-force mitigation by ID (Cédula/NIT) ---
const idQueryTracker = new Map();
const maxQueriesPerIdPerHour = ID_QUERY_MAX_PER_HOUR;

function isIdBlocked(docId) {
    const now = Date.now();
    const track = idQueryTracker.get(docId);
    if (!track) return false;
    
    // Reset tracker if older than 1 hour
    if (now - track.firstQueryTime > 60 * 60 * 1000) {
        idQueryTracker.delete(docId);
        return false;
    }
    
    return track.count >= maxQueriesPerIdPerHour;
}

function trackIdQuery(docId) {
    const now = Date.now();
    const track = idQueryTracker.get(docId);
    if (!track) {
        idQueryTracker.set(docId, { count: 1, firstQueryTime: now });
    } else {
        track.count += 1;
    }
}

function normalizeDocType(docType) {
    return String(docType || '').trim().toUpperCase();
}

function normalizeDocNumber(docNumber) {
    return String(docNumber || '').replace(/\s+/g, '').trim();
}

const ALLOWED_DOC_TYPES = new Set(['CC', 'CE', 'NIT', 'TI', 'PP']);

function isValidDocType(docType) {
    return ALLOWED_DOC_TYPES.has(normalizeDocType(docType));
}

function isValidDocNumber(docNumber) {
    const value = normalizeDocNumber(docNumber);
    return /^[A-Za-z0-9-]{3,30}$/.test(value);
}

function getIdentityKey(docType, docNumber) {
    return `${normalizeDocType(docType)}:${normalizeDocNumber(docNumber)}`;
}

function createCorrelationId() {
    return `${MULESOFT_APP_ID}-${crypto.randomUUID()}`;
}

function getSessionCorrelationId(session) {
    if (!session.correlationId) {
        session.correlationId = createCorrelationId();
    }
    return session.correlationId;
}

function getMulesoftHeaders(correlationId, extraHeaders = {}) {
    return {
        'name': MULESOFT_APP_ID,
        'source': MULESOFT_APP_ID,
        'X-CORRELATION-ID': correlationId,
        ...extraHeaders
    };
}

function getBearerAuthHeaderFromEnv(envName) {
    const token = process.env[envName]?.trim();
    if (!token) return {};
    return {
        Authorization: token.toLowerCase().startsWith('bearer ') ? token : `Bearer ${token}`
    };
}

function getMulesoftLogUrl(url) {
    try {
        const parsed = new URL(url);
        return `${parsed.origin}${parsed.pathname}`;
    } catch {
        return String(url || '').split('?')[0];
    }
}

function logMulesoftEvent(event, details = {}, level = 'log') {
    const serviceKey = event.match(/^mulesoft\.(ms\d)\./)?.[1];
    const serviceDetails = serviceKey
        ? {
            serviceCode: serviceKey.toUpperCase(),
            serviceName: MULESOFT_SERVICE_NAMES[serviceKey]
        }
        : {};
    const payload = {
        event,
        app: MULESOFT_APP_ID,
        ...serviceDetails,
        ...details
    };
    console[level](JSON.stringify(payload));
}

function getRequestBrowserOrigin(req) {
    const origin = req.get('origin');
    if (origin) return origin;

    const referer = req.get('referer');
    if (!referer) return '';

    try {
        return new URL(referer).origin;
    } catch {
        return '';
    }
}

function requireAllowedBrowserOrigin(req, res, next) {
    if (configuredCorsOrigins.length === 0 && process.env.NODE_ENV !== 'production') {
        return next();
    }

    const requestOrigin = getRequestBrowserOrigin(req);
    if (!requestOrigin || !configuredCorsOrigins.includes(requestOrigin)) {
        return res.status(403).json({ error: 'Origen no autorizado para esta operación.' });
    }

    return next();
}

function getMipymesIdentityKey(companyDocType, companyDocNumber, repDocType, repDocNumber) {
    return [
        getIdentityKey(companyDocType, companyDocNumber),
        getIdentityKey(repDocType, repDocNumber)
    ].join('|');
}

function maskIdentityKey(identityKey) {
    if (String(identityKey).includes('|')) {
        return String(identityKey)
            .split('|')
            .map(part => maskIdentityKey(part))
            .join('|');
    }
    const [docType, docNumber = ''] = String(identityKey).split(':');
    return `${docType}:${'*'.repeat(Math.max(0, docNumber.length - 4))}${docNumber.slice(-4)}`;
}

function isOtpLocked(identityKey) {
    const lockKey = getOtpLockStoreKey(identityKey);
    const lock = otpLockStore.get(lockKey);
    if (!lock) return false;
    if (Date.now() > lock.lockedUntil) {
        otpLockStore.delete(lockKey);
        persistOtpLocks();
        return false;
    }
    return true;
}

function isSessionOtpLocked(session) {
    if (!session) return false;
    if (session.status === 'BLOCKED') return true;
    if (session.identityKey && isOtpLocked(session.identityKey)) return true;
    if (session.intent === 'login' && session.emailHash && isOtpLocked(getLoginEmailLockKeyFromHash(session.emailHash))) {
        return true;
    }
    return false;
}

function getOtpLockMessage() {
    return 'Has superado los intentos permitidos. Por seguridad, intenta nuevamente en 2 horas.';
}

function isValidRegisteredEmail(email) {
    if (typeof email !== 'string') return false;
    const value = email.trim();
    if (value.length < 6 || value.length > 254 || /\s/.test(value)) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getLoginEmailLockKeyFromHash(emailHash) {
    if (!emailHash) return '';
    return `EMAIL_LOGIN:${emailHash}`;
}

function getMulesoftOtpValidationPath(baseUrl) {
    const normalized = String(baseUrl || '').replace(/\/+$/, '');
    if (normalized.endsWith('/operations/v1customer')) {
        return `${normalized}/otp/validation`;
    }
    if (normalized.endsWith('/operations/v1/customer')) {
        return `${normalized}/otp/validation`;
    }
    if (normalized.endsWith('/operations/v1')) {
        return `${normalized}/customer/otp/validation`;
    }
    return `${normalized}/operations/v1/customer/otp/validation`;
}

function getReliableRegistrationEligibility(customer) {
    if (!customer || typeof customer !== 'object') return false;
    const status = customer.registrationEligibility?.status || customer.registrationEligibility?.estado;
    return (
        customer.eligibleForDigitalRegistration === true ||
        customer.hasActiveServices === true ||
        status === 'ELIGIBLE'
    );
}

function hashSecret(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

function registerOtpFailure(session) {
    session.attempts = (session.attempts || 0) + 1;

    if (session.attempts >= MAX_OTP_ATTEMPTS) {
        const lockedUntil = Date.now() + OTP_LOCK_MS;
        session.status = 'BLOCKED';
        session.lockedUntil = lockedUntil;
        const lockKeys = new Set();
        if (session.identityKey) lockKeys.add(session.identityKey);
        if (session.intent === 'login' && session.emailHash) {
            lockKeys.add(getLoginEmailLockKeyFromHash(session.emailHash));
        }
        for (const lockKey of lockKeys) {
            setOtpLock(lockKey, lockedUntil);
        }
        persistOtpLocks();
        return { blocked: true };
    }

    return { blocked: false, remainingAttempts: MAX_OTP_ATTEMPTS - session.attempts };
}

function isPasswordStrong(password) {
    return (
        typeof password === 'string' &&
        password.length >= 8 &&
        /[A-Z]/.test(password) &&
        /[0-9]/.test(password) &&
        /[^A-Za-z0-9]/.test(password)
    );
}

function normalizePhoneNumber(phoneNumber) {
    return String(phoneNumber || '').replace(/[^\d+]/g, '').trim();
}

function isValidPhoneNumber(phoneNumber) {
    const value = normalizePhoneNumber(phoneNumber);
    const digits = value.replace(/\D/g, '');
    return digits.length >= 7 && digits.length <= 15 && /^\+?\d+$/.test(value);
}

// --- Firebase Admin SDK Initialization ---
let isFirebaseAdminInitialized = false;
try {
    // Cloud Run resolves ADC from the attached service account metadata server.
    // Local runs can still use GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_CONFIG.
    if (admin.apps.length === 0) {
        admin.initializeApp();
    }
    isFirebaseAdminInitialized = true;
    console.log('Firebase Admin SDK initialized successfully.');
} catch (error) {
    isFirebaseAdminInitialized = false;
    console.error('Failed to initialize Firebase Admin:', error.message);
}

// --- Masking Utility (PII Protection) ---
function maskEmail(email) {
    if (!email) return '';
    const [user, domain] = email.split('@');
    if (!domain) return 'e******@domain.com';
    const maskedUser = user.length <= 2 
        ? user + '***' 
        : user.substring(0, 2) + '*'.repeat(Math.max(3, user.length - 2));
    return `${maskedUser}@${domain}`;
}

// --- Dynamic OAuth 2.0 MuleSoft Bearer JWT Generator ---
async function getMuleSoftBearerToken(correlationId) {
    const clientId = process.env.MULESOFT_CLIENT_ID;
    const clientSecret = process.env.MULESOFT_CLIENT_SECRET;
    const tokenUrl = process.env.MULESOFT_OAUTH_URL;
    const oauthClientId = getEnvValueOrFallback('MULESOFT_OAUTH_CLIENT_ID', clientId);
    const oauthClientSecret = getEnvValueOrFallback('MULESOFT_OAUTH_CLIENT_SECRET', clientSecret);
    const oauthAccountId = process.env.MULESOFT_OAUTH_ACCOUNT_ID;

    if (!clientId || !clientSecret || !tokenUrl || !oauthAccountId) {
        throw new Error('MuleSoft OAuth configuration is incomplete.');
    }

    try {
        const headers = getMulesoftHeaders(correlationId || createCorrelationId(), {
            'Content-Type': 'application/json',
            'client_id': clientId,
            'client_secret': clientSecret,
            ...getBearerAuthHeaderFromEnv('MULESOFT_OAUTH_AUTHORIZATION_BEARER')
        });

        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                grant_type: 'client_credentials',
                client_id: oauthClientId,
                client_secret: oauthClientSecret,
                ...(oauthAccountId ? { account_id: oauthAccountId } : {})
            })
        });

        if (!response.ok) {
            throw new Error(`MuleSoft Token Auth failed with status ${response.status}`);
        }

        const data = await response.json();
        const accessToken = data.access_token || data.token;
        if (!accessToken) {
            throw new Error('MuleSoft Token Auth response did not include an access token.');
        }
        return accessToken;
    } catch (error) {
        console.error('Error fetching dynamic MuleSoft bearer token:', error.message);
        throw error;
    }
}

// --- Helper: Validate reCAPTCHA Enterprise ---
async function verifyRecaptcha(token, action) {
    const projectId = process.env.RECAPTCHA_PROJECT_ID;
    const siteKey = process.env.RECAPTCHA_SITE_KEY;
    const apiKey = process.env.RECAPTCHA_API_KEY;

    if (!projectId || !siteKey || !apiKey) {
        console.log(`[reCAPTCHA Bypass] Simulation mode active. Action: ${action}`);
        return { success: true, score: 0.9 };
    }

    try {
        const url = `https://recaptchaenterprise.googleapis.com/v1/projects/${projectId}/assessments?key=${apiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event: {
                    token: token,
                    siteKey: siteKey,
                    expectedAction: action
                }
            })
        });

        if (!response.ok) {
            console.error('reCAPTCHA enterprise verification request failed:', response.statusText);
            return { success: false, error: 'Request failed' };
        }

        const data = await response.json();
        
        if (!data.tokenProperties || !data.tokenProperties.valid) {
            console.warn(`reCAPTCHA invalid token. Reason: ${data.tokenProperties?.invalidReason}`);
            return { success: false, error: data.tokenProperties?.invalidReason };
        }

        return {
            success: true,
            score: data.riskAnalysis?.score || 0.0,
            reasons: data.riskAnalysis?.reasons || []
        };
    } catch (err) {
        console.error('Error during reCAPTCHA verification:', err.message);
        return { success: false, error: err.message };
    }
}

async function verifyRecaptchaOrReject(res, token, action) {
    const captchaRes = await verifyRecaptcha(token, action);
    if (!captchaRes.success || (captchaRes.score && captchaRes.score < RECAPTCHA_MIN_SCORE)) {
        res.status(403).json({ error: 'Verificación de seguridad fallida.' });
        return false;
    }
    return true;
}

// --- Config Injection Endpoint ---
// Serve window.APP_CONFIG inside public / Cloud Run container
app.get('/config.js', (req, res) => {
    res.type('application/javascript');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    const mode = getTrimmedEnv('APP_MODE') || 'IDP';
    
    const firebaseConfig = {
        apiKey: getTrimmedEnv('VITE_FIREBASE_API_KEY', 'FIREBASE_API_KEY'),
        authDomain: getTrimmedEnv('VITE_FIREBASE_AUTH_DOMAIN', 'FIREBASE_AUTH_DOMAIN'),
        projectId: getTrimmedEnv('VITE_FIREBASE_PROJECT_ID', 'FIREBASE_PROJECT_ID')
    };

    const allowedOrigins = parseOriginList(process.env.VITE_ALLOWED_ORIGINS || '');
    const canonicalIdpOrigin = getTrimmedEnv('CANONICAL_IDP_ORIGIN', 'VITE_IDP_URL');
    const appConfig = {
        MODE: mode,
        IDP_URL: canonicalIdpOrigin,
        canonicalIdpOrigin,
        CLIENT_ID: getTrimmedEnv('OIDC_CLIENT_ID', 'CLIENT_ID'),
        REDIRECT_URI: getTrimmedEnv('OIDC_REDIRECT_URI', 'REDIRECT_URI'),
        RESPONSE_TYPE: getTrimmedEnv('OIDC_RESPONSE_TYPE', 'RESPONSE_TYPE'),
        SCOPE: getTrimmedEnv('OIDC_SCOPE', 'SCOPE'),
        allowedOrigins,
        firebase: firebaseConfig,
        recaptchaSiteKey: getTrimmedEnv('VITE_RECAPTCHA_SITE_KEY', 'RECAPTCHA_SITE_KEY'),
        requireOidcRedirect: getBooleanEnv('REQUIRE_OIDC_REDIRECT'),
        emailLinkPrimaryTabRedirect: getBooleanEnv('EMAIL_LINK_PRIMARY_TAB_REDIRECT', false)
    };

    try {
        assertPublicAppConfigSafe(appConfig);
    } catch (error) {
        console.error('Unsafe public APP_CONFIG blocked:', error.message);
        res.status(500).send('window.APP_CONFIG = {};');
        return;
    }

    res.send(`window.APP_CONFIG = ${JSON.stringify(appConfig)};`);
});

// --- Shared: send OTP via MuleSoft MS-2 (EMAIL channel) ---
// Used by both the registration flow (/api/customer/otp/send) and the
// email-OTP login flow (/api/customer/otp/start-login). The session must
// already carry the resolved customer document (docNumber) and realEmail.
async function sendOtpViaMs2(session) {
    const mUrl = process.env.MULESOFT_BASE_URL_MS2 || process.env.MULESOFT_BASE_URL_MS3;
    const isMockMode = !mUrl || mUrl.includes('mock') || !process.env.MULESOFT_CLIENT_ID;
    const correlationId = getSessionCorrelationId(session);
    const chosenChannel = 'EMAIL';
    const channelValue = session.realEmail;

    let transactionId = 'SIM_TX_' + crypto.randomBytes(4).toString('hex');

    if (isMockMode) {
        console.log(`[MOCK MS-2] OTP sent via ${chosenChannel} to ${maskEmail(channelValue)}. TxId: ${transactionId}`);
        await new Promise(r => setTimeout(r, 500));
    } else {
        const bearerToken = await getMuleSoftBearerToken(correlationId);
        const url = `${mUrl}/operations/v1/customer/otp`;
        const ms2Start = Date.now();
        logMulesoftEvent('mulesoft.ms2.request', {
            correlationId,
            method: 'POST',
            url: getMulesoftLogUrl(url),
            channel: chosenChannel,
            identity: maskIdentityKey(session.identityKey)
        });

        const response = await fetch(url, {
            method: 'POST',
            headers: getMulesoftHeaders(correlationId, {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${bearerToken}`
            }),
            body: JSON.stringify({
                aplicacion: MULESOFT_APP_ID,
                id_almacenamiento: "",
                nombre_cliente: session.docNumber,
                identificacion_cliente: session.docNumber,
                tipo_canal: chosenChannel,
                valor_canal: channelValue
            })
        });
        const durationMs = Date.now() - ms2Start;

        logMulesoftEvent(response.ok ? 'mulesoft.ms2.response' : 'mulesoft.ms2.error', {
            correlationId,
            status: response.status,
            durationMs,
            url: getMulesoftLogUrl(url)
        }, response.ok ? 'log' : 'error');

        if (!response.ok) {
            throw new Error(`MuleSoft MS-2 Send OTP returned status ${response.status}`);
        }

        const data = await response.json();
        transactionId = data.id_transaccion || data.transactionId;
    }

    session.otpTransactionId = transactionId;
    session.status = 'OTP_SENT';
    return transactionId;
}

// --- API Endpoints ---

// 1. Customer Lookup (MS-1)
app.post('/api/customer/lookup', requireAllowedBrowserOrigin, lookupLimiter, async (req, res) => {
    const {
        docType,
        docNumber,
        companyDocType,
        companyDocNumber,
        repDocType,
        repDocNumber,
        lastName,
        recaptchaToken,
        customerType
    } = req.body;
    const normalizedCustomerType = customerType === 'MIPYMES' ? 'MIPYMES' : 'HOGARES';
    const normalizedDocType = normalizedCustomerType === 'MIPYMES' ? normalizeDocType(repDocType) : normalizeDocType(docType);
    const normalizedDocNumber = normalizedCustomerType === 'MIPYMES' ? normalizeDocNumber(repDocNumber) : normalizeDocNumber(docNumber);
    const normalizedCompanyDocType = normalizedCustomerType === 'MIPYMES' ? normalizeDocType(companyDocType || 'NIT') : null;
    const normalizedCompanyDocNumber = normalizedCustomerType === 'MIPYMES' ? normalizeDocNumber(companyDocNumber) : null;
    const identityKey = normalizedCustomerType === 'MIPYMES'
        ? getMipymesIdentityKey(normalizedCompanyDocType, normalizedCompanyDocNumber, normalizedDocType, normalizedDocNumber)
        : getIdentityKey(normalizedDocType, normalizedDocNumber);

    if (
        !isValidDocType(normalizedDocType) ||
        !isValidDocNumber(normalizedDocNumber) ||
        (normalizedCustomerType === 'MIPYMES' && (
            normalizedCompanyDocType !== 'NIT' ||
            !isValidDocNumber(normalizedCompanyDocNumber) ||
            !lastName
        ))
    ) {
        return res.status(400).json({ error: 'Faltan campos obligatorios para la consulta.' });
    }

    if (isOtpLocked(identityKey)) {
        return res.status(423).json({ error: getOtpLockMessage() });
    }

    // Protection: Abusive ID requests limit
    if (isIdBlocked(identityKey)) {
        return res.status(429).json({ error: 'Se ha detectado actividad sospechosa con esta identificación. Cuenta suspendida por una hora.' });
    }
    trackIdQuery(identityKey);

    // Verify reCAPTCHA
    if (!(await verifyRecaptchaOrReject(res, recaptchaToken, 'lookup'))) return;

    const mUrl = process.env.MULESOFT_BASE_URL_MS1;
    const isMockMode = !mUrl || mUrl.includes('mock') || !process.env.MULESOFT_CLIENT_ID;
    const correlationId = createCorrelationId();

    try {
        let realEmail = '';
        let eligibleForRegistration = false;

        if (isMockMode) {
            // Highly robust mock response for local testing
            console.log(`[MOCK MS-1] Querying customer: ID=${maskIdentityKey(identityKey)}`);
            await new Promise(r => setTimeout(r, 600)); // Network delay simulation
            realEmail = `cliente${normalizedDocNumber.slice(-6) || 'test'}@etb.com.co`;
            eligibleForRegistration = true;
        } else {
            // Get Dynamic Bearer Token for MuleSoft
            const bearerToken = await getMuleSoftBearerToken(correlationId);
            const query = new URLSearchParams({
                ORIGIN: 'TELECENTER',
                CUSTOMER_ID: normalizedDocNumber,
                CUSTOMER_ID_TYPE: normalizedDocType
            });

            if (normalizedCustomerType === 'MIPYMES') {
                query.set('COMPANY_ID', normalizedCompanyDocNumber);
                query.set('COMPANY_ID_TYPE', normalizedCompanyDocType);
            }

            const url = `${mUrl}/v1/customer?${query.toString()}`;
            const ms1Start = Date.now();
            logMulesoftEvent('mulesoft.ms1.request', {
                correlationId,
                method: 'GET',
                url: getMulesoftLogUrl(url),
                customerType: normalizedCustomerType,
                identity: maskIdentityKey(identityKey)
            });
            
            const response = await fetch(url, {
                method: 'GET',
                headers: getMulesoftHeaders(correlationId, {
                    'systemId': 'MIGRACION',
                    'client_id': process.env.MULESOFT_CLIENT_ID,
                    'client_secret': process.env.MULESOFT_CLIENT_SECRET,
                    'Authorization': `Bearer ${bearerToken}`
                })
            });
            const durationMs = Date.now() - ms1Start;

            logMulesoftEvent(response.ok ? 'mulesoft.ms1.response' : 'mulesoft.ms1.error', {
                correlationId,
                status: response.status,
                durationMs,
                url: getMulesoftLogUrl(url)
            }, response.ok ? 'log' : 'error');

            if (!response.ok) {
                if (response.status === 404) {
                    return res.status(404).json({ error: 'No se encontró ningún cliente registrado con esa información.' });
                }
                throw new Error(`MuleSoft MS-1 returned status ${response.status}`);
            }

            const data = await response.json();
            // Extrapolate registered email from MuleSoft response schema.
            const customer = Array.isArray(data) ? data[0] : data;
            realEmail = customer?.contactData?.email || customer?.email || '';
            eligibleForRegistration = getReliableRegistrationEligibility(customer);

            if (!eligibleForRegistration) {
                return res.status(403).json({ error: 'No fue posible validar que tengas un servicio vigente para completar el registro.' });
            }
        }

        if (!isValidRegisteredEmail(realEmail)) {
            return res.status(422).json({
                error: 'Encontramos una inconsistencia en tus datos de contacto. Comunícate con nuestras líneas de atención para actualizar tu información.'
            });
        }

        // Generate dynamic blind sessionId
        const sessionId = crypto.randomUUID();
        const now = Date.now();
        sessionStore.set(sessionId, {
            realEmail: realEmail.trim(),
            maskedEmail: maskEmail(realEmail),
            customerType: normalizedCustomerType,
            docType: normalizedDocType,
            docNumber: normalizedDocNumber,
            companyDocType: normalizedCompanyDocType,
            companyDocNumber: normalizedCompanyDocNumber,
            repDocType: normalizedCustomerType === 'MIPYMES' ? normalizedDocType : null,
            repDocNumber: normalizedCustomerType === 'MIPYMES' ? normalizedDocNumber : null,
            identityKey,
            eligibleForRegistration,
            isVerified: false,
            otpTransactionId: null,
            attempts: 0,
            status: 'INITIATED',
            verificationTokenHash: null,
            verificationTokenUsed: false,
            correlationId,
            createdAt: now,
            expiresAt: now + SESSION_TTL_MS
        });

        // Safe Response (Return enmasked strings only - Cero PII leakage)
        return res.json({
            sessionId,
            maskedEmail: maskEmail(realEmail)
        });

    } catch (err) {
        console.error('Error during customer lookup proxy:', err.message);
        return res.status(500).json({ error: 'Error del servidor al procesar la consulta del cliente.' });
    }
});

// 1b. Start email-OTP LOGIN (resolve existing user by email, then MS-2)
// Only existing Identity Platform users that carry the documentType/documentNumber
// custom claims (i.e. registered through the ETB/MuleSoft flow) are eligible.
// Responds generically for any well-formed email to prevent account enumeration.
app.post('/api/customer/otp/start-login', requireAllowedBrowserOrigin, otpSendLimiter, async (req, res) => {
    const { email, recaptchaToken } = req.body;

    if (!isValidRegisteredEmail(email)) {
        return res.status(400).json({ error: 'Ingresa un correo electrónico válido.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const emailHash = hashSecret(normalizedEmail);
    const emailRateKey = getLoginEmailLockKeyFromHash(emailHash);

    if (isOtpLocked(emailRateKey)) {
        return res.status(423).json({ error: getOtpLockMessage() });
    }

    if (isIdBlocked(emailRateKey)) {
        return res.status(429).json({ error: 'Se ha detectado actividad sospechosa con este correo. Intenta nuevamente más tarde.' });
    }
    trackIdQuery(emailRateKey);

    // Verify reCAPTCHA (reuse the otp_send action assessment)
    if (!(await verifyRecaptchaOrReject(res, recaptchaToken, 'otp_send'))) return;

    const sessionId = crypto.randomUUID();
    const now = Date.now();
    const correlationId = createCorrelationId();
    const genericResponse = { success: true, sessionId, maskedEmail: maskEmail(normalizedEmail) };

    // Resolve an eligible user via Admin SDK custom claims.
    let eligibleUser = null;
    if (isFirebaseAdminInitialized) {
        try {
            const userRecord = await admin.auth().getUserByEmail(normalizedEmail);
            const claims = userRecord.customClaims || {};
            if (!userRecord.disabled && claims.documentType && claims.documentNumber) {
                eligibleUser = {
                    uid: userRecord.uid,
                    docType: normalizeDocType(claims.documentType),
                    docNumber: normalizeDocNumber(claims.documentNumber)
                };
            }
        } catch (err) {
            // auth/user-not-found and any lookup error => ineligible (shadow session)
            if (err.code && err.code !== 'auth/user-not-found') {
                console.warn('start-login getUserByEmail error:', err.code);
            }
        }
    }

    if (!eligibleUser) {
        // Shadow session: never calls MuleSoft, but keeps the flow indistinguishable.
        sessionStore.set(sessionId, {
            intent: 'login',
            isShadow: true,
            emailHash,
            maskedEmail: maskEmail(normalizedEmail),
            identityKey: emailRateKey,
            isVerified: false,
            otpTransactionId: null,
            attempts: 0,
            status: 'INITIATED',
            correlationId,
            createdAt: now,
            expiresAt: now + SESSION_TTL_MS
        });
        logMulesoftEvent('login.otp.start', { correlationId, eligible: false });
        return res.json(genericResponse);
    }

    const identityKey = getIdentityKey(eligibleUser.docType, eligibleUser.docNumber);
    if (isOtpLocked(identityKey) || isOtpLocked(emailRateKey)) {
        return res.status(423).json({ error: getOtpLockMessage() });
    }

    const session = {
        intent: 'login',
        isShadow: false,
        uid: eligibleUser.uid,
        realEmail: normalizedEmail,
        maskedEmail: maskEmail(normalizedEmail),
        emailHash,
        docType: eligibleUser.docType,
        docNumber: eligibleUser.docNumber,
        identityKey,
        eligibleForLogin: true,
        isVerified: false,
        otpTransactionId: null,
        attempts: 0,
        status: 'INITIATED',
        verificationTokenHash: null,
        verificationTokenUsed: false,
        verificationTokenExpiresAt: 0,
        correlationId,
        createdAt: now,
        expiresAt: now + SESSION_TTL_MS
    };
    sessionStore.set(sessionId, session);

    try {
        await sendOtpViaMs2(session);
        logMulesoftEvent('login.otp.start', {
            correlationId,
            eligible: true,
            identity: maskIdentityKey(identityKey)
        });
    } catch (err) {
        // Do not leak the failure to the caller (anti-enumeration); the user can resend.
        console.error('start-login MS-2 send failed:', err.message);
    }

    return res.json(genericResponse);
});

// 2. Generate and Send OTP (MS-2)
app.post('/api/customer/otp/send', requireAllowedBrowserOrigin, otpSendLimiter, async (req, res) => {
    const { sessionId, recaptchaToken } = req.body;

    if (!sessionId) {
        return res.status(400).json({ error: 'La sesión es obligatoria.' });
    }

    const session = sessionStore.get(sessionId);
    if (!session) {
        return res.status(404).json({ error: 'La sesión ha expirado o es inválida. Por favor, re-inicia el formulario.' });
    }

    if (Date.now() > session.expiresAt) {
        sessionStore.delete(sessionId);
        return res.status(404).json({ error: 'La sesión ha expirado. Por favor, inicia nuevamente el registro.' });
    }

    if (isSessionOtpLocked(session)) {
        return res.status(423).json({ error: getOtpLockMessage() });
    }

    // Verify reCAPTCHA
    if (!(await verifyRecaptchaOrReject(res, recaptchaToken, 'otp_send'))) return;

    // Shadow login sessions (non-eligible email) never reach MuleSoft, but they
    // must respond identically to avoid account enumeration.
    if (session.isShadow) {
        return res.json({ success: true, message: 'OTP enviado correctamente.' });
    }

    try {
        await sendOtpViaMs2(session);
        return res.json({ success: true, message: 'OTP enviado correctamente.' });
    } catch (err) {
        console.error('Error during send OTP proxy:', err.message);
        return res.status(500).json({ error: 'No fue posible enviar el código OTP de seguridad.' });
    }
});

// 3. Validate OTP (MS-3)
app.post('/api/customer/otp/validate', requireAllowedBrowserOrigin, otpValidateLimiter, otpValidateSessionLimiter, async (req, res) => {
    const { sessionId, code, recaptchaToken } = req.body;

    if (!sessionId || !/^\d{6}$/.test(String(code || ''))) {
        return res.status(400).json({ error: 'Faltan campos requeridos para la validación.' });
    }

    const session = sessionStore.get(sessionId);
    if (!session) {
        return res.status(404).json({ error: 'La sesión ha expirado o es inválida.' });
    }

    if (Date.now() > session.expiresAt) {
        sessionStore.delete(sessionId);
        return res.status(404).json({ error: 'La sesión ha expirado. Por favor, inicia nuevamente el registro.' });
    }

    if (isSessionOtpLocked(session)) {
        return res.status(423).json({ error: getOtpLockMessage() });
    }

    if (!(await verifyRecaptchaOrReject(res, recaptchaToken, 'otp_validate'))) return;

    // Shadow login sessions have no real OTP transaction; treat every code as
    // invalid (and count attempts) so they are indistinguishable from a wrong code.
    if (session.isShadow) {
        const failure = registerOtpFailure(session);
        return res.status(failure.blocked ? 423 : 400).json({
            error: failure.blocked
                ? getOtpLockMessage()
                : `Código OTP incorrecto. Te quedan ${failure.remainingAttempts} intento(s).`
        });
    }

    const mUrl = process.env.MULESOFT_BASE_URL_MS3;
    const isMockMode = !mUrl || mUrl.includes('mock') || !process.env.MULESOFT_CLIENT_ID;
    const correlationId = getSessionCorrelationId(session);

    try {
        let isOtpValid = false;

        if (isMockMode) {
            console.log(`[MOCK MS-3] Validating OTP for TxId: ${session.otpTransactionId}`);
            await new Promise(r => setTimeout(r, 600));
            isOtpValid = code === '123456' || code === '654321';
        } else {
            const bearerToken = await getMuleSoftBearerToken(correlationId);
            const url = getMulesoftOtpValidationPath(mUrl);
            const ms3Start = Date.now();
            logMulesoftEvent('mulesoft.ms3.request', {
                correlationId,
                method: 'POST',
                url: getMulesoftLogUrl(url),
                identity: maskIdentityKey(session.identityKey)
            });

            const response = await fetch(url, {
                method: 'POST',
                headers: getMulesoftHeaders(correlationId, {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${bearerToken}`
                }),
                body: JSON.stringify({
                    aplicacion: MULESOFT_APP_ID,
                    tipo_canal: "EMAIL",
                    id_transaccion: session.otpTransactionId,
                    codigo: code
                })
            });
            const durationMs = Date.now() - ms3Start;

            logMulesoftEvent(response.ok ? 'mulesoft.ms3.response' : 'mulesoft.ms3.error', {
                correlationId,
                status: response.status,
                durationMs,
                url: getMulesoftLogUrl(url)
            }, response.ok ? 'log' : 'warn');

            if (response.ok) {
                isOtpValid = true;
            } else {
                const failure = registerOtpFailure(session);
                return res.status(failure.blocked ? 423 : 400).json({
                    error: failure.blocked
                        ? getOtpLockMessage()
                        : `Código OTP incorrecto o expirado. Te quedan ${failure.remainingAttempts} intento(s).`
                });
            }
        }

        if (!isOtpValid) {
            const failure = registerOtpFailure(session);
            return res.status(failure.blocked ? 423 : 400).json({
                error: failure.blocked
                    ? getOtpLockMessage()
                    : `Código OTP incorrecto. Te quedan ${failure.remainingAttempts} intento(s).`
            });
        }

        session.isVerified = true;
        session.attempts = 0;
        session.status = 'OTP_VERIFIED';
        const verificationToken = crypto.randomBytes(32).toString('base64url');
        session.verificationTokenHash = hashSecret(verificationToken);
        session.verificationTokenUsed = false;
        session.verificationTokenExpiresAt = Date.now() + VERIFICATION_TOKEN_TTL_MS;

        return res.json({
            success: true,
            verificationToken,
            maskedEmail: session.maskedEmail,
            message: 'OTP validado correctamente.'
        });

    } catch (err) {
        console.error('Error during OTP validation proxy:', err.message);
        return res.status(500).json({ error: 'Error interno al validar el código OTP.' });
    }
});

// 4. Register customer after verified OTP (optional MS-4 + Identity Platform)
app.post('/api/customers/register', requireAllowedBrowserOrigin, async (req, res) => {
    const { sessionId, verificationToken, password, phoneNumber, acceptTerms, acceptDataPolicy } = req.body;

    if (!sessionId || !verificationToken || !isPasswordStrong(password) || !isValidPhoneNumber(phoneNumber)) {
        return res.status(400).json({ error: 'Faltan datos válidos para completar el registro.' });
    }

    const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);

    if (!acceptTerms || !acceptDataPolicy) {
        return res.status(400).json({ error: 'Debes aceptar los términos y las políticas de tratamiento de datos.' });
    }

    const session = sessionStore.get(sessionId);
    if (!session || Date.now() > session.expiresAt) {
        if (session) sessionStore.delete(sessionId);
        return res.status(404).json({ error: 'La sesión ha expirado. Por favor, inicia nuevamente el registro.' });
    }

    if (
        session.status !== 'OTP_VERIFIED' ||
        !session.isVerified ||
        session.verificationTokenUsed ||
        !session.verificationTokenHash ||
        Date.now() > session.verificationTokenExpiresAt ||
        hashSecret(verificationToken) !== session.verificationTokenHash
    ) {
        return res.status(403).json({ error: 'La validación de seguridad no está vigente. Solicita un nuevo código OTP.' });
    }

    if (!session.eligibleForRegistration || !isValidRegisteredEmail(session.realEmail)) {
        return res.status(403).json({ error: 'No fue posible completar el registro con la información validada.' });
    }

    const isMs4Enabled = process.env.MULESOFT_ENABLE_MS4 === 'true';
    const mUrl = process.env.MULESOFT_BASE_URL_MS4;
    const isMockMode = !mUrl || mUrl.includes('mock') || !process.env.MULESOFT_CLIENT_ID;
    const correlationId = getSessionCorrelationId(session);

    // MS-4 is intentionally disabled until MuleSoft delivers the productive
    // Alta Digital contract. Expected future sequence: after MS-3 validates OTP
    // and before Admin SDK creates/updates the Identity Platform user, call
    // MuleSoft Alta Digital with OTP transaction, customer identity, contact
    // phone, accepted terms, and provider "GCP_IDENTITY_PLATFORM".
    if (isMs4Enabled && !mUrl) {
        return res.status(503).json({ error: 'MS-4 no está configurado para completar el alta digital.' });
    }

    if (isMs4Enabled && isMockMode) {
        return res.status(503).json({ error: 'MS-4 no tiene configuración productiva válida.' });
    }

    if (isMs4Enabled) {
        try {
            const bearerToken = await getMuleSoftBearerToken(correlationId);
            const ms4Response = await fetch(`${mUrl}/operations/v1/customer/register`, {
                method: 'POST',
                headers: getMulesoftHeaders(correlationId, {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${bearerToken}`
                }),
                body: JSON.stringify({
                    id_transaccion_otp: session.otpTransactionId,
                    tipo_cliente: session.customerType,
                    tipo_documento: session.docType,
                    numero_documento: session.docNumber,
                    nit_empresa: session.customerType === 'MIPYMES' ? session.companyDocNumber : undefined,
                    correo_registrado: session.realEmail,
                    telefono_contacto: normalizedPhoneNumber,
                    acepta_terminos: true,
                    acepta_tratamiento_datos: true,
                    proveedor_identidad: 'GCP_IDENTITY_PLATFORM'
                })
            });

            if (!ms4Response.ok) {
                throw new Error(`Alta Digital MS-4 failed with status ${ms4Response.status}`);
            }
        } catch (ms4Err) {
            console.error('MS-4 (Alta Digital) failed:', ms4Err.message);
            return res.status(502).json({ error: 'No fue posible registrar el alta digital del cliente.' });
        }
    }

    if (!isFirebaseAdminInitialized) {
        return res.status(503).json({ error: 'El servicio de registro seguro no está configurado. Intenta más tarde.' });
    }

    try {
        let userRecord;
        try {
            userRecord = await admin.auth().getUserByEmail(session.realEmail);
        } catch (getUserErr) {
            if (getUserErr.code === 'auth/user-not-found') {
                userRecord = await admin.auth().createUser({
                    email: session.realEmail,
                    password,
                    emailVerified: true,
                });
            } else {
                throw getUserErr;
            }
        }

        const customClaims = {
            customerType: session.customerType,
            documentType: session.docType,
            documentNumber: session.docNumber,
            documentHash: hashSecret(getIdentityKey(session.docType, session.docNumber)),
            registration_source: 'mulesoft_otp',
            auth_level: 'otp_verified'
        };

        if (session.customerType === 'MIPYMES') {
            customClaims.companyDocumentType = session.companyDocType;
            customClaims.companyDocumentNumber = session.companyDocNumber;
            customClaims.companyDocumentHash = hashSecret(getIdentityKey(session.companyDocType, session.companyDocNumber));
        }

        await admin.auth().setCustomUserClaims(userRecord.uid, customClaims);

        const customToken = await admin.auth().createCustomToken(userRecord.uid, {
            customerType: session.customerType,
            documentType: session.docType,
            documentNumber: session.docNumber,
            ...(session.customerType === 'MIPYMES' ? {
                companyDocumentType: session.companyDocType,
                companyDocumentNumber: session.companyDocNumber
            } : {}),
            auth_level: 'otp_verified'
        });

        session.verificationTokenUsed = true;
        session.status = 'REGISTERED';
        sessionStore.delete(sessionId);

        return res.json({
            success: true,
            customToken
        });
    } catch (firebaseErr) {
        console.error('Firebase Admin signup error:', firebaseErr.message);
        return res.status(500).json({ error: 'Error al crear la cuenta de usuario en la base de seguridad.' });
    }
});

// 5. Complete email-OTP LOGIN: mint a custom token for the resolved user.
// signInWithCustomToken on the client establishes a real Identity Platform
// session and updates the user's lastSignInTime (Custom Auth login).
app.post('/api/auth/login/complete', requireAllowedBrowserOrigin, otpValidateLimiter, async (req, res) => {
    const { sessionId, verificationToken } = req.body;

    if (!sessionId || !verificationToken) {
        return res.status(400).json({ error: 'Faltan datos para completar el inicio de sesión.' });
    }

    const session = sessionStore.get(sessionId);
    if (!session || Date.now() > session.expiresAt) {
        if (session) sessionStore.delete(sessionId);
        return res.status(404).json({ error: 'La sesión ha expirado. Vuelve a solicitar un código de acceso.' });
    }

    if (
        session.intent !== 'login' ||
        session.isShadow ||
        !session.eligibleForLogin ||
        !session.uid ||
        session.status !== 'OTP_VERIFIED' ||
        !session.isVerified ||
        session.verificationTokenUsed ||
        !session.verificationTokenHash ||
        Date.now() > session.verificationTokenExpiresAt ||
        hashSecret(verificationToken) !== session.verificationTokenHash
    ) {
        return res.status(403).json({ error: 'La validación de seguridad no está vigente. Solicita un nuevo código de acceso.' });
    }

    if (!isFirebaseAdminInitialized) {
        return res.status(503).json({ error: 'El servicio de inicio de sesión no está disponible. Intenta más tarde.' });
    }

    try {
        const customToken = await admin.auth().createCustomToken(session.uid, {
            auth_level: 'otp_email_verified',
            login_method: 'miuso_email_otp'
        });

        session.verificationTokenUsed = true;
        session.status = 'LOGGED_IN';

        // Functional login audit (no PII, no OTP, no token persisted).
        logMulesoftEvent('login.otp.success', {
            correlationId: getSessionCorrelationId(session),
            uid: session.uid,
            emailHash: session.emailHash,
            identity: maskIdentityKey(session.identityKey),
            ipHash: hashSecret(String(req.ip || '')).slice(0, 16),
            userAgentHash: hashSecret(String(req.get('user-agent') || '')).slice(0, 16),
            method: 'miuso_email_otp'
        });

        sessionStore.delete(sessionId);
        return res.json({ success: true, customToken });
    } catch (err) {
        console.error('Error issuing login custom token:', err.message);
        return res.status(500).json({ error: 'No fue posible completar el inicio de sesión.' });
    }
});

// --- Serve Static Frontend (Vite Build) ---
const DIST_PATH = path.join(__dirname, 'dist');
app.use(express.static(DIST_PATH));

// Health Check
app.get('/api/health', (req, res) => {
    res.send('ETB IDP Static Host is running');
});

// SPA Catch-All Route
app.get('*', (req, res) => {
    res.sendFile(path.join(DIST_PATH, 'index.html'));
});

function __resetForTests() {
    sessionStore.clear();
    otpLockStore.clear();
    idQueryTracker.clear();
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isMainModule) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

export { app, __resetForTests };
