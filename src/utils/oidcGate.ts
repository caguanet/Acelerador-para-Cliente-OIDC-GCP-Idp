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
  /** Enlace de acceso por correo abierto en /auth/action?mode=signIn&oobCode=... */
  isEmailLinkSignInAction: boolean;
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
    const { passthroughParams, error } = extractOidcPassthroughParams(nested.searchParams);
    if (error) return null;
    return {
      redirect_uri,
      client_id,
      state: nested.searchParams.get('state'),
      nonce: nested.searchParams.get('nonce'),
      prompt: nested.searchParams.get('prompt'),
      passthroughParams,
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
  const nonce = params.get('nonce');
  const prompt = params.get('prompt');
  const { passthroughParams, error: passthroughError } = extractOidcPassthroughParams(params);

  if (passthroughError) {
    return { oidcParams: emptyOidc, oidcError: passthroughError, isEmailLinkSignInAction: false };
  }

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
      oidcParams: { redirect_uri, client_id, state, nonce, prompt, passthroughParams },
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
