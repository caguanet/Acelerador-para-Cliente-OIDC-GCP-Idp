/**
 * Validación OIDC centralizada: se ejecuta en el primer render de App
 * antes de montar formularios de correo, registro o handlers Firebase.
 */

export type OidcParams = {
  redirect_uri: string | null;
  client_id: string | null;
  state: string | null;
  nonce: string | null;
  prompt: string | null;
  passthroughParams: Record<string, string>;
};

export type AccessGateResult = {
  oidcParams: OidcParams;
  oidcError: string | null;
};

const emptyOidc: OidcParams = {
  redirect_uri: null,
  client_id: null,
  state: null,
  nonce: null,
  prompt: null,
  passthroughParams: {},
};

const RESTRICTED_MSG =
  'Acceso restringido: ingresa desde una aplicación autorizada para iniciar sesión.';

const INCOMPLETE_OIDC_MSG =
  'Acceso restringido: la solicitud OIDC está incompleta. Ingresa desde la aplicación autorizada.';

const UNAUTHORIZED_REDIRECT_MSG =
  'Error de Seguridad: El dominio de redirección no está autorizado.';

const INVALID_PASSTHROUGH_MSG =
  'Acceso restringido: la solicitud contiene parámetros de retorno no válidos.';

const RESERVED_OIDC_PARAM_NAMES = new Set([
  'access_token',
  'api_key',
  'apikey',
  'client_id',
  'code',
  'continueurl',
  'error',
  'error_description',
  'expires_in',
  'id_token',
  'mode',
  'nonce',
  'oobcode',
  'prompt',
  'redirect_uri',
  'refresh_token',
  'response_type',
  'scope',
  'state',
  'token',
  'token_type',
]);

const PASSTHROUGH_PARAM_NAME_REGEX = /^[A-Za-z][A-Za-z0-9_-]{0,39}$/;
const PASSTHROUGH_PARAM_VALUE_REGEX = /^[A-Za-z0-9:._~@/+,-]{1,256}$/;

function extractOidcPassthroughParams(params: URLSearchParams): {
  passthroughParams: Record<string, string>;
  error: string | null;
} {
  const passthroughParams: Record<string, string> = {};
  const seenNames = new Set<string>();

  for (const [name, value] of params.entries()) {
    const normalizedName = name.toLowerCase();
    if (RESERVED_OIDC_PARAM_NAMES.has(normalizedName)) continue;

    if (seenNames.has(normalizedName)) {
      return { passthroughParams: {}, error: INVALID_PASSTHROUGH_MSG };
    }
    seenNames.add(normalizedName);

    if (
      !PASSTHROUGH_PARAM_NAME_REGEX.test(name) ||
      !PASSTHROUGH_PARAM_VALUE_REGEX.test(value)
    ) {
      return { passthroughParams: {}, error: INVALID_PASSTHROUGH_MSG };
    }
    passthroughParams[name] = value;
  }

  return { passthroughParams, error: null };
}

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
    // Fallback de conveniencia SOLO en build de desarrollo y con opt-in explícito
    // (allowDevLocalhostOrigins). Nunca aplica en producción ni por defecto.
    if (
      validationOrigins.length === 0 &&
      import.meta.env.DEV &&
      window.APP_CONFIG?.allowDevLocalhostOrigins === true
    ) {
      return (
        (targetUrl.protocol === 'http:' || targetUrl.protocol === 'https:') &&
        (targetUrl.hostname === 'localhost' || targetUrl.hostname === '127.0.0.1')
      );
    }
    return validationOrigins.some((origin) => targetUrl.origin === origin);
  } catch {
    return false;
  }
}

/** Parámetros OIDC en la query actual (ruta raíz del IdP). */
function loadOidcFromSearchParams(params: URLSearchParams): AccessGateResult {
  const redirect_uri = params.get('redirect_uri');
  const client_id = params.get('client_id');
  const state = params.get('state');
  const nonce = params.get('nonce');
  const prompt = params.get('prompt');
  const { passthroughParams, error: passthroughError } = extractOidcPassthroughParams(params);

  if (passthroughError) {
    return { oidcParams: emptyOidc, oidcError: passthroughError };
  }

  if (redirect_uri || client_id) {
    if (!redirect_uri || !client_id) {
      if (requiresOidcRedirect()) {
        return { oidcParams: emptyOidc, oidcError: INCOMPLETE_OIDC_MSG };
      }
    }
  }

  if (redirect_uri && client_id) {
    if (!isValidOrigin(redirect_uri)) {
      return { oidcParams: emptyOidc, oidcError: UNAUTHORIZED_REDIRECT_MSG };
    }
    return {
      oidcParams: { redirect_uri, client_id, state, nonce, prompt, passthroughParams },
      oidcError: null,
    };
  }

  if (requiresOidcRedirect()) {
    return { oidcParams: emptyOidc, oidcError: RESTRICTED_MSG };
  }

  return { oidcParams: emptyOidc, oidcError: null };
}

/**
 * Resuelve si la URL actual puede mostrar captura de correo o debe bloquearse de inmediato.
 */
export function resolveAccessGate(): AccessGateResult {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  const oobCode = params.get('oobCode');

  // Firebase action links manejados por FirebaseActionForm (recuperación/verificación).
  const isOtherFirebaseAction =
    Boolean(oobCode) &&
    (mode === 'resetPassword' || mode === 'verifyEmail' || mode === 'recoverEmail');

  if (isOtherFirebaseAction) {
    return { oidcParams: emptyOidc, oidcError: null };
  }

  return loadOidcFromSearchParams(params);
}

export function hasValidOidcContext(params: OidcParams): boolean {
  return Boolean(params.redirect_uri && params.client_id && isValidOrigin(params.redirect_uri));
}
