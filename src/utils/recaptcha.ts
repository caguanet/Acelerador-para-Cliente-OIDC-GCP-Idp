/**
 * reCAPTCHA Enterprise helpers shared by the registration and login flows.
 *
 * When no site key is configured (local/simulation), `getRecaptchaToken`
 * returns a simulation token that the BFF accepts in bypass mode.
 */

const RECAPTCHA_ENTERPRISE_SCRIPT_ID = 'recaptcha-enterprise-script';
const RECAPTCHA_SIM_TOKEN = 'SIM_TOKEN';

export type RecaptchaAction = 'lookup' | 'otp_send';

let recaptchaScriptPromise: Promise<void> | null = null;

export function getConfiguredRecaptchaSiteKey(): string {
    const runtimeKey = window.APP_CONFIG?.recaptchaSiteKey;
    const envKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
    return (runtimeKey || envKey || '').trim();
}

export function loadRecaptchaEnterprise(siteKey: string): Promise<void> {
    if (typeof window === 'undefined' || typeof document === 'undefined') return Promise.resolve();
    if (window.grecaptcha?.enterprise) return Promise.resolve();
    if (recaptchaScriptPromise) return recaptchaScriptPromise;

    recaptchaScriptPromise = new Promise((resolve, reject) => {
        const existingScript = document.getElementById(RECAPTCHA_ENTERPRISE_SCRIPT_ID);
        if (existingScript) {
            existingScript.addEventListener('load', () => resolve(), { once: true });
            existingScript.addEventListener('error', () => reject(new Error('No pudimos cargar la verificación de seguridad.')), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.id = RECAPTCHA_ENTERPRISE_SCRIPT_ID;
        script.src = `https://www.google.com/recaptcha/enterprise.js?render=${encodeURIComponent(siteKey)}`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => {
            recaptchaScriptPromise = null;
            reject(new Error('No pudimos cargar la verificación de seguridad.'));
        };
        document.head.appendChild(script);
    });

    return recaptchaScriptPromise;
}

export async function getRecaptchaToken(action: RecaptchaAction): Promise<string> {
    const siteKey = getConfiguredRecaptchaSiteKey();
    if (!siteKey) return RECAPTCHA_SIM_TOKEN;

    await loadRecaptchaEnterprise(siteKey);
    const enterprise = window.grecaptcha?.enterprise;
    if (!enterprise) {
        throw new Error('No pudimos cargar la verificación de seguridad.');
    }

    await new Promise<void>((resolve) => enterprise.ready(resolve));
    return enterprise.execute(siteKey, { action });
}
