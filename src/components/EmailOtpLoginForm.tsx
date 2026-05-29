import { FormEvent, useEffect, useRef, useState } from 'react';
import { User, signInWithCustomToken } from 'firebase/auth';
import { auth } from '../firebase';
import { getRecaptchaToken } from '../utils/recaptcha';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 30;

const GENERIC_START_MESSAGE = 'Si el correo corresponde a una cuenta habilitada, te enviamos un código de acceso.';
const START_ERROR = 'No pudimos iniciar el acceso por código. Inténtalo nuevamente en unos minutos.';
const VERIFY_ERROR = 'No pudimos validar el código. Revísalo o solicita uno nuevo.';
const RESEND_ERROR = 'No pudimos reenviar el código. Inténtalo nuevamente en unos minutos.';
const COMPLETE_ERROR = 'No pudimos completar el inicio de sesión. Solicita un nuevo código.';
const NETWORK_ERROR = 'No pudimos conectarnos. Revisa tu conexión a internet e inténtalo de nuevo.';

type Phase = 'EMAIL' | 'CODE';
type ApiJson = Record<string, unknown>;

interface EmailOtpLoginFormProps {
    onSignInSuccess: (user: User) => void;
    oidcContextRequired?: boolean;
    hasValidOidcContext?: boolean;
}

function validateEmail(email: string) {
    if (!email.trim()) return 'Ingresa tu correo electrónico.';
    if (!EMAIL_REGEX.test(email)) return 'Ingresa un correo electrónico válido.';
    return '';
}

async function readApiJson(response: Response): Promise<ApiJson | null> {
    if (response.status === 204 || response.status === 205) return null;
    try {
        const text = await response.text();
        if (!text.trim()) return null;
        const parsed = JSON.parse(text);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as ApiJson) : null;
    } catch {
        return null;
    }
}

function getApiString(data: ApiJson | null, key: string): string {
    const value = data?.[key];
    return typeof value === 'string' ? value : '';
}

function getSafeMessage(message: string, fallback: string): string {
    const clean = message.trim();
    if (!clean || clean.length > 180 || /failed|json|firebase:|auth\/|mulesoft|status|servidor|interno/i.test(clean)) {
        return fallback;
    }
    return clean;
}

function getApiErrorMessage(data: ApiJson | null, fallback: string): string {
    return getSafeMessage(getApiString(data, 'error'), fallback);
}

function getSafeErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof TypeError) return NETWORK_ERROR;
    if (error instanceof Error) return getSafeMessage(error.message, fallback);
    return fallback;
}

export function EmailOtpLoginForm({
    onSignInSuccess,
    oidcContextRequired = false,
    hasValidOidcContext = true,
}: EmailOtpLoginFormProps) {
    const [phase, setPhase] = useState<Phase>('EMAIL');
    const [email, setEmail] = useState('');
    const [maskedEmail, setMaskedEmail] = useState('');
    const [sessionId, setSessionId] = useState('');
    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const [resendCountdown, setResendCountdown] = useState(0);
    const codeInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (resendCountdown <= 0) return;
        const timer = setTimeout(() => setResendCountdown((s) => s - 1), 1000);
        return () => clearTimeout(timer);
    }, [resendCountdown]);

    useEffect(() => {
        if (phase === 'CODE') {
            requestAnimationFrame(() => codeInputRef.current?.focus());
        }
    }, [phase]);

    const handleStart = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');
        setInfo('');

        if (oidcContextRequired && !hasValidOidcContext) {
            setError('Acceso restringido: ingresa desde una aplicación autorizada para iniciar sesión.');
            return;
        }

        const validationError = validateEmail(email);
        if (validationError) {
            setError(validationError);
            return;
        }

        setIsLoading(true);
        try {
            const recaptchaToken = await getRecaptchaToken('otp_send');
            const response = await fetch('/api/customer/otp/start-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), recaptchaToken }),
            });

            const data = await readApiJson(response);
            if (!response.ok) {
                throw new Error(getApiErrorMessage(data, START_ERROR));
            }

            const nextSessionId = getApiString(data, 'sessionId');
            if (!nextSessionId) {
                throw new Error(START_ERROR);
            }

            setSessionId(nextSessionId);
            setMaskedEmail(getApiString(data, 'maskedEmail'));
            setCode('');
            setResendCountdown(RESEND_COOLDOWN);
            setInfo(GENERIC_START_MESSAGE);
            setPhase('CODE');
        } catch (err: unknown) {
            console.warn('No fue posible iniciar el acceso por código.', err);
            setError(getSafeErrorMessage(err, START_ERROR));
        } finally {
            setIsLoading(false);
        }
    };

    const handleResend = async () => {
        if (resendCountdown > 0 || isLoading || !sessionId) return;
        setError('');
        setIsLoading(true);
        try {
            const recaptchaToken = await getRecaptchaToken('otp_send');
            const response = await fetch('/api/customer/otp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, recaptchaToken }),
            });
            const data = await readApiJson(response);
            if (!response.ok) {
                throw new Error(getApiErrorMessage(data, RESEND_ERROR));
            }
            setCode('');
            setResendCountdown(RESEND_COOLDOWN);
            setInfo(GENERIC_START_MESSAGE);
            requestAnimationFrame(() => codeInputRef.current?.focus());
        } catch (err: unknown) {
            console.warn('No fue posible reenviar el código de acceso.', err);
            setError(getSafeErrorMessage(err, RESEND_ERROR));
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerify = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');
        if (!/^\d{6}$/.test(code)) {
            setError('Ingresa el código de 6 dígitos que recibiste por correo.');
            return;
        }

        setIsLoading(true);
        try {
            const validateResponse = await fetch('/api/customer/otp/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, code }),
            });
            const validateData = await readApiJson(validateResponse);
            if (!validateResponse.ok) {
                throw new Error(getApiErrorMessage(validateData, VERIFY_ERROR));
            }

            const verificationToken = getApiString(validateData, 'verificationToken');
            if (!verificationToken) {
                throw new Error(VERIFY_ERROR);
            }

            const completeResponse = await fetch('/api/auth/login/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, verificationToken }),
            });
            const completeData = await readApiJson(completeResponse);
            if (!completeResponse.ok) {
                throw new Error(getApiErrorMessage(completeData, COMPLETE_ERROR));
            }

            const customToken = getApiString(completeData, 'customToken');
            if (!customToken) {
                throw new Error(COMPLETE_ERROR);
            }

            const credential = await signInWithCustomToken(auth, customToken);
            onSignInSuccess(credential.user);
        } catch (err: unknown) {
            console.warn('No fue posible completar el acceso por código.', err);
            setError(getSafeErrorMessage(err, VERIFY_ERROR));
        } finally {
            setIsLoading(false);
        }
    };

    const goBackToEmail = () => {
        setPhase('EMAIL');
        setError('');
        setInfo('');
        setCode('');
        setSessionId('');
        setResendCountdown(0);
    };

    if (phase === 'EMAIL') {
        return (
            <div className="otp-login-panel">
                <p className="login-form-subtitle">
                    Ingresa el correo de tu cuenta ETB y te enviaremos un código de acceso de un solo uso.
                </p>

                {error && <div className="auth-alert error" role="alert">{error}</div>}

                <form onSubmit={handleStart} noValidate>
                    <div className="login-field">
                        <label htmlFor="otp-login-email" className="sr-only">Correo electrónico</label>
                        <input
                            id="otp-login-email"
                            name="email"
                            type="email"
                            autoComplete="username"
                            enterKeyHint="send"
                            required
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); setError(''); }}
                            placeholder="Correo electrónico"
                        />
                    </div>

                    <button type="submit" disabled={isLoading} className="login-btn-primary">
                        {isLoading ? 'Enviando...' : 'Enviar código de acceso'}
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div className="otp-login-panel">
            <p className="login-form-subtitle">
                Escribe el código de 6 dígitos que enviamos a <strong>{maskedEmail || 'tu correo'}</strong>.
            </p>

            {error && <div className="auth-alert error" role="alert">{error}</div>}
            {info && !error && <div className="auth-alert success" role="status">{info}</div>}

            <form onSubmit={handleVerify} noValidate>
                <div className="login-field">
                    <label htmlFor="otp-login-code" className="sr-only">Código de acceso</label>
                    <input
                        id="otp-login-code"
                        ref={codeInputRef}
                        name="otp"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        enterKeyHint="done"
                        maxLength={OTP_LENGTH}
                        required
                        value={code}
                        onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH)); setError(''); }}
                        placeholder="••••••"
                    />
                </div>

                <button type="submit" disabled={isLoading || code.length !== OTP_LENGTH} className="login-btn-primary">
                    {isLoading ? 'Verificando...' : 'Ingresar'}
                </button>
            </form>

            <div className="login-forgot">
                <button type="button" onClick={handleResend} disabled={resendCountdown > 0 || isLoading}>
                    {resendCountdown > 0 ? `Reenviar código en ${resendCountdown}s` : 'Reenviar código'}
                </button>
            </div>

            <button type="button" onClick={goBackToEmail} className="otp-back-link">
                Usar otro correo
            </button>
        </div>
    );
}
