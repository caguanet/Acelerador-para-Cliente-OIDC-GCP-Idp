/**
 * Coordinación entre pestaña IdP original (envío de enlace) y pestaña del correo (oobCode).
 * La primaria redirige al partner; la secundaria completa Firebase y muestra mensaje de cierre.
 */

export const EMAIL_LINK_INTENT_ID_KEY = 'idp.emailLinkIntentId';
const PRIMARY_HEARTBEAT_KEY = 'idp.emailLinkPrimaryHeartbeat';
const REDIRECT_STARTED_KEY = 'idp.emailLinkRedirectStarted';
const CHANNEL_NAME = 'idp-email-link';

const HEARTBEAT_INTERVAL_MS = 2000;
const HEARTBEAT_TTL_MS = 5000;
const SECONDARY_REDIRECT_WAIT_MS = 3000;

type HeartbeatPayload = {
  intentId: string;
  tabId: string;
  ts: number;
};

type RedirectStartedPayload = {
  intentId: string;
  ts: number;
};

type ChannelMessage =
  | { type: 'auth-complete'; intentId: string }
  | { type: 'redirect-started'; intentId: string };

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let activeTabId: string | null = null;

export function isEmailLinkTabCoordinationEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return window.APP_CONFIG?.emailLinkPrimaryTabRedirect !== false;
}

export function getActiveEmailLinkIntentId(): string | null {
  try {
    return window.localStorage.getItem(EMAIL_LINK_INTENT_ID_KEY);
  } catch {
    return null;
  }
}

/** Registra intento OIDC en pestaña que envió el correo e inicia heartbeat. */
export function startPrimaryEmailLinkTab(): string {
  const intentId = crypto.randomUUID();
  activeTabId = crypto.randomUUID();

  try {
    window.localStorage.setItem(EMAIL_LINK_INTENT_ID_KEY, intentId);
    clearRedirectStarted(intentId);
  } catch {
    /* storage bloqueado */
  }

  writeHeartbeat(intentId, activeTabId);
  stopPrimaryEmailLinkTabHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (activeTabId) writeHeartbeat(intentId, activeTabId);
  }, HEARTBEAT_INTERVAL_MS);

  return intentId;
}

export function stopPrimaryEmailLinkTab(): void {
  stopPrimaryEmailLinkTabHeartbeat();
  activeTabId = null;
  try {
    window.localStorage.removeItem(PRIMARY_HEARTBEAT_KEY);
  } catch {
    /* ignore */
  }
}

function stopPrimaryEmailLinkTabHeartbeat(): void {
  if (heartbeatTimer !== null) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function writeHeartbeat(intentId: string, tabId: string): void {
  const payload: HeartbeatPayload = { intentId, tabId, ts: Date.now() };
  try {
    window.localStorage.setItem(PRIMARY_HEARTBEAT_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function isPrimaryEmailLinkTabAlive(intentId: string | null): boolean {
  if (!intentId || !isEmailLinkTabCoordinationEnabled()) return false;

  try {
    const raw = window.localStorage.getItem(PRIMARY_HEARTBEAT_KEY);
    if (!raw) return false;
    const payload = JSON.parse(raw) as HeartbeatPayload;
    return (
      payload.intentId === intentId &&
      Date.now() - payload.ts < HEARTBEAT_TTL_MS
    );
  } catch {
    return false;
  }
}

function postChannelMessage(message: ChannelMessage): void {
  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage(message);
    channel.close();
  } catch {
    /* BroadcastChannel no disponible */
  }
}

/** Pestaña del correo: avisa que Firebase ya autenticó. */
export function notifyEmailLinkAuthComplete(intentId: string): void {
  postChannelMessage({ type: 'auth-complete', intentId });
}

/** Pestaña primaria: escucha auth-complete para reaccionar antes del sync de Firebase. */
export function subscribeEmailLinkAuthComplete(
  listener: (intentId: string) => void,
): () => void {
  if (!isEmailLinkTabCoordinationEnabled()) return () => undefined;

  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<ChannelMessage>) => {
      if (event.data?.type === 'auth-complete' && event.data.intentId) {
        listener(event.data.intentId);
      }
    };
  } catch {
    /* sin canal */
  }

  return () => {
    channel?.close();
  };
}

/** Solo una pestaña debe redirigir al partner por intentId. */
export function claimEmailLinkOidcRedirect(intentId: string): boolean {
  try {
    const raw = window.localStorage.getItem(REDIRECT_STARTED_KEY);
    if (raw) {
      const existing = JSON.parse(raw) as RedirectStartedPayload;
      if (existing.intentId === intentId && Date.now() - existing.ts < 120_000) {
        return false;
      }
    }
    const payload: RedirectStartedPayload = { intentId, ts: Date.now() };
    window.localStorage.setItem(REDIRECT_STARTED_KEY, JSON.stringify(payload));
    postChannelMessage({ type: 'redirect-started', intentId });
    return true;
  } catch {
    return true;
  }
}

function clearRedirectStarted(intentId: string): void {
  try {
    const raw = window.localStorage.getItem(REDIRECT_STARTED_KEY);
    if (!raw) return;
    const existing = JSON.parse(raw) as RedirectStartedPayload;
    if (existing.intentId === intentId) {
      window.localStorage.removeItem(REDIRECT_STARTED_KEY);
    }
  } catch {
    /* ignore */
  }
}

function isRedirectStartedForIntent(intentId: string): boolean {
  try {
    const raw = window.localStorage.getItem(REDIRECT_STARTED_KEY);
    if (!raw) return false;
    const payload = JSON.parse(raw) as RedirectStartedPayload;
    return payload.intentId === intentId && Date.now() - payload.ts < 120_000;
  } catch {
    return false;
  }
}

/** Pestaña del correo: espera a que la primaria inicie redirect al partner. */
export function waitForPrimaryEmailLinkRedirect(intentId: string): Promise<boolean> {
  if (isRedirectStartedForIntent(intentId)) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === REDIRECT_STARTED_KEY && isRedirectStartedForIntent(intentId)) {
        finish(true);
      }
    };

    let channel: BroadcastChannel | null = null;
    const onChannel = (event: MessageEvent<ChannelMessage>) => {
      if (
        event.data?.type === 'redirect-started' &&
        event.data.intentId === intentId
      ) {
        finish(true);
      }
    };

    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = onChannel;
    } catch {
      /* ignore */
    }

    window.addEventListener('storage', onStorage);
    const timer = setTimeout(() => finish(false), SECONDARY_REDIRECT_WAIT_MS);

    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener('storage', onStorage);
      channel?.close();
    };
  });
}

export function clearEmailLinkTabCoordination(intentId?: string | null): void {
  const resolvedIntentId = intentId ?? getActiveEmailLinkIntentId();
  stopPrimaryEmailLinkTab();
  try {
    if (resolvedIntentId) clearRedirectStarted(resolvedIntentId);
    window.localStorage.removeItem(EMAIL_LINK_INTENT_ID_KEY);
  } catch {
    /* ignore */
  }
}
