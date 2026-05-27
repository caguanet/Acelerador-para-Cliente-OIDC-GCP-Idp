import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App';

const authMocks = vi.hoisted(() => ({
  sendSignInLinkToEmail: vi.fn(() => Promise.resolve()),
  signInWithEmailLink: vi.fn(() => Promise.resolve({
    user: { getIdToken: vi.fn(() => Promise.resolve('mock-id-token')) },
  })),
  isSignInWithEmailLink: vi.fn(() => false),
  sendPasswordResetEmail: vi.fn(() => Promise.resolve()),
  verifyPasswordResetCode: vi.fn(() => Promise.resolve('cliente@etb.com.co')),
  confirmPasswordReset: vi.fn(() => Promise.resolve()),
  checkActionCode: vi.fn(() => Promise.resolve({})),
  applyActionCode: vi.fn(() => Promise.resolve()),
  signInWithPopup: vi.fn(() => Promise.resolve({
    user: { getIdToken: vi.fn(() => Promise.resolve('mock-id-token')) },
  })),
  linkWithPopup: vi.fn(() => Promise.resolve()),
  getAdditionalUserInfo: vi.fn(() => ({ isNewUser: false })),
  signOut: vi.fn(() => Promise.resolve()),
  onAuthStateChanged: vi.fn((_auth, cb) => {
    if (typeof cb === 'function') cb(null);
    return () => {};
  }),
}));

// Mock firebase module to avoid real connections in tests
vi.mock('./firebase', () => ({
  auth: {},
}));
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
}));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  GoogleAuthProvider: vi.fn(() => ({})),
  OAuthProvider: vi.fn(() => ({})),
  FacebookAuthProvider: vi.fn(() => ({})),
  sendSignInLinkToEmail: authMocks.sendSignInLinkToEmail,
  signInWithEmailLink: authMocks.signInWithEmailLink,
  isSignInWithEmailLink: authMocks.isSignInWithEmailLink,
  sendPasswordResetEmail: authMocks.sendPasswordResetEmail,
  verifyPasswordResetCode: authMocks.verifyPasswordResetCode,
  confirmPasswordReset: authMocks.confirmPasswordReset,
  checkActionCode: authMocks.checkActionCode,
  applyActionCode: authMocks.applyActionCode,
  signInWithPopup: authMocks.signInWithPopup,
  linkWithPopup: authMocks.linkWithPopup,
  getAdditionalUserInfo: authMocks.getAdditionalUserInfo,
  signOut: authMocks.signOut,
  onAuthStateChanged: authMocks.onAuthStateChanged,
}));

// Mock themeConfig to avoid missing logo issues
vi.mock('./config/theme', () => ({
  themeConfig: {
    brandName: 'Test Brand',
    logoUrl: '/test-logo.png',
  }
}));


describe('App OIDC Logic', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    delete (window as any).location;
    (window as any).location = {
      ...originalLocation,
      search: '',
      pathname: '/',
      hash: '',
      href: '',
      assign: vi.fn(),
      replace: vi.fn(),
    };

    (window as any).APP_CONFIG = {
      allowedOrigins: ['http://localhost:3000', 'http://localhost:5173']
    };

    vi.stubGlobal('fetch', vi.fn());
    window.localStorage.clear();
    authMocks.onAuthStateChanged.mockImplementation((_auth, cb) => {
      if (typeof cb === 'function') cb(null);
      return () => {};
    });
  });

  afterEach(() => {
    (window as any).location = originalLocation;
    delete (window as any).APP_CONFIG;
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('detects OIDC parameters and sends a passwordless email link on valid request', async () => {
    window.location.search = '?redirect_uri=http://localhost:3000&client_id=test-client';
    render(<App />);
    expect(screen.getByRole('heading', { name: /Inicia sesión en tu cuenta/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Correo electrónico/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Número celular/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Contraseña/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Google/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Apple/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Facebook/i })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Correo electrónico/i), {
      target: { value: 'cliente@etb.com.co' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Enviar enlace de acceso/i }));

    await waitFor(() => {
      expect(authMocks.sendSignInLinkToEmail).toHaveBeenCalledWith(
        {},
        'cliente@etb.com.co',
        expect.objectContaining({ handleCodeInApp: true }),
      );
    });
    expect(screen.getByText(/Te enviamos un enlace seguro/i)).toBeInTheDocument();
    // Should show client info
    expect(screen.getByText('test-client')).toBeInTheDocument();
  });

  it('does not redirect the primary tab before the email link is confirmed', async () => {
    authMocks.onAuthStateChanged.mockImplementation((_auth, cb) => {
      if (typeof cb === 'function') {
        cb({ getIdToken: vi.fn(() => Promise.resolve('old-session-token')) });
      }
      return () => {};
    });
    window.location.search = '?redirect_uri=http://localhost:3000&client_id=test-client&state=abc';

    render(<App />);

    fireEvent.change(screen.getByPlaceholderText(/Correo electrónico/i), {
      target: { value: 'cliente@etb.com.co' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Enviar enlace de acceso/i }));

    await waitFor(() => {
      expect(authMocks.sendSignInLinkToEmail).toHaveBeenCalled();
    });
    expect(screen.getByText(/Esperando que confirmes el enlace/i)).toBeInTheDocument();
    expect(window.location.href).not.toContain('id_token=old-session-token');
  });

  it('blocks redirect to non-whitelisted domains', () => {
    window.location.search = '?redirect_uri=http://evil.com&client_id=test-client';
    vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<App />);
    // Should show error message
    expect(screen.getByText(/Acceso No Autorizado/i)).toBeInTheDocument();
    expect(screen.getByText(/Error de Seguridad/i)).toBeInTheDocument();
  });

  it('renders login form when no OIDC params', () => {
    window.location.search = '';
    render(<App />);
    expect(screen.getByRole('heading', { name: /Inicia sesión en tu cuenta/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Correo electrónico/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Número celular/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Contraseña/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Google/i })).toBeInTheDocument();
    // Should NOT show client_id info (no params)
    expect(screen.queryByText(/Acceso solicitado por/i)).not.toBeInTheDocument();
  });

  it('blocks direct IdP access when OIDC redirect is required', () => {
    (window as any).APP_CONFIG.requireOidcRedirect = true;
    window.location.search = '';

    render(<App />);

    expect(screen.getByText(/Acceso No Autorizado/i)).toBeInTheDocument();
    expect(screen.getByText(/Acceso restringido/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Correo electrónico/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /volver al inicio/i })).not.toBeInTheDocument();
  });

  it('requests native password reset without revealing whether the account exists', async () => {
    window.location.search = '';
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /recuperar tu contraseña/i }));
    fireEvent.change(screen.getByPlaceholderText(/Correo electrónico/i), {
      target: { value: 'cliente@etb.com.co' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Enviar enlace de recuperación/i }));

    await waitFor(() => {
      expect(authMocks.sendPasswordResetEmail).toHaveBeenCalledWith(
        {},
        'cliente@etb.com.co',
        expect.objectContaining({
          url: 'http://localhost:3000/',
          handleCodeInApp: false,
        }),
      );
    });
    expect(screen.getByText(/Si el correo está registrado/i)).toBeInTheDocument();
  });

  it('renders branded password reset action form and confirms a new password', async () => {
    window.location.search = '?mode=resetPassword&oobCode=abc123&continueUrl=%2F';
    render(<App />);

    expect(screen.getByRole('heading', { name: /Validando enlace/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(authMocks.verifyPasswordResetCode).toHaveBeenCalledWith({}, 'abc123');
    });

    expect(screen.getByRole('heading', { name: /Cambia tu contraseña/i })).toBeInTheDocument();
    expect(screen.getByText(/cliente@etb.com.co/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Nueva contraseña/i), {
      target: { value: 'ClaveNueva1!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Guardar contraseña/i }));

    await waitFor(() => {
      expect(authMocks.confirmPasswordReset).toHaveBeenCalledWith({}, 'abc123', 'ClaveNueva1!');
    });
    expect(screen.getByRole('heading', { name: /Contraseña actualizada/i })).toBeInTheDocument();
  });

  it('handles branded verify email action links', async () => {
    window.location.search = '?mode=verifyEmail&oobCode=verify123&continueUrl=%2F';
    render(<App />);

    await waitFor(() => {
      expect(authMocks.checkActionCode).toHaveBeenCalledWith({}, 'verify123');
      expect(authMocks.applyActionCode).toHaveBeenCalledWith({}, 'verify123');
    });

    expect(screen.getByRole('heading', { name: /Correo verificado/i })).toBeInTheDocument();
  });

  it('blocks email sign-in action without OIDC in continueUrl when redirect is required', () => {
    (window as any).APP_CONFIG.requireOidcRedirect = true;
    const continueUrl = encodeURIComponent('https://idp.example/');
    window.location.search = `?mode=signIn&oobCode=abc&continueUrl=${continueUrl}`;

    render(<App />);

    expect(screen.getByText(/Acceso No Autorizado/i)).toBeInTheDocument();
    expect(screen.getByText(/Acceso restringido/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Correo electrónico/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Inicia sesión en tu cuenta/i })).not.toBeInTheDocument();
  });

  it('blocks incomplete OIDC params when redirect is required', () => {
    (window as any).APP_CONFIG.requireOidcRedirect = true;
    window.location.search = '?client_id=test-client';

    render(<App />);

    expect(screen.getByText(/solicitud OIDC está incompleta/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Correo electrónico/i)).not.toBeInTheDocument();
  });

  it('delegates email sign-in to primary tab when heartbeat is alive', async () => {
    const coordination = await import('./utils/emailLinkTabCoordination');
    vi.spyOn(coordination, 'isPrimaryEmailLinkTabAlive').mockReturnValue(true);
    vi.spyOn(coordination, 'waitForPrimaryEmailLinkRedirect').mockResolvedValue(true);
    vi.spyOn(coordination, 'getActiveEmailLinkIntentId').mockReturnValue('intent-test');

    authMocks.isSignInWithEmailLink.mockReturnValue(true);
    window.localStorage.setItem('idp.emailForSignIn', 'cliente@etb.com.co');
    const continueTarget =
      'https://idp.example/?client_id=test-client&redirect_uri=http%3A%2F%2Flocalhost%3A3000&state=abc';
    window.location.search = `?mode=signIn&oobCode=link123&continueUrl=${encodeURIComponent(continueTarget)}`;
    const hrefBefore = window.location.href;

    render(<App />);

    await waitFor(() => {
      expect(authMocks.signInWithEmailLink).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText(/Puedes cerrar esta pestaña/i)).toBeInTheDocument();
    });
    expect(window.location.href).toBe(hrefBefore);

    vi.restoreAllMocks();
  });

  it('completes email sign-in action with OIDC nested in continueUrl', async () => {
    authMocks.isSignInWithEmailLink.mockReturnValue(true);
    window.localStorage.setItem('idp.emailForSignIn', 'cliente@etb.com.co');
    const continueTarget =
      'https://idp.example/?client_id=test-client&redirect_uri=http%3A%2F%2Flocalhost%3A3000&state=abc';
    window.location.search = `?mode=signIn&oobCode=link123&continueUrl=${encodeURIComponent(continueTarget)}`;

    render(<App />);

    await waitFor(() => {
      expect(authMocks.signInWithEmailLink).toHaveBeenCalledWith(
        {},
        'cliente@etb.com.co',
        expect.any(String),
      );
    });
    await waitFor(() => {
      expect(window.location.href).toContain('id_token=mock-id-token');
      expect(window.location.href).toContain('state=abc');
    });
  });

  it('completes passwordless login when returning with an email link', async () => {
    authMocks.isSignInWithEmailLink.mockReturnValueOnce(true);
    window.localStorage.setItem('idp.emailForSignIn', 'cliente@etb.com.co');
    window.location.search = '?redirect_uri=http://localhost:3000&client_id=test-client&state=abc';

    render(<App />);

    await waitFor(() => {
      expect(authMocks.signInWithEmailLink).toHaveBeenCalledWith(
        {},
        'cliente@etb.com.co',
        expect.any(String),
      );
    });
    await waitFor(() => {
      expect(window.location.href).toContain('id_token=mock-id-token');
      expect(window.location.href).toContain('state=abc');
    });
  });
});
