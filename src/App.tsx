import { useState, useEffect } from 'react'
import { User } from "firebase/auth";
import './index.css'
import './firebase'; // initializes Firebase before any component imports getAuth()
import { BrandLoginForm } from './components/BrandLoginForm';
import { OtpVerificationForm } from './components/OtpVerificationForm';
import { themeConfig } from './config/theme';

type LoginMode = 'password' | 'otp';


function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [loginMode, setLoginMode] = useState<LoginMode>('password');

  const [oidcParams, setOidcParams] = useState<{
    redirect_uri: string | null,
    client_id: string | null,
    state: string | null
  }>({ redirect_uri: null, client_id: null, state: null });
  const [oidcError, setOidcError] = useState<string | null>(null);

  const isValidOrigin = (urlStr: string) => {
    try {
      const targetUrl = new URL(urlStr);
      const validationOrigins = [...(window.APP_CONFIG?.allowedOrigins || [])];
      if (import.meta.env.DEV && validationOrigins.length === 0) {
        return targetUrl.hostname === 'localhost';
      }
      return validationOrigins.some(origin => targetUrl.origin === origin);
    } catch {
      return false;
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const redirect_uri = params.get('redirect_uri');
    const client_id = params.get('client_id');
    const state = params.get('state');

    if (redirect_uri && client_id) {
      if (!isValidOrigin(redirect_uri)) {
        setOidcError(`Error de Seguridad: El dominio de redirección no está autorizado.`);
        return;
      }
      setOidcParams({ redirect_uri, client_id, state });
    }
  }, []);

  const handleLoginSuccess = async (currentUser: User) => {
    try {
      const idToken = await currentUser.getIdToken();

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
          <h1 className="login-hero-title">Bienvenido<br/>a MiETB</h1>
          <p className="login-hero-accent">Autogestiona todos tus productos</p>
          <p className="login-hero-desc">fácilmente desde un solo lugar.</p>
          <p className="login-hero-app-label">Descarga y conoce la app MiETB</p>
          <div className="login-hero-badges">
            <a href="https://apps.apple.com" className="app-badge" aria-label="Download on the App Store" target="_blank" rel="noopener noreferrer">
              <svg width="20" height="20" viewBox="0 0 814 1000" fill="white" xmlns="http://www.w3.org/2000/svg">
                <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.7 0 663 0 541.8c0-194.3 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/>
              </svg>
              <span><small>Download on the</small><br/><b>App Store</b></span>
            </a>
            <a href="https://play.google.com" className="app-badge" aria-label="Get it on Google Play" target="_blank" rel="noopener noreferrer">
              <svg width="20" height="20" viewBox="0 0 512 512" fill="white" xmlns="http://www.w3.org/2000/svg">
                <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l232.6-232.6L47 0zm425.6 225.6l-58.9-34-67.7 67.7 67.7 67.7 59.1-34c16.8-9.7 16.8-34.7.8-67.4zm-160.5 133.4L99.5 512l280.8-161.2-67.2-91.8z"/>
              </svg>
              <span><small>GET IT ON</small><br/><b>Google Play</b></span>
            </a>
            <a href="https://appgallery.huawei.com" className="app-badge app-badge--huawei" aria-label="Explore on AppGallery" target="_blank" rel="noopener noreferrer">
              <svg width="20" height="20" viewBox="0 0 100 100" fill="white" xmlns="http://www.w3.org/2000/svg">
                <path d="M50 10 C50 10 65 25 65 40 C65 48 58 55 50 55 C42 55 35 48 35 40 C35 25 50 10 50 10Z"/>
                <path d="M50 10 C50 10 35 25 35 40 C35 48 42 55 50 55 C58 55 65 48 65 40 C65 25 50 10 50 10Z" fillOpacity="0.6"/>
                <path d="M20 50 C20 50 35 35 50 35 C58 35 65 42 65 50 C65 58 58 65 50 65 C35 65 20 50 20 50Z"/>
                <path d="M80 50 C80 50 65 35 50 35 C42 35 35 42 35 50 C35 58 42 65 50 65 C65 65 80 50 80 50Z" fillOpacity="0.6"/>
                <path d="M50 90 C50 90 35 75 35 60 C35 52 42 45 50 45 C58 45 65 52 65 60 C65 75 50 90 50 90Z"/>
              </svg>
              <span><small>EXPLÓRALO EN</small><br/><b>AppGallery</b></span>
            </a>
          </div>
        </div>
      </div>

      {/* Card panel — mobile: centered over bg | desktop: right side floating */}
      <div className="login-card-panel">
        <div className="login-page-card">
          {oidcError ? (
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
              {/* Toggle: Contraseña / OTP */}
              <div className="login-mode-tabs" role="tablist" aria-label="Método de acceso">
                <button
                  role="tab"
                  aria-selected={loginMode === 'password'}
                  className={`login-mode-tab${loginMode === 'password' ? ' login-mode-tab--active' : ''}`}
                  onClick={() => setLoginMode('password')}
                >
                  Contraseña
                </button>
                <button
                  role="tab"
                  aria-selected={loginMode === 'otp'}
                  className={`login-mode-tab${loginMode === 'otp' ? ' login-mode-tab--active' : ''}`}
                  onClick={() => setLoginMode('otp')}
                >
                  Código OTP
                </button>
              </div>

              {loginMode === 'password' ? (
                <BrandLoginForm onSignInSuccess={handleLoginSuccess} />
              ) : (
                <OtpVerificationForm
                  onSendCode={async (email) => {
                    await new Promise(r => setTimeout(r, 900));
                    if (email !== 'pruebamietb@yopmail.com') {
                      throw new Error('Correo no registrado en el sistema.');
                    }
                  }}
                  onVerifyCode={async (email, code) => {
                    await new Promise(r => setTimeout(r, 800));
                    if (email !== 'pruebamietb@yopmail.com' || code !== '987654') {
                      throw new Error('No fue posible autenticar tu usuario, por favor vuelve a intentarlo');
                    }
                  }}
                  onSuccess={() => setLoggedIn(true)}
                  onGoToRegister={() => setLoginMode('password')}
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

      {/* Mobile only: brand tagline */}
      <div className="login-tagline">
        <p><strong>Serás</strong> lo que <strong>creas</strong></p>
      </div>

    </div>
  );
}

export default App
