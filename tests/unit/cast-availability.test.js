/** @vitest-environment happy-dom */
import { describe, it, expect } from 'vitest';
import { createCastController } from '../../src/cast/cast-controller.js';

describe('cast availability empty state', () => {
  it('getState stays idle when no session', () => {
    const c = createCastController();
    expect(c.getState().provider).toBe('none');
  });
});
