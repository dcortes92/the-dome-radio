import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api, BASES, secureAssetUrl, streamPlayCandidates } from '../../src/api/radio-browser.js';

describe('secureAssetUrl', () => {
  it('upgrades http favicons to https', () => {
    expect(secureAssetUrl('http://example.com/icon.png')).toBe('https://example.com/icon.png');
  });

  it('leaves https urls unchanged', () => {
    expect(secureAssetUrl('https://example.com/icon.png')).toBe('https://example.com/icon.png');
  });

  it('upgrades protocol-relative urls', () => {
    expect(secureAssetUrl('//cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png');
  });

  it('returns empty for missing values', () => {
    expect(secureAssetUrl('')).toBe('');
    expect(secureAssetUrl(null)).toBe('');
    expect(secureAssetUrl(undefined)).toBe('');
  });
});

describe('streamPlayCandidates', () => {
  it('prefers https then original http', () => {
    expect(streamPlayCandidates('http://stream.example:8000/mp3')).toEqual([
      'https://stream.example:8000/mp3',
      'http://stream.example:8000/mp3',
    ]);
  });

  it('returns only https when already secure', () => {
    expect(streamPlayCandidates('https://stream.example/live')).toEqual([
      'https://stream.example/live',
    ]);
  });

  it('normalizes protocol-relative to https then http', () => {
    expect(streamPlayCandidates('//cdn.example.com/live')).toEqual([
      'https://cdn.example.com/live',
      'http://cdn.example.com/live',
    ]);
  });

  it('returns empty for missing values', () => {
    expect(streamPlayCandidates('')).toEqual([]);
    expect(streamPlayCandidates(null)).toEqual([]);
  });
});

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
