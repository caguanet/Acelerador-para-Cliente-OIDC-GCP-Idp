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
  signInWithPopup: vi.fn(() => Promise.resolve({
    user: { getIdToken: vi.fn(() => Promise.resolve('mock-id-token')) },
  })),
  linkWithPopup: vi.fn(() => Promise.resolve()),
  getAdditionalUserInfo: vi.fn(() => ({ isNewUser: false })),
  signOut: vi.fn(() => Promise.resolve()),
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
  signInWithPopup: authMocks.signInWithPopup,
  linkWithPopup: authMocks.linkWithPopup,
  getAdditionalUserInfo: authMocks.getAdditionalUserInfo,
  signOut: authMocks.signOut,
  onAuthStateChanged: vi.fn((_auth, cb) => {
    if (typeof cb === 'function') cb(null);
    return () => {};
  }),
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

  it('requests native password reset without revealing whether the account exists', async () => {
    window.location.search = '';
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /recuperar tu contraseña/i }));
    fireEvent.change(screen.getByPlaceholderText(/Correo electrónico/i), {
      target: { value: 'cliente@etb.com.co' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Enviar enlace de recuperación/i }));

    await waitFor(() => {
      expect(authMocks.sendPasswordResetEmail).toHaveBeenCalledWith({}, 'cliente@etb.com.co');
    });
    expect(screen.getByText(/Si el correo está registrado/i)).toBeInTheDocument();
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
