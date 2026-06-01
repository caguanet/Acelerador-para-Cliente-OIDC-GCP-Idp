window.APP_CONFIG = {
  // Tema (opcional). Por defecto el build usa `ETB_IDP_THEME_COLORS` en `src/config/theme.ts`;
  // `applyThemeCssVars` en `main.tsx` vuelca a `--brand-*` y `--brand-*-rgb`.
  // theme: {
  //   brandName: "ETB",
  //   logoUrl: "/branding/default/logo.svg",
  //   colors: {
  //     primary: "#214780",
  //     secondary: "#0092bc",
  //     accent: "#00E5FF",
  //     background: "#F8F9FB",
  //     text: "#080707",
  //     textSecondary: "#515151",
  //     action: "#d86055",
  //     cardBackground: "#fafafa",
  //     heroGradientStart: "#004b90",
  //     heroGradientEnd: "#0092bc",
  //   },
  //   hero: { title: "…", subtitle: "…" },
  // },

  // Runtime Firebase Config (if different from build time)
  // firebase: {
  //   apiKey: "...",
  //   authDomain: "...",
  //   projectId: "..."
  // },

  // Allowed Redirect Origins (for OIDC safety)
  allowedOrigins: [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://mietb.etb.com",
    "https://pedrocasas.pau.solutions"
  ],

  // Canonical IdP origin. When set, email links and direct visits through
  // alternate Cloud Run URLs are normalized to this origin.
  // canonicalIdpOrigin: "https://idp-service-2tczqvffra-ue.a.run.app",

  // Set to false in production to hide the test dashboard/landing page
  enableLandingPage: true,

  // Mobile promo visibility. If omitted, the IdP hides store badges only when
  // it looks embedded inside a mobile app webview.
  // showMobileStoreBadges: false,

  // Set to true in preview/production when the IdP must only be opened by
  // authorized OIDC clients with client_id + redirect_uri.
  requireOidcRedirect: false,

  // Backend URL
  BACKEND_URL: "http://localhost:8080",

  // Public reCAPTCHA Enterprise site key for registration/OTP risk checks.
  // Private assessment credentials must stay only in the BFF runtime.
  recaptchaSiteKey: ""
};
