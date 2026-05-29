import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signInWithCustomToken } from 'firebase/auth';
import { EmailOtpLoginForm } from './EmailOtpLoginForm';

vi.mock('../firebase', () => ({
  auth: {},
}));

vi.mock('firebase/auth', () => ({
  signInWithCustomToken: vi.fn(),
}));

function jsonResponse(ok: boolean, body: Record<string, unknown>) {
  return { ok, status: ok ? 200 : 400, text: async () => JSON.stringify(body) };
}

describe('EmailOtpLoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete (window as any).APP_CONFIG;
    delete (window as any).grecaptcha;
  });

  it('valida el correo antes de llamar al BFF', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<EmailOtpLoginForm onSignInSuccess={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'no-es-correo' } });
    fireEvent.click(screen.getByRole('button', { name: /Enviar código de acceso/i }));

    expect(await screen.findByText(/correo electrónico válido/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('flujo completo: start → validate → login/complete → signInWithCustomToken', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/customer/otp/start-login') {
        return jsonResponse(true, { success: true, sessionId: 'sess-1', maskedEmail: 'cl****@etb.com.co' });
      }
      if (url === '/api/customer/otp/validate') {
        return jsonResponse(true, { success: true, verificationToken: 'vt-1' });
      }
      if (url === '/api/auth/login/complete') {
        return jsonResponse(true, { success: true, customToken: 'custom-token-1' });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    (signInWithCustomToken as any).mockResolvedValue({ user: { uid: 'uid-1' } });
    const onSignInSuccess = vi.fn();

    render(<EmailOtpLoginForm onSignInSuccess={onSignInSuccess} />);

    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'cliente@etb.com.co' } });
    fireEvent.click(screen.getByRole('button', { name: /Enviar código de acceso/i }));

    const codeInput = await screen.findByLabelText('Código de acceso');
    fireEvent.change(codeInput, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /Ingresar/i }));

    await waitFor(() => {
      expect(signInWithCustomToken).toHaveBeenCalledWith({}, 'custom-token-1');
      expect(onSignInSuccess).toHaveBeenCalledWith({ uid: 'uid-1' });
    });

    const calledUrls = fetchMock.mock.calls.map((c) => c[0]);
    expect(calledUrls).toEqual([
      '/api/customer/otp/start-login',
      '/api/customer/otp/validate',
      '/api/auth/login/complete',
    ]);
  });

  it('muestra error genérico y no autentica cuando el OTP es inválido', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/customer/otp/start-login') {
        return jsonResponse(true, { success: true, sessionId: 'sess-2', maskedEmail: 'cl****@etb.com.co' });
      }
      if (url === '/api/customer/otp/validate') {
        return jsonResponse(false, { error: 'Código OTP incorrecto. Te quedan 2 intento(s).' });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const onSignInSuccess = vi.fn();

    render(<EmailOtpLoginForm onSignInSuccess={onSignInSuccess} />);

    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'cliente@etb.com.co' } });
    fireEvent.click(screen.getByRole('button', { name: /Enviar código de acceso/i }));

    const codeInput = await screen.findByLabelText('Código de acceso');
    fireEvent.change(codeInput, { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: /Ingresar/i }));

    expect(await screen.findByText(/Código OTP incorrecto/i)).toBeInTheDocument();
    expect(signInWithCustomToken).not.toHaveBeenCalled();
    expect(onSignInSuccess).not.toHaveBeenCalled();
  });

  it('bloquea el acceso por código sin contexto OIDC cuando es requerido', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(
      <EmailOtpLoginForm onSignInSuccess={vi.fn()} oidcContextRequired hasValidOidcContext={false} />,
    );

    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'cliente@etb.com.co' } });
    fireEvent.click(screen.getByRole('button', { name: /Enviar código de acceso/i }));

    expect(screen.getByText(/Acceso restringido/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
