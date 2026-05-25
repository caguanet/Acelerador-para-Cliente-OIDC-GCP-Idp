import { useState, useEffect, useRef, KeyboardEvent, ClipboardEvent } from 'react';
import { getFriendlyAuthErrorMessage } from '../utils/authErrors';

// ── Constants ─────────────────────────────────────────────────────────────────
const OTP_LENGTH = 6;
const COLOMBIA_MOBILE_REGEX = /^3\d{9}$/;
const emptyDigits = (): string[] => Array<string>(OTP_LENGTH).fill('');

function normalizeMobileNumber(value: string): string {
    const digits = value.replace(/\D/g, '');
    return digits.startsWith('57') && digits.length === 12 ? digits.slice(2) : digits;
}

function maskPhone(phone: string): string {
    const normalized = normalizeMobileNumber(phone);
    if (normalized.length < 7) return phone;
    return `${normalized.slice(0, 3)} *** ${normalized.slice(-4)}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────
type OtpStep = 'PHONE' | 'CODE' | 'SUCCESS';

export interface OtpVerificationFormProps {
    /** Sends the OTP code to the given mobile phone number. Throw to display an error. */
    onSendCode: (phone: string) => Promise<void>;
    /** Verifies the submitted OTP code. Throw to display an error. */
    onVerifyCode: (phone: string, code: string) => Promise<void>;
    /** Called after the success screen's "Continuar" action. */
    onSuccess?: (phone: string) => void;
    /** Called when the user clicks "Regístrate" */
    onGoToRegister?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function OtpVerificationForm({
    onSendCode,
    onVerifyCode,
    onSuccess,
    onGoToRegister,
}: OtpVerificationFormProps) {
    const [step, setStep] = useState<OtpStep>('PHONE');
    const [phone, setPhone] = useState('');
    const [digits, setDigits] = useState<string[]>(emptyDigits);
    const [alert, setAlert] = useState<{ type: 'error' | 'info'; msg: string } | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);

    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

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

    // ── PHONE step handlers ───────────────────────────────────────────────────
    const handleSendCode = async (e: React.FormEvent) => {
        e.preventDefault();
        clearMessages();

        const normalizedPhone = normalizeMobileNumber(phone);
        if (!normalizedPhone) { setAlert({ type: 'error', msg: 'Ingresa tu número celular.' }); return; }
        if (!COLOMBIA_MOBILE_REGEX.test(normalizedPhone)) { setAlert({ type: 'error', msg: 'Ingresa un número celular colombiano válido.' }); return; }

        setIsSending(true);
        try {
            await onSendCode(normalizedPhone);
            setPhone(normalizedPhone);
            setDigits(emptyDigits());
            setStep('CODE');
            requestAnimationFrame(() => inputRefs.current[0]?.focus());
        } catch (err: any) {
            setAlert({ type: 'error', msg: getFriendlyAuthErrorMessage(err, 'otp') });
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
            await onVerifyCode(phone, code);
            setStep('SUCCESS');
        } catch (err: any) {
            setAlert({ type: 'error', msg: getFriendlyAuthErrorMessage(err, 'otp') });
        } finally {
            setIsVerifying(false);
        }
    };

    const handleBackToPhone = () => {
        setStep('PHONE');
        setDigits(emptyDigits());
        clearMessages();
    };

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
                <p className="otp-success-email" aria-label={`Celular verificado: ${phone}`}>
                    {maskPhone(phone)}
                </p>

                <button
                    type="button"
                    className="login-btn-primary otp-success-btn"
                    onClick={() => onSuccess?.(phone)}
                    autoFocus
                >
                    Continuar
                </button>
            </div>
        );
    }

    // ── RENDER: PHONE step ────────────────────────────────────────────────────
    if (step === 'PHONE') {
        return (
            <div className="otp-form">
                <h2 className="login-form-title">Inicia sesión en tu cuenta</h2>
                {onGoToRegister && (
                    <p className="login-form-subtitle">
                        ¿No tienes cuenta en Mi ETB?{' '}
                        <button type="button" data-testid="go-register" onClick={onGoToRegister}>
                            Regístrate
                        </button>
                    </p>
                )}

                <form onSubmit={handleSendCode} noValidate>
                    <div className="login-field">
                        <label htmlFor="otp-phone" className="sr-only">Número celular</label>
                        <input
                            id="otp-phone"
                            name="phone"
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel-national"
                            enterKeyHint="next"
                            required
                            value={phone}
                            onChange={e => { setPhone(e.target.value); clearMessages(); }}
                            placeholder="Número celular"
                        />
                    </div>

                    {alert && (
                        <div className={`otp-alert otp-alert--${alert.type}`} role={alert.type === 'error' ? 'alert' : 'status'}>
                            <span className="otp-alert-icon" aria-hidden="true">{alert.type === 'error' ? '✕' : 'ℹ'}</span>
                            <div><strong>{alert.type === 'error' ? 'Error' : 'Información'}</strong><p>{alert.msg}</p></div>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSending}
                        className="login-btn-primary"
                    >
                        {isSending ? 'Enviando\u2026' : 'Enviar código OTP'}
                    </button>
                </form>
            </div>
        );
    }

    // ── RENDER: CODE step ─────────────────────────────────────────────────────
    return (
        <div className="otp-form">
            <h2 className="login-form-title">Inicia sesión en tu cuenta</h2>
            {onGoToRegister && (
                <p className="login-form-subtitle">
                    ¿No tienes cuenta en Mi ETB?{' '}
                    <button type="button" data-testid="go-register" onClick={onGoToRegister}>
                        Regístrate
                    </button>
                </p>
            )}
            <p className="otp-code-desc">
                Enviamos un código OTP al celular <strong className="otp-masked-email">{maskPhone(phone)}</strong>.<br />
                Ingresa el código de {OTP_LENGTH} dígitos.
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

            <button type="button" onClick={handleBackToPhone} className="otp-back-link">
                Cambiar número celular
            </button>
        </div>
    );
}
