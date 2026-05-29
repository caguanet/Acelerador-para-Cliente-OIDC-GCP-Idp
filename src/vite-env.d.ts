/// <reference types="vite/client" />

type AppConfigTheme = {
  brandName?: string;
  logoUrl?: string;
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
    action?: string;
    textSecondary?: string;
    cardBackground?: string;
    heroGradientStart?: string;
    heroGradientEnd?: string;
  };
  hero?: { title?: string; subtitle?: string };
};

interface Window {
  APP_CONFIG: {
    MODE: 'IDP' | 'MOCK';
    firebase?: {
      apiKey: string;
      authDomain: string;
      projectId: string;
    };
    IDP_URL?: string;
    CLIENT_ID?: string;
    REDIRECT_URI?: string;
    RESPONSE_TYPE?: string;
    SCOPE?: string;
    /** Origen canonico del IdP para QA/produccion temporal, por ejemplo https://...run.app. */
    canonicalIdpOrigin?: string;
    BACKEND_URL?: string;
    MOCK_CLIENT_URL?: string;
    allowedOrigins?: string[];
    recaptchaSiteKey?: string;
    enableLandingPage?: boolean;
    requireOidcRedirect?: boolean;
    /** Si true, la pestaña original intenta redirigir al partner. Default: false. */
    emailLinkPrimaryTabRedirect?: boolean;
    theme?: AppConfigTheme;
  };
  grecaptcha?: {
    enterprise?: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}
