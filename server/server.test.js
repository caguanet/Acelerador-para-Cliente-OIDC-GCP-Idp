// @vitest-environment node
import { createServer } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const firebaseAdminMock = vi.hoisted(() => ({
    auth: {
        getUserByEmail: vi.fn(),
        createCustomToken: vi.fn(),
        createUser: vi.fn(),
        setCustomUserClaims: vi.fn(),
    },
    initializeApp: vi.fn(),
}));

vi.mock('firebase-admin', () => ({
    default: {
        apps: [],
        initializeApp: firebaseAdminMock.initializeApp,
        auth: vi.fn(() => firebaseAdminMock.auth),
    },
}));

const OLD_ENV = { ...process.env };
const TEST_ORIGIN = 'https://client.test';
const TEST_EMAIL = 'ventaapis@yopmail.com';
let app;
let resetBffState;
let server;
let baseUrl;
let nativeFetch;
let fetchSpy;
let externalFetchMock;

function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
    });
}

function getRequestUrl(input) {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.toString();
    return input.url;
}

function getHeader(init, headerName) {
    const headers = init?.headers;
    if (!headers) return undefined;
    if (headers instanceof Headers) return headers.get(headerName);
    const lowerName = headerName.toLowerCase();
    const entry = Object.entries(headers).find(([name]) => name.toLowerCase() === lowerName);
    return entry?.[1];
}

function externalCalls() {
    return externalFetchMock.mock.calls.map(([input, init]) => ({
        url: getRequestUrl(input),
        init,
        body: init?.body ? JSON.parse(init.body) : undefined,
    }));
}

function findExternalCall(pathPart) {
    return externalCalls().find(call => call.url.includes(pathPart));
}

async function startHttpServer(expressApp) {
    const httpServer = createServer(expressApp);
    await new Promise(resolve => httpServer.listen(0, '127.0.0.1', resolve));
    const address = httpServer.address();
    return {
        httpServer,
        url: `http://127.0.0.1:${address.port}`,
    };
}

async function request(path, options = {}) {
    const {
        method = 'POST',
        body,
        origin = TEST_ORIGIN,
        headers = {},
    } = options;
    const response = await nativeFetch(`${baseUrl}${path}`, {
        method,
        headers: {
            ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
            ...(origin ? { origin } : {}),
            ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let data = text;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        // keep raw text for JavaScript config and health responses
    }
    return { response, data, text };
}

async function startEligibleLogin(email = TEST_EMAIL) {
    firebaseAdminMock.auth.getUserByEmail.mockResolvedValue({
        uid: 'uid-otp-1',
        disabled: false,
        customClaims: {
            documentType: 'CC',
            documentNumber: '8739353211',
        },
    });

    const result = await request('/api/customer/otp/start-login', {
        body: { email, recaptchaToken: 'captcha-ok' },
    });

    expect(result.response.status).toBe(200);
    expect(result.data.success).toBe(true);
    expect(result.data.maskedEmail).toMatch(/^[a-z]{2}\*+@yopmail\.com$/);
    expect(result.data.sessionId).toEqual(expect.any(String));
    return result.data.sessionId;
}

beforeAll(async () => {
    process.env = {
        ...OLD_ENV,
        NODE_ENV: 'test',
        APP_MODE: 'IDP',
        CORS_ALLOWED_ORIGINS: TEST_ORIGIN,
        VITE_ALLOWED_ORIGINS: TEST_ORIGIN,
        OTP_LOCK_STORE_FILE: 'off',
        LOOKUP_RATE_LIMIT_MAX: '1000',
        OTP_SEND_RATE_LIMIT_MAX: '1000',
        OTP_VALIDATE_RATE_LIMIT_MAX: '1000',
        OTP_VALIDATE_SESSION_RATE_LIMIT_MAX: '1000',
        ID_QUERY_MAX_PER_HOUR: '1000',
        MULESOFT_CLIENT_ID: 'mulesoft-client-id',
        MULESOFT_CLIENT_SECRET: 'mulesoft-client-secret',
        MULESOFT_OAUTH_URL: 'https://oauth.test/token',
        MULESOFT_OAUTH_ACCOUNT_ID: 'mulesoft-account',
        MULESOFT_BASE_URL_MS2: 'https://ms2.test',
        MULESOFT_BASE_URL_MS3: 'https://ms3.test/operations/v1',
        VITE_FIREBASE_API_KEY: 'public-firebase-api-key',
        VITE_FIREBASE_AUTH_DOMAIN: 'auth.example.test',
        VITE_FIREBASE_PROJECT_ID: 'identity-project',
        OIDC_CLIENT_ID: 'etb-identity-omnicanal',
        OIDC_REDIRECT_URI: 'https://client.test/callback',
        OIDC_RESPONSE_TYPE: 'token',
        OIDC_SCOPE: 'openid profile email',
        VITE_RECAPTCHA_SITE_KEY: 'public-site-key',
    };

    nativeFetch = globalThis.fetch.bind(globalThis);
    ({ app, __resetForTests: resetBffState } = await import('./server.js'));
    const started = await startHttpServer(app);
    server = started.httpServer;
    baseUrl = started.url;
});

beforeEach(() => {
    resetBffState();
    vi.clearAllMocks();
    delete process.env.RECAPTCHA_PROJECT_ID;
    delete process.env.RECAPTCHA_SITE_KEY;
    delete process.env.RECAPTCHA_API_KEY;

    firebaseAdminMock.auth.createCustomToken.mockResolvedValue('custom-token-otp');
    externalFetchMock = vi.fn(async (input, init) => {
        const url = getRequestUrl(input);

        if (url === 'https://oauth.test/token') {
            return jsonResponse({ access_token: 'bearer-token' });
        }

        if (url === 'https://ms2.test/operations/v1/customer/otp') {
            return jsonResponse({ id_transaccion: 'tx-email-otp-1' });
        }

        if (url === 'https://ms3.test/operations/v1/customer/otp/validation') {
            return jsonResponse({ valid: true });
        }

        if (url.startsWith('https://recaptchaenterprise.googleapis.com/')) {
            return jsonResponse({
                tokenProperties: { valid: true },
                riskAnalysis: { score: 0.9 },
            });
        }

        return jsonResponse({ error: `Unexpected external request: ${url}` }, 500);
    });

    fetchSpy?.mockRestore();
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => externalFetchMock(input, init));
});

afterAll(async () => {
    fetchSpy?.mockRestore();
    await new Promise(resolve => server.close(resolve));
    process.env = OLD_ENV;
});

describe('BFF public configuration', () => {
    it('serves APP_CONFIG without leaking backend credentials or service secrets', async () => {
        const { response, text } = await request('/config.js', { method: 'GET' });

        expect(response.status).toBe(200);
        expect(text).toContain('window.APP_CONFIG');
        expect(text).toContain('public-firebase-api-key');
        expect(text).toContain('public-site-key');
        expect(text).not.toContain('mulesoft-client-secret');
        expect(text).not.toMatch(/MULESOFT|CLIENT_SECRET|RECAPTCHA_API_KEY|PRIVATE_KEY|ACCESS_TOKEN|BEARER/i);
    });
});

describe('BFF browser-origin protections', () => {
    it('rejects protected OTP endpoints from unauthorized browser origins before calling Firebase or MuleSoft', async () => {
        const { response, data } = await request('/api/customer/otp/start-login', {
            origin: 'https://evil.example',
            body: { email: TEST_EMAIL, recaptchaToken: 'captcha-ok' },
        });

        expect(response.status).toBe(403);
        expect(data.error).toBe('Origen no autorizado para esta operación.');
        expect(firebaseAdminMock.auth.getUserByEmail).not.toHaveBeenCalled();
        expect(externalFetchMock).not.toHaveBeenCalled();
    });
});

describe('BFF login OTP integration', () => {
    it('runs the eligible email OTP login path through MS-2, MS-3 and custom token issuance', async () => {
        const sessionId = await startEligibleLogin();

        const ms2Call = findExternalCall('/customer/otp');
        expect(ms2Call).toBeTruthy();
        expect(getHeader(ms2Call.init, 'Authorization')).toBe('Bearer bearer-token');
        expect(getHeader(ms2Call.init, 'name')).toBe('IDP-MiETB');
        expect(ms2Call.body).toMatchObject({
            aplicacion: 'IDP-MiETB',
            tipo_canal: 'EMAIL',
            valor_canal: TEST_EMAIL,
            identificacion_cliente: '8739353211',
        });

        const validation = await request('/api/customer/otp/validate', {
            body: { sessionId, code: '123456', recaptchaToken: 'captcha-ok' },
        });

        expect(validation.response.status).toBe(200);
        expect(validation.data).toMatchObject({ success: true, maskedEmail: 've*******@yopmail.com' });
        expect(validation.data.verificationToken).toEqual(expect.any(String));

        const ms3Call = findExternalCall('/customer/otp/validation');
        expect(ms3Call).toBeTruthy();
        expect(ms3Call.body).toMatchObject({
            aplicacion: 'IDP-MiETB',
            tipo_canal: 'EMAIL',
            id_transaccion: 'tx-email-otp-1',
            codigo: '123456',
        });

        const complete = await request('/api/auth/login/complete', {
            body: {
                sessionId,
                verificationToken: validation.data.verificationToken,
            },
        });

        expect(complete.response.status).toBe(200);
        expect(complete.data).toEqual({ success: true, customToken: 'custom-token-otp' });
        expect(firebaseAdminMock.auth.createCustomToken).toHaveBeenCalledWith('uid-otp-1', {
            auth_level: 'otp_email_verified',
            login_method: 'miuso_email_otp',
        });
    });

    it('keeps non-eligible email sessions indistinguishable and never calls MuleSoft', async () => {
        firebaseAdminMock.auth.getUserByEmail.mockRejectedValue({ code: 'auth/user-not-found' });

        const started = await request('/api/customer/otp/start-login', {
            body: { email: TEST_EMAIL, recaptchaToken: 'captcha-ok' },
        });

        expect(started.response.status).toBe(200);
        expect(started.data).toMatchObject({ success: true, maskedEmail: 've*******@yopmail.com' });
        expect(externalFetchMock).not.toHaveBeenCalled();

        const validation = await request('/api/customer/otp/validate', {
            body: {
                sessionId: started.data.sessionId,
                code: '123456',
                recaptchaToken: 'captcha-ok',
            },
        });

        expect(validation.response.status).toBe(400);
        expect(validation.data.error).toContain('Código OTP incorrecto');
        expect(externalFetchMock).not.toHaveBeenCalled();
    });

    it('locks the session and disables resend after the configured number of invalid OTP attempts', async () => {
        const sessionId = await startEligibleLogin('locktest@yopmail.com');
        externalFetchMock.mockImplementation(async (input) => {
            const url = getRequestUrl(input);
            if (url === 'https://oauth.test/token') return jsonResponse({ access_token: 'bearer-token' });
            if (url === 'https://ms3.test/operations/v1/customer/otp/validation') {
                return jsonResponse({ error: 'invalid otp' }, 400);
            }
            if (url === 'https://ms2.test/operations/v1/customer/otp') {
                return jsonResponse({ id_transaccion: 'tx-email-otp-1' });
            }
            return jsonResponse({ error: `Unexpected external request: ${url}` }, 500);
        });

        const first = await request('/api/customer/otp/validate', {
            body: { sessionId, code: '111111', recaptchaToken: 'captcha-ok' },
        });
        const second = await request('/api/customer/otp/validate', {
            body: { sessionId, code: '222222', recaptchaToken: 'captcha-ok' },
        });
        const third = await request('/api/customer/otp/validate', {
            body: { sessionId, code: '333333', recaptchaToken: 'captcha-ok' },
        });
        const resend = await request('/api/customer/otp/send', {
            body: { sessionId, recaptchaToken: 'captcha-ok' },
        });

        expect(first.response.status).toBe(400);
        expect(second.response.status).toBe(400);
        expect(third.response.status).toBe(423);
        expect(third.data.error).toBe('Has superado los intentos permitidos. Por seguridad, intenta nuevamente en 2 horas.');
        expect(resend.response.status).toBe(423);
        expect(resend.data.error).toBe(third.data.error);
    });

    it('rejects completion when the verification token does not match the validated OTP session', async () => {
        const sessionId = await startEligibleLogin('tokencheck@yopmail.com');
        const validation = await request('/api/customer/otp/validate', {
            body: { sessionId, code: '123456', recaptchaToken: 'captcha-ok' },
        });

        expect(validation.response.status).toBe(200);

        const complete = await request('/api/auth/login/complete', {
            body: {
                sessionId,
                verificationToken: 'different-token',
            },
        });

        expect(complete.response.status).toBe(403);
        expect(complete.data.error).toBe('La validación de seguridad no está vigente. Solicita un nuevo código de acceso.');
        expect(firebaseAdminMock.auth.createCustomToken).not.toHaveBeenCalled();
    });
});

describe('BFF reCAPTCHA enforcement', () => {
    it('rejects OTP start when reCAPTCHA Enterprise returns an invalid assessment', async () => {
        process.env.RECAPTCHA_PROJECT_ID = 'identity-project';
        process.env.RECAPTCHA_SITE_KEY = 'server-site-key';
        process.env.RECAPTCHA_API_KEY = 'server-api-key';
        externalFetchMock.mockResolvedValueOnce(jsonResponse({
            tokenProperties: { valid: false, invalidReason: 'BROWSER_ERROR' },
            riskAnalysis: { score: 0.1 },
        }));

        const started = await request('/api/customer/otp/start-login', {
            body: { email: TEST_EMAIL, recaptchaToken: 'bad-captcha' },
        });

        expect(started.response.status).toBe(403);
        expect(started.data.error).toBe('Verificación de seguridad fallida.');
        expect(firebaseAdminMock.auth.getUserByEmail).not.toHaveBeenCalled();
        expect(findExternalCall('recaptchaenterprise.googleapis.com')).toBeTruthy();
    });
});
