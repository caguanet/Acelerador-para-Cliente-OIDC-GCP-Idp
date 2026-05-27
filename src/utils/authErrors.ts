type AuthContext = "login" | "social" | "recovery" | "otp";

type FirebaseLikeError = {
  code?: string;
  message?: string;
};

/**
 * Traduce errores técnicos de autenticación a mensajes claros para usuario final.
 * Regla UX: nunca exponer códigos internos (`auth/...`) en pantalla.
 */
export function getFriendlyAuthErrorMessage(
  error: FirebaseLikeError | unknown,
  context: AuthContext = "login",
): string {
  const code = extractCode(error);

  if (!code) return extractDisplayMessage(error) || genericMessage(context);

  const byCode: Record<string, string> = {
    // Credenciales / sesión
    "auth/invalid-credential": "Correo o contraseña incorrectos. Verifica tus datos e intenta de nuevo.",
    "auth/user-not-found": "No encontramos una cuenta con ese correo.",
    "auth/wrong-password": "Correo o contraseña incorrectos. Verifica tus datos e intenta de nuevo.",
    "auth/invalid-email": "El correo ingresado no tiene un formato válido.",
    "auth/user-disabled": "Tu cuenta está temporalmente deshabilitada. Contacta soporte.",
    "auth/too-many-requests":
      "Detectamos varios intentos seguidos. Espera unos minutos e inténtalo nuevamente.",

    // Proveedores sociales / popups
    "auth/popup-blocked":
      "Tu navegador bloqueó la ventana de inicio de sesión. Habilita ventanas emergentes para continuar.",
    "auth/popup-closed-by-user":
      "Cerraste la ventana antes de terminar el inicio de sesión. Inténtalo de nuevo cuando quieras.",
    "auth/cancelled-popup-request":
      "Ya hay un intento de inicio de sesión en curso. Espera un momento e inténtalo de nuevo.",
    "auth/account-exists-with-different-credential":
      "Este correo ya está registrado con otro método de acceso. Inicia sesión con ese método.",
    "auth/unauthorized-domain":
      "Este dominio no está autorizado para autenticación. Intenta desde el portal oficial.",
    "auth/expired-action-code":
      "El enlace venció. Solicita uno nuevo para continuar.",
    "auth/invalid-action-code":
      "El enlace no es válido o ya fue usado. Solicita uno nuevo para continuar.",
    "auth/weak-password":
      "Crea una contraseña más segura para continuar.",

    // Recuperación
    "auth/missing-email": "Ingresa tu correo para enviarte el enlace de recuperación.",

    // OTP / verificación
    "auth/invalid-verification-code": "El código ingresado no es válido. Verifícalo e intenta nuevamente.",
    "auth/code-expired": "El código venció. Solicita uno nuevo para continuar.",

    // Infra / red
    "auth/network-request-failed":
      "No pudimos conectarnos. Revisa tu conexión a internet e inténtalo de nuevo.",
    "auth/internal-error":
      "Ocurrió un inconveniente temporal. Inténtalo nuevamente en unos minutos.",
  };

  return byCode[code] || genericMessage(context);
}

function genericMessage(context: AuthContext): string {
  switch (context) {
    case "social":
      return "No pudimos completar el inicio de sesión con este proveedor. Inténtalo nuevamente.";
    case "recovery":
      return "No fue posible enviar el enlace de recuperación. Inténtalo nuevamente.";
    case "otp":
      return "No fue posible validar el código. Inténtalo nuevamente.";
    case "login":
    default:
      return "No fue posible iniciar sesión en este momento. Inténtalo nuevamente.";
  }
}

function extractDisplayMessage(error: FirebaseLikeError | unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const message = (error as FirebaseLikeError).message?.trim();
  if (!message) return undefined;

  const looksTechnical =
    /auth\/[a-z-]+/i.test(message) ||
    /firebase:/i.test(message) ||
    /mulesoft/i.test(message) ||
    /returned status/i.test(message) ||
    /stack trace/i.test(message);

  if (looksTechnical || message.length > 180) return undefined;
  return message;
}

function extractCode(error: FirebaseLikeError | unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const maybe = error as FirebaseLikeError;
  if (typeof maybe.code === "string" && maybe.code.trim().length > 0) return maybe.code;

  if (typeof maybe.message === "string") {
    const m = maybe.message.match(/\(auth\/[a-z-]+\)/i);
    if (m) return m[0].replace(/[()]/g, "");
  }
  return undefined;
}
