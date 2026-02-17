window.APP_CONFIG = {
  // Theme Configuration (Optional Override)
  // theme: {
  //   brandName: "My Company IDP",
  //   logoUrl: "https://via.placeholder.com/150",
  //   colors: {
  //     primary: "#007bff",
  //     secondary: "#6c757d"
  //   }
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
    "http://localhost:5173"
  ],

  // Set to false in production to hide the test dashboard/landing page
  enableLandingPage: true,

  // Backend URL
  BACKEND_URL: "http://localhost:8080"
};
