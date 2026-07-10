const BASES = [
  'https://de1.api.radio-browser.info',
  'https://de2.api.radio-browser.info',
  'https://fi1.api.radio-browser.info',
  'https://at1.api.radio-browser.info',
];

let baseIdx = 0;

export async function api(path) {
  for (let i = 0; i < BASES.length; i++) {
    const b = BASES[(baseIdx + i) % BASES.length];
    try {
      const r = await fetch(b + path, { headers: { 'User-Agent': 'TheDome/1.0' } });
      if (!r.ok) throw new Error('bad status');
      baseIdx = (baseIdx + i) % BASES.length;
      return await r.json();
    } catch {
      /* next mirror */
    }
  }
  throw new Error('All mirrors unreachable');
}

export { BASES };
