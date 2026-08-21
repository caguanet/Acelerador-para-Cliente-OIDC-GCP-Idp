/**
 * Lectura y saneamiento de respuestas del BFF, compartido por los formularios.
 * Regla UX/seguridad: nunca mostrar al usuario mensajes técnicos (códigos auth/...,
 * errores de JSON, "servidor"/"interno", stack traces).
 */
export type ApiJson = Record<string, unknown>;

export const NETWORK_ERROR = 'No pudimos conectarnos. Revisa tu conexión a internet e inténtalo de nuevo.';

export function isApiJson(value: unknown): value is ApiJson {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export async function readApiJson(response: Response): Promise<ApiJson | null> {
    if (response.status === 204 || response.status === 205) return null;

    try {
        if (typeof response.text === 'function') {
            const text = await response.text();
            if (!text.trim()) return null;

            try {
                const parsed = JSON.parse(text);
                return isApiJson(parsed) ? parsed : null;
            } catch (err) {
                console.warn('La API devolvió una respuesta que no es JSON válido.', {
                    status: response.status,
                    error: err,
                });
                return null;
            }
        }

        const parsed = await response.json();
        return isApiJson(parsed) ? parsed : null;
    } catch (err) {
        console.warn('No fue posible leer la respuesta JSON de la API.', {
            status: response.status,
            error: err,
        });
        return null;
    }
}

export function getApiString(data: ApiJson | null, key: string): string {
    const value = data?.[key];
    return typeof value === 'string' ? value : '';
}

export function looksTechnical(message: string): boolean {
    return /failed to execute|unexpected end of json|json input|syntaxerror|response\.json|firebase:|auth\/|returned status|stack trace|servidor|interno/i.test(message);
}

export function getSafeDisplayMessage(message: string, fallback: string): string {
    const cleanMessage = message.trim();
    if (!cleanMessage || cleanMessage.length > 180 || looksTechnical(cleanMessage)) return fallback;
    return cleanMessage;
}

export function getApiErrorMessage(data: ApiJson | null, fallback: string): string {
    return getSafeDisplayMessage(getApiString(data, 'error'), fallback);
}

export function getSafeErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof TypeError) return NETWORK_ERROR;
    if (error instanceof Error) return getSafeDisplayMessage(error.message, fallback);
    return fallback;
}
