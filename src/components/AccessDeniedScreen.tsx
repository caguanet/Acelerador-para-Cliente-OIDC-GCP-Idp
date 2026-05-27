import { themeConfig } from '../config/theme';

/** Pantalla de bloqueo temprano: sin campo de correo ni acciones de autenticación. */
export function AccessDeniedScreen({ message }: { message: string }) {
  return (
    <div className="login-desktop">
      <div className="login-mobile-header">
        <img src={themeConfig.logoUrl} alt={themeConfig.brandName} className="login-mobile-logo" />
      </div>

      <div className="login-hero" aria-hidden="true">
        <div className="login-hero-inner">
          <h1 className="login-hero-title">
            Bienvenido
            <br />
            a Mi ETB
          </h1>
        </div>
      </div>

      <div className="login-card-panel">
        <div className="login-page-card">
          <div className="login-error-state" role="alert">
            <div className="login-error-icon">✕</div>
            <h2>Acceso No Autorizado</h2>
            <p>{message}</p>
            <p className="login-error-guidance">
              Cierra esta ventana e ingresa nuevamente desde la aplicación autorizada.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
