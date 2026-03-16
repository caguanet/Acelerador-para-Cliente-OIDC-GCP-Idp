/// <reference types="vite/client" />

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
    theme?: any; // Partial<ThemeConfig> loaded at runtime
  }
}
