import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RegisterForm } from './RegisterForm';

vi.mock('../firebase', () => ({
  auth: {},
}));

vi.mock('firebase/auth', () => ({
  signInWithCustomToken: vi.fn(),
  linkWithPopup: vi.fn(),
  GoogleAuthProvider: vi.fn(() => ({})),
  FacebookAuthProvider: vi.fn(() => ({})),
  OAuthProvider: vi.fn(() => ({})),
}));

describe('RegisterForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('pide solo documento al iniciar y muestra documento no editable tras OTP valido', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/customer/lookup') {
        return {
          ok: true,
          json: async () => ({
            sessionId: 'session-1',
            maskedEmail: 'cl****@etb.com.co',
          }),
        };
      }

      if (url === '/api/customer/otp/send') {
        return { ok: true, json: async () => ({ success: true }) };
      }

      if (url === '/api/customer/otp/validate') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            verificationToken: 'verification-token',
            maskedEmail: 'cl****@etb.com.co',
          }),
        };
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<RegisterForm onRegisterSuccess={vi.fn()} onGoToLogin={vi.fn()} />);

    expect(screen.queryByPlaceholderText('Apellido')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Fecha de expedición/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('N° de identificación'), {
      target: { value: '123456789' },
    });
    fireEvent.click(screen.getByText(/Acepto los/i).closest('label')!.querySelector('input')!);
    fireEvent.click(screen.getByText(/Acepto las/i).closest('label')!.querySelector('input')!);
    fireEvent.click(screen.getByRole('checkbox', { name: /Verificación de seguridad/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Crear cuenta$/i }));

    await screen.findByRole('heading', { name: /Verifica tu cuenta/i });

    const boxes = screen.getAllByRole('textbox', { name: /Dígito/i });
    '123456'.split('').forEach((digit, index) => {
      fireEvent.change(boxes[index], { target: { value: digit } });
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Número de identificación validado')).toHaveValue('123456789');
    }, { timeout: 2500 });

    expect(screen.getByLabelText('Número de identificación validado')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Tipo de documento validado')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Correo registrado')).toHaveValue('cl****@etb.com.co');
    expect(screen.getByPlaceholderText('Número de teléfono')).toBeInTheDocument();
  });

  it('MiPymes valida NIT y representante antes de habilitar contraseña', async () => {
    const lookupBodies: any[] = [];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/customer/lookup') {
        lookupBodies.push(JSON.parse(String(init?.body)));
        return {
          ok: true,
          json: async () => ({
            sessionId: 'mipyme-session-1',
            maskedEmail: 're****@empresa.com.co',
          }),
        };
      }

      if (url === '/api/customer/otp/send') {
        return { ok: true, json: async () => ({ success: true }) };
      }

      if (url === '/api/customer/otp/validate') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            verificationToken: 'mipyme-verification-token',
            maskedEmail: 're****@empresa.com.co',
          }),
        };
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<RegisterForm onRegisterSuccess={vi.fn()} onGoToLogin={vi.fn()} />);

    fireEvent.click(screen.getByRole('tab', { name: /MiPymes/i }));
    fireEvent.change(screen.getByLabelText('N° de identificación de empresa'), {
      target: { value: '900123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Continuar$/i }));

    await screen.findByLabelText('N° de identificación de representante legal');

    expect(screen.queryByPlaceholderText('Correo electrónico')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Contraseña')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('N° de identificación de representante legal'), {
      target: { value: '123456789' },
    });
    fireEvent.change(screen.getByLabelText('Fecha de expedición de tu documento'), {
      target: { value: '2020-01-15' },
    });
    fireEvent.change(screen.getByPlaceholderText('Apellido del representante legal'), {
      target: { value: 'Garcia' },
    });
    fireEvent.click(screen.getByText(/Acepto los/i).closest('label')!.querySelector('input')!);
    fireEvent.click(screen.getByText(/Acepto las/i).closest('label')!.querySelector('input')!);
    fireEvent.click(screen.getByRole('checkbox', { name: /Verificación de seguridad/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Crear cuenta$/i }));

    await screen.findByRole('heading', { name: /Verifica tu cuenta/i });

    expect(lookupBodies[0]).toMatchObject({
      customerType: 'MIPYMES',
      companyDocType: 'NIT',
      companyDocNumber: '900123456',
      repDocType: 'CC',
      repDocNumber: '123456789',
      acceptTerms: true,
      acceptDataPolicy: true,
    });

    expect(screen.getByText('re****@empresa.com.co')).toBeInTheDocument();

    const boxes = screen.getAllByRole('textbox', { name: /Dígito/i });
    '123456'.split('').forEach((digit, index) => {
      fireEvent.change(boxes[index], { target: { value: digit } });
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Número de identificación de empresa validado')).toHaveValue('900123456');
    }, { timeout: 2500 });

    expect(screen.getByLabelText('Número de identificación de empresa validado')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Número de identificación de representante validado')).toHaveValue('123456789');
    expect(screen.getByLabelText('Número de identificación de representante validado')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Correo registrado')).toHaveValue('re****@empresa.com.co');
    expect(screen.getByPlaceholderText('Número de teléfono')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Contraseña')).toBeInTheDocument();
  });
});
