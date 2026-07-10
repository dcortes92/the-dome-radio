import { describe, it, expect } from 'vitest';
import { isPremium } from '../../src/api/premium.js';

describe('isPremium', () => {
  it('is false for null/guest', () => {
    expect(isPremium(null)).toBe(false);
    expect(isPremium(undefined)).toBe(false);
    expect(isPremium({ subscription_status: 'free' })).toBe(false);
  });

  it('is true for active', () => {
    expect(isPremium({ subscription_status: 'active' })).toBe(true);
  });

  it('honors premium_until grace', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(isPremium({ subscription_status: 'canceled', premium_until: future })).toBe(true);
    expect(isPremium({ subscription_status: 'canceled', premium_until: past })).toBe(false);
  });
});
