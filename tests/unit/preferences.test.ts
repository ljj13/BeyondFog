import { describe, it, expect } from 'vitest';
import { preferencesSchema, defaults, searchUrl, moveShortcut } from '../../src/shared/preferences';
describe('preferences and search', () => {
  it('upgrades old configurations without losing shortcuts or their order', () => {
    const legacy = { ...defaults, shortcuts: defaults.shortcuts.map(({folderId, ...site}) => site) } as Record<string, unknown>;
    delete legacy.shortcutLayout; delete legacy.folders;
    const upgraded = preferencesSchema.parse(legacy);
    expect(upgraded).toMatchObject({ shortcutLayout: 'flat', folders: [] });
    expect(upgraded.shortcuts.map(s => s.id)).toEqual(defaults.shortcuts.map(s => s.id));
    expect(upgraded.shortcuts.every(s => s.folderId === null)).toBe(true);
  });
  it('accepts folders and memberships but rejects dangling IDs, duplicates and over-capacity', () => {
    const data = { ...defaults, shortcutLayout: 'folders', folders: [{ id: 'work', name: '工作' }],
      shortcuts: [{ ...defaults.shortcuts[0], folderId: 'work' }] };
    expect(preferencesSchema.parse(data)).toMatchObject({ shortcutLayout: 'folders', folders: [{ id: 'work', name: '工作' }] });
    expect(() => preferencesSchema.parse({ ...data, shortcuts: [{ ...data.shortcuts[0], folderId: 'missing' }] })).toThrow();
    expect(() => preferencesSchema.parse({ ...data, folders: [data.folders[0], data.folders[0]] })).toThrow();
    expect(() => preferencesSchema.parse({ ...data, folders: Array.from({ length: 21 }, (_, i) => ({ id: String(i), name: String(i) })) })).toThrow();
  });
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
