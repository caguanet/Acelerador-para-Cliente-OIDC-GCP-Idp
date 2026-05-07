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
    BACKEND_URL?: string;
    MOCK_CLIENT_URL?: string;
    allowedOrigins?: string[];
    enableLandingPage?: boolean;
    theme?: AppConfigTheme;
  }
}
