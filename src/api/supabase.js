import { createClient } from '@supabase/supabase-js';
import { store } from '../store.js';
import { isPremium } from './premium.js';
import { secureAssetUrl } from './radio-browser.js';

let client = null;

export function getSupabase() {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  client = createClient(url, key);
  return client;
}

/**
 * @param {{ onProfile?: (p: object | null) => void }} opts
 */
export async function initSupabaseAuth(opts = {}) {
  const sb = getSupabase();
  if (!sb) return null;

  sb.auth.onAuthStateChange(async (_event, session) => {
    if (!session?.user) {
      store.set('profile', null);
      opts.onProfile?.(null);
      return;
    }
    const { data: profile } = await sb
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();
    store.set('profile', profile);
    opts.onProfile?.(profile);

    // Pull favorites (server-wins)
    const { data: favs } = await sb.from('favorites').select('*').order('created_at', { ascending: false });
    if (favs) {
      store.set(
        'favs',
        favs.map((f) => ({ stationuuid: f.station_uuid, ...f.station_snapshot })),
      );
    }
  });

  return sb;
}

export async function signUp(email, password) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase not configured');
  return sb.auth.signUp({ email, password });
}

export async function signIn(email, password) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase not configured');
  return sb.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  const sb = getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
  store.set('profile', null);
}

export async function addFavorite(station) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase not configured');
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const snapshot = {
    name: station.name,
    favicon: secureAssetUrl(station.favicon),
    url: station.url_resolved || station.url,
    country: station.country,
    countrycode: station.countrycode,
    tags: station.tags,
    bitrate: station.bitrate,
  };
  return sb.from('favorites').upsert(
    { user_id: user.id, station_uuid: station.stationuuid, station_snapshot: snapshot },
    { onConflict: 'user_id,station_uuid' },
  );
}

export async function removeFavorite(stationUuid) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase not configured');
  return sb.from('favorites').delete().eq('station_uuid', stationUuid);
}

export async function upsertRecent(station) {
  const sb = getSupabase();
  if (!sb) return;
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return;
  const snapshot = {
    name: station.name,
    favicon: secureAssetUrl(station.favicon),
    url: station.url_resolved || station.url,
    country: station.country,
    countrycode: station.countrycode,
  };
  await sb.from('recents').upsert(
    {
      user_id: user.id,
      station_uuid: station.stationuuid,
      station_snapshot: snapshot,
      played_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,station_uuid' },
  );
}

export { isPremium };
