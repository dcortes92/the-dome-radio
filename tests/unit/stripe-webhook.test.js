import { describe, it, expect } from 'vitest';
import { mapSubscriptionToProfile } from '../../netlify/functions/lib/subscription-map.js';

describe('mapSubscriptionToProfile', () => {
  it('maps active subscription', () => {
    const p = mapSubscriptionToProfile({
      status: 'active',
      current_period_end: 2000000000,
      cancel_at_period_end: false,
    });
    expect(p.subscription_status).toBe('active');
  });

  it('maps canceled with period end grace', () => {
    const p = mapSubscriptionToProfile({
      status: 'canceled',
      current_period_end: 2000000000,
      cancel_at_period_end: true,
    });
    expect(p.subscription_status).toBe('canceled');
    expect(p.premium_until).toBeTruthy();
  });

  it('maps past_due', () => {
    expect(mapSubscriptionToProfile({ status: 'past_due', current_period_end: 1 }).subscription_status).toBe(
      'past_due',
    );
  });
});
