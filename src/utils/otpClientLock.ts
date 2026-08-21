/**
 * Bloqueo de OTP del lado del cliente (cosmético): refleja el lock autoritativo
 * del servidor en localStorage para evitar reintentos obvios. La fuente de verdad
 * sigue siendo el servidor (respuesta 423); esto solo mejora la UX.
 */
const CLIENT_LOCK_MS = 2 * 60 * 60 * 1000;
const CLIENT_LOCK_PREFIX = 'mi-etb:otp-login-lock:';

export function isLockoutResponse(response: Response, message: string): boolean {
    return response.status === 423 || /superado los intentos|intentos permitidos|intenta nuevamente en 2 horas/i.test(message);
}

async function hashForClientStorage(value: string): Promise<string> {
    const normalized = value.trim().toLowerCase();
    if (!normalized || !window.crypto?.subtle) return '';
    const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function getClientLockKey(email: string): Promise<string> {
    const hash = await hashForClientStorage(email);
    return hash ? `${CLIENT_LOCK_PREFIX}${hash}` : '';
}

export async function getClientLockedUntil(email: string): Promise<number> {
    try {
        const key = await getClientLockKey(email);
        if (!key) return 0;
        const raw = window.localStorage.getItem(key);
        if (!raw) return 0;
        const parsed = JSON.parse(raw) as { lockedUntil?: number };
        const lockedUntil = Number(parsed.lockedUntil || 0);
        if (lockedUntil <= Date.now()) {
            window.localStorage.removeItem(key);
            return 0;
        }
        return lockedUntil;
    } catch {
        return 0;
    }
}

export async function rememberClientLock(email: string): Promise<void> {
    try {
        const key = await getClientLockKey(email);
        if (!key) return;
        window.localStorage.setItem(key, JSON.stringify({ lockedUntil: Date.now() + CLIENT_LOCK_MS }));
    } catch {
        // The server-side lock remains the source of truth.
    }
}
