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
        MULESOFT_OAUTH_AUTHORIZATION_BEARER: 'oauth-bootstrap-token',
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

describe('BFF customer lookup integration', () => {
    beforeEach(() => {
        process.env.MULESOFT_BASE_URL_MS1 = 'https://ms1.test';
    });

    it('uses customer[0].contactData.email from MS-1 as the registered OTP destination', async () => {
        externalFetchMock.mockImplementation(async (input) => {
            const url = getRequestUrl(input);
            if (url === 'https://oauth.test/token') return jsonResponse({ access_token: 'bearer-token' });
            if (url.startsWith('https://ms1.test/v1/customer?')) {
                return jsonResponse({
                    codeResponse: '200',
                    responseMessage: 'La solicitud fue exitosa',
                    customer: [{
                        identityData: {
                            documentType: 'CC',
                            documentNumber: '3626608491',
                        },
                        contactData: {
                            email: 'abelardocorreo@yopmail.com',
                        },
                        eligibleForDigitalRegistration: true,
                    }],
                });
            }
            return jsonResponse({ error: `Unexpected external request: ${url}` }, 500);
        });

        const { response, data } = await request('/api/customer/lookup', {
            body: {
                customerType: 'HOGARES',
                docType: 'CC',
                docNumber: '3626608491',
                recaptchaToken: 'captcha-ok',
            },
        });

        expect(response.status).toBe(200);
        expect(data.sessionId).toEqual(expect.any(String));
        expect(data.maskedEmail).toBe('ab************@yopmail.com');

        const ms1Call = findExternalCall('/v1/customer');
        expect(ms1Call).toBeTruthy();
        expect(ms1Call.url).toContain('CUSTOMER_ID=3626608491');
        expect(ms1Call.url).toContain('CUSTOMER_ID_TYPE=CC');
    });

    it('anti-enumeration: MS-1 customer without contactData.email yields a generic 200 shadow session (no real OTP)', async () => {
        externalFetchMock.mockImplementation(async (input) => {
            const url = getRequestUrl(input);
            if (url === 'https://oauth.test/token') return jsonResponse({ access_token: 'bearer-token' });
            if (url.startsWith('https://ms1.test/v1/customer?')) {
                return jsonResponse({
                    codeResponse: '200',
                    customer: [{
                        contactData: {},
                        eligibleForDigitalRegistration: true,
                    }],
                });
            }
            return jsonResponse({ error: `Unexpected external request: ${url}` }, 500);
        });

        const { response, data } = await request('/api/customer/lookup', {
            body: {
                customerType: 'HOGARES',
                docType: 'CC',
                docNumber: '3626608491',
                recaptchaToken: 'captcha-ok',
            },
        });

        // Same 200 shape as an eligible customer — no distinguishable 404/403/422.
        expect(response.status).toBe(200);
        expect(data.sessionId).toEqual(expect.any(String));
        expect(data.maskedEmail).toMatch(/^[a-z0-9]{2}\*+@[\w.-]+$/i);

        // Shadow session: /otp/send responds generically WITHOUT ever calling MS-2.
        const send = await request('/api/customer/otp/send', {
            body: { sessionId: data.sessionId, recaptchaToken: 'captcha-ok' },
        });
        expect(send.response.status).toBe(200);
        expect(findExternalCall('/operations/v1/customer/otp')).toBeUndefined();

        // And the OTP can never validate for a shadow session.
        const validate = await request('/api/customer/otp/validate', {
            body: { sessionId: data.sessionId, code: '123456', recaptchaToken: 'captcha-ok' },
        });
        expect([400, 423]).toContain(validate.response.status);
    });

    it('anti-enumeration: MS-1 404 (not found) yields a generic 200 shadow session', async () => {
        externalFetchMock.mockImplementation(async (input) => {
            const url = getRequestUrl(input);
            if (url === 'https://oauth.test/token') return jsonResponse({ access_token: 'bearer-token' });
            if (url.startsWith('https://ms1.test/v1/customer?')) {
                return jsonResponse({ error: 'not found' }, 404);
            }
            return jsonResponse({ error: `Unexpected external request: ${url}` }, 500);
        });

        const { response, data } = await request('/api/customer/lookup', {
            body: {
                customerType: 'HOGARES',
                docType: 'CC',
                docNumber: '9999999999',
                recaptchaToken: 'captcha-ok',
            },
        });

        expect(response.status).toBe(200);
        expect(data.sessionId).toEqual(expect.any(String));
        expect(data.maskedEmail).toMatch(/^[a-z0-9]{2}\*+@[\w.-]+$/i);
    });
});

describe('BFF customer registration claims', () => {
    beforeEach(() => {
        process.env.MULESOFT_BASE_URL_MS1 = 'https://ms1.test';
        process.env.MULESOFT_ENABLE_MS4 = 'false';
    });

    it('stores and mints only documentType and documentNumber as Identity Platform claims', async () => {
        externalFetchMock.mockImplementation(async (input) => {
            const url = getRequestUrl(input);
            if (url === 'https://oauth.test/token') return jsonResponse({ access_token: 'bearer-token' });
            if (url.startsWith('https://ms1.test/v1/customer?')) {
                return jsonResponse({
                    codeResponse: '200',
                    customer: [{
                        contactData: { email: 'abelardocorreo@yopmail.com' },
                        eligibleForDigitalRegistration: true,
                    }],
                });
            }
            if (url === 'https://ms2.test/operations/v1/customer/otp') {
                return jsonResponse({ id_transaccion: 'tx-registration-otp-1' });
            }
            if (url === 'https://ms3.test/operations/v1/customer/otp/validation') {
                return jsonResponse({ codigo: '200' });
            }
            return jsonResponse({ error: `Unexpected external request: ${url}` }, 500);
        });

        firebaseAdminMock.auth.getUserByEmail.mockRejectedValue({ code: 'auth/user-not-found' });
        firebaseAdminMock.auth.createUser.mockResolvedValue({ uid: 'uid-registration-1' });

        const lookup = await request('/api/customer/lookup', {
            body: {
                customerType: 'HOGARES',
                docType: 'CC',
                docNumber: '3626608491',
                recaptchaToken: 'captcha-ok',
            },
        });
        expect(lookup.response.status).toBe(200);

        const send = await request('/api/customer/otp/send', {
            body: { sessionId: lookup.data.sessionId, recaptchaToken: 'captcha-ok' },
        });
        expect(send.response.status).toBe(200);

        const validation = await request('/api/customer/otp/validate', {
            body: {
                sessionId: lookup.data.sessionId,
                code: '181292',
                recaptchaToken: 'captcha-ok',
            },
        });
        expect(validation.response.status).toBe(200);

        const register = await request('/api/customers/register', {
            body: {
                sessionId: lookup.data.sessionId,
                verificationToken: validation.data.verificationToken,
                password: 'SecureQa123!',
                phoneNumber: '3000000000',
                acceptTerms: true,
                acceptDataPolicy: true,
            },
        });

        expect(register.response.status).toBe(200);
        expect(firebaseAdminMock.auth.setCustomUserClaims).toHaveBeenCalledWith('uid-registration-1', {
            documentType: 'CC',
            documentNumber: '3626608491',
        });
        expect(firebaseAdminMock.auth.createCustomToken).toHaveBeenCalledWith('uid-registration-1', {
            documentType: 'CC',
            documentNumber: '3626608491',
        });
    });
});

describe('BFF login OTP integration', () => {
    it('invalidates the cached MuleSoft token and retries once on a 401 from a service call', async () => {
        firebaseAdminMock.auth.getUserByEmail.mockResolvedValue({
            uid: 'uid-otp-1',
            disabled: false,
            customClaims: { documentType: 'CC', documentNumber: '8739353211' },
        });

        let tokenFetches = 0;
        let ms2Calls = 0;
        externalFetchMock.mockImplementation(async (input) => {
            const url = getRequestUrl(input);
            if (url === 'https://oauth.test/token') {
                tokenFetches += 1;
                return jsonResponse({ access_token: `bearer-token-${tokenFetches}` });
            }
            if (url === 'https://ms2.test/operations/v1/customer/otp') {
                ms2Calls += 1;
                return ms2Calls === 1
                    ? jsonResponse({ error: 'unauthorized' }, 401)
                    : jsonResponse({ id_transaccion: 'tx-retry' });
            }
            return jsonResponse({ error: `Unexpected external request: ${url}` }, 500);
        });

        const result = await request('/api/customer/otp/start-login', {
            body: { email: TEST_EMAIL, recaptchaToken: 'captcha-ok' },
        });

        expect(result.response.status).toBe(200);
        expect(ms2Calls).toBe(2);     // service call retried once after 401
        expect(tokenFetches).toBe(2); // cache invalidated → fresh token minted
    });

    it('runs the eligible email OTP login path through MS-2, MS-3 and custom token issuance', async () => {
        const sessionId = await startEligibleLogin();

        const oauthCall = findExternalCall('/token');
        expect(oauthCall).toBeTruthy();
        expect(getHeader(oauthCall.init, 'Authorization')).toBe('Bearer oauth-bootstrap-token');

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
            documentType: 'CC',
            documentNumber: '8739353211',
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

    it('does not persist an email lock from a shadow session, so a victim email cannot be locked out pre-auth', async () => {
        // Attacker drives a non-eligible (shadow) login for the victim email.
        firebaseAdminMock.auth.getUserByEmail.mockRejectedValue({ code: 'auth/user-not-found' });

        const started = await request('/api/customer/otp/start-login', {
            body: { email: TEST_EMAIL, recaptchaToken: 'captcha-ok' },
        });
        expect(started.response.status).toBe(200);
        const sessionId = started.data.sessionId;

        // Exhaust the attempt budget on the shadow session.
        await request('/api/customer/otp/validate', { body: { sessionId, code: '111111', recaptchaToken: 'captcha-ok' } });
        await request('/api/customer/otp/validate', { body: { sessionId, code: '222222', recaptchaToken: 'captcha-ok' } });
        const third = await request('/api/customer/otp/validate', { body: { sessionId, code: '333333', recaptchaToken: 'captcha-ok' } });
        expect(third.response.status).toBe(423); // session-level block (indistinguishable)

        // A fresh start-login for the same email must NOT be locked (no persistent email-key lock).
        const reStart = await request('/api/customer/otp/start-login', {
            body: { email: TEST_EMAIL, recaptchaToken: 'captcha-ok' },
        });
        expect(reStart.response.status).toBe(200);
        expect(reStart.data.success).toBe(true);
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

// H1: the MuleSoft mock/simulation path must never run in production. A misconfigured
// production deploy (missing MULESOFT_* vars) must fail closed (503), not fabricate an
// eligible customer or accept the hardcoded simulation OTP.
describe('BFF MuleSoft fail-closed in production (H1)', () => {
    const PROD_ENV_KEYS = ['NODE_ENV', 'MULESOFT_BASE_URL_MS1', 'RECAPTCHA_PROJECT_ID', 'RECAPTCHA_SITE_KEY', 'RECAPTCHA_API_KEY'];
    let savedEnv;

    beforeEach(() => {
        savedEnv = Object.fromEntries(PROD_ENV_KEYS.map((k) => [k, process.env[k]]));
    });

    afterEach(() => {
        for (const k of PROD_ENV_KEYS) {
            if (savedEnv[k] === undefined) delete process.env[k];
            else process.env[k] = savedEnv[k];
        }
    });

    it('returns 503 on lookup when required MuleSoft config is missing in production', async () => {
        process.env.NODE_ENV = 'production';
        delete process.env.MULESOFT_BASE_URL_MS1; // required var missing
        // Make reCAPTCHA pass so we reach the MuleSoft config gate (which is checked after).
        process.env.RECAPTCHA_PROJECT_ID = 'identity-project';
        process.env.RECAPTCHA_SITE_KEY = 'server-site-key';
        process.env.RECAPTCHA_API_KEY = 'server-api-key';

        const { response, data } = await request('/api/customer/lookup', {
            body: { customerType: 'HOGARES', docType: 'CC', docNumber: '3626608491', recaptchaToken: 'captcha-ok' },
        });

        expect(response.status).toBe(503);
        expect(data.error).toMatch(/no está disponible/i);
        // Crucially: no fabricated customer / no MS-1 call leaked an eligible session.
        expect(data.sessionId).toBeUndefined();
        expect(findExternalCall('/v1/customer')).toBeUndefined();
    });

    it('still allows the simulation mock path outside production (no MuleSoft config)', async () => {
        process.env.NODE_ENV = 'test';
        delete process.env.MULESOFT_BASE_URL_MS1; // triggers mock mode in non-prod

        const { response, data } = await request('/api/customer/lookup', {
            body: { customerType: 'HOGARES', docType: 'CC', docNumber: '3626608491', recaptchaToken: 'captcha-ok' },
        });

        expect(response.status).toBe(200);
        expect(data.sessionId).toEqual(expect.any(String));
        expect(data.maskedEmail).toContain('@');
    });
});

describe('BFF security headers and config hardening', () => {
    // L1: values injected into /config.js must be escaped so they cannot break out
    // of the inline <script> context.
    it('escapes </script> and angle brackets in /config.js (L1)', async () => {
        const original = process.env.OIDC_SCOPE;
        process.env.OIDC_SCOPE = 'openid</script><script>alert(1)</script>';
        try {
            const { response, text } = await request('/config.js', { method: 'GET' });
            expect(response.status).toBe(200);
            expect(text).not.toContain('</script>');
            expect(text).toContain('\\u003c');
        } finally {
            if (original === undefined) delete process.env.OIDC_SCOPE;
            else process.env.OIDC_SCOPE = original;
        }
    });

    // M2: enforcing CSP header is emitted only when CSP_ENFORCE is enabled.
    it('emits Content-Security-Policy only when CSP_ENFORCE=true (M2)', async () => {
        const original = process.env.CSP_ENFORCE;
        try {
            delete process.env.CSP_ENFORCE;
            const off = await request('/api/health', { method: 'GET' });
            expect(off.response.headers.get('content-security-policy')).toBeNull();

            process.env.CSP_ENFORCE = 'true';
            const on = await request('/api/health', { method: 'GET' });
            const csp = on.response.headers.get('content-security-policy');
            expect(csp).toBeTruthy();
            expect(csp).toContain("default-src 'self'");
            expect(csp).toContain('https://www.recaptcha.net');
        } finally {
            if (original === undefined) delete process.env.CSP_ENFORCE;
            else process.env.CSP_ENFORCE = original;
        }
    });

    // L3: registration endpoint is rate-limited (defense-in-depth). Isolated by a
    // unique X-Forwarded-For so the limiter counter does not bleed into other tests.
    it('rate-limits /api/customers/register after the configured max (L3)', async () => {
        const ip = '203.0.113.77';
        const max = Number(process.env.REGISTER_RATE_LIMIT_MAX || 10);
        let lastStatus = 0;
        for (let i = 0; i <= max; i++) {
            const { response } = await request('/api/customers/register', {
                headers: { 'x-forwarded-for': ip },
                body: {},
            });
            lastStatus = response.status;
        }
        expect(lastStatus).toBe(429);
    });
});
