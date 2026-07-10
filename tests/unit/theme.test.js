/** @vitest-environment happy-dom */
import { describe, it, expect, beforeEach } from 'vitest';
import { applyTheme, getTheme } from '../../src/theme.js';

describe('theme persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  it('persists and restores theme', () => {
    applyTheme('dark');
    expect(localStorage.getItem('dome:theme')).toBe(JSON.stringify('dark'));
    expect(getTheme()).toBe('dark');
    applyTheme('light');
    expect(getTheme()).toBe('light');
  });
});
