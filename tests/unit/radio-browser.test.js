import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api, BASES } from '../../src/api/radio-browser.js';

describe('radio-browser api failover', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns JSON from first healthy mirror', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ stations: 1 }),
      }),
    );
    const data = await api('/json/stats');
    expect(data.stations).toBe(1);
    expect(fetch).toHaveBeenCalled();
    expect(String(fetch.mock.calls[0][0])).toContain(BASES[0]);
  });

  it('fails over when first mirror errors', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });
    vi.stubGlobal('fetch', fetchMock);
    const data = await api('/json/stations/topclick/1');
    expect(data.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws when all mirrors fail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    await expect(api('/x')).rejects.toThrow(/All mirrors/);
  });
});
