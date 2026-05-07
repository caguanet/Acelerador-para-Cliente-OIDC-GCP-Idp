import { useState, useEffect } from 'react';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    GoogleAuthProvider,
    FacebookAuthProvider,
    signInWithPopup,
    sendPasswordResetEmail
} from 'firebase/auth';
import etbLogo from '../../img/ETB.png';
import { auth } from '../firebase';
import { getFriendlyAuthErrorMessage } from '../utils/authErrors';
const googleProvider = new GoogleAuthProvider();
const facebookProvider = new FacebookAuthProvider();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVALID_CRED_CODES = new Set(['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password']);

// Hoisted static JSX — created once at module load, not on every render
const GOOGLE_ICON = (
    <svg aria-hidden="true" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
        <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.341,43.611,20.083z"/>
        <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
        <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
        <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.341,43.611,20.083z"/>
    </svg>
);

const FACEBOOK_ICON = (
    <svg aria-hidden="true" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
);

interface CustomLoginFormProps {
    onSignInSuccess: (user: any) => void;
}

type AuthMode = 'LOGIN' | 'REGISTER' | 'RECOVERY';

export function CustomLoginForm({ onSignInSuccess }: CustomLoginFormProps) {
    const [mode, setMode] = useState<AuthMode>('LOGIN');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!successMsg) return;
        const timer = setTimeout(() => setMode('LOGIN'), 5000);
        return () => clearTimeout(timer);
    }, [successMsg]);

    const handleGoogleLogin = async () => {
        setError('');
        setIsLoading(true);
        try {
            const result = await signInWithPopup(auth, googleProvider);
            onSignInSuccess(result.user);
        } catch (err: any) {
            console.error(err);
            setError(getFriendlyAuthErrorMessage(err, 'social'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleFacebookLogin = async () => {
        setError('');
        setIsLoading(true);
        try {
            const result = await signInWithPopup(auth, facebookProvider);
            onSignInSuccess(result.user);
        } catch (err: any) {
            console.error(err);
            setError(getFriendlyAuthErrorMessage(err, 'social'));
        } finally {
            setIsLoading(false);
        }
    };

    const handlePasswordReset = async (e: React.FormEvent) => {
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
            setSuccessMsg(`Se ha enviado un enlace de recuperación a ${email}`);
        } catch (err: any) {
            console.error(err);
            setError(getFriendlyAuthErrorMessage(err, 'recovery'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (mode === 'REGISTER' && !name.trim()) {
            setError('Por favor ingresa tu nombre completo.');
            return;
        }
        if (!email) {
            setError('Por favor ingresa tu correo electrónico.');
            return;
        }
        if (!EMAIL_REGEX.test(email)) {
            setError('Ingresa un correo electrónico válido.');
            return;
        }
        if (!password) {
            setError('Por favor ingresa tu contraseña.');
            return;
        }
        if (mode === 'REGISTER' && password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres.');
            return;
        }

        setIsLoading(true);
        try {
            if (mode === 'REGISTER') {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                if (name) {
                    await updateProfile(userCredential.user, { displayName: name });
                }
                onSignInSuccess(userCredential.user);
            } else if (mode === 'LOGIN') {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                onSignInSuccess(userCredential.user);
            }
        } catch (err: any) {
            console.error(err);
            if (INVALID_CRED_CODES.has(err.code)) {
                setError(getFriendlyAuthErrorMessage({ code: 'auth/invalid-credential' }, 'login'));
            } else if (err.code === 'auth/email-already-in-use') {
                setError('Este correo ya está registrado. Inicia sesión.');
                setMode('LOGIN');
            } else if (err.code === 'auth/weak-password') {
                setError('La contraseña es muy débil (mín. 6 caracteres).');
            } else {
                setError(getFriendlyAuthErrorMessage(err, 'login'));
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="custom-login-container">
            <div className="logo-container">
                <img src={etbLogo} alt="ETB Logo" className="auth-logo" />
            </div>

            <h3 className="auth-title">
                {mode === 'LOGIN' && 'Portal de Acceso'}
                {mode === 'REGISTER' && 'Crear Nueva Cuenta'}
                {mode === 'RECOVERY' && 'Recuperar Contraseña'}
            </h3>

            {error && <div className="auth-alert error">{error}</div>}
            {successMsg && <div className="auth-alert success">{successMsg}</div>}

            {mode === 'RECOVERY' ? (
                <form onSubmit={handlePasswordReset} className="auth-form" noValidate>
                    <p className="recovery-desc">Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.</p>
                    <div className="input-group">
                        <label htmlFor="custom-recovery-email">Correo Electrónico</label>
                        <input
                            id="custom-recovery-email"
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="usuario@etb.com.co"
                            className="etb-input"
                        />
                    </div>
                    <button type="submit" disabled={isLoading} className="login-submit-btn primary">
                        {isLoading ? 'Enviando...' : 'Enviar Enlace'}
                    </button>
                    <button type="button" onClick={() => setMode('LOGIN')} className="login-submit-btn secondary">
                        Volver
                    </button>
                </form>
            ) : (
                <form onSubmit={handleSubmit} className="auth-form" noValidate>
                    {mode === 'REGISTER' && (
                        <div className="input-group">
                            <label htmlFor="custom-name">Nombre Completo</label>
                            <input
                                id="custom-name"
                                type="text"
                                autoComplete="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Tu Nombre"
                                className="etb-input"
                            />
                        </div>
                    )}

                    <div className="input-group">
                        <label htmlFor="custom-email">Correo Electrónico</label>
                        <input
                            id="custom-email"
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="usuario@etb.com.co"
                            className="etb-input"
                        />
                    </div>

                    <div className="input-group">
                        <label htmlFor="custom-password">Contraseña</label>
                        <input
                            id="custom-password"
                            type="password"
                            autoComplete={mode === 'REGISTER' ? 'new-password' : 'current-password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="etb-input"
                        />
                    </div>

                    {mode === 'LOGIN' && (
                        <div className="forgot-pass-link">
                            <button type="button" onClick={() => setMode('RECOVERY')}>¿Olvidaste tu contraseña?</button>
                        </div>
                    )}

                    <button type="submit" disabled={isLoading} className="login-submit-btn primary">
                        {isLoading ? 'Procesando...' : (mode === 'REGISTER' ? 'Registrarse' : 'Ingresar')}
                    </button>

                    <div className="divider">
                        <span>O continúa con</span>
                    </div>

                    <button type="button" onClick={handleGoogleLogin} disabled={isLoading} className="google-btn">
                        {GOOGLE_ICON}
                        Google
                    </button>
                    <button type="button" onClick={handleFacebookLogin} disabled={isLoading} className="google-btn">
                        {FACEBOOK_ICON}
                        Facebook
                    </button>
                </form>
            )}

            <div className="auth-switch">
                <p>
                    {mode === 'REGISTER'
                        ? '¿Ya tienes cuenta?'
                        : (mode === 'LOGIN' ? '¿No tienes cuenta?' : '')}

                    {mode !== 'RECOVERY' && (
                        <button
                            type="button"
                            onClick={() => {
                                setMode(mode === 'LOGIN' ? 'REGISTER' : 'LOGIN');
                                setError('');
                            }}
                            className="switch-btn"
                        >
                            {mode === 'LOGIN' ? 'Regístrate' : 'Inicia Sesión'}
                        </button>
                    )}
                </p>
            </div>

            <div className="mfa-badge">
                <small><span aria-hidden="true">🔒</span> Protección MFA soportada por Identity Platform</small>
            </div>
        </div>
    );
}
