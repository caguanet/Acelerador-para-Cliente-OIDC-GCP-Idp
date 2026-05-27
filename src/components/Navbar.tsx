import { User } from "firebase/auth";
import { themeConfig } from "../config/theme";

interface NavbarProps {
  user: User | null;
  onLoginClick: () => void;
  onLogoutClick: () => void;
}

function maskEmail(email: string | null) {
  if (!email) return 'Usuario autenticado';
  const [local, domain] = email.split('@');
  if (!local || !domain) return 'Usuario autenticado';
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

export function Navbar({ user, onLoginClick, onLogoutClick }: NavbarProps) {
  return (
    <nav className="navbar">
      <div className="nav-logo">{themeConfig.brandName}</div>
      <div className="nav-links">
        <a href="#features">Features</a>
        <a href="#pricing">Pricing</a>
        <a href="#about">About</a>
        {!user ? (
          <button className="nav-btn-login" onClick={onLoginClick}>
            Iniciar Sesión
          </button>
        ) : (
          <div className="user-badge">
            <span title="Correo de la sesión">{maskEmail(user.email)}</span>
            <button className="nav-btn-logout" onClick={onLogoutClick}>
              Salir
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
