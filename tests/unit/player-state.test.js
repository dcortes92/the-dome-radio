import { describe, it, expect } from 'vitest';

describe('player state labels', () => {
  function nextState(current, event) {
    const map = {
      idle: { play: 'loading', error: 'error' },
      loading: { playing: 'playing', error: 'error', pause: 'paused' },
      playing: { pause: 'paused', error: 'error', stop: 'idle' },
      paused: { play: 'loading', stop: 'idle' },
      error: { play: 'loading', stop: 'idle' },
    };
    return map[current]?.[event] || current;
  }

  it('transitions loading → playing → paused', () => {
    let s = 'idle';
    s = nextState(s, 'play');
    expect(s).toBe('loading');
    s = nextState(s, 'playing');
    expect(s).toBe('playing');
    s = nextState(s, 'pause');
    expect(s).toBe('paused');
  });

  it('does not stay playing on error', () => {
    expect(nextState('playing', 'error')).toBe('error');
  });
});
