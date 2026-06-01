import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getCanonicalIdpUrlForCurrentLocation,
  resolveAccessGate,
} from './oidcGate';

describe('oidcGate', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    delete (window as any).location;
    (window as any).location = {
      ...originalLocation,
      origin: 'http://localhost:5173',
      href: 'http://localhost:5173/',
      search: '',
      pathname: '/',
    };
    (window as any).APP_CONFIG = {
      allowedOrigins: ['http://localhost:3000', 'https://pedrocasas.pau.solutions'],
      requireOidcRedirect: false,
    };
  });

  afterEach(() => {
    (window as any).location = originalLocation;
    delete (window as any).APP_CONFIG;
  });

  it('resolveAccessGate preserves OIDC nonce and safe PAU trace from the launcher URL', () => {
    window.location.search =
      '?client_id=app&redirect_uri=https%3A%2F%2Fpedrocasas.pau.solutions%2Fcallback&state=s1&nonce=n1&trace=PAU14%3A56373%3Aew2h6q6y2u229&flow_id=ABC-123&channel=web';

    const gate = resolveAccessGate();
    expect(gate.oidcError).toBeNull();
    expect(gate.oidcParams.nonce).toBe('n1');
    expect(gate.oidcParams.passthroughParams.trace).toBe('PAU14:56373:ew2h6q6y2u229');
    expect(gate.oidcParams.passthroughParams.flow_id).toBe('ABC-123');
    expect(gate.oidcParams.passthroughParams.channel).toBe('web');
    expect(gate.oidcParams.passthroughParams.scope).toBeUndefined();
  });

  it('blocks invalid passthrough params instead of reflecting them', () => {
    window.location.search =
      '?client_id=app&redirect_uri=https%3A%2F%2Fpedrocasas.pau.solutions%2Fcallback&trace=%3Cscript%3Ealert(1)%3C%2Fscript%3E';

    const gate = resolveAccessGate();
    expect(gate.oidcError).toMatch(/parámetros de retorno no válidos/i);
    expect(gate.oidcParams.redirect_uri).toBeNull();
  });

  it('does not forward reserved protocol params as launcher passthrough', () => {
    window.location.search =
      '?client_id=app&redirect_uri=https%3A%2F%2Fpedrocasas.pau.solutions%2Fcallback&scope=openid&nonce=n1&id_token=fake&trace=PAU14%3A56373%3Aew2h6q6y2u229';

    const gate = resolveAccessGate();
    expect(gate.oidcError).toBeNull();
    expect(gate.oidcParams.nonce).toBe('n1');
    expect(gate.oidcParams.passthroughParams).toEqual({
      trace: 'PAU14:56373:ew2h6q6y2u229',
    });
  });

  it('blocks direct access when requireOidcRedirect is true', () => {
    (window as any).APP_CONFIG.requireOidcRedirect = true;
    window.location.search = '';

    const gate = resolveAccessGate();
    expect(gate.oidcError).toMatch(/Acceso restringido/i);
  });

  it('blocks Firebase email sign-in links (feature removed) when redirect is required', () => {
    (window as any).APP_CONFIG.requireOidcRedirect = true;
    window.location.search = '?mode=signIn&oobCode=abc&continueUrl=%2F';

    const gate = resolveAccessGate();
    expect(gate.oidcError).toMatch(/Acceso restringido/i);
  });

  it('builds a canonical redirect URL preserving path and query', () => {
    (window as any).APP_CONFIG.canonicalIdpOrigin = 'https://idp-service-2tczqvffra-ue.a.run.app';
    (window as any).location = {
      ...window.location,
      href: 'https://idp-service-296091754258.us-east1.run.app/?client_id=app&redirect_uri=https%3A%2F%2Fpedrocasas.pau.solutions%2Fcallback',
      origin: 'https://idp-service-296091754258.us-east1.run.app',
    };

    expect(getCanonicalIdpUrlForCurrentLocation()).toBe(
      'https://idp-service-2tczqvffra-ue.a.run.app/?client_id=app&redirect_uri=https%3A%2F%2Fpedrocasas.pau.solutions%2Fcallback',
    );
  });
});
