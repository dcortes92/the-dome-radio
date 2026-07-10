/**
 * @typedef {{ subscription_status?: string, premium_until?: string | null }} Profile
 */

/**
 * @param {Profile | null | undefined} profile
 */
export function isPremium(profile) {
  if (!profile) return false;
  if (profile.subscription_status === 'active') return true;
  if (profile.premium_until) {
    const t = new Date(profile.premium_until).getTime();
    if (!Number.isNaN(t) && t > Date.now()) return true;
  }
  return false;
}
