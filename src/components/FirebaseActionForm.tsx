import { FormEvent, useEffect, useMemo, useState } from 'react';
import { applyActionCode, checkActionCode, confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from '../firebase';
import { themeConfig } from '../config/theme';
import { getFriendlyAuthErrorMessage } from '../utils/authErrors';
import { isValidOrigin } from '../utils/oidcGate';

/**
 * Evita open redirect: solo permite rutas relativas internas o URLs absolutas
 * cuyo origen esté en la allowlist (isValidOrigin). Cualquier otra cosa cae a '/'.
 */
function getSafeReturnUrl(continueUrl: string): string {
    const value = (continueUrl || '').trim();
    if (!value) return '/';
    // Ruta relativa interna (no protocol-relative '//host').
    if (value.startsWith('/') && !value.startsWith('//')) return value;
    try {
        const target = new URL(value, window.location.origin);
        if (target.origin === window.location.origin) return target.toString();
        if (isValidOrigin(target.toString())) return target.toString();
    } catch {
        return '/';
    }
    return '/';
}

const EYE_ICON = (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M2.25 12s3.5-6 9.75-6 9.75 6 9.75 6-3.5 6-9.75 6-9.75-6-9.75-6Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 15.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const EYE_OFF_ICON = (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="m3 3 18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M10.58 10.58a2 2 0 0 0 2.83 2.83" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M9.88 5.18A9.6 9.6 0 0 1 12 5c6.25 0 9.75 7 9.75 7a17.24 17.24 0 0 1-2.22 3.12M6.61 6.63C3.8 8.37 2.25 12 2.25 12s3.5 7 9.75 7c1.83 0 3.4-.6 4.72-1.44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

type ActionState = 'checking' | 'ready' | 'success' | 'error';
type EmailActionMode = 'resetPassword' | 'verifyEmail' | 'recoverEmail';

function getPasswordChecks(value: string) {
    return {
        length: value.length >= 8,
        uppercase: /[A-Z]/.test(value),
        number: /[0-9]/.test(value),
        special: /[^A-Za-z0-9]/.test(value),
    };
}

function getEmailActionMode(): EmailActionMode | null {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    if (!params.get('oobCode')) return null;
    if (mode === 'resetPassword' || mode === 'verifyEmail' || mode === 'recoverEmail') return mode;
    return null;
}

export function shouldRenderFirebaseAction() {
    return getEmailActionMode() !== null;
}

export function FirebaseActionForm() {
    const params = useMemo(() => new URLSearchParams(window.location.search), []);
    const mode = getEmailActionMode();
    const oobCode = params.get('oobCode') || '';
    const safeReturnUrl = useMemo(() => getSafeReturnUrl(params.get('continueUrl') || '/'), [params]);

    const [state, setState] = useState<ActionState>('checking');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');

    const passwordChecks = getPasswordChecks(password);
    const canSubmit = Object.values(passwordChecks).every(Boolean) && state === 'ready';

    useEffect(() => {
        let isMounted = true;

        const validateAction = async () => {
            if (mode === 'resetPassword') {
                const actionEmail = await verifyPasswordResetCode(auth, oobCode);
                if (!isMounted) return;
                setEmail(actionEmail);
                setState('ready');
                return;
            }

            if (mode === 'verifyEmail' || mode === 'recoverEmail') {
                await checkActionCode(auth, oobCode);
                await applyActionCode(auth, oobCode);
                if (!isMounted) return;
                setState('success');
                return;
            }

            throw new Error('Acción no soportada.');
        };

        validateAction().catch((err) => {
            if (!isMounted) return;
            const friendlyMessage = getFriendlyAuthErrorMessage(err, 'recovery');
            setError(
                friendlyMessage.includes('enlace de recuperación')
                    ? 'El enlace no es válido o ya venció. Solicita uno nuevo para continuar.'
                    : friendlyMessage,
            );
            setState('error');
        });

        return () => {
            isMounted = false;
        };
    }, [mode, oobCode]);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError('');

        if (!canSubmit) {
            setError('Crea una contraseña que cumpla todos los requisitos.');
            return;
        }

        setState('checking');
        try {
            await confirmPasswordReset(auth, oobCode, password);
            setState('success');
        } catch (err: any) {
            setError(getFriendlyAuthErrorMessage(err, 'recovery'));
            setState('ready');
        }
    };

    const handleReturn = () => {
        window.location.href = safeReturnUrl;
    };

    const actionCopy = getActionCopy(mode);

    return (
        <main className="action-page" aria-labelledby="action-title">
            <section className="action-brand-panel" aria-hidden="true">
                <div className="action-brand-copy">
                    <h1>Tu acceso sigue protegido</h1>
                    <p>Actualiza tu contraseña y vuelve a conectar con tus servicios ETB.</p>
                </div>
            </section>

            <section className="action-card-panel">
                <div className="action-card">
                    <div className="action-logo-shell">
                        <img src={themeConfig.logoUrl} alt={themeConfig.brandName} className="action-logo" />
                    </div>

                    {state === 'checking' && (
                        <div className="action-state" role="status" aria-live="polite">
                            <div className="action-spinner" aria-hidden="true" />
                            <h2 id="action-title">Validando enlace</h2>
                            <p>{actionCopy.checking}</p>
                        </div>
                    )}

                    {state === 'error' && (
                        <div className="action-state">
                            <div className="login-error-icon">!</div>
                            <h2 id="action-title">Enlace no disponible</h2>
                            <p>{error || actionCopy.error}</p>
                            <a href="/" className="login-btn-primary action-link-button">Volver al inicio</a>
                        </div>
                    )}

                    {state === 'success' && (
                        <div className="action-state">
                            <div className="action-success-icon" aria-hidden="true">✓</div>
                            <h2 id="action-title">{actionCopy.successTitle}</h2>
                            <p>{actionCopy.successBody}</p>
                            <button type="button" className="login-btn-primary" onClick={handleReturn}>
                                Continuar
                            </button>
                        </div>
                    )}

                    {state === 'ready' && (
                        <form className="login-form action-form" onSubmit={handleSubmit}>
                            <p className="action-kicker">Recuperación de cuenta</p>
                            <h2 id="action-title" className="login-form-title">Cambia tu contraseña</h2>
                            <p className="login-form-subtitle">
                                Usa una contraseña nueva para <strong>{email}</strong>.
                            </p>

                            {error && <div className="auth-alert error" role="alert">{error}</div>}

                            <div className="login-field">
                                <label htmlFor="new-password" className="action-label">Nueva contraseña</label>
                                <div className="login-field-password">
                                    <input
                                        id="new-password"
                                        name="new-password"
                                        type={showPassword ? 'text' : 'password'}
                                        autoComplete="new-password"
                                        minLength={8}
                                        pattern="(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}"
                                        required
                                        spellCheck={false}
                                        value={password}
                                        onChange={(event) => {
                                            setPassword(event.target.value);
                                            setError('');
                                        }}
                                        aria-describedby="new-password-rules"
                                    />
                                    <button
                                        type="button"
                                        className="login-password-toggle"
                                        onClick={() => setShowPassword((value) => !value)}
                                        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                    >
                                        {showPassword ? EYE_OFF_ICON : EYE_ICON}
                                    </button>
                                </div>
                            </div>

                            <ul id="new-password-rules" className="reg-pwd-requirements action-password-rules">
                                <li className={passwordChecks.length ? 'reg-req--ok' : ''}>Al menos 8 caracteres</li>
                                <li className={passwordChecks.uppercase ? 'reg-req--ok' : ''}>Al menos 1 mayúscula</li>
                                <li className={passwordChecks.number ? 'reg-req--ok' : ''}>Al menos 1 número</li>
                                <li className={passwordChecks.special ? 'reg-req--ok' : ''}>Al menos 1 caracter especial</li>
                            </ul>

                            <button type="submit" disabled={!canSubmit} className="login-btn-primary">
                                Guardar contraseña
                            </button>
                        </form>
                    )}
                </div>
            </section>
        </main>
    );
}

function getActionCopy(mode: EmailActionMode | null) {
    switch (mode) {
        case 'verifyEmail':
            return {
                checking: 'Estamos confirmando tu correo electrónico.',
                error: 'Solicita un nuevo enlace de verificación para continuar.',
                successTitle: 'Correo verificado',
                successBody: 'Tu correo quedó confirmado. Ya puedes continuar con tu acceso.',
            };
        case 'recoverEmail':
            return {
                checking: 'Estamos validando la recuperación de tu correo anterior.',
                error: 'Solicita un nuevo enlace para recuperar tu correo.',
                successTitle: 'Correo recuperado',
                successBody: 'Restauramos el correo de acceso asociado a tu cuenta.',
            };
        case 'resetPassword':
        default:
            return {
                checking: 'Estamos revisando que el enlace siga vigente.',
                error: 'Solicita un nuevo enlace para restablecer tu contraseña.',
                successTitle: 'Contraseña actualizada',
                successBody: 'Ya puedes usar tu nueva contraseña en los servicios asociados.',
            };
    }
}
