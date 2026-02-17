import { User } from "firebase/auth";
import { themeConfig } from "../config/theme";

interface HeroSectionProps {
  user: User | null;
  backendResponse: string | null;
}

export function HeroSection({ user, backendResponse }: HeroSectionProps) {
  return (
    <div className="hero-section">
      <h1>
        {themeConfig.hero.title}
      </h1>
      <p className="hero-subtitle">
        {themeConfig.hero.subtitle}
      </p>

      <div className="feature-grid">
        <div className="feature-card">
          <h3>Single Sign-On</h3>
          <p>
            Seamless access to all your applications with one set of credentials.
          </p>
        </div>
        <div className="feature-card">
          <h3>Secure Authentication</h3>
          <p>Enterprise-grade security compliant with OIDC standards.</p>
        </div>
        <div className="feature-card">
          <h3>User Management</h3>
          <p>
            Centralized profile and session management.
          </p>
        </div>
        <div className="feature-card">
            <div className="card-icon">⚡</div>
            <h3>High Performance</h3>
            <p>Low latency globally distributed infrastructure.</p>
        </div>
      </div>



      {user && backendResponse && (
        <div className="secure-data-panel">
          <h3>🔐 Datos Seguros del Backend</h3>
          <pre>{backendResponse}</pre>
        </div>
      )}
    </div>
  );
}
