import { useState, useEffect } from 'react'
import { User, onAuthStateChanged } from "firebase/auth";
import './index.css'
import { auth } from './firebase'; // initializes Firebase before any component imports getAuth()
import { PasswordlessLoginForm } from './components/PasswordlessLoginForm';
import { RegisterForm } from './components/RegisterForm';
import { StoreBadges } from './components/StoreBadges';
import { themeConfig } from './config/theme';

type AuthView = 'login' | 'register';

type OidcParams = {
  redirect_uri: string | null;
  client_id: string | null;
  state: string | null;
  prompt: string | null;
};

const emptyOidc: OidcParams = { redirect_uri: null, client_id: null, state: null, prompt: null };

function isValidOrigin(urlStr: string) {
  try {
    const targetUrl = new URL(urlStr);
    const validationOrigins = [...(window.APP_CONFIG?.allowedOrigins || [])];
    if (import.meta.env.DEV && validationOrigins.length === 0) {
      return targetUrl.hostname === 'localhost';
    }
    return validationOrigins.some((origin) => targetUrl.origin === origin);
  } catch {
    return false;
  }
}

/** Lectura síncrona de query OIDC en el primer render (evita un frame con UI incorrecta antes del useEffect). */
function loadOidcFromUrl(): { oidcParams: OidcParams; oidcError: string | null } {
  const params = new URLSearchParams(window.location.search);
  const redirect_uri = params.get('redirect_uri');
  const client_id = params.get('client_id');
  const state = params.get('state');
  const prompt = params.get('prompt');

  if (redirect_uri && client_id) {
    if (!isValidOrigin(redirect_uri)) {
      return {
        oidcParams: emptyOidc,
        oidcError: `Error de Seguridad: El dominio de redirección no está autorizado.`,
      };
    }
    return { oidcParams: { redirect_uri, client_id, state, prompt }, oidcError: null };
  }
  return { oidcParams: emptyOidc, oidcError: null };
}

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [authView, setAuthView] = useState<AuthView>('login');

  const [{ oidcParams, oidcError }, setOidc] = useState(() => loadOidcFromUrl());

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
          targetUrl.hash = `id_token=${idToken}&state=${state}`;
        } else {
          targetUrl.hash = `error=login_required&error_description=${encodeURIComponent('Sesión no activa en el IdP')}&state=${state}`;
        }
      } catch (err) {
        console.error('Silent refresh error', err);
        targetUrl.hash = `error=server_error&error_description=${encodeURIComponent('No se pudo renovar el token')}&state=${state}`;
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
        const targetUrl = new URL(oidcParams.redirect_uri);
        targetUrl.hash = `id_token=${idToken}&state=${oidcParams.state || ''}`;
        window.location.href = targetUrl.toString();
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
            <div className="login-error-state">
              <div className="login-error-icon">✕</div>
              <h2>Acceso No Autorizado</h2>
              <p>{oidcError}</p>
              <a href="/" className="login-btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                Volver al Inicio
              </a>
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

export default App
