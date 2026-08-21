import { FormEvent, useState } from 'react';
import { User, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { EmailOtpLoginForm } from './EmailOtpLoginForm';
import { getFriendlyAuthErrorMessage } from '../utils/authErrors';
import { EMAIL_REGEX } from '../utils/email';

const SAFE_RECOVERY_MESSAGE = 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.';

type LoginMode = 'SIGN_IN' | 'RECOVERY';

interface PasswordlessLoginFormProps {
    onSignInSuccess: (user: User) => void;
    onGoToRegister: () => void;
    /** Si true, no se autentica sin contexto OIDC válido. */
    oidcContextRequired?: boolean;
    hasValidOidcContext?: boolean;
}

function validateEmail(email: string) {
    if (!email.trim()) return 'Ingresa tu correo electrónico.';
    if (!EMAIL_REGEX.test(email)) return 'Ingresa un correo electrónico válido.';
    return '';
}

function getPasswordResetContinueUrl() {
    return `${window.location.origin}/`;
}

export function PasswordlessLoginForm({
    onSignInSuccess,
    onGoToRegister,
    oidcContextRequired = false,
    hasValidOidcContext = true,
}: PasswordlessLoginFormProps) {
    const [mode, setMode] = useState<LoginMode>('SIGN_IN');
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const handlePasswordRecovery = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');

        const validationError = validateEmail(email);
        if (validationError) {
            setError(validationError);
            return;
        }

        setIsLoading(true);
        try {
            await sendPasswordResetEmail(auth, email, {
                url: getPasswordResetContinueUrl(),
                handleCodeInApp: false,
            });
            setSuccessMsg(SAFE_RECOVERY_MESSAGE);
        } catch (err: any) {
            const code = typeof err?.code === 'string' ? err.code : '';
            if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
                setSuccessMsg(SAFE_RECOVERY_MESSAGE);
            } else {
                setError(getFriendlyAuthErrorMessage(err, 'recovery'));
            }
        } finally {
            setIsLoading(false);
        }
    };

    const switchMode = (nextMode: LoginMode) => {
        setMode(nextMode);
        setError('');
        setSuccessMsg('');
    };

    const title = mode === 'RECOVERY' ? 'Recuperar contraseña' : 'Inicia sesión en tu cuenta';
    const showSignInOptions = mode === 'SIGN_IN';

    return (
        <div className="login-form">
            <h2 className="login-form-title">{title}</h2>
            {showSignInOptions && (
                <p className="login-form-subtitle">
                    ¿No tienes cuenta en Mi ETB?{' '}
                    <button type="button" data-testid="go-register" onClick={onGoToRegister}>
                        Regístrate
                    </button>
                </p>
            )}
            {mode === 'RECOVERY' && (
                <p className="login-form-subtitle">
                    Te enviaremos un enlace para restablecer la contraseña usada en servicios externos.
                </p>
            )}

            {error && <div className="auth-alert error" role="alert">{error}</div>}
            {successMsg && <div className="auth-alert success" role="status">{successMsg}</div>}

            {showSignInOptions && (
                <div id="auth-panel-otp-code">
                    <EmailOtpLoginForm
                        onSignInSuccess={onSignInSuccess}
                        oidcContextRequired={oidcContextRequired}
                        hasValidOidcContext={hasValidOidcContext}
                    />
                </div>
            )}

            {mode === 'RECOVERY' && (
                <div id="auth-panel-recovery">
                    <form onSubmit={handlePasswordRecovery} noValidate>
                        <div className="login-field">
                            <label htmlFor="passwordless-email" className="sr-only">Correo electrónico</label>
                            <input
                                id="passwordless-email"
                                name="email"
                                type="email"
                                autoComplete="username"
                                enterKeyHint="done"
                                required
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    setError('');
                                }}
                                placeholder="Correo electrónico"
                            />
                        </div>

                        <button type="submit" disabled={isLoading} className="login-btn-primary">
                            {isLoading ? 'Procesando...' : 'Enviar enlace de recuperación'}
                        </button>
                    </form>
                </div>
            )}

            {showSignInOptions && (
                <div className="login-forgot">
                    <button type="button" onClick={() => switchMode('RECOVERY')}>
                        ¿Necesitas recuperar tu contraseña?
                    </button>
                </div>
            )}

            {mode === 'RECOVERY' && (
                <button type="button" onClick={() => switchMode('SIGN_IN')} className="otp-back-link">
                    Volver al inicio de sesión
                </button>
            )}
        </div>
    );
}
