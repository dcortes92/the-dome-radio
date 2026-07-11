/** @vitest-environment happy-dom */
import { describe, it, expect } from 'vitest';
import { shouldShowAds } from '../../src/ads/ads.js';

describe('shouldShowAds', () => {
  it('shows ads for guests and free users', () => {
    expect(shouldShowAds(null)).toBe(true);
    expect(shouldShowAds({ subscription_status: 'free' })).toBe(true);
  });

  it('hides ads for premium', () => {
    expect(shouldShowAds({ subscription_status: 'active' })).toBe(false);
  });
});
