import { describe, it, expect } from 'vitest';
import { preferencesSchema, defaults, searchUrl, moveShortcut } from '../../src/shared/preferences';
describe('preferences and search', () => {
  it('starts with Google and licensed builtin wallpaper', () => {
    expect(defaults.engine).toBe('google');
    expect(preferencesSchema.parse(defaults).wallpaper.kind).toBe('builtin');
  });
  it('encodes search strings without turning them into query parameters', () => {
    const url = new URL(searchUrl('google', '雾 & a=1 + # ?'));
    expect(url.hostname).toBe('www.google.com');
    expect(url.searchParams.get('q')).toBe('雾 & a=1 + # ?');
    expect([...url.searchParams.keys()]).toEqual(['q']);
  });
  it.each(['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd'])('rejects dangerous shortcut URL %s', url => {
    expect(() => preferencesSchema.parse({ ...defaults, shortcuts: [{ id: 'a', title: 'A', url }] })).toThrow();
  });
  it('rejects duplicated shortcut IDs and invalid wallpaper paths', () => {
    expect(() => preferencesSchema.parse({ ...defaults, shortcuts: [defaults.shortcuts[0], defaults.shortcuts[0]] })).toThrow();
    expect(() => preferencesSchema.parse({ ...defaults, wallpaper: { kind: 'webdav', file: '../secret.jpg' } })).toThrow();
  });
  it('reorders without losing or mutating shortcuts', () => {
    const list = defaults.shortcuts;
    const moved = moveShortcut(list, 0, 2);
    expect(moved[2]).toEqual(list[0]);
    expect(moved).toHaveLength(list.length);
    expect(list[0].id).toBe('github');
  });
});
