/** @vitest-environment happy-dom */
import { describe, it, expect } from 'vitest';
import { createCastController } from '../../src/cast/cast-controller.js';

describe('cast session state', () => {
  it('starts idle', () => {
    const c = createCastController();
    expect(c.getState()).toEqual({ provider: 'none', state: 'idle' });
  });

  it('reports availability via watchAvailability', async () => {
    const c = createCastController();
    const available = await new Promise((resolve) => {
      c.watchAvailability(resolve);
    });
    expect(typeof available).toBe('boolean');
  });
});
