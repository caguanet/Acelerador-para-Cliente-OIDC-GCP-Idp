import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App';

// Mock firebase module to avoid real connections in tests
vi.mock('./firebase', () => ({
  auth: {},
}));
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
}));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
}));

// Mock BrandLoginForm to isolate App logic
vi.mock('./components/BrandLoginForm', () => ({
  BrandLoginForm: ({ onSignInSuccess }: any) => (
    <div data-testid="brand-login-form">
      <span>Bienvenido a mi ETB</span>
      <button onClick={() => onSignInSuccess({ getIdToken: () => Promise.resolve('fake-token-123') })}>
        Simulate Login
      </button>
    </div>
  )
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
  });

  afterEach(() => {
    (window as any).location = originalLocation;
    delete (window as any).APP_CONFIG;
    vi.clearAllMocks();
  });

  it('detects OIDC parameters and shows login form on valid request', () => {
    window.location.search = '?redirect_uri=http://localhost:3000&client_id=test-client';
    render(<App />);
    // Should show the brand login form
    expect(screen.getByTestId('brand-login-form')).toBeInTheDocument();
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
    // Should show the login form
    expect(screen.getByTestId('brand-login-form')).toBeInTheDocument();
    // Should NOT show client_id info (no params)
    expect(screen.queryByText(/Acceso solicitado por/i)).not.toBeInTheDocument();
  });
});
