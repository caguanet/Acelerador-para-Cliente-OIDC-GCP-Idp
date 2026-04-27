import { useState, useEffect, FormEvent } from 'react';
import {
    signInWithEmailAndPassword,
    GoogleAuthProvider,
    OAuthProvider,
    FacebookAuthProvider,
    signInWithPopup,
    sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from '../firebase';
import { RegisterForm } from './RegisterForm';
const googleProvider = new GoogleAuthProvider();
const appleProvider = new OAuthProvider('apple.com');
const facebookProvider = new FacebookAuthProvider();

// Shared constants
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVALID_CRED_CODES = new Set(['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password']);

interface BrandLoginFormProps {
    onSignInSuccess: (user: any) => void;
}

type AuthMode = 'LOGIN' | 'REGISTER' | 'RECOVERY';

// Hoisted static JSX — created once at module load, not on every render
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

const EYE_ICON = (
    <svg aria-hidden="true" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
    </svg>
);

const EYE_OFF_ICON = (
    <svg aria-hidden="true" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
);



export function BrandLoginForm({ onSignInSuccess }: BrandLoginFormProps) {
    const [mode, setMode] = useState<AuthMode>('LOGIN');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSocialLoading, setIsSocialLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Auto-redirect after password reset — cleaned up on unmount
    useEffect(() => {
        if (!successMsg) return;
        const timer = setTimeout(() => setMode('LOGIN'), 5000);
        return () => clearTimeout(timer);
    }, [successMsg]);

    // Reset social loading when window regains focus (popup closed without completing)
    useEffect(() => {
        if (!isSocialLoading) return;
        const handler = () => setTimeout(() => setIsSocialLoading(false), 800);
        window.addEventListener('focus', handler);
        return () => window.removeEventListener('focus', handler);
    }, [isSocialLoading]);

    const handleSocialLogin = async (provider: typeof googleProvider) => {
        setError('');
        setIsSocialLoading(true);
        try {
            const result = await signInWithPopup(auth, provider);
            onSignInSuccess(result.user);
        } catch (err: any) {
            if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
                setError(err.message || 'Error al iniciar sesión con red social.');
            }
        } finally {
            setIsSocialLoading(false);
        }
    };

    const handleGoogleLogin = () => handleSocialLogin(googleProvider);
    const handleAppleLogin = () => handleSocialLogin(appleProvider);
    const handleFacebookLogin = () => handleSocialLogin(facebookProvider);

    const handlePasswordReset = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        if (!email) {
            setError('Por favor ingresa tu correo electrónico.');
            return;
        }
        if (!EMAIL_REGEX.test(email)) {
            setError('Ingresa un correo electrónico válido.');
            return;
        }
        setIsLoading(true);
        try {
            await sendPasswordResetEmail(auth, email);
            setSuccessMsg(`Se envió un enlace de recuperación a ${email}`);
        } catch (err: any) {
            setError(err.code === 'auth/user-not-found'
                ? 'No existe una cuenta con este correo.'
                : 'Error al enviar el correo. Intenta de nuevo.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        if (!email) { setError('Por favor ingresa tu correo electrónico.'); return; }
        if (!EMAIL_REGEX.test(email)) { setError('Ingresa un correo electrónico válido.'); return; }
        if (!password) { setError('Por favor ingresa tu contraseña.'); return; }
        setIsLoading(true);
        try {
            const cred = await signInWithEmailAndPassword(auth, email, password);
            onSignInSuccess(cred.user);
        } catch (err: any) {
            if (INVALID_CRED_CODES.has(err.code)) {
                setError('Credenciales inválidas.');
            } else {
                setError(err.message || 'Error de autenticación');
            }
        } finally {
            setIsLoading(false);
        }
    };



    const switchMode = (next: AuthMode) => {
        setMode(next);
        setError('');
        setSuccessMsg('');
    };

    if (mode === 'REGISTER') {
        return <RegisterForm onRegisterSuccess={onSignInSuccess} onGoToLogin={() => switchMode('LOGIN')} />;
    }

    if (mode === 'RECOVERY') {
        return (
            <div className="login-form">
                <h2 className="login-form-title">Recuperar Contraseña</h2>
                <p className="login-form-subtitle">
                    Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
                </p>

                {error && <div className="auth-alert error">{error}</div>}
                {successMsg && <div className="auth-alert success">{successMsg}</div>}

                <form onSubmit={handlePasswordReset} noValidate>
                    <div className="login-field">
                        <label htmlFor="recovery-email" className="sr-only">Correo electrónico</label>
                        <input
                            id="recovery-email"
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Email"
                        />
                    </div>
                    <button type="submit" disabled={isLoading} className="login-btn-primary">
                        {isLoading ? 'Enviando\u2026' : 'Enviar Enlace'}
                    </button>
                    <button type="button" onClick={() => switchMode('LOGIN')} className="login-btn-outline">
                        Volver
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div className="login-form">
            <h2 className="login-form-title">Inicia sesión en tu cuenta</h2>
            <p className="login-form-subtitle">
                <>¿No tienes cuenta en Mi ETB? <button type="button" onClick={() => switchMode('REGISTER')}>Registrate</button></>
            </p>

            {error && <div className="auth-alert error">{error}</div>}
            {successMsg && <div className="auth-alert success">{successMsg}</div>}

            <form onSubmit={handleSubmit} noValidate>
                <div className="login-field">
                    <label htmlFor="login-email" className="sr-only">Correo electrónico</label>
                    <input
                        id="login-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email"
                    />
                </div>
                <div className="login-field">
                    <label htmlFor="login-password" className="sr-only">Contraseña</label>
                    <div className="login-field-password">
                        <input
                            id="login-password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            spellCheck={false}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Contraseña"
                        />
                        <button
                            type="button"
                            className="login-password-toggle"
                            onClick={() => setShowPassword(v => !v)}
                            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        >
                            {showPassword ? EYE_OFF_ICON : EYE_ICON}
                        </button>
                    </div>
                </div>

                <button type="submit" disabled={isLoading} className="login-btn-primary">
                    {isLoading ? 'Procesando\u2026' : 'Ingresa'}
                </button>
            </form>

            <div className="login-social-row">
                <button type="button" onClick={handleGoogleLogin} disabled={isSocialLoading} className="login-btn-social" aria-label="Inicia sesión con Google">
                    {GOOGLE_ICON}
                    <span className="login-social-label">Inicia sesión con Google</span>
                </button>
                <button type="button" onClick={handleAppleLogin} disabled={isSocialLoading} className="login-btn-social" aria-label="Inicia sesión con Apple">
                    {APPLE_ICON}
                    <span className="login-social-label">Inicia sesión con Apple</span>
                </button>
                <button type="button" onClick={handleFacebookLogin} disabled={isSocialLoading} className="login-btn-social" aria-label="Inicia sesión con Facebook">
                    {FACEBOOK_ICON}
                    <span className="login-social-label">Inicia sesión con Facebook</span>
                </button>
            </div>

            {mode === 'LOGIN' && (
                <div className="login-forgot">
                    <button type="button" onClick={() => switchMode('RECOVERY')}>
                        ¿Olvidaste tu contraseña?
                    </button>
                </div>
            )}
        </div>
    );
}
