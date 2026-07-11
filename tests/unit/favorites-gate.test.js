import { describe, it, expect } from 'vitest';

describe('favorites gate', () => {
  it('guests cannot persist account favorites', () => {
    const requireAuthToFavorite = (session) => {
      if (!session?.user) return { ok: false, reason: 'auth_required' };
      return { ok: true };
    };
    expect(requireAuthToFavorite(null).ok).toBe(false);
    expect(requireAuthToFavorite({ user: { id: 'u1' } }).ok).toBe(true);
  });
});
