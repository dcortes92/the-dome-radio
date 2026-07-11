/** @vitest-environment happy-dom */
import { describe, it, expect, beforeEach } from 'vitest';
import { applyTheme, getTheme } from '../../src/theme.js';

describe('theme persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.className = '';
  });

  it('persists and restores theme via data-theme', () => {
    applyTheme('dark');
    expect(localStorage.getItem('dome:theme')).toBe(JSON.stringify('dark'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(getTheme()).toBe('dark');
    applyTheme('light');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(getTheme()).toBe('light');
  });
});
