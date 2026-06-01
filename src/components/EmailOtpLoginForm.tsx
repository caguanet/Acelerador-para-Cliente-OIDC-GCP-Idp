import { FormEvent, useEffect, useRef, useState } from 'react';
import { User, signInWithCustomToken } from 'firebase/auth';
import { auth } from '../firebase';
import { getRecaptchaToken } from '../utils/recaptcha';
import { EMAIL_REGEX } from '../utils/email';
import { getApiErrorMessage, getApiString, getSafeErrorMessage, readApiJson } from '../utils/apiJson';
import { getClientLockedUntil, isLockoutResponse, rememberClientLock } from '../utils/otpClientLock';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 30;

const GENERIC_START_MESSAGE = 'Si el correo corresponde a una cuenta habilitada, te enviamos un código de acceso.';
const START_ERROR = 'No pudimos iniciar el acceso por código. Inténtalo nuevamente en unos minutos.';
const VERIFY_ERROR = 'No pudimos validar el código. Revísalo o solicita uno nuevo.';
const RESEND_ERROR = 'No pudimos reenviar el código. Inténtalo nuevamente en unos minutos.';
const COMPLETE_ERROR = 'No pudimos completar el inicio de sesión. Solicita un nuevo código.';
const LOCKOUT_MESSAGE = 'Has superado los intentos permitidos. Por seguridad, intenta nuevamente en 2 horas.';

type Phase = 'EMAIL' | 'CODE';

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
    const [isLocked, setIsLocked] = useState(false);
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

        if (await getClientLockedUntil(email)) {
            setIsLocked(true);
            setError(LOCKOUT_MESSAGE);
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
                const message = getApiErrorMessage(data, START_ERROR);
                if (isLockoutResponse(response, message)) {
                    await rememberClientLock(email);
                    setIsLocked(true);
                    setResendCountdown(0);
                }
                throw new Error(message);
            }

            const nextSessionId = getApiString(data, 'sessionId');
            if (!nextSessionId) {
                throw new Error(START_ERROR);
            }

            setSessionId(nextSessionId);
            setMaskedEmail(getApiString(data, 'maskedEmail'));
            setCode('');
            setIsLocked(false);
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
        if (isLocked || resendCountdown > 0 || isLoading || !sessionId) return;
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
                const message = getApiErrorMessage(data, RESEND_ERROR);
                if (isLockoutResponse(response, message)) {
                    await rememberClientLock(email);
                    setIsLocked(true);
                    setResendCountdown(0);
                }
                throw new Error(message);
            }
            setCode('');
            setIsLocked(false);
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
        if (isLocked) {
            setError(LOCKOUT_MESSAGE);
            return;
        }
        if (!/^\d{6}$/.test(code)) {
            setError('Ingresa el código de 6 dígitos que recibiste por correo.');
            return;
        }

        setIsLoading(true);
        let failureFallback = VERIFY_ERROR;
        try {
            const recaptchaToken = await getRecaptchaToken('otp_validate');
            const validateResponse = await fetch('/api/customer/otp/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, code, recaptchaToken }),
            });
            const validateData = await readApiJson(validateResponse);
            if (!validateResponse.ok) {
                const message = getApiErrorMessage(validateData, VERIFY_ERROR);
                if (isLockoutResponse(validateResponse, message)) {
                    await rememberClientLock(email);
                    setIsLocked(true);
                    setResendCountdown(0);
                }
                throw new Error(message);
            }

            const verificationToken = getApiString(validateData, 'verificationToken');
            if (!verificationToken) {
                throw new Error(VERIFY_ERROR);
            }

            failureFallback = COMPLETE_ERROR;
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
            setError(getSafeErrorMessage(err, failureFallback));
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
        setIsLocked(false);
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
                        disabled={isLocked}
                        value={code}
                        onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH)); if (!isLocked) setError(''); }}
                        placeholder="••••••"
                    />
                </div>

                <button type="submit" disabled={isLocked || isLoading || code.length !== OTP_LENGTH} className="login-btn-primary">
                    {isLoading ? 'Verificando...' : 'Ingresar'}
                </button>
            </form>

            <div className="login-forgot">
                <button type="button" onClick={handleResend} disabled={isLocked || resendCountdown > 0 || isLoading}>
                    {isLocked ? 'Reenvío bloqueado' : resendCountdown > 0 ? `Reenviar código en ${resendCountdown}s` : 'Reenviar código'}
                </button>
            </div>

            <button type="button" onClick={goBackToEmail} className="otp-back-link">
                Usar otro correo
            </button>
        </div>
    );
}
