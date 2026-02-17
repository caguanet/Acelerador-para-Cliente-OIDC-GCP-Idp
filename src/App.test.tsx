import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App';

// Mock child components to isolate App logic

vi.mock('./components/LoginModal', () => ({
  LoginModal: ({ isOpen, onSignInSuccess }: any) => (
    isOpen ? (
      <div data-testid="login-modal">
        Login Modal
        <button onClick={() => onSignInSuccess({ getIdToken: () => Promise.resolve('fake-token-123') })}>
          Simulate Login
        </button>
      </div>
    ) : null
  )
}));


describe('App OIDC Logic', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    // Reset window.location mock
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
    
    // Mock APP_CONFIG
    (window as any).APP_CONFIG = {
        allowedOrigins: ['http://localhost:3000', 'http://localhost:5173']
    };
  });

  afterEach(() => {
    (window as any).location = originalLocation;
    delete (window as any).APP_CONFIG;
    vi.clearAllMocks();
  });

  it('detects OIDC parameters and shows login modal on valid request', () => {
    window.location.search = '?redirect_uri=http://localhost:3000&client_id=test-client';
    render(<App />);
    // Should NOT show the service status page, but the login prompt
    expect(screen.queryByText(/Identity Provider Service/i)).not.toBeInTheDocument();
    // Should show the login modal (mocked) and client info
    expect(screen.getByText('Login Modal')).toBeInTheDocument();
    expect(screen.getByText('test-client')).toBeInTheDocument();
  });

  it('blocks redirect to non-whitelisted domains', async () => {
    window.location.search = '?redirect_uri=http://evil.com&client_id=test-client';
    vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<App />);
    // Should show error message instead of main service page
    expect(screen.getByText(/Acceso No Autorizado/i)).toBeInTheDocument();
    expect(screen.getByText(/Error de Seguridad/i)).toBeInTheDocument();
  });

  it('renders Service Status when no params', () => {
    window.location.pathname = '/';
    window.location.search = '';
    render(<App />);
    expect(screen.getByText(/Identity Provider Service/i)).toBeInTheDocument();
    expect(screen.queryByText('Navbar')).not.toBeInTheDocument();
  });
});
