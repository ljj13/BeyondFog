import { beforeEach,afterEach,it,expect,vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { webdavApi,MAX_IMAGE } from '../../worker/webdav';
import { seal } from '../../worker/security';
import { Problem,type Env } from '../../worker/types';
let db:DatabaseSync,env:Env;
const origin='https://home.example.com',key='10'.repeat(32),endpoint='https://dav.example.com/dav/';
beforeEach(async()=>{
  db=new DatabaseSync(':memory:');db.exec(readFileSync('migrations/0001_initial.sql','utf8'));
  db.prepare('INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt) VALUES (?,?,?,?,?,?)').run('owner','x','owner@example.com',1,'now','now');
  db.prepare('INSERT INTO webdav(owner,endpoint,username,directory,secret) VALUES (?,?,?,?,?)').run('owner',endpoint,'test-user','BeyondFog/wallpapers',JSON.stringify(await seal('test-app-password',key,'owner')));
  const prepare=(sql:string,args:any[]=[]):any=>({bind(...values:any[]){return prepare(sql,values);},async first(){return db.prepare(sql).get(...args)??null;},async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};}});
  env={DB:{prepare},WEBDAV_ENCRYPTION_KEY:key,WEBDAV_ALLOWED_HOSTS:'dav.example.com'} as unknown as Env;
});
afterEach(()=>{vi.restoreAllMocks();db.close();});
const request=(path:string,method='GET',body?:BodyInit,headers:Record<string,string>={})=>new Request(origin+'/api/webdav/'+path,{method,body,headers,...(body instanceof ReadableStream?{duplex:'half'}:{})} as RequestInit);
it('creates nested directory, uploads unique files without overwriting, streams bytes unchanged',async()=>{
  const seen:string[]=[],payloads:Uint8Array[]=[];
  const fetcher=vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
    expect(init?.redirect).toBe('manual');expect((init?.headers as Record<string,string>).Authorization).toMatch(/^Basic /);
    if(init?.method==='MKCOL') return new Response(null,{status:201});
    expect(init?.method).toBe('PUT');expect((init?.headers as Record<string,string>)['If-None-Match']).toBe('*');seen.push(String(input));payloads.push(new Uint8Array(await new Response(init?.body).arrayBuffer()));return new Response(null,{status:201});
  });
  const bytes=new Uint8Array([255,216,255,224,...new Array(1000).fill(42)]);
  for(let i=0;i<2;i++) {const r=await webdavApi(request('upload','POST',bytes,{'X-File-Size':String(bytes.length)}),env,'owner');expect(r.status).toBe(201);expect(await r.text()).not.toContain('test-app-password');}
  expect(fetcher).toHaveBeenCalledTimes(6);expect(seen[0]).not.toBe(seen[1]);expect(seen.every(s=>s.startsWith(endpoint+'BeyondFog/wallpapers/'))).toBe(true);expect(payloads).toEqual([bytes,bytes]);
});
it('reads original image bytes with private cache controls',async()=>{
  const bytes=new Uint8Array([255,216,255,224,...new Array(100).fill(4)]);
  vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(bytes,{headers:{'Content-Length':String(bytes.length),'Content-Type':'text/html'}}));
  const r=await webdavApi(request('image?file=%E5%B1%B1.jpg'),env,'owner');expect(r.headers.get('content-type')).toBe('image/jpeg');expect(r.headers.get('cache-control')).toContain('no-store');expect(new Uint8Array(await r.arrayBuffer())).toEqual(bytes);
});
it('streams an image when the provider omits Content-Length',async()=>{
  const bytes=new Uint8Array([255,216,255,224,...new Array(100).fill(4)]);
  vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(bytes));
  const r=await webdavApi(request('image?file=a.jpg'),env,'owner');expect(new Uint8Array(await r.arrayBuffer())).toEqual(bytes);
});
it.each([[401,502],[403,502],[429,429],[302,502],[404,404]])('maps upstream %i without exposing response bodies or credentials',async(status,expected)=>{
  vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('secret-provider-diagnostics',{status,headers:{Location:'https://evil.example/'}}));
  try {await webdavApi(request('image?file=a.jpg'),env,'owner');throw new Error('should fail');}catch(e){expect(e).toBeInstanceOf(Problem);expect((e as Problem).status).toBe(expected);expect((e as Error).message).not.toMatch(/secret-provider|test-app-password/);}
});
it('converts timeouts into recoverable errors',async()=>{
  vi.spyOn(globalThis,'fetch').mockRejectedValue(new DOMException('test-app-password','TimeoutError'));
  await expect(webdavApi(request('image?file=a.jpg'),env,'owner')).rejects.toMatchObject({status:504});
});
it('rejects unsupported and oversized uploads before calling upstream',async()=>{
  const fetcher=vi.spyOn(globalThis,'fetch');
  await expect(webdavApi(request('upload','POST','x',{'X-File-Size':String(MAX_IMAGE+1)}),env,'owner')).rejects.toMatchObject({status:413});
  await expect(webdavApi(request('upload','POST','<svg>evil</svg>',{'X-File-Size':'15'}),env,'owner')).rejects.toMatchObject({status:415});
  expect(fetcher).not.toHaveBeenCalled();
});
it('cleans only its unique partial upload after a transfer failure',async()=>{
  const puts:string[]=[],deletes:string[]=[];
  vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
    if(init?.method==='MKCOL')return new Response(null,{status:201});
    if(init?.method==='PUT'){puts.push(String(input));await new Response(init.body).arrayBuffer();throw new Error('partial transfer');}
    if(init?.method==='DELETE'){deletes.push(String(input));return new Response(null,{status:204});}
    throw new Error('unexpected method');
  });
  const bytes=new Uint8Array([255,216,255,224,...new Array(100).fill(1)]);
  await expect(webdavApi(request('upload','POST',bytes,{'X-File-Size':String(bytes.length)}),env,'owner')).rejects.toMatchObject({status:504});
  expect(deletes).toEqual(puts);expect(deletes).toHaveLength(1);
});
