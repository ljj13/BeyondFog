import { z } from 'zod';
export const wallpapers = [
  { id: 'alpine-mist', name: '雾入山林', author: 'Mary Brennan', source: 'https://unsplash.com/photos/uCcCAf6hGQU' },
  { id: 'cloud-peaks', name: '云上群峰', author: 'Katie Moum', source: 'https://unsplash.com/photos/ZoxA2AUNEww' },
  { id: 'winter-light', name: '冬日微光', author: 'Pascal Debrunner', source: 'https://unsplash.com/photos/8xkImX3so8U' },
] as const;
const file = z.string().min(1).max(255).refine(s => !/[/%\\\u0000-\u001f:#?]/.test(s) && s !== '.' && s !== '..');
export const shortcutSchema = z.object({ id: z.string().min(1).max(64), title: z.string().trim().min(1).max(40), folderId: z.string().min(1).max(64).nullable().default(null), url: z.url().max(2048).refine(s => { const u = new URL(s); return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password; }) }).strict();
export const folderSchema = z.object({id: z.string().min(1).max(64), name: z.string().trim().min(1).max(24)}).strict();
export const preferencesSchema = z.object({
  shortcutLayout: z.enum(['flat','folders']).default('flat'),
  folders: z.array(folderSchema).max(20).default([]),
  engine: z.enum(['google', 'bing', 'baidu']), newTab: z.boolean(),
  wallpaper: z.discriminatedUnion('kind', [z.object({kind: z.literal('builtin'), id: z.enum(['alpine-mist','cloud-peaks','winter-light'])}).strict(), z.object({kind: z.literal('webdav'), file}).strict()]),
  dim: z.number().min(0.15).max(0.7),
  shortcuts: z.array(shortcutSchema).max(100).refine(s => new Set(s.map(x => x.id)).size === s.length),
}).strict().superRefine((data,ctx)=>{
  const ids=new Set(data.folders.map(f=>f.id));
  if(ids.size!==data.folders.length)ctx.addIssue({code:'custom',path:['folders'],message:'文件夹 ID 重复'});
  for(const [i,s] of data.shortcuts.entries())if(s.folderId!==null&&!ids.has(s.folderId))ctx.addIssue({code:'custom',path:['shortcuts',i,'folderId'],message:'文件夹不存在'});
});
export type Preferences = z.infer<typeof preferencesSchema>;
export type Shortcut = z.input<typeof shortcutSchema>;
export type Folder = z.infer<typeof folderSchema>;
export const defaults: Preferences = preferencesSchema.parse({ engine: 'google', newTab: true, wallpaper: {kind: 'builtin', id: 'alpine-mist'}, dim: 0.32, shortcuts: [
  {id: 'github', title: 'GitHub', url: 'https://github.com/'},
  {id: 'gmail', title: 'Gmail', url: 'https://mail.google.com/'},
  {id: 'bilibili', title: '哔哩哔哩', url: 'https://www.bilibili.com/'},
  {id: 'wikipedia', title: '维基百科', url: 'https://zh.wikipedia.org/'},
  {id: 'cloudflare', title: 'Cloudflare', url: 'https://dash.cloudflare.com/'},
] });
export const engines = {google: 'Google', bing: '必应', baidu: '百度'};
export function searchUrl(engine: string, query: string): string {
  const endpoints: Record<string, [string,string]> = {google: ['https://www.google.com/search','q'], bing: ['https://www.bing.com/search','q'], baidu: ['https://www.baidu.com/s','wd']};
  const [base,param] = endpoints[engine] ?? endpoints.google;
  const url = new URL(base); url.searchParams.set(param, query); return url.href;
}
export function moveShortcut<T>(list: T[], from: number, to: number): T[] {
  const result = [...list];
  if (from < 0 || to < 0 || from >= list.length || to >= list.length) return result;
  result.splice(to, 0, ...result.splice(from, 1)); return result;
}
