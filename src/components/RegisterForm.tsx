import { useState, useEffect, useRef, KeyboardEvent, ClipboardEvent, FormEvent } from 'react';
import {
    FacebookAuthProvider,
    GoogleAuthProvider,
    OAuthProvider,
    linkWithPopup,
    signInWithCustomToken,
} from 'firebase/auth';
import { auth } from '../firebase';
import { getConfiguredRecaptchaSiteKey, getRecaptchaToken, loadRecaptchaEnterprise } from '../utils/recaptcha';

// ── Icons ─────────────────────────────────────────────────────────────────────
const EYE_ICON = (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
);
const EYE_OFF_ICON = (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" />
    </svg>
);
const CALENDAR_ICON = (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
);
const INFO_ICON = (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
);

// ── Constants ─────────────────────────────────────────────────────────────────
const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 30;
const OTP_EXPIRY_SECONDS = 5 * 60;
const PENDING_SOCIAL_PROVIDER_KEY = 'idp.pendingSocialProvider';
const emptyDigits = (): string[] => Array<string>(OTP_LENGTH).fill('');
const VERIFY_IDENTITY_ERROR = 'No pudimos verificar tus datos en este momento. Revisa la información e inténtalo nuevamente.';
const SEND_OTP_ERROR = 'No pudimos enviar el código de seguridad. Inténtalo nuevamente en unos minutos.';
const VERIFY_CODE_ERROR = 'No pudimos validar el código. Revísalo o solicita uno nuevo.';
const RESEND_OTP_ERROR = 'No pudimos reenviar el código. Inténtalo nuevamente en unos minutos.';
const COMPLETE_REGISTRATION_ERROR = 'No pudimos completar el registro. Inténtalo nuevamente en unos minutos.';
const NETWORK_ERROR = 'No pudimos conectarnos. Revisa tu conexión a internet e inténtalo de nuevo.';

type CustomerType = 'HOGARES' | 'MIPYMES';
type DocType = 'CC' | 'CE' | 'NIT' | 'TI' | 'PP';
type ApiJson = Record<string, unknown>;

/**
 * Hogares flow:  IDENTIFY → VERIFY → PASSWORD
 * MiPymes flow:  COMPANY  → LEGAL_REP → VERIFY → PASSWORD
 */
type RegisterStep = 'IDENTIFY' | 'COMPANY' | 'LEGAL_REP' | 'VERIFY' | 'PASSWORD';

function formatTime(s: number) {
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}

function checkPassword(pwd: string) {
    return {
        length: pwd.length >= 8,
        uppercase: /[A-Z]/.test(pwd),
        number: /[0-9]/.test(pwd),
        special: /[^A-Za-z0-9]/.test(pwd),
    };
}

function isValidPhoneNumber(value: string) {
    const digits = value.replace(/\D/g, '');
    return digits.length >= 7 && digits.length <= 15;
}

function getPendingSocialProvider(providerId: string | null) {
    switch (providerId) {
        case 'google.com':
            return new GoogleAuthProvider();
        case 'facebook.com':
            return new FacebookAuthProvider();
        case 'apple.com':
            return new OAuthProvider('apple.com');
        default:
            return null;
    }
}

async function readApiJson(response: Response): Promise<ApiJson | null> {
    if (response.status === 204 || response.status === 205) return null;

    try {
        if (typeof response.text === 'function') {
            const text = await response.text();
            if (!text.trim()) return null;

            try {
                const parsed = JSON.parse(text);
                return isApiJson(parsed) ? parsed : null;
            } catch (err) {
                console.warn('La API devolvió una respuesta que no es JSON válido.', {
                    status: response.status,
                    error: err,
                });
                return null;
            }
        }

        const parsed = await response.json();
        return isApiJson(parsed) ? parsed : null;
    } catch (err) {
        console.warn('No fue posible leer la respuesta JSON de la API.', {
            status: response.status,
            error: err,
        });
        return null;
    }
}

function isApiJson(value: unknown): value is ApiJson {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getApiString(data: ApiJson | null, key: string): string {
    const value = data?.[key];
    return typeof value === 'string' ? value : '';
}

function getApiErrorMessage(data: ApiJson | null, fallback: string): string {
    return getSafeDisplayMessage(getApiString(data, 'error'), fallback);
}

function getSafeErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof TypeError) return NETWORK_ERROR;
    if (error instanceof Error) return getSafeDisplayMessage(error.message, fallback);
    return fallback;
}

function getSafeDisplayMessage(message: string, fallback: string): string {
    const cleanMessage = message.trim();
    if (!cleanMessage || cleanMessage.length > 180 || looksTechnical(cleanMessage)) return fallback;
    return cleanMessage;
}

function looksTechnical(message: string): boolean {
    return /failed to execute|unexpected end of json|json input|syntaxerror|response\.json|firebase:|auth\/|returned status|stack trace|servidor|interno/i.test(message);
}

export interface RegisterFormProps {
    onRegisterSuccess: (user: any) => void;
    onGoToLogin: () => void;
}

export function RegisterForm({ onRegisterSuccess, onGoToLogin }: RegisterFormProps) {
    const [customerType, setCustomerType] = useState<CustomerType>('HOGARES');
    const [step, setStep] = useState<RegisterStep>('IDENTIFY');

    // ── Hogares: IDENTIFY ──────────────────────────────────────────────────────
    const [docType, setDocType] = useState<DocType>('CC');
    const [docNumber, setDocNumber] = useState('');
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [acceptDataPolicy, setAcceptDataPolicy] = useState(false);
    const [identifyError, setIdentifyError] = useState('');
    const [isIdentifying, setIsIdentifying] = useState(false);

    // ── MiPymes: COMPANY ───────────────────────────────────────────────────────
    const [companyDocType, setCompanyDocType] = useState<DocType>('NIT');
    const [companyDocNumber, setCompanyDocNumber] = useState('');
    const [companyError, setCompanyError] = useState('');
    const [isLookingUp, setIsLookingUp] = useState(false);

    // ── MiPymes: LEGAL_REP ────────────────────────────────────────────────────
    const [repDocType, setRepDocType] = useState<DocType>('CC');
    const [repDocNumber, setRepDocNumber] = useState('');
    const [repExpDate, setRepExpDate] = useState('');
    const [repLastName, setRepLastName] = useState('');
    const [legalRepError, setLegalRepError] = useState('');
    const [isSubmittingRep, setIsSubmittingRep] = useState(false);

    // ── Shared: password collected only after OTP validation ──────────────────
    const [password, setPassword] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // ── Resolved contact data (from API mock) ─────────────────────────────────
    const [maskedEmail, setMaskedEmail] = useState('');
    const [sessionId, setSessionId] = useState('');
    const [verificationToken, setVerificationToken] = useState('');

    // ── VERIFY ────────────────────────────────────────────────────────────────
    const [digits, setDigits] = useState<string[]>(emptyDigits());
    const [verifyError, setVerifyError] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [verifySuccess, setVerifySuccess] = useState(false);
    const [resendCountdown, setResendCountdown] = useState(0);
    const [expiryCountdown, setExpiryCountdown] = useState(0);
    const [isSending, setIsSending] = useState(false);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // ── Hogares: PASSWORD ─────────────────────────────────────────────────────
    const [passwordError, setPasswordError] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);

    // ── Timers ────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (resendCountdown <= 0) return;
        const id = setInterval(() => setResendCountdown(c => c - 1), 1000);
        return () => clearInterval(id);
    }, [resendCountdown]);

    useEffect(() => {
        const siteKey = getConfiguredRecaptchaSiteKey();
        if (!siteKey) return;

        loadRecaptchaEnterprise(siteKey).catch((err) => {
            console.warn('No fue posible precargar reCAPTCHA Enterprise.', err);
        });
    }, []);

    useEffect(() => {
        if (step !== 'VERIFY' || expiryCountdown <= 0) return;
        const id = setInterval(() => setExpiryCountdown(c => c - 1), 1000);
        return () => clearInterval(id);
    }, [step, expiryCountdown]);

    // Auto-submit OTP when complete
    const isCodeComplete = digits.every(d => d !== '');
    useEffect(() => {
        if (step !== 'VERIFY' || !isCodeComplete || isVerifying || verifySuccess) return;
        handleVerifyCode();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isCodeComplete, step]);

    // Auto-advance after OTP success
    useEffect(() => {
        if (!verifySuccess) return;
        if (auth.currentUser) return; // If already logged in via Custom Token, skip standard signup
        const t = setTimeout(() => {
            setStep('PASSWORD');
        }, 450);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [verifySuccess]);

    // Switch between customer types resets steps
    const handleCustomerTypeSwitch = (type: CustomerType) => {
        setCustomerType(type);
        setStep(type === 'HOGARES' ? 'IDENTIFY' : 'COMPANY');
        setIdentifyError(''); setCompanyError(''); setLegalRepError('');
    };

    // ── Shared OTP helpers ────────────────────────────────────────────────────
    const enterVerifyStep = () => {
        setDigits(emptyDigits());
        setResendCountdown(RESEND_COOLDOWN);
        setExpiryCountdown(OTP_EXPIRY_SECONDS);
        setVerifySuccess(false);
        setVerifyError('');
        setStep('VERIFY');
    };

    // ── HOGARES: IDENTIFY ─────────────────────────────────────────────────────
    const handleIdentify = async (e: FormEvent) => {
        e.preventDefault();
        setIdentifyError('');
        if (!docNumber.trim()) { setIdentifyError('Ingresa tu número de identificación.'); return; }
        if (!acceptTerms) { setIdentifyError('Debes aceptar los términos y condiciones.'); return; }
        if (!acceptDataPolicy) { setIdentifyError('Debes aceptar las políticas de tratamiento de datos.'); return; }
        setIsIdentifying(true);
        try {
            const lookupRecaptchaToken = await getRecaptchaToken('lookup');
            const response = await fetch('/api/customer/lookup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    docType,
                    docNumber,
                    recaptchaToken: lookupRecaptchaToken,
                    customerType: 'HOGARES',
                    acceptTerms,
                    acceptDataPolicy
                })
            });

            const data = await readApiJson(response);
            if (!response.ok) {
                throw new Error(getApiErrorMessage(data, VERIFY_IDENTITY_ERROR));
            }

            const nextSessionId = getApiString(data, 'sessionId');
            const nextMaskedEmail = getApiString(data, 'maskedEmail');
            if (!nextSessionId || !nextMaskedEmail) {
                throw new Error(VERIFY_IDENTITY_ERROR);
            }

            setSessionId(nextSessionId);
            setMaskedEmail(nextMaskedEmail);
            setVerificationToken('');

            // Send initial OTP automatically
            const otpRecaptchaToken = await getRecaptchaToken('otp_send');
            const sendResponse = await fetch('/api/customer/otp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: nextSessionId,
                    recaptchaToken: otpRecaptchaToken
                })
            });

            const sendData = await readApiJson(sendResponse);
            if (!sendResponse.ok) {
                throw new Error(getApiErrorMessage(sendData, SEND_OTP_ERROR));
            }

            enterVerifyStep();
        } catch (err: unknown) {
            console.warn('No fue posible iniciar el registro de Hogares.', err);
            setIdentifyError(getSafeErrorMessage(err, VERIFY_IDENTITY_ERROR));
        } finally {
            setIsIdentifying(false);
        }
    };

    const resetVerifiedSession = () => {
        setSessionId('');
        setVerificationToken('');
        setMaskedEmail('');
        setPhoneNumber('');
        setPassword('');
        setVerifySuccess(false);
        setVerifyError('');
        setDigits(emptyDigits());
        setExpiryCountdown(0);
        setResendCountdown(0);
    };

    // ── MIPYMES: COMPANY ──────────────────────────────────────────────────────
    const handleCompanyLookup = async (e: FormEvent) => {
        e.preventDefault();
        setCompanyError('');
        if (!companyDocNumber.trim()) { setCompanyError('Ingresa el número de identificación de la empresa.'); return; }
        resetVerifiedSession();
        setIsLookingUp(true);
        try {
            await new Promise(r => setTimeout(r, 800));
            // Simulated: company found → advance to legal rep form
            setStep('LEGAL_REP');
        } catch (err: any) {
            setCompanyError(err.message || 'No se encontró la empresa. Verifica los datos.');
        } finally {
            setIsLookingUp(false);
        }
    };

    // ── MIPYMES: LEGAL_REP ────────────────────────────────────────────────────
    const handleLegalRepSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLegalRepError('');
        if (!repDocNumber.trim()) { setLegalRepError('Ingresa el número de identificación del representante legal.'); return; }
        if (!repExpDate) { setLegalRepError('Ingresa la fecha de expedición del documento.'); return; }
        if (!repLastName.trim()) { setLegalRepError('Ingresa el apellido del representante legal.'); return; }
        if (!acceptTerms) { setLegalRepError('Debes aceptar los términos y condiciones.'); return; }
        if (!acceptDataPolicy) { setLegalRepError('Debes aceptar las políticas de tratamiento de datos.'); return; }
        setIsSubmittingRep(true);
        try {
            const lookupRecaptchaToken = await getRecaptchaToken('lookup');
            const response = await fetch('/api/customer/lookup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyDocType,
                    companyDocNumber,
                    repDocType,
                    repDocNumber,
                    lastName: repLastName,
                    recaptchaToken: lookupRecaptchaToken,
                    customerType: 'MIPYMES',
                    acceptTerms,
                    acceptDataPolicy
                })
            });

            const data = await readApiJson(response);
            if (!response.ok) {
                throw new Error(getApiErrorMessage(data, VERIFY_IDENTITY_ERROR));
            }

            const nextSessionId = getApiString(data, 'sessionId');
            const nextMaskedEmail = getApiString(data, 'maskedEmail');
            if (!nextSessionId || !nextMaskedEmail) {
                throw new Error(VERIFY_IDENTITY_ERROR);
            }

            setSessionId(nextSessionId);
            setMaskedEmail(nextMaskedEmail);

            // Send initial OTP automatically
            const otpRecaptchaToken = await getRecaptchaToken('otp_send');
            const sendResponse = await fetch('/api/customer/otp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: nextSessionId,
                    recaptchaToken: otpRecaptchaToken
                })
            });

            const sendData = await readApiJson(sendResponse);
            if (!sendResponse.ok) {
                throw new Error(getApiErrorMessage(sendData, SEND_OTP_ERROR));
            }

            enterVerifyStep();
        } catch (err: unknown) {
            console.warn('No fue posible iniciar el registro de MiPymes.', err);
            setLegalRepError(getSafeErrorMessage(err, VERIFY_IDENTITY_ERROR));
        } finally {
            setIsSubmittingRep(false);
        }
    };

    // ── VERIFY ────────────────────────────────────────────────────────────────
    const handleDigitChange = (index: number, value: string) => {
        const char = value.replace(/\D/g, '').slice(-1);
        const next = [...digits];
        next[index] = char;
        setDigits(next);
        setVerifyError('');
        if (char && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
    };

    const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !digits[index] && index > 0) inputRefs.current[index - 1]?.focus();
    };

    const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
        if (!pasted) return;
        const next = emptyDigits();
        pasted.split('').forEach((ch, i) => { next[i] = ch; });
        setDigits(next);
        inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
    };

    const handleVerifyCode = async (e?: FormEvent) => {
        e?.preventDefault();
        if (!isCodeComplete || verifySuccess) return;
        setVerifyError('');
        setIsVerifying(true);
        try {
            const otpRecaptchaToken = await getRecaptchaToken('otp_validate');
            const response = await fetch('/api/customer/otp/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    code: digits.join(''),
                    recaptchaToken: otpRecaptchaToken
                })
            });

            const data = await readApiJson(response);
            if (!response.ok) {
                throw new Error(getApiErrorMessage(data, VERIFY_CODE_ERROR));
            }

            const nextVerificationToken = getApiString(data, 'verificationToken');
            if (!nextVerificationToken) {
                throw new Error(VERIFY_CODE_ERROR);
            }

            setVerificationToken(nextVerificationToken);
            setVerifySuccess(true);
        } catch (err: unknown) {
            console.warn('No fue posible validar el código OTP.', err);
            setVerifyError(getSafeErrorMessage(err, VERIFY_CODE_ERROR));
        } finally {
            setIsVerifying(false);
        }
    };

    const handleResend = async () => {
        if (resendCountdown > 0 || isSending) return;
        setIsSending(true);
        try {
            const otpRecaptchaToken = await getRecaptchaToken('otp_send');
            const response = await fetch('/api/customer/otp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    recaptchaToken: otpRecaptchaToken
                })
            });

            const data = await readApiJson(response);
            if (!response.ok) {
                throw new Error(getApiErrorMessage(data, RESEND_OTP_ERROR));
            }

            setDigits(emptyDigits());
            setResendCountdown(RESEND_COOLDOWN);
            setExpiryCountdown(OTP_EXPIRY_SECONDS);
            setVerifyError('');
            requestAnimationFrame(() => inputRefs.current[0]?.focus());
        } catch (err: unknown) {
            console.warn('No fue posible reenviar el código OTP.', err);
            setVerifyError(getSafeErrorMessage(err, RESEND_OTP_ERROR));
        } finally {
            setIsSending(false);
        }
    };

    const completeRegistrationWithBff = async (nextPassword: string) => {
        const response = await fetch('/api/customers/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId,
                verificationToken,
                password: nextPassword,
                phoneNumber,
                acceptTerms,
                acceptDataPolicy
            })
        });

        const data = await readApiJson(response);
        if (!response.ok) {
            throw new Error(getApiErrorMessage(data, COMPLETE_REGISTRATION_ERROR));
        }

        const customToken = getApiString(data, 'customToken');
        if (!customToken) {
            throw new Error(COMPLETE_REGISTRATION_ERROR);
        }

        const cred = await signInWithCustomToken(auth, customToken);
        const pendingProviderId = window.sessionStorage.getItem(PENDING_SOCIAL_PROVIDER_KEY);
        const pendingProvider = getPendingSocialProvider(pendingProviderId);
        if (pendingProvider) {
            try {
                await linkWithPopup(cred.user, pendingProvider);
                window.sessionStorage.removeItem(PENDING_SOCIAL_PROVIDER_KEY);
            } catch (err) {
                console.warn('No fue posible vincular el proveedor social pendiente.', err);
            }
        }
        onRegisterSuccess(cred.user);
    };

    // ── PASSWORD: final registration for both customer types ──────────────────
    const handleCompleteRegistration = async (e: FormEvent) => {
        e.preventDefault();
        setPasswordError('');
        if (!verificationToken) { setPasswordError('La validación OTP no está vigente. Solicita un nuevo código.'); return; }
        if (!isValidPhoneNumber(phoneNumber)) { setPasswordError('Ingresa un número de teléfono válido.'); return; }
        if (!Object.values(checkPassword(password)).every(Boolean)) {
            setPasswordError('La contraseña no cumple todos los requisitos de seguridad.');
            return;
        }
        setIsRegistering(true);
        try {
            await completeRegistrationWithBff(password);
        } catch (err: unknown) {
            console.warn('No fue posible completar el registro.', err);
            setPasswordError(getSafeErrorMessage(err, COMPLETE_REGISTRATION_ERROR));
        } finally {
            setIsRegistering(false);
        }
    };

    // ── Shared: customer type tabs (shown on IDENTIFY and COMPANY steps) ──────
    const CustomerTabs = ({ showOnStep }: { showOnStep: RegisterStep }) => (
        step === showOnStep ? (
            <div className="reg-customer-tabs" role="tablist" aria-label="Tipo de cliente">
                <button type="button" role="tab" aria-selected={customerType === 'HOGARES'}
                    className={`reg-customer-tab${customerType === 'HOGARES' ? ' reg-customer-tab--active' : ''}`}
                    onClick={() => handleCustomerTypeSwitch('HOGARES')}>Hogares</button>
                <button type="button" role="tab" aria-selected={customerType === 'MIPYMES'}
                    className={`reg-customer-tab${customerType === 'MIPYMES' ? ' reg-customer-tab--active' : ''}`}
                    onClick={() => handleCustomerTypeSwitch('MIPYMES')}>MiPymes</button>
            </div>
        ) : null
    );

    const pwdChecks = checkPassword(password);
    const allPwdOk = Object.values(pwdChecks).every(Boolean);
    const phoneOk = isValidPhoneNumber(phoneNumber);

    // ══════════════════════════════════════════════
    // RENDER: HOGARES — IDENTIFY
    // ══════════════════════════════════════════════
    if (step === 'IDENTIFY') {
        return (
            <div className="login-form">
                <h2 className="login-form-title">Crea tu cuenta</h2>
                <p className="login-form-subtitle">Si ya eres cliente, regístrate ahora y accede a tus servicios</p>
                <CustomerTabs showOnStep="IDENTIFY" />

                <form onSubmit={handleIdentify} noValidate>
                    <div className="reg-row">
                        <div className="reg-floating-field reg-field-tipo">
                            <label htmlFor="reg-doc-type" className="sr-only">Tipo de documento</label>
                            <select id="reg-doc-type" value={docType} onChange={e => setDocType(e.target.value as DocType)}
                                className="reg-floating-select">
                                <option value="CC">CC</option><option value="CE">CE</option>
                                <option value="NIT">NIT</option><option value="TI">TI</option><option value="PP">PP</option>
                            </select>
                        </div>
                        <div className="reg-floating-field reg-field-num">
                            <label htmlFor="reg-doc-number" className="sr-only">N° de identificación</label>
                            <input id="reg-doc-number" type="text" inputMode="numeric"
                                value={docNumber} onChange={e => setDocNumber(e.target.value)}
                                className="reg-floating-input"
                                placeholder="N° de identificación" autoComplete="off" />
                        </div>
                    </div>

                    <label className="reg-checkbox-row">
                        <input type="checkbox" checked={acceptTerms} onChange={e => setAcceptTerms(e.target.checked)} />
                        <span>Acepto los <button type="button" className="reg-link">términos y condiciones</button></span>
                    </label>
                    <label className="reg-checkbox-row">
                        <input type="checkbox" checked={acceptDataPolicy} onChange={e => setAcceptDataPolicy(e.target.checked)} />
                        <span>Acepto las <button type="button" className="reg-link">políticas de tratamiento</button> de mis datos</span>
                    </label>

                    {identifyError && <div className="auth-alert error" role="alert">{identifyError}</div>}

                    <button type="submit" disabled={isIdentifying} className="login-btn-primary">
                        {isIdentifying ? 'Verificando\u2026' : 'Crear cuenta'}
                    </button>
                </form>

                <button type="button" onClick={onGoToLogin} className="otp-back-link" style={{ marginTop: '0.5rem' }}>
                    Regresar al inicio
                </button>
            </div>
        );
    }

    // ══════════════════════════════════════════════
    // RENDER: MIPYMES — COMPANY LOOKUP
    // ══════════════════════════════════════════════
    if (step === 'COMPANY') {
        return (
            <div className="login-form">
                <h2 className="login-form-title">Crea tu cuenta</h2>
                <p className="login-form-subtitle">Si ya eres cliente, regístrate ahora y accede a tus servicios</p>
                <CustomerTabs showOnStep="COMPANY" />

                <form onSubmit={handleCompanyLookup} noValidate>
                    <div className="reg-row">
                        <div className="reg-floating-field reg-field-tipo">
                            <select id="reg-company-doc-type" value={companyDocType}
                                onChange={e => setCompanyDocType(e.target.value as DocType)}
                                className="reg-floating-select" aria-label="Tipo de identificación empresa">
                                <option value="NIT">NIT</option><option value="CC">CC</option>
                                <option value="CE">CE</option><option value="TI">TI</option><option value="PP">PP</option>
                            </select>
                            <label htmlFor="reg-company-doc-type" className="reg-floating-label reg-floating-label--select">Tipo</label>
                        </div>
                        <div className="reg-floating-field reg-field-num">
                            <label htmlFor="reg-company-doc-number" className="sr-only">N° de identificación de empresa</label>
                            <input id="reg-company-doc-number" type="text" inputMode="numeric"
                                value={companyDocNumber} onChange={e => setCompanyDocNumber(e.target.value)}
                                className="reg-floating-input"
                                placeholder="N° de identificación de empresa" autoComplete="off" />
                        </div>
                    </div>

                    {companyError && <div className="auth-alert error" role="alert">{companyError}</div>}

                    <button type="submit" disabled={isLookingUp || !companyDocNumber.trim()} className="login-btn-primary">
                        {isLookingUp ? 'Buscando\u2026' : 'Continuar'}
                    </button>
                </form>

                <button type="button" onClick={onGoToLogin} className="otp-back-link" style={{ marginTop: '0.5rem' }}>
                    Regresar al inicio
                </button>
            </div>
        );
    }

    // ══════════════════════════════════════════════
    // RENDER: MIPYMES — LEGAL REP FORM
    // ══════════════════════════════════════════════
    if (step === 'LEGAL_REP') {
        return (
            <div className="login-form">
                <h2 className="login-form-title">Crea tu cuenta</h2>
                <p className="login-form-subtitle">Si ya eres cliente, regístrate ahora y accede a tus servicios</p>
                <CustomerTabs showOnStep="LEGAL_REP" />

                <form onSubmit={handleLegalRepSubmit} noValidate>
                    {/* Empresa (locked) */}
                    <div className="reg-row">
                        <div className="reg-floating-field reg-field-tipo">
                            <select disabled className="reg-floating-select reg-floating-select--disabled" aria-label="Tipo empresa">
                                <option value={companyDocType}>{companyDocType}</option>
                            </select>
                            <label className="reg-floating-label reg-floating-label--select">Tipo</label>
                        </div>
                        <div className="reg-floating-field reg-field-num">
                            <label className="sr-only">N° de identificación de empresa</label>
                            <input type="text" value={companyDocNumber} disabled
                                className="reg-floating-input reg-floating-input--disabled"
                                placeholder="N° de identificación de empresa" />
                        </div>
                    </div>

                    {/* Representante legal doc */}
                    <div className="reg-row">
                        <div className="reg-floating-field reg-field-tipo">
                            <select id="reg-rep-doc-type" value={repDocType}
                                onChange={e => setRepDocType(e.target.value as DocType)}
                                className="reg-floating-select" aria-label="Tipo doc representante">
                                <option value="CC">CC</option><option value="CE">CE</option>
                                <option value="NIT">NIT</option><option value="TI">TI</option><option value="PP">PP</option>
                            </select>
                            <label htmlFor="reg-rep-doc-type" className="reg-floating-label reg-floating-label--select">Tipo</label>
                        </div>
                        <div className="reg-floating-field reg-field-num">
                            <label htmlFor="reg-rep-doc-number" className="sr-only">N° de identificación de representante legal</label>
                            <input id="reg-rep-doc-number" type="text" inputMode="numeric"
                                value={repDocNumber} onChange={e => setRepDocNumber(e.target.value)}
                                className="reg-floating-input"
                                placeholder="N° de identificación" autoComplete="off" />
                        </div>
                    </div>

                    {/* Fecha de expedición */}
                    <div className="reg-floating-field">
                        <label htmlFor="reg-rep-exp-date" className="sr-only">Fecha de expedición de tu documento</label>
                        <input id="reg-rep-exp-date" type="date"
                            value={repExpDate} onChange={e => setRepExpDate(e.target.value)}
                            className="reg-floating-input reg-floating-input--with-icon"
                            autoComplete="off" />
                        <span className="reg-field-icon">{CALENDAR_ICON}</span>
                    </div>

                    {/* Apellido representante */}
                    <div className="reg-floating-field">
                        <label htmlFor="reg-rep-last-name" className="sr-only">Apellido del representante legal</label>
                        <input id="reg-rep-last-name" type="text"
                            value={repLastName} onChange={e => setRepLastName(e.target.value)}
                            className="reg-floating-input"
                            placeholder="Apellido del representante legal" autoComplete="family-name" />
                    </div>

                    {/* Terms */}
                    <label className="reg-checkbox-row">
                        <input type="checkbox" checked={acceptTerms} onChange={e => setAcceptTerms(e.target.checked)} />
                        <span>Acepto los <button type="button" className="reg-link">términos y condiciones</button></span>
                    </label>
                    <label className="reg-checkbox-row">
                        <input type="checkbox" checked={acceptDataPolicy} onChange={e => setAcceptDataPolicy(e.target.checked)} />
                        <span>Acepto las <button type="button" className="reg-link">políticas de tratamiento</button> de mis datos</span>
                    </label>

                    {legalRepError && <div className="auth-alert error" role="alert">{legalRepError}</div>}

                    <button type="submit" disabled={isSubmittingRep} className="login-btn-primary">
                        {isSubmittingRep ? 'Procesando\u2026' : 'Crear cuenta'}
                    </button>
                </form>

                <button type="button" onClick={() => setStep('COMPANY')} className="otp-back-link" style={{ marginTop: '0.5rem' }}>
                    Regresar
                </button>
            </div>
        );
    }

    // ══════════════════════════════════════════════
    // RENDER: VERIFY (both flows)
    // ══════════════════════════════════════════════
    if (step === 'VERIFY') {
        return (
            <div className="login-form">
                <h2 className="login-form-title" style={{ textAlign: 'center' }}>Verifica tu cuenta</h2>
                <p className="reg-verify-desc">
                    Te hemos enviado un código de verificación para completar tu registro<br />
                    Correo: <strong className="reg-contact-highlight">{maskedEmail}</strong><br />
                    Por favor, ingresa el código de {OTP_LENGTH} dígitos.
                </p>

                <form onSubmit={handleVerifyCode} noValidate>
                    <div className="otp-boxes" role="group" aria-label="Código de verificación">
                        {digits.map((digit, i) => (
                            <input key={i} ref={el => { inputRefs.current[i] = el; }}
                                type="text" inputMode="numeric" maxLength={1}
                                value={digit}
                                onChange={e => handleDigitChange(i, e.target.value)}
                                onKeyDown={e => handleKeyDown(i, e)}
                                onPaste={i === 0 ? handlePaste : undefined}
                                className={`otp-box${digit ? ' otp-box--filled' : ''}${verifySuccess ? ' otp-box--success' : ''}`}
                                aria-label={`Dígito ${i + 1}`} autoComplete="one-time-code" readOnly={verifySuccess} />
                        ))}
                    </div>

                    {verifySuccess ? (
                        <div className="reg-verify-success" role="status">
                            <span className="reg-verify-success-icon" aria-hidden="true">✓</span>
                            <div><strong>Éxito</strong><p>Código verificado correctamente...</p></div>
                        </div>
                    ) : verifyError ? (
                        <div className="auth-alert error" role="alert">{verifyError}</div>
                    ) : null}

                    <button type="submit" disabled={!isCodeComplete || isVerifying || verifySuccess} className="login-btn-primary">
                        {isVerifying ? 'Verificando\u2026' : 'Verificar Código'}
                    </button>
                </form>

                <button type="button" onClick={handleResend} disabled={resendCountdown > 0 || isSending} className="otp-btn-secondary">
                    {isSending ? 'Reenviando\u2026' : resendCountdown > 0 ? `Reenviar en ${resendCountdown}s` : 'Reenviar Código'}
                </button>

                {expiryCountdown > 0 && !verifySuccess && (
                    <div className="reg-expiry-badge" aria-live="polite">
                        Este código expira en <strong>{formatTime(expiryCountdown)}</strong>
                    </div>
                )}

                <button type="button"
                    onClick={() => {
                        resetVerifiedSession();
                        setStep(customerType === 'HOGARES' ? 'IDENTIFY' : 'LEGAL_REP');
                    }}
                    className="otp-back-link">
                    ← Volver al registro
                </button>

                <p className="reg-support-text">
                    ¿Tienes inconvenientes?<br />
                    Comunícate al <strong>601 377 7777</strong>
                </p>
            </div>
        );
    }

    // ══════════════════════════════════════════════
    // RENDER: PASSWORD (final step for both flows)
    // ══════════════════════════════════════════════
    return (
        <div className="login-form">
            <form onSubmit={handleCompleteRegistration} noValidate>
                <h2 className="login-form-title" style={{ textAlign: 'center' }}>Completa tu registro</h2>

                {customerType === 'MIPYMES' && (
                    <div className="reg-row">
                        <div className="reg-floating-field reg-field-tipo">
                            <label htmlFor="reg-final-company-doc-type" className="sr-only">Tipo de documento de empresa validado</label>
                            <input id="reg-final-company-doc-type" type="text"
                                value={companyDocType}
                                readOnly
                                className="reg-floating-input reg-floating-input--disabled"
                                aria-readonly="true" />
                        </div>
                        <div className="reg-floating-field reg-field-num">
                            <label htmlFor="reg-final-company-doc-number" className="sr-only">Número de identificación de empresa validado</label>
                            <input id="reg-final-company-doc-number" type="text"
                                value={companyDocNumber}
                                readOnly
                                className="reg-floating-input reg-floating-input--disabled"
                                aria-readonly="true" />
                        </div>
                    </div>
                )}

                <div className="reg-row">
                    <div className="reg-floating-field reg-field-tipo">
                        <label htmlFor="reg-final-doc-type" className="sr-only">
                            {customerType === 'MIPYMES' ? 'Tipo de documento de representante validado' : 'Tipo de documento validado'}
                        </label>
                        <input id="reg-final-doc-type" type="text"
                            value={customerType === 'MIPYMES' ? repDocType : docType}
                            readOnly
                            className="reg-floating-input reg-floating-input--disabled"
                            aria-readonly="true" />
                    </div>
                    <div className="reg-floating-field reg-field-num">
                        <label htmlFor="reg-final-doc-number" className="sr-only">
                            {customerType === 'MIPYMES' ? 'Número de identificación de representante validado' : 'Número de identificación validado'}
                        </label>
                        <input id="reg-final-doc-number" type="text"
                            value={customerType === 'MIPYMES' ? repDocNumber : docNumber}
                            readOnly
                            className="reg-floating-input reg-floating-input--disabled"
                            aria-readonly="true" />
                    </div>
                </div>

                <div className="reg-floating-field">
                    <label htmlFor="reg-final-email" className="sr-only">Correo registrado</label>
                    <input id="reg-final-email" type="email"
                        value={maskedEmail}
                        readOnly
                        className="reg-floating-input reg-floating-input--disabled"
                        placeholder="Correo registrado" autoComplete="email"
                        aria-readonly="true" />
                </div>

                <div className="reg-floating-field">
                    <label htmlFor="reg-final-phone" className="sr-only">Número de teléfono</label>
                    <input id="reg-final-phone" type="tel" inputMode="tel"
                        value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)}
                        className="reg-floating-input"
                        placeholder="Número de teléfono" autoComplete="tel" />
                </div>

                <div className="reg-floating-field">
                    <label htmlFor="reg-final-password" className="sr-only">Contraseña</label>
                    <input id="reg-final-password" type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password" spellCheck={false}
                        value={password} onChange={e => setPassword(e.target.value)}
                        className="reg-floating-input reg-floating-input--with-toggle"
                        placeholder="Contraseña" />
                    <button type="button" className="reg-password-toggle"
                        onClick={() => setShowPassword(v => !v)}
                        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                        {showPassword ? EYE_OFF_ICON : EYE_ICON}
                    </button>
                </div>

                <ul className="reg-pwd-requirements" aria-label="Requisitos de contraseña">
                    <li className={pwdChecks.length ? 'reg-req--ok' : ''}>Al menos 8 caracteres</li>
                    <li className={pwdChecks.uppercase ? 'reg-req--ok' : ''}>Al menos 1 mayúscula</li>
                    <li className={pwdChecks.number ? 'reg-req--ok' : ''}>Al menos 1 número</li>
                    <li className={pwdChecks.special ? 'reg-req--ok' : ''}>Al menos 1 caracter especial</li>
                </ul>

                <div className="reg-info-box">
                    {INFO_ICON}
                    <p>Esta contraseña te permitirá acceder a servicios de entretenimiento como plataformas OTT y disfrutar de nuestro servicio de Chat de Luz cuando lo necesites.</p>
                </div>

                {passwordError && <div className="auth-alert error" role="alert">{passwordError}</div>}

                <button type="submit" disabled={isRegistering || !allPwdOk || !phoneOk || !verificationToken} className="login-btn-primary">
                    {isRegistering ? 'Registrando\u2026' : 'Completar registro'}
                </button>
            </form>
        </div>
    );
}
