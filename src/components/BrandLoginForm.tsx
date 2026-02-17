import { useState } from 'react';
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    updateProfile,
    GoogleAuthProvider,
    signInWithPopup,
    sendPasswordResetEmail
} from 'firebase/auth';
import { themeConfig } from '../config/theme';

interface BrandLoginFormProps {
    onSignInSuccess: (user: any) => void;
}

type AuthMode = 'LOGIN' | 'REGISTER' | 'RECOVERY';

export function BrandLoginForm({ onSignInSuccess }: BrandLoginFormProps) {
    const [mode, setMode] = useState<AuthMode>('LOGIN');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const auth = getAuth();
    const googleProvider = new GoogleAuthProvider();

    const handleGoogleLogin = async () => {
        setError('');
        setIsLoading(true);
        try {
            const result = await signInWithPopup(auth, googleProvider);
            onSignInSuccess(result.user);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Error con Google Sign-In');
        } finally {
            setIsLoading(false);
        }
    };

    const handlePasswordReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setIsLoading(true);

        if (!email) {
            setError('Por favor ingresa tu correo electrónico.');
            setIsLoading(false);
            return;
        }

        try {
            await sendPasswordResetEmail(auth, email);
            setSuccessMsg(`Se ha enviado un enlace de recuperación a ${email}`);
            setTimeout(() => setMode('LOGIN'), 5000);
        } catch (err: any) {
            console.error(err);
            if (err.code === 'auth/user-not-found') {
                setError('No existe una cuenta con este correo.');
            } else {
                setError('Error al enviar el correo. Intenta de nuevo.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
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
                // TODO: Check MFA here if enabled on the user
                onSignInSuccess(userCredential.user);
            }
        } catch (err: any) {
            console.error(err);
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
                setError('Credenciales inválidas.');
            } else if (err.code === 'auth/email-already-in-use') {
                setError('Este correo ya está registrado. Inicia sesión.');
                setMode('LOGIN');
            } else if (err.code === 'auth/weak-password') {
                setError('La contraseña es muy débil (mín. 6 caracteres).');
            } else {
                setError(err.message || 'Error de autenticación');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="custom-login-container">
            <div className="logo-container">
                <img src={themeConfig.logoUrl} alt="Brand Logo" className="auth-logo" onError={(e) => {
                    // Fallback if image fails
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement!.innerHTML = `<h2 style='color:var(--brand-primary)'>${themeConfig.brandName}</h2>`;
                }}/>
            </div>

            <h3 className="auth-title">
                {mode === 'LOGIN' && 'Portal de Acceso'}
                {mode === 'REGISTER' && 'Crear Nueva Cuenta'}
                {mode === 'RECOVERY' && 'Recuperar Contraseña'}
            </h3>
            
            {(error) && <div className="auth-alert error">{error}</div>}
            {(successMsg) && <div className="auth-alert success">{successMsg}</div>}

            {mode === 'RECOVERY' ? (
                <form onSubmit={handlePasswordReset} className="auth-form">
                    <p className="recovery-desc">Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.</p>
                    <div className="input-group">
                        <label>Correo Electrónico</label>
                        <input 
                            type="email" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="usuario@empresa.com"
                            required
                            className="brand-input" // Keeping class name for CSS comaptibility for now
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
                <form onSubmit={handleSubmit} className="auth-form">
                    {mode === 'REGISTER' && (
                        <div className="input-group">
                            <label>Nombre Completo</label>
                            <input 
                                type="text" 
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Tu Nombre"
                                required
                                className="brand-input"
                            />
                        </div>
                    )}

                    <div className="input-group">
                        <label>Correo Electrónico</label>
                        <input 
                            type="email" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="usuario@empresa.com"
                            required
                            className="brand-input"
                        />
                    </div>

                    <div className="input-group">
                        <label>Contraseña</label>
                        <input 
                            type="password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            className="brand-input"
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
                        <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.341,43.611,20.083z"/><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.341,43.611,20.083z"/></svg>
                        Google
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
                <small>🔒 Protección MFA soportada por Identity Platform</small>
            </div>
        </div>
    );
}
