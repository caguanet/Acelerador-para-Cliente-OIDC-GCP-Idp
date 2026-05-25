import express from 'express';
import cors from 'cors';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import admin from 'firebase-admin';

const app = express();
const PORT = process.env.PORT || 8080;

// --- Security: Limit JSON Payload size to 10KB (DoS protection) ---
app.use(express.json({ limit: '10kb' }));

function parseOriginList(value = '') {
    return value
        .split(/[|,]/)
        .map(origin => origin.trim())
        .filter(Boolean);
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
        return callback(new Error('Origen no permitido por CORS.'));
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
const otpLockStore = new Map();

// Periodic Session Cleanup to avoid memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [sid, session] of sessionStore.entries()) {
        if (now > session.expiresAt || now - session.createdAt > SESSION_TTL_MS) {
            sessionStore.delete(sid);
        }
    }
    for (const [key, lock] of otpLockStore.entries()) {
        if (now > lock.lockedUntil) otpLockStore.delete(key);
    }
}, 5 * 60 * 1000); // Clean every 5 minutes

// --- Security: Rate Limiters by IP ---
const lookupLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 mins
    max: 10,
    message: { error: 'Límite de búsquedas excedido. Por favor intenta más tarde.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const otpSendLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 mins
    max: 5,
    message: { error: 'Límite de envío de OTP excedido. Por favor intenta más tarde.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const otpValidateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 mins
    max: 15,
    message: { error: 'Límite de intentos de validación excedido. Por favor intenta más tarde.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// --- Security: Brute-force mitigation by ID (Cédula/NIT) ---
const idQueryTracker = new Map();
const maxQueriesPerIdPerHour = 5;

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
    const lock = otpLockStore.get(identityKey);
    if (!lock) return false;
    if (Date.now() > lock.lockedUntil) {
        otpLockStore.delete(identityKey);
        return false;
    }
    return true;
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

function getMulesoftOtpValidationPath(baseUrl) {
    const normalized = String(baseUrl || '').replace(/\/+$/, '');
    if (normalized.endsWith('/operations/v1customer')) {
        return `${normalized}/otp/validation`;
    }
    if (normalized.endsWith('/operations/v1/customer')) {
        return `${normalized}/otp/validation`;
    }
    if (normalized.endsWith('/operations/v1')) {
        return `${normalized}customer/otp/validation`;
    }
    return `${normalized}/operations/v1customer/otp/validation`;
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
        if (session.identityKey) {
            otpLockStore.set(session.identityKey, { lockedUntil });
        }
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
    // If running in GCP Cloud Run, it automatically picks up service account metadata
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_CONFIG) {
        admin.initializeApp();
        isFirebaseAdminInitialized = true;
        console.log('Firebase Admin SDK initialized successfully.');
    } else {
        console.warn('Firebase Admin SDK: No credentials found. Running in simulation mode.');
    }
} catch (error) {
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
async function getMuleSoftBearerToken() {
    const clientId = process.env.MULESOFT_CLIENT_ID;
    const clientSecret = process.env.MULESOFT_CLIENT_SECRET;
    const tokenUrl = process.env.MULESOFT_OAUTH_URL;

    if (!clientId || !clientSecret || !tokenUrl) {
        // Fallback to static bearer JWT if provided, otherwise simulation string
        return process.env.MULESOFT_BEARER_JWT || 'SIMULATED_MULESOFT_JWT_TOKEN';
    }

    try {
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: clientId,
                client_secret: clientSecret
            })
        });

        if (!response.ok) {
            throw new Error(`MuleSoft Token Auth failed with status ${response.status}`);
        }

        const data = await response.json();
        return data.access_token || data.token;
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

// --- Config Injection Endpoint ---
// Serve window.APP_CONFIG inside public / Cloud Run container
app.get('/config.js', (req, res) => {
    res.type('application/javascript');
    const mode = process.env.APP_MODE || 'IDP';
    
    const firebaseConfig = {
        apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
        authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID
    };

    const allowedOriginsEnv = process.env.VITE_ALLOWED_ORIGINS || '';
    const allowedOrigins = allowedOriginsEnv.split('|').map(o => o.trim()).filter(o => o);

    res.send(`window.APP_CONFIG = { 
        MODE: "${mode}",
        IDP_URL: "${process.env.VITE_IDP_URL || ''}",
        allowedOrigins: ${JSON.stringify(allowedOrigins)},
        firebase: ${JSON.stringify(firebaseConfig)},
        recaptchaSiteKey: "${process.env.VITE_RECAPTCHA_SITE_KEY || process.env.RECAPTCHA_SITE_KEY || ''}"
    };`);
});

// --- API Endpoints ---

// 1. Customer Lookup (MS-1)
app.post('/api/customer/lookup', lookupLimiter, async (req, res) => {
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
    const captchaRes = await verifyRecaptcha(recaptchaToken, 'lookup');
    if (!captchaRes.success || (captchaRes.score && captchaRes.score < 0.5)) {
        return res.status(403).json({ error: 'Verificación de seguridad fallida. Petición rechazada.' });
    }

    const mUrl = process.env.MULESOFT_BASE_URL_MS1;
    const isMockMode = !mUrl || mUrl.includes('mock') || !process.env.MULESOFT_CLIENT_ID;

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
            const bearerToken = await getMuleSoftBearerToken();
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
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'systemId': 'MIGRACION',
                    'name': 'telecenter',
                    'source': 'telecenter',
                    'X-CORRELATION-ID': `BFF-LOOKUP-${crypto.randomUUID()}`,
                    'client_id': process.env.MULESOFT_CLIENT_ID,
                    'client_secret': process.env.MULESOFT_CLIENT_SECRET,
                    'Authorization': `Bearer ${bearerToken}`
                }
            });

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

// 2. Generate and Send OTP (MS-2)
app.post('/api/customer/otp/send', otpSendLimiter, async (req, res) => {
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

    if (session.status === 'BLOCKED' || isOtpLocked(session.identityKey)) {
        return res.status(423).json({ error: getOtpLockMessage() });
    }

    // Verify reCAPTCHA
    const captchaRes = await verifyRecaptcha(recaptchaToken, 'otp_send');
    if (!captchaRes.success || (captchaRes.score && captchaRes.score < 0.5)) {
        return res.status(403).json({ error: 'Verificación de seguridad fallida.' });
    }

    const mUrl = process.env.MULESOFT_BASE_URL_MS2 || process.env.MULESOFT_BASE_URL_MS3;
    const isMockMode = !mUrl || mUrl.includes('mock') || !process.env.MULESOFT_CLIENT_ID;

    const chosenChannel = 'EMAIL';
    const channelValue = session.realEmail;

    try {
        let transactionId = 'SIM_TX_' + crypto.randomBytes(4).toString('hex');

        if (isMockMode) {
            console.log(`[MOCK MS-2] OTP sent via ${chosenChannel} to ${maskEmail(channelValue)}. TxId: ${transactionId}`);
            await new Promise(r => setTimeout(r, 500));
        } else {
            const bearerToken = await getMuleSoftBearerToken();
            const response = await fetch(`${mUrl}/operations/v1/customer/otp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'name': 'telecenter',
                    'source': 'telecenter',
                    'X-CORRELATION-ID': `BFF-OTP-SEND-${crypto.randomUUID()}`,
                    'Authorization': `Bearer ${bearerToken}`
                },
                body: JSON.stringify({
                    aplicacion: "telecenter",
                    id_almacenamiento: "",
                    nombre_cliente: session.docNumber,
                    identificacion_cliente: session.docNumber,
                    tipo_canal: chosenChannel,
                    valor_canal: channelValue
                })
            });

            if (!response.ok) {
                throw new Error(`MuleSoft MS-2 Send OTP returned status ${response.status}`);
            }

            const data = await response.json();
            transactionId = data.id_transaccion || data.transactionId;
        }

        // Save transactionId in blind session
        session.otpTransactionId = transactionId;
        session.status = 'OTP_SENT';
        return res.json({ success: true, message: 'OTP enviado correctamente.' });

    } catch (err) {
        console.error('Error during send OTP proxy:', err.message);
        return res.status(500).json({ error: 'No fue posible enviar el código OTP de seguridad.' });
    }
});

// 3. Validate OTP (MS-3)
app.post('/api/customer/otp/validate', otpValidateLimiter, async (req, res) => {
    const { sessionId, code } = req.body;

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

    if (session.status === 'BLOCKED' || isOtpLocked(session.identityKey)) {
        return res.status(423).json({ error: getOtpLockMessage() });
    }

    const mUrl = process.env.MULESOFT_BASE_URL_MS3;
    const isMockMode = !mUrl || mUrl.includes('mock') || !process.env.MULESOFT_CLIENT_ID;

    try {
        let isOtpValid = false;

        if (isMockMode) {
            console.log(`[MOCK MS-3] Validating OTP for TxId: ${session.otpTransactionId}`);
            await new Promise(r => setTimeout(r, 600));
            isOtpValid = code === '123456' || code === '654321';
        } else {
            const bearerToken = await getMuleSoftBearerToken();
            const response = await fetch(getMulesoftOtpValidationPath(mUrl), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'name': 'telecenter',
                    'source': 'telecenter',
                    'X-CORRELATION-ID': `BFF-OTP-VALIDATE-${crypto.randomUUID()}`,
                    'Authorization': `Bearer ${bearerToken}`
                },
                body: JSON.stringify({
                    aplicacion: "telecenter",
                    tipo_canal: "EMAIL",
                    id_transaccion: session.otpTransactionId,
                    codigo: code
                })
            });

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

// 4. Register customer after verified OTP (MS-4 + Identity Platform)
app.post('/api/customers/register', async (req, res) => {
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

    const mUrl = process.env.MULESOFT_BASE_URL_MS4;
    const isMockMode = !mUrl || mUrl.includes('mock') || !process.env.MULESOFT_CLIENT_ID;

    if (mUrl && !isMockMode) {
        try {
            const bearerToken = await getMuleSoftBearerToken();
            const ms4Response = await fetch(`${mUrl}/operations/v1/customer/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CORRELATION-ID': `BFF-MS4-${crypto.randomUUID()}`,
                    'Authorization': `Bearer ${bearerToken}`
                },
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
            documentHash: hashSecret(getIdentityKey(session.docType, session.docNumber)),
            registration_source: 'mulesoft_otp',
            auth_level: 'otp_verified'
        };

        if (session.customerType === 'MIPYMES') {
            customClaims.companyDocumentHash = hashSecret(getIdentityKey(session.companyDocType, session.companyDocNumber));
        }

        await admin.auth().setCustomUserClaims(userRecord.uid, customClaims);

        const customToken = await admin.auth().createCustomToken(userRecord.uid, {
            customerType: session.customerType,
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

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
