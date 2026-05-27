import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EMAIL_LINK_INTENT_ID_KEY,
  claimEmailLinkOidcRedirect,
  clearEmailLinkTabCoordination,
  getActiveEmailLinkIntentId,
  isPrimaryEmailLinkTabAlive,
  startPrimaryEmailLinkTab,
  stopPrimaryEmailLinkTab,
} from './emailLinkTabCoordination';

describe('emailLinkTabCoordination', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.APP_CONFIG = {
      MODE: 'IDP',
      emailLinkPrimaryTabRedirect: true,
    };
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn()
        .mockReturnValueOnce('intent-1')
        .mockReturnValueOnce('tab-1'),
    });
  });

  afterEach(() => {
    stopPrimaryEmailLinkTab();
    clearEmailLinkTabCoordination();
    vi.unstubAllGlobals();
  });

  it('startPrimaryEmailLinkTab stores intent id and heartbeat', () => {
    const intentId = startPrimaryEmailLinkTab();
    expect(intentId).toBe('intent-1');
    expect(getActiveEmailLinkIntentId()).toBe('intent-1');
    expect(isPrimaryEmailLinkTabAlive('intent-1')).toBe(true);
  });

  it('isPrimaryEmailLinkTabAlive returns false when heartbeat is stale', () => {
    startPrimaryEmailLinkTab();
    const stale = JSON.stringify({
      intentId: 'intent-1',
      tabId: 'tab-1',
      ts: Date.now() - 10_000,
    });
    window.localStorage.setItem('idp.emailLinkPrimaryHeartbeat', stale);
    expect(isPrimaryEmailLinkTabAlive('intent-1')).toBe(false);
  });

  it('claimEmailLinkOidcRedirect allows only first claim per intent', () => {
    expect(claimEmailLinkOidcRedirect('intent-1')).toBe(true);
    expect(claimEmailLinkOidcRedirect('intent-1')).toBe(false);
  });

  it('clearEmailLinkTabCoordination removes intent id', () => {
    startPrimaryEmailLinkTab();
    clearEmailLinkTabCoordination('intent-1');
    expect(window.localStorage.getItem(EMAIL_LINK_INTENT_ID_KEY)).toBeNull();
  });

  it('isPrimaryEmailLinkTabAlive is false when coordination disabled', () => {
    window.APP_CONFIG = {
      MODE: 'IDP',
      emailLinkPrimaryTabRedirect: false,
    };
    startPrimaryEmailLinkTab();
    expect(isPrimaryEmailLinkTabAlive('intent-1')).toBe(false);
  });
});
