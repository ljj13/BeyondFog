import { describe, it, expect } from 'vitest';
import { defaults, preferencesSchema } from '../../src/shared/preferences';
import { buildPresetImport, presetCategories, matchingShortcuts } from '../../src/shared/presets';
import { resolveFolderIcon } from '../../src/shared/folder-icons';

describe('folder icons and catalog import', () => {
  it('matches category names automatically and retains manual icons after rename', () => {
    expect(resolveFolderIcon('私人邮箱')).toBe('mail');
    expect(resolveFolderIcon('工作')).toBe('briefcase');
    expect(resolveFolderIcon('学习')).toBe('book');
    expect(resolveFolderIcon('购物')).toBe('shopping');
    expect(resolveFolderIcon('娱乐')).toBe('play');
    expect(resolveFolderIcon('工具')).toBe('tools');
    expect(resolveFolderIcon('收藏夹')).toBe('folder');
    expect(resolveFolderIcon('购物', 'heart')).toBe('heart');
  });
  it('imports email, reuses first same-name folder and moves existing unclassified without rewriting URL/order', () => {
    const input=preferencesSchema.parse({...defaults,folders:[{id:'first',name:'邮箱',icon:'heart'},{id:'second',name:'邮箱',icon:'book'}],shortcuts:defaults.shortcuts.map(s=>s.id==='gmail'?{...s,title:'我的 Gmail',url:'https://mail.google.com/mail/u/0/#inbox'}:s)});
    const original=structuredClone(input),ids=presetCategories[0].sites.map(s=>s.id);
    const result=buildPresetImport(input,ids);
    expect(input).toEqual(original);expect(result.added).toBe(3);expect(result.moved).toBe(1);expect(result.created).toBe(0);
    expect(result.data.folders).toEqual(input.folders);expect(result.data.shortcutLayout).toBe('flat');
    expect(result.data.shortcuts.slice(0,5).map(s=>s.id)).toEqual(defaults.shortcuts.map(s=>s.id));
    expect(result.data.shortcuts[1]).toMatchObject({title:'我的 Gmail',url:'https://mail.google.com/mail/u/0/#inbox',folderId:'first'});
    expect(result.data.shortcuts.slice(5).map(s=>s.title)).toEqual(['Outlook','QQ 邮箱','163 邮箱']);
    expect(buildPresetImport(result.data,ids).data).toEqual(result.data);
  });
  it('preserves already grouped sites and creates only effective selected categories in catalog order', () => {
    const input=preferencesSchema.parse({...defaults,folders:[{id:'private',name:'自定义',icon:'star'}],shortcuts:defaults.shortcuts.map(s=>({...s,folderId:s.id==='gmail'?'private':null}))});
    const result=buildPresetImport(input,['gmail']);expect(result.data).toEqual(input);expect(result.created).toBe(0);
    const many=buildPresetImport(defaults,['docs-qq','outlook','jd']);
    expect(many.data.folders.map(f=>f.name)).toEqual(['邮箱','购物','工具']);
    expect(many.data.shortcuts.slice(5).map(s=>s.title)).toEqual(['Outlook','京东','腾讯文档']);
  });
  it('matches official aliases but never lookalike domains; JD keeps the saved home URL', () => {
    const jd=presetCategories.flatMap(c=>c.sites).find(s=>s.id==='jd')!;
    const data=preferencesSchema.parse({...defaults,shortcuts:[{id:'a',title:'京东',url:'https://home.jd.com/'},{id:'b',title:'假网站',url:'https://jd.com.evil.example/'}]});
    expect(matchingShortcuts(data,jd).map(s=>s.id)).toEqual(['a']);
    const result=buildPresetImport(data,['jd']);expect(result.added).toBe(0);expect(result.data.shortcuts[0].url).toBe('https://home.jd.com/');expect(result.data.shortcuts[1].folderId).toBe(null);
  });
  it('rejects over-capacity imports atomically and does not create empty folders', () => {
    const full=preferencesSchema.parse({...defaults,shortcuts:Array.from({length:100},(_,i)=>({id:'s'+i,title:'站点'+i,url:'https://example.com/'+i}))});const before=structuredClone(full);
    expect(()=>buildPresetImport(full,['qq-mail'])).toThrow('最多 100');expect(full).toEqual(before);
    const folders=preferencesSchema.parse({...defaults,folders:Array.from({length:20},(_,i)=>({id:'f'+i,name:'分组'+i}))});
    expect(()=>buildPresetImport(folders,['outlook'])).toThrow('最多 20');
    expect(buildPresetImport(defaults,[]).data).toEqual(defaults);
    expect(presetCategories.flatMap(c=>c.sites)).toHaveLength(19);
  });
});
