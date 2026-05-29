/**
 * Helpers compartidos para retorno OIDC Implicit (#id_token / errores en fragmento).
 */

export function buildOidcFragment(params: Record<string, string | null | undefined>): string {
  const safeParams = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== null && value !== undefined),
  ) as Record<string, string>;

  return new URLSearchParams(safeParams).toString();
}

export function buildOidcReturnUrl(
  redirectUri: string,
  fragmentParams: Record<string, string | null | undefined>,
): string {
  const targetUrl = new URL(redirectUri);
  targetUrl.hash = buildOidcFragment(fragmentParams);
  return targetUrl.toString();
}

/** Navega al partner con id_token y state en el hash (contrato launcher). */
export function redirectToOidcPartner(
  redirectUri: string,
  idToken: string,
  state: string,
  passthroughParams: Record<string, string> = {},
  nonce?: string | null,
): void {
  window.location.href = buildOidcReturnUrl(redirectUri, {
    id_token: idToken,
    state,
    nonce,
    ...passthroughParams,
  });
}

export function redirectToOidcPartnerError(
  redirectUri: string,
  error: string,
  errorDescription: string,
  state: string,
  passthroughParams: Record<string, string> = {},
  nonce?: string | null,
): void {
  window.location.href = buildOidcReturnUrl(redirectUri, {
    error,
    error_description: errorDescription,
    state,
    nonce,
    ...passthroughParams,
  });
}
