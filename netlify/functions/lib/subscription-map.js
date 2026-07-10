/**
 * Map a Stripe Subscription object to profiles columns.
 * Pure helper — unit-tested.
 */
export function mapSubscriptionToProfile(sub) {
  const status = sub.status;
  let subscription_status = 'free';
  if (status === 'active' || status === 'trialing') subscription_status = 'active';
  else if (status === 'past_due') subscription_status = 'past_due';
  else if (status === 'canceled' || status === 'unpaid') subscription_status = 'canceled';

  const premium_until =
    sub.cancel_at_period_end || subscription_status === 'canceled'
      ? new Date((sub.current_period_end || 0) * 1000).toISOString()
      : subscription_status === 'active'
        ? null
        : sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null;

  return { subscription_status, premium_until };
}
