import { useState, useEffect } from 'react'
import { User, onAuthStateChanged } from "firebase/auth";
import './index.css'
import { auth } from './firebase'; // initializes Firebase before any component imports getAuth()
import { PasswordlessLoginForm } from './components/PasswordlessLoginForm';
import { RegisterForm } from './components/RegisterForm';
import { StoreBadges } from './components/StoreBadges';
import { themeConfig } from './config/theme';
import { FirebaseActionForm, shouldRenderFirebaseAction } from './components/FirebaseActionForm';
import { AccessDeniedScreen } from './components/AccessDeniedScreen';
import { EmailLinkActionForm } from './components/EmailLinkActionForm';
import {
  getCanonicalIdpUrlForCurrentLocation,
  isValidOrigin,
  requiresOidcRedirect,
  resolveAccessGate,
  type AccessGateResult,
} from './utils/oidcGate';
import { buildOidcFragment, redirectToOidcPartner } from './utils/oidcRedirect';

type AuthView = 'login' | 'register';

function LoginApp({ gate }: { gate: AccessGateResult }) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [authView, setAuthView] = useState<AuthView>('login');

  const [{ oidcParams, oidcError }, setOidc] = useState(() => ({
    oidcParams: gate.oidcParams,
    oidcError: gate.oidcError,
  }));

  const setOidcError = (msg: string | null) =>
    setOidc((prev) => ({ ...prev, oidcError: msg }));

  // Silent refresh: prompt=none → if IdP has an active Firebase session, return a fresh id_token without showing login
  useEffect(() => {
    if (oidcParams.prompt !== 'none' || !oidcParams.redirect_uri || !isValidOrigin(oidcParams.redirect_uri)) return;

    const redirectUri = oidcParams.redirect_uri;
    const state = oidcParams.state || '';

    const unsub = onAuthStateChanged(auth, async (user) => {
      unsub();
      const targetUrl = new URL(redirectUri);
      try {
        if (user) {
          const idToken = await user.getIdToken(true); // force refresh for new expiry
          targetUrl.hash = buildOidcFragment({ id_token: idToken, state });
        } else {
          targetUrl.hash = buildOidcFragment({
            error: 'login_required',
            error_description: 'Sesión no activa en el IdP',
            state,
          });
        }
      } catch (err) {
        console.error('Silent refresh error', err);
        targetUrl.hash = buildOidcFragment({
          error: 'server_error',
          error_description: 'No se pudo renovar el token',
          state,
        });
      }
      window.location.href = targetUrl.toString();
    });

    return () => unsub();
  }, [oidcParams.prompt, oidcParams.redirect_uri, oidcParams.state]);

  const handleLoginSuccess = async (currentUser: User) => {
    try {
      const idToken = await currentUser.getIdToken(true); // fresh token with full TTL

      if (oidcParams.redirect_uri) {
        if (!isValidOrigin(oidcParams.redirect_uri)) {
          setOidcError(`Error de seguridad: El dominio no está autorizado para recibir credenciales.`);
          return;
        }
        redirectToOidcPartner(oidcParams.redirect_uri, idToken, oidcParams.state || '');
        return;
      }

      // Standalone: mark as logged in
      setLoggedIn(true);
    } catch (err) {
      console.error("Error fetching token", err);
    }
  };

  return (
    <div className="login-desktop">

      {/* Mobile only: ETB logo centered at top */}
      <div className="login-mobile-header">
        <img src={themeConfig.logoUrl} alt={themeConfig.brandName} className="login-mobile-logo" />
      </div>

      {/* Desktop only: Left hero panel — visually hidden spacer, image baked into bg */}
      <div className="login-hero" aria-hidden="true">
        <div className="login-hero-inner">
          <h1 className="login-hero-title">Bienvenido<br/>a Mi ETB</h1>
          <p className="login-hero-accent">Autogestiona todos tus productos</p>
          <p className="login-hero-desc">fácilmente desde un solo lugar.</p>
          <p className="login-hero-app-label">Descarga y conoce la app Mi ETB</p>
          <StoreBadges />
        </div>
      </div>

      {/* Card panel — mobile: centered over bg | desktop: right side floating */}
      <div className="login-card-panel">
        <div className="login-page-card">
          {oidcParams.prompt === 'none' && oidcParams.redirect_uri && !oidcError ? (
            <div className="login-error-state" role="status" aria-live="polite">
              <div className="login-error-icon" style={{ fontSize: '1.5rem' }}>⟳</div>
              <h2>Comprobando sesión</h2>
              <p style={{ color: 'var(--brand-text-secondary)' }}>Redirigiendo...</p>
            </div>
          ) : oidcError ? (
            <div className="login-error-state" role="alert">
              <div className="login-error-icon">✕</div>
              <h2>Acceso No Autorizado</h2>
              <p>{oidcError}</p>
              <p className="login-error-guidance">
                Cierra esta ventana e ingresa nuevamente desde la aplicación autorizada.
              </p>
            </div>
          ) : loggedIn ? (
            <div className="login-error-state">
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✓</div>
              <h2 style={{ color: 'var(--brand-primary)' }}>Autenticado</h2>
              <p style={{ color: 'var(--brand-text-secondary)' }}>Sesión iniciada correctamente.</p>
            </div>
          ) : (
            <>
              {authView === 'register' ? (
                <RegisterForm
                  onRegisterSuccess={handleLoginSuccess}
                  onGoToLogin={() => setAuthView('login')}
                />
              ) : (
                <PasswordlessLoginForm
                  onSignInSuccess={handleLoginSuccess}
                  onGoToRegister={() => setAuthView('register')}
                  oidcContextRequired={requiresOidcRedirect()}
                  hasValidOidcContext={Boolean(oidcParams.redirect_uri && oidcParams.client_id)}
                />
              )}

              {oidcParams.client_id && (
                <p className="login-client-id">
                  Acceso solicitado por: <strong>{oidcParams.client_id}</strong>
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Móvil / tablet: mismas tiendas que en el hero desktop (paridad con PNG ≥1024px) */}
      <div className="login-mobile-app-stores">
        <p className="login-mobile-app-stores__title">Descarga y conoce la app Mi ETB</p>
        <StoreBadges />
      </div>

      {/* Mobile only: brand tagline */}
      <div className="login-tagline">
        <p><strong>Serás</strong> lo que <strong>creas</strong></p>
      </div>

    </div>
  );
}

function App() {
  const canonicalTarget = getCanonicalIdpUrlForCurrentLocation();
  if (canonicalTarget) {
    window.location.replace(canonicalTarget);
    return null;
  }

  const gate = resolveAccessGate();

  if (gate.oidcError) {
    return <AccessDeniedScreen message={gate.oidcError} />;
  }

  if (gate.isEmailLinkSignInAction) {
    return <EmailLinkActionForm oidcParams={gate.oidcParams} />;
  }

  if (shouldRenderFirebaseAction()) {
    return <FirebaseActionForm />;
  }

  return <LoginApp gate={gate} />;
}

export default App
