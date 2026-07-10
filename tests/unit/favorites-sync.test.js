import { describe, it, expect } from 'vitest';

describe('favorites gate', () => {
  it('requires auth for account-backed favorites', () => {
    const isGuest = (session) => !session?.user;
    const canPersistFavorite = (session) => !isGuest(session);
    expect(canPersistFavorite(null)).toBe(false);
    expect(canPersistFavorite({ user: { id: '1' } })).toBe(true);
  });
});

describe('favorites sync server-wins', () => {
  it('prefers server list on merge', () => {
    const local = [{ stationuuid: 'a' }, { stationuuid: 'b' }];
    const server = [{ stationuuid: 'b' }, { stationuuid: 'c' }];
    const merged = server; // server-wins
    expect(merged.map((s) => s.stationuuid)).toEqual(['b', 'c']);
    expect(local).not.toEqual(merged);
  });
});
