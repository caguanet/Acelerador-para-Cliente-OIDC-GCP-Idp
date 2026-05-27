/**
 * Validación OIDC centralizada: se ejecuta en el primer render de App
 * antes de montar formularios de correo, registro o handlers Firebase.
 */

export type OidcParams = {
  redirect_uri: string | null;
  client_id: string | null;
  state: string | null;
  prompt: string | null;
};

export type AccessGateResult = {
  oidcParams: OidcParams;
  oidcError: string | null;
  /** Enlace de acceso por correo abierto en /auth/action?mode=signIn&oobCode=... */
  isEmailLinkSignInAction: boolean;
};

const emptyOidc: OidcParams = {
  redirect_uri: null,
  client_id: null,
  state: null,
  prompt: null,
};

const RESTRICTED_MSG =
  'Acceso restringido: ingresa desde una aplicación autorizada para iniciar sesión.';

const INCOMPLETE_OIDC_MSG =
  'Acceso restringido: la solicitud OIDC está incompleta. Ingresa desde la aplicación autorizada.';

const UNAUTHORIZED_REDIRECT_MSG =
  'Error de Seguridad: El dominio de redirección no está autorizado.';

export function requiresOidcRedirect(): boolean {
  return window.APP_CONFIG?.requireOidcRedirect === true;
}

export function getCanonicalIdpOrigin(): string | null {
  const configuredOrigin =
    window.APP_CONFIG?.canonicalIdpOrigin || window.APP_CONFIG?.IDP_URL || '';
  if (!configuredOrigin.trim()) return null;

  try {
    return new URL(configuredOrigin).origin;
  } catch {
    return null;
  }
}

export function getCanonicalIdpUrlForCurrentLocation(): string | null {
  const canonicalOrigin = getCanonicalIdpOrigin();
  if (!canonicalOrigin || canonicalOrigin === window.location.origin) return null;

  try {
    const target = new URL(window.location.href);
    target.protocol = new URL(canonicalOrigin).protocol;
    target.host = new URL(canonicalOrigin).host;
    return target.toString();
  } catch {
    return null;
  }
}

export function isValidOrigin(urlStr: string): boolean {
  try {
    const targetUrl = new URL(urlStr);
    const validationOrigins = [...(window.APP_CONFIG?.allowedOrigins || [])];
    if (import.meta.env.DEV && validationOrigins.length === 0) {
      return targetUrl.hostname === 'localhost';
    }
    return validationOrigins.some((origin) => targetUrl.origin === origin);
  } catch {
    return false;
  }
}

/** Extrae OIDC anidado en continueUrl (enlaces de correo Firebase). */
export function parseOidcFromContinueUrl(continueUrl: string | null): OidcParams | null {
  if (!continueUrl) return null;
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://localhost';
    const nested = new URL(continueUrl, base);
    const redirect_uri = nested.searchParams.get('redirect_uri');
    const client_id = nested.searchParams.get('client_id');
    if (!redirect_uri || !client_id) return null;
    return {
      redirect_uri,
      client_id,
      state: nested.searchParams.get('state'),
      prompt: nested.searchParams.get('prompt'),
    };
  } catch {
    return null;
  }
}

/** Parámetros OIDC en la query actual (ruta raíz del IdP). */
function loadOidcFromSearchParams(params: URLSearchParams): AccessGateResult {
  const redirect_uri = params.get('redirect_uri');
  const client_id = params.get('client_id');
  const state = params.get('state');
  const prompt = params.get('prompt');

  if (redirect_uri || client_id) {
    if (!redirect_uri || !client_id) {
      if (requiresOidcRedirect()) {
        return { oidcParams: emptyOidc, oidcError: INCOMPLETE_OIDC_MSG, isEmailLinkSignInAction: false };
      }
    }
  }

  if (redirect_uri && client_id) {
    if (!isValidOrigin(redirect_uri)) {
      return { oidcParams: emptyOidc, oidcError: UNAUTHORIZED_REDIRECT_MSG, isEmailLinkSignInAction: false };
    }
    return {
      oidcParams: { redirect_uri, client_id, state, prompt },
      oidcError: null,
      isEmailLinkSignInAction: false,
    };
  }

  if (requiresOidcRedirect()) {
    return { oidcParams: emptyOidc, oidcError: RESTRICTED_MSG, isEmailLinkSignInAction: false };
  }

  return { oidcParams: emptyOidc, oidcError: null, isEmailLinkSignInAction: false };
}

/**
 * Resuelve si la URL actual puede mostrar captura de correo o debe bloquearse de inmediato.
 */
export function resolveAccessGate(): AccessGateResult {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  const oobCode = params.get('oobCode');

  const isEmailLinkSignInAction = mode === 'signIn' && Boolean(oobCode);
  const isOtherFirebaseAction =
    Boolean(oobCode) &&
    (mode === 'resetPassword' || mode === 'verifyEmail' || mode === 'recoverEmail');

  if (isOtherFirebaseAction) {
    return { oidcParams: emptyOidc, oidcError: null, isEmailLinkSignInAction: false };
  }

  if (isEmailLinkSignInAction) {
    const fromContinue = parseOidcFromContinueUrl(params.get('continueUrl'));
    if (fromContinue?.redirect_uri && fromContinue.client_id) {
      if (!isValidOrigin(fromContinue.redirect_uri)) {
        return {
          oidcParams: emptyOidc,
          oidcError: UNAUTHORIZED_REDIRECT_MSG,
          isEmailLinkSignInAction: true,
        };
      }
      return { oidcParams: fromContinue, oidcError: null, isEmailLinkSignInAction: true };
    }
    if (requiresOidcRedirect()) {
      return { oidcParams: emptyOidc, oidcError: RESTRICTED_MSG, isEmailLinkSignInAction: true };
    }
    return { oidcParams: emptyOidc, oidcError: null, isEmailLinkSignInAction: true };
  }

  return loadOidcFromSearchParams(params);
}

export function hasValidOidcContext(params: OidcParams): boolean {
  return Boolean(params.redirect_uri && params.client_id && isValidOrigin(params.redirect_uri));
}
