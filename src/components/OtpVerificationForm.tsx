import { useState, useEffect, useRef, KeyboardEvent, ClipboardEvent } from 'react';

// ── Hoisted static icons ─────────────────────────────────────────────────────
const GOOGLE_ICON = (
    <svg aria-hidden="true" width="22" height="22" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
        <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.341,43.611,20.083z"/>
        <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
        <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
        <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.341,43.611,20.083z"/>
    </svg>
);

const FACEBOOK_ICON = (
    <svg aria-hidden="true" width="22" height="22" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
);

const APPLE_ICON = (
    <svg aria-hidden="true" width="22" height="22" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 814 1000">
        <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.7 0 663 0 541.8c0-194.3 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/>
    </svg>
);

// ── Constants ─────────────────────────────────────────────────────────────────
const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 30; // seconds
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const emptyDigits = (): string[] => Array<string>(OTP_LENGTH).fill('');

function maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return email;
    const visible = local.slice(0, 2);
    const masked = '*'.repeat(Math.max(local.length - 2, 5));
    return `${visible}${masked}@${domain}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────
type OtpStep = 'EMAIL' | 'CODE' | 'SUCCESS';

export interface OtpVerificationFormProps {
    /** Sends the OTP code to the given email. Throw to display an error. */
    onSendCode: (email: string) => Promise<void>;
    /** Verifies the submitted OTP code. Throw to display an error. */
    onVerifyCode: (email: string, code: string) => Promise<void>;
    /** Called after the success screen's "Continuar" action. */
    onSuccess?: () => void;
    /** Social sign-in shortcuts (optional) */
    onSignInWithGoogle?: () => Promise<void>;
    onSignInWithFacebook?: () => Promise<void>;
    onSignInWithApple?: () => Promise<void>;
    /** Called when the user clicks "Regístrate" */
    onGoToRegister?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function OtpVerificationForm({
    onSendCode,
    onVerifyCode,
    onSuccess,
    onSignInWithGoogle,
    onSignInWithFacebook,
    onSignInWithApple,
    onGoToRegister,
}: OtpVerificationFormProps) {
    const [step, setStep] = useState<OtpStep>('EMAIL');
    const [email, setEmail] = useState('');
    const [digits, setDigits] = useState<string[]>(emptyDigits);
    const [alert, setAlert] = useState<{ type: 'error' | 'info'; msg: string } | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [recaptchaOk, setRecaptchaOk] = useState(false);

    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // ── Countdown timer for resend ────────────────────────────────────────────
    useEffect(() => {
        if (countdown <= 0) return;
        const id = setInterval(() => setCountdown(c => c - 1), 1000);
        return () => clearInterval(id);
    }, [countdown]);

    // ── Helpers ───────────────────────────────────────────────────────────────
    const code = digits.join('');
    const isCodeComplete = digits.every(d => d !== '');

    const clearMessages = () => setAlert(null);

    // ── Auto-submit when all digits are filled ────────────────────────────────
    useEffect(() => {
        if (step !== 'CODE' || !isCodeComplete || isVerifying) return;
        handleVerify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isCodeComplete, step]);

    // ── EMAIL step handlers ───────────────────────────────────────────────────
    const handleSendCode = async (e: React.FormEvent) => {
        e.preventDefault();
        clearMessages();

        if (!email.trim()) { setAlert({ type: 'error', msg: 'Por favor ingresa tu correo electrónico.' }); return; }
        if (!EMAIL_REGEX.test(email)) { setAlert({ type: 'error', msg: 'Ingresa un correo electrónico válido.' }); return; }

        setIsSending(true);
        try {
            await onSendCode(email);
            setDigits(emptyDigits());
            setCountdown(RESEND_COOLDOWN);
            setStep('CODE');
            requestAnimationFrame(() => inputRefs.current[0]?.focus());
        } catch (err: any) {
            setAlert({ type: 'error', msg: err.message || 'No fue posible enviar el código. Intenta de nuevo.' });
        } finally {
            setIsSending(false);
        }
    };

    // ── CODE step handlers ────────────────────────────────────────────────────
    const handleDigitChange = (index: number, value: string) => {
        const char = value.replace(/\D/g, '').slice(-1);
        const next = [...digits];
        next[index] = char;
        setDigits(next);
        clearMessages();
        if (char && index < OTP_LENGTH - 1) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !digits[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
        if (!pasted) return;
        const next = emptyDigits();
        pasted.split('').forEach((ch, i) => { next[i] = ch; });
        setDigits(next);
        clearMessages();
        const lastIdx = Math.min(pasted.length, OTP_LENGTH - 1);
        inputRefs.current[lastIdx]?.focus();
    };

    const handleVerify = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!isCodeComplete) return;
        clearMessages();
        setIsVerifying(true);
        try {
            await onVerifyCode(email, code);
            setStep('SUCCESS');
        } catch (err: any) {
            setAlert({ type: 'error', msg: err.message || 'No fue posible autenticar tu usuario, por favor vuelve a intentarlo' });
        } finally {
            setIsVerifying(false);
        }
    };

    const handleResend = async () => {
        if (countdown > 0 || isSending) return;
        clearMessages();
        setDigits(emptyDigits());
        setIsSending(true);
        try {
            await onSendCode(email);
            setCountdown(RESEND_COOLDOWN);
            setAlert({ type: 'info', msg: 'Nuevo código enviado a tu correo' });
            requestAnimationFrame(() => inputRefs.current[0]?.focus());
        } catch (err: any) {
            setAlert({ type: 'error', msg: err.message || 'Error al reenviar el código. Intenta de nuevo.' });
        } finally {
            setIsSending(false);
        }
    };

    const handleBackToEmail = () => {
        setStep('EMAIL');
        setDigits(emptyDigits());
        clearMessages();
        setCountdown(0);
    };

    // ── Social handlers ───────────────────────────────────────────────────────
    const makeSocialHandler = (fn?: () => Promise<void>) => async () => {
        if (!fn) return;
        clearMessages();
        try { await fn(); } catch (err: any) { setAlert({ type: 'error', msg: err.message || 'Error al iniciar sesión.' }); }
    };

    // ── RENDER: EMAIL step ────────────────────────────────────────────────────
    if (step === 'EMAIL') {
        return (
            <div className="otp-form">
                <form onSubmit={handleSendCode} noValidate>
                    <div className="login-field">
                        <label htmlFor="otp-email" className="sr-only">Correo electrónico</label>
                        <input
                            id="otp-email"
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={e => { setEmail(e.target.value); clearMessages(); }}
                            placeholder="Correo electrónico"
                        />
                    </div>

                    {alert && (
                        <div className={`otp-alert otp-alert--${alert.type}`} role={alert.type === 'error' ? 'alert' : 'status'}>
                            <span className="otp-alert-icon" aria-hidden="true">{alert.type === 'error' ? '✕' : 'ℹ'}</span>
                            <div><strong>{alert.type === 'error' ? 'Error' : 'Información'}</strong><p>{alert.msg}</p></div>
                        </div>
                    )}

                    {/* reCAPTCHA — mount your RecaptchaVerifier here */}
                    <div className="otp-recaptcha-area">
                        <div className="otp-recaptcha-mock">
                            <label className="otp-recaptcha-check">
                                <input
                                    type="checkbox"
                                    checked={recaptchaOk}
                                    onChange={e => setRecaptchaOk(e.target.checked)}
                                    aria-label="Verificación de seguridad"
                                />
                                <span>No soy un robot</span>
                            </label>
                            <div className="otp-recaptcha-badge">
                                <svg aria-hidden="true" width="32" height="32" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M32 4L56 18V46L32 60L8 46V18L32 4Z" fill="#4A90D9" opacity="0.15" stroke="#4A90D9" strokeWidth="2"/>
                                    <path d="M32 14L48 23V41L32 50L16 41V23L32 14Z" fill="#4A90D9" opacity="0.3"/>
                                </svg>
                                <div className="otp-recaptcha-brand">
                                    <span>reCAPTCHA</span>
                                    <small>Privacidad · Términos</small>
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={!recaptchaOk || isSending}
                        className="login-btn-primary"
                    >
                        {isSending ? 'Enviando\u2026' : 'Continuar'}
                    </button>
                </form>

                <div className="otp-divider"><span>o ingresa con</span></div>

                <div className="login-social-row">
                    <button type="button" onClick={makeSocialHandler(onSignInWithGoogle)} className="login-btn-social" aria-label="Inicia sesión con Google">
                        {GOOGLE_ICON}
                        <span className="login-social-label">Inicia sesión con Google</span>
                    </button>
                    <button type="button" onClick={makeSocialHandler(onSignInWithApple)} className="login-btn-social" aria-label="Inicia sesión con Apple">
                        {APPLE_ICON}
                        <span className="login-social-label">Inicia sesión con Apple</span>
                    </button>
                    <button type="button" onClick={makeSocialHandler(onSignInWithFacebook)} className="login-btn-social" aria-label="Inicia sesión con Facebook">
                        {FACEBOOK_ICON}
                        <span className="login-social-label">Inicia sesión con Facebook</span>
                    </button>
                </div>

                {onGoToRegister && (
                    <p className="otp-register-link">
                        ¿Aún no tienes cuenta?{' '}
                        <button type="button" onClick={onGoToRegister}>Regístrate</button>
                    </p>
                )}
            </div>
        );
    }

    // ── RENDER: SUCCESS step ──────────────────────────────────────────────────
    if (step === 'SUCCESS') {
        return (
            <div className="otp-form otp-success" role="status" aria-live="polite">
                <div className="otp-success-circle" aria-hidden="true">
                    <svg className="otp-success-svg" viewBox="0 0 52 52" xmlns="http://www.w3.org/2000/svg">
                        <circle className="otp-success-ring" cx="26" cy="26" r="24" fill="none" stroke="#43a047" strokeWidth="2.5"/>
                        <path className="otp-success-check" fill="none" stroke="#43a047" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" d="M14 27l8 8 16-16"/>
                    </svg>
                </div>

                <h2 className="otp-success-title">¡Verificación Exitosa!</h2>
                <p className="otp-success-desc">Tu identidad ha sido verificada correctamente.</p>
                <p className="otp-success-email" aria-label={`Correo verificado: ${email}`}>
                    {maskEmail(email)}
                </p>

                <button
                    type="button"
                    className="login-btn-primary otp-success-btn"
                    onClick={onSuccess}
                    autoFocus
                >
                    Continuar
                </button>
            </div>
        );
    }

    // ── RENDER: CODE step ─────────────────────────────────────────────────────
    return (
        <div className="otp-form">
            <h2 className="login-form-title">Verificación de Código</h2>
            <p className="otp-code-desc">
                Hemos enviado un código de verificación a:<br />
                Correo: <strong className="otp-masked-email">{maskEmail(email)}</strong><br />
                Por favor, ingresa el código de {OTP_LENGTH} dígitos.
            </p>

            <form onSubmit={handleVerify} noValidate>
                <div className="otp-boxes" role="group" aria-label="Código de verificación">
                    {digits.map((digit, i) => (
                        <input
                            key={i}
                            ref={el => { inputRefs.current[i] = el; }}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={e => handleDigitChange(i, e.target.value)}
                            onKeyDown={e => handleKeyDown(i, e)}
                            onPaste={i === 0 ? handlePaste : undefined}
                            className={`otp-box${digit ? ' otp-box--filled' : ''}`}
                            aria-label={`Dígito ${i + 1}`}
                            autoComplete="one-time-code"
                        />
                    ))}
                </div>

                {alert && (
                    <div className={`otp-alert otp-alert--${alert.type}`} role={alert.type === 'error' ? 'alert' : 'status'}>
                        <span className="otp-alert-icon" aria-hidden="true">{alert.type === 'error' ? '✕' : 'ℹ'}</span>
                        <div><strong>{alert.type === 'error' ? 'Error' : 'Información'}</strong><p>{alert.msg}</p></div>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={!isCodeComplete || isVerifying}
                    className="login-btn-primary"
                >
                    {isVerifying ? 'Verificando\u2026' : 'Verificar Código'}
                </button>
            </form>

            <button
                type="button"
                onClick={handleResend}
                disabled={countdown > 0 || isSending}
                className="otp-btn-secondary"
            >
                {isSending
                    ? 'Reenviando\u2026'
                    : countdown > 0
                        ? `Reenviar en ${countdown}s`
                        : 'Reenviar Código'}
            </button>

            <button type="button" onClick={handleBackToEmail} className="otp-back-link">
                ← Volver a inicio de sesión
            </button>
        </div>
    );
}
