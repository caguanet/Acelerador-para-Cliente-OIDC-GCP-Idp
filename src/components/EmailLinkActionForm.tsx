import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  User,
  getAdditionalUserInfo,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut,
} from 'firebase/auth';
import { auth } from '../firebase';
import { themeConfig } from '../config/theme';
import { getFriendlyAuthErrorMessage } from '../utils/authErrors';
import type { OidcParams } from '../utils/oidcGate';
import { hasValidOidcContext } from '../utils/oidcGate';
import {
  clearEmailLinkTabCoordination,
  getActiveEmailLinkIntentId,
  isEmailLinkTabCoordinationEnabled,
  isPrimaryEmailLinkTabAlive,
  notifyEmailLinkAuthComplete,
  waitForPrimaryEmailLinkRedirect,
} from '../utils/emailLinkTabCoordination';
import { redirectToOidcPartner } from '../utils/oidcRedirect';

const EMAIL_FOR_SIGN_IN_KEY = 'idp.emailForSignIn';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ActionState = 'checking' | 'confirm-email' | 'redirecting' | 'delegated' | 'error';

interface EmailLinkActionFormProps {
  oidcParams: OidcParams;
}

function validateEmail(email: string) {
  if (!email.trim()) return 'Ingresa tu correo electrónico.';
  if (!EMAIL_REGEX.test(email)) return 'Ingresa un correo electrónico válido.';
  return '';
}

/**
 * Completa magic links (mode=signIn) en /auth/action sin mostrar el login completo.
 * Tras autenticar, redirige al partner con id_token si el continueUrl traía OIDC válido.
 */
export function EmailLinkActionForm({ oidcParams }: EmailLinkActionFormProps) {
  const [state, setState] = useState<ActionState>('checking');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const actionHref = useMemo(() => window.location.href, []);
  const oidcReady = hasValidOidcContext(oidcParams);

  const redirectWithToken = async (user: User) => {
    if (!oidcParams.redirect_uri) {
      setError('No hay destino autorizado para completar el acceso.');
      setState('error');
      return;
    }
    setState('redirecting');
    const idToken = await user.getIdToken(true);
    redirectToOidcPartner(oidcParams.redirect_uri, idToken, oidcParams.state || '');
  };

  const tryDelegateToPrimaryTab = async (user: User): Promise<boolean> => {
    const intentId = getActiveEmailLinkIntentId();
    if (
      !isEmailLinkTabCoordinationEnabled() ||
      !intentId ||
      !isPrimaryEmailLinkTabAlive(intentId)
    ) {
      return false;
    }

    notifyEmailLinkAuthComplete(intentId);
    setState('delegated');
    const primaryRedirected = await waitForPrimaryEmailLinkRedirect(intentId);
    clearEmailLinkTabCoordination(intentId);
    if (!primaryRedirected) {
      await redirectWithToken(user);
      return false;
    }
    return true;
  };

  const completeEmailLinkSignIn = async (nextEmail: string) => {
    setError('');
    setState('checking');
    try {
      const credential = await signInWithEmailLink(auth, nextEmail, actionHref);
      const info = getAdditionalUserInfo(credential);
      if (info?.isNewUser) {
        await signOut(auth);
        setError('Para acceder primero debes completar el registro y la validación ETB.');
        setState('error');
        return;
      }
      window.localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY);
      const delegated = await tryDelegateToPrimaryTab(credential.user);
      if (!delegated) {
        await redirectWithToken(credential.user);
      }
    } catch (err: unknown) {
      setError(getFriendlyAuthErrorMessage(err, 'login'));
      setState('confirm-email');
    }
  };

  useEffect(() => {
    if (!isSignInWithEmailLink(auth, actionHref)) {
      setError('El enlace de acceso no es válido o ya venció.');
      setState('error');
      return;
    }

    const storedEmail = window.localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY) || '';
    if (!storedEmail) {
      setState('confirm-email');
      return;
    }

    void completeEmailLinkSignIn(storedEmail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionHref]);

  const handleConfirmEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateEmail(email);
    if (validationError) {
      setError(validationError);
      return;
    }
    await completeEmailLinkSignIn(email);
  };

  return (
    <main className="action-page" aria-labelledby="email-link-action-title">
      <section className="action-brand-panel" aria-hidden="true">
        <div className="action-brand-copy">
          <h1>Completando tu acceso</h1>
          <p>Estamos validando el enlace seguro que enviamos a tu correo.</p>
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
              <h2 id="email-link-action-title">Validando enlace</h2>
              <p>Espera un momento mientras confirmamos tu acceso.</p>
            </div>
          )}

          {state === 'redirecting' && (
            <div className="action-state" role="status" aria-live="polite">
              <div className="action-spinner" aria-hidden="true" />
              <h2 id="email-link-action-title">Acceso confirmado</h2>
              <p>Te estamos llevando de vuelta a la aplicación.</p>
            </div>
          )}

          {state === 'delegated' && (
            <div className="action-state" role="status" aria-live="polite">
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem', color: 'var(--brand-primary)' }}>✓</div>
              <h2 id="email-link-action-title">Acceso confirmado</h2>
              <p>
                Tu sesión se completó correctamente. Puedes cerrar esta pestaña; la ventana donde
                iniciaste el acceso te llevará a la aplicación.
              </p>
            </div>
          )}

          {state === 'error' && (
            <div className="action-state">
              <div className="login-error-icon">!</div>
              <h2 id="email-link-action-title">No pudimos completar el acceso</h2>
              <p>{error}</p>
              {oidcReady ? (
                <a href={oidcParams.redirect_uri || '/'} className="login-btn-primary action-link-button">
                  Volver a la aplicación
                </a>
              ) : (
                <a href="/" className="login-btn-primary action-link-button">
                  Volver al inicio
                </a>
              )}
            </div>
          )}

          {state === 'confirm-email' && (
            <form className="login-form action-form" onSubmit={handleConfirmEmail}>
              <p className="action-kicker">Confirmación de correo</p>
              <h2 id="email-link-action-title" className="login-form-title">
                Confirma tu correo
              </h2>
              <p className="login-form-subtitle">
                Abriste el enlace en otro dispositivo. Ingresa el mismo correo al que enviamos el enlace.
              </p>

              {error && (
                <div className="auth-alert error" role="alert">
                  {error}
                </div>
              )}

              <div className="login-field">
                <label htmlFor="email-link-confirm" className="action-label">
                  Correo electrónico
                </label>
                <input
                  id="email-link-confirm"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setError('');
                  }}
                />
              </div>

              <button type="submit" className="login-btn-primary">
                Continuar
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
