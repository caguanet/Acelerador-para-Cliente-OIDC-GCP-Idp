import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getCanonicalIdpUrlForCurrentLocation,
  parseOidcFromContinueUrl,
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

  it('parseOidcFromContinueUrl extracts nested OIDC params', () => {
    const nested =
      'https://idp.example/?client_id=app&redirect_uri=https%3A%2F%2Fpedrocasas.pau.solutions%2Fcallback&state=s1';
    const result = parseOidcFromContinueUrl(nested);
    expect(result?.client_id).toBe('app');
    expect(result?.redirect_uri).toBe('https://pedrocasas.pau.solutions/callback');
    expect(result?.state).toBe('s1');
  });

  it('blocks direct access when requireOidcRedirect is true', () => {
    (window as any).APP_CONFIG.requireOidcRedirect = true;
    window.location.search = '';

    const gate = resolveAccessGate();
    expect(gate.oidcError).toMatch(/Acceso restringido/i);
    expect(gate.isEmailLinkSignInAction).toBe(false);
  });

  it('blocks email sign-in action without OIDC in continueUrl when required', () => {
    (window as any).APP_CONFIG.requireOidcRedirect = true;
    window.location.search = '?mode=signIn&oobCode=abc&continueUrl=%2F';

    const gate = resolveAccessGate();
    expect(gate.oidcError).toMatch(/Acceso restringido/i);
    expect(gate.isEmailLinkSignInAction).toBe(true);
  });

  it('allows email sign-in action with valid continueUrl OIDC', () => {
    (window as any).APP_CONFIG.requireOidcRedirect = true;
    const continueUrl = encodeURIComponent(
      'https://idp.example/?client_id=app&redirect_uri=https%3A%2F%2Fpedrocasas.pau.solutions%2Fcallback',
    );
    window.location.search = `?mode=signIn&oobCode=abc&continueUrl=${continueUrl}`;

    const gate = resolveAccessGate();
    expect(gate.oidcError).toBeNull();
    expect(gate.isEmailLinkSignInAction).toBe(true);
    expect(gate.oidcParams.redirect_uri).toBe('https://pedrocasas.pau.solutions/callback');
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
