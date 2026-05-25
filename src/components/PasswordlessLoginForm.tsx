import { FormEvent, useEffect, useState } from 'react';
import {
    FacebookAuthProvider,
    GoogleAuthProvider,
    OAuthProvider,
    User,
    getAdditionalUserInfo,
    isSignInWithEmailLink,
    sendPasswordResetEmail,
    sendSignInLinkToEmail,
    signInWithEmailLink,
    signInWithPopup,
    signOut,
} from 'firebase/auth';
import { auth } from '../firebase';
import { getFriendlyAuthErrorMessage } from '../utils/authErrors';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_FOR_SIGN_IN_KEY = 'idp.emailForSignIn';
const PENDING_SOCIAL_PROVIDER_KEY = 'idp.pendingSocialProvider';
const SAFE_RECOVERY_MESSAGE = 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.';

const googleProvider = new GoogleAuthProvider();
const appleProvider = new OAuthProvider('apple.com');
const facebookProvider = new FacebookAuthProvider();

const GOOGLE_ICON = (
    <svg aria-hidden="true" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
        <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.341,43.611,20.083z"/>
        <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
        <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
        <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.341,43.611,20.083z"/>
    </svg>
);

const APPLE_ICON = (
    <svg aria-hidden="true" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 814 1000">
        <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.7 0 663 0 541.8c0-194.3 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/>
    </svg>
);

const FACEBOOK_ICON = (
    <svg aria-hidden="true" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
);

type LoginMode = 'SIGN_IN' | 'RECOVERY';

interface PasswordlessLoginFormProps {
    onSignInSuccess: (user: User) => void;
    onGoToRegister: () => void;
}

function validateEmail(email: string) {
    if (!email.trim()) return 'Ingresa tu correo electrónico.';
    if (!EMAIL_REGEX.test(email)) return 'Ingresa un correo electrónico válido.';
    return '';
}

function getActionUrl() {
    return `${window.location.origin}${window.location.pathname}${window.location.search}`;
}

export function PasswordlessLoginForm({ onSignInSuccess, onGoToRegister }: PasswordlessLoginFormProps) {
    const [mode, setMode] = useState<LoginMode>('SIGN_IN');
    const [email, setEmail] = useState('');
    const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSocialLoading, setIsSocialLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    useEffect(() => {
        if (!isSignInWithEmailLink(auth, window.location.href)) return;

        const storedEmail = window.localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY) || '';
        if (!storedEmail) {
            setNeedsEmailConfirmation(true);
            setSuccessMsg('Confirma tu correo para completar el acceso.');
            return;
        }

        completeEmailLinkSignIn(storedEmail);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const completeEmailLinkSignIn = async (nextEmail: string) => {
        setError('');
        setIsLoading(true);
        try {
            const credential = await signInWithEmailLink(auth, nextEmail, window.location.href);
            const info = getAdditionalUserInfo(credential);
            if (info?.isNewUser) {
                await signOut(auth);
                setError('Para acceder primero debes completar el registro y la validación ETB.');
                return;
            }
            window.localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY);
            onSignInSuccess(credential.user);
        } catch (err: any) {
            setError(getFriendlyAuthErrorMessage(err, 'login'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendEmailLink = async (e: FormEvent<HTMLFormElement>) => {
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
            await sendSignInLinkToEmail(auth, email, {
                url: getActionUrl(),
                handleCodeInApp: true,
            });
            window.localStorage.setItem(EMAIL_FOR_SIGN_IN_KEY, email);
            setSuccessMsg('Te enviamos un enlace seguro. Abre el correo en este dispositivo para continuar.');
        } catch (err: any) {
            setError(getFriendlyAuthErrorMessage(err, 'login'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirmEmailForLink = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const validationError = validateEmail(email);
        if (validationError) {
            setError(validationError);
            return;
        }
        await completeEmailLinkSignIn(email);
    };

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
            await sendPasswordResetEmail(auth, email);
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

    const handleSocialLogin = async (provider: GoogleAuthProvider | OAuthProvider | FacebookAuthProvider) => {
        setError('');
        setSuccessMsg('');
        setIsSocialLoading(true);
        try {
            const result = await signInWithPopup(auth, provider);
            const info = getAdditionalUserInfo(result);
            if (info?.isNewUser) {
                window.sessionStorage.setItem(PENDING_SOCIAL_PROVIDER_KEY, provider.providerId);
                await signOut(auth);
                onGoToRegister();
                return;
            }
            onSignInSuccess(result.user);
        } catch (err: any) {
            if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
                setError(getFriendlyAuthErrorMessage(err, 'social'));
            }
        } finally {
            setIsSocialLoading(false);
        }
    };

    const switchMode = (nextMode: LoginMode) => {
        setMode(nextMode);
        setError('');
        setSuccessMsg('');
        setNeedsEmailConfirmation(false);
    };

    const title = mode === 'RECOVERY'
        ? 'Recuperar contraseña'
        : needsEmailConfirmation
            ? 'Confirma tu correo'
            : 'Inicia sesión en tu cuenta';

    return (
        <div className="login-form">
            <h2 className="login-form-title">{title}</h2>
            {mode === 'SIGN_IN' && !needsEmailConfirmation && (
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

            <form onSubmit={needsEmailConfirmation ? handleConfirmEmailForLink : mode === 'RECOVERY' ? handlePasswordRecovery : handleSendEmailLink} noValidate>
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
                    {isLoading
                        ? 'Procesando...'
                        : needsEmailConfirmation
                            ? 'Completar acceso'
                            : mode === 'RECOVERY'
                                ? 'Enviar enlace de recuperación'
                                : 'Enviar enlace de acceso'}
                </button>
            </form>

            {mode === 'SIGN_IN' && !needsEmailConfirmation && (
                <>
                    <div className="otp-divider"><span>o continúa con</span></div>

                    <div className="login-social-row">
                        <button type="button" onClick={() => handleSocialLogin(googleProvider)} disabled={isSocialLoading} className="login-btn-social" aria-label="Continúa con Google">
                            {GOOGLE_ICON}
                            <span className="login-social-label">Continúa con Google</span>
                        </button>
                        <button type="button" onClick={() => handleSocialLogin(appleProvider)} disabled={isSocialLoading} className="login-btn-social" aria-label="Continúa con Apple">
                            {APPLE_ICON}
                            <span className="login-social-label">Continúa con Apple</span>
                        </button>
                        <button type="button" onClick={() => handleSocialLogin(facebookProvider)} disabled={isSocialLoading} className="login-btn-social" aria-label="Continúa con Facebook">
                            {FACEBOOK_ICON}
                            <span className="login-social-label">Continúa con Facebook</span>
                        </button>
                    </div>

                    <div className="login-forgot">
                        <button type="button" onClick={() => switchMode('RECOVERY')}>
                            ¿Necesitas recuperar tu contraseña?
                        </button>
                    </div>
                </>
            )}

            {(mode === 'RECOVERY' || needsEmailConfirmation) && (
                <button type="button" onClick={() => switchMode('SIGN_IN')} className="otp-back-link">
                    Volver al inicio de sesión
                </button>
            )}
        </div>
    );
}
