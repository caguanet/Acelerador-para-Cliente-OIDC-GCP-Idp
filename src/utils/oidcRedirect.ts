/**
 * Helpers compartidos para retorno OIDC Implicit (#id_token / errores en fragmento).
 */

export function buildOidcFragment(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

export function buildOidcReturnUrl(
  redirectUri: string,
  fragmentParams: Record<string, string>,
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
): void {
  window.location.href = buildOidcReturnUrl(redirectUri, {
    id_token: idToken,
    state,
  });
}
