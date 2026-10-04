import { XMLParser } from 'fast-xml-parser';
import { z } from 'zod';
import { fileUrl, imageType, normalizeDirectory, normalizeEndpoint, safeFile, seal, unseal } from './security';
import { json, Problem, readJson, type Env } from './types';
export const MAX_IMAGE = 20 * 1024 * 1024;
const array = <T>(v: T | T[] | undefined): T[] => v === undefined ? [] : Array.isArray(v) ? v : [v];
export function parseListing(xml: string, folder: string): {name: string; size: number}[] {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || xml.length > 2*1024*1024) throw new Problem(502, '网盘目录响应无效或过大');
  const parsed = new XMLParser({removeNSPrefix: true, processEntities: false, parseTagValue: false}).parse(xml);
  if (!parsed.multistatus) throw new Problem(502, '服务器没有返回 WebDAV 目录');
  const base = new URL(folder);
  const files = new Map<string,{name: string; size: number}>();
  for (const entry of array<any>(parsed.multistatus.response)) {
    try {
      const url = new URL(entry.href, base);
      if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname) || url.search || url.hash) continue;
      const name = safeFile(decodeURIComponent(url.pathname.slice(base.pathname.length)));
      if (!/\.(jpe?g|png|webp)$/i.test(name)) continue;
      const stat = array<any>(entry.propstat).find(s => /\s200\s/.test(s.status));
      if (!stat || stat.prop?.resourcetype?.collection !== undefined) continue;
      const size = Number(stat.prop?.getcontentlength);
      if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_IMAGE) continue;
      files.set(name,{name,size});
    } catch { /* Ignore any sibling, nested, or malformed href. */ }
  }
  return [...files.values()].sort((a,b)=>a.name.localeCompare(b.name,'zh-CN'));
}
export function limitedStream(body: ReadableStream<Uint8Array>, size: number, exact = true): ReadableStream<Uint8Array> {
  let count = 0;
  return body.pipeThrough(new TransformStream<Uint8Array,Uint8Array>({
    transform(chunk,c) {count += chunk.byteLength; if (count > size) throw new Problem(413,'文件超出允许大小'); c.enqueue(chunk);},
    flush() {if (exact && count !== size) throw new Problem(400,'上传文件长度不匹配');},
  }));
}
interface Connection {owner: string; version: number; endpoint: string; username: string; directory: string; secret: string}
function allowedHosts(env: Env) {return (env.WEBDAV_ALLOWED_HOSTS || 'dav.jianguoyun.com').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);}
function checkHost(endpoint: string, env: Env) {
  if (!allowedHosts(env).includes(new URL(endpoint).hostname)) throw new Problem(400,'此 WebDAV 域名尚未获准。坚果云可直接使用；其他网盘请先在部署配置中添加域名。');
}
function publicConnection(c: Connection | null, env: Env) {
  return {configured: Boolean(c), version: c?.version ?? 0, endpoint: c?.endpoint ?? 'https://dav.jianguoyun.com/dav/', username: c?.username ?? '', directory: c?.directory ?? 'BeyondFog/wallpapers', allowedHosts: allowedHosts(env)};
}
async function dav(c: Connection, env: Env, url: string, method: string, headers: Record<string,string> = {}, body?: ReadableStream<Uint8Array> | string) {
  checkHost(c.endpoint, env);
  const target = new URL(url), base = new URL(c.endpoint);
  if (target.origin !== base.origin || !target.pathname.startsWith(base.pathname)) throw new Problem(400, '网盘路径超出连接范围');
  const password = await unseal(JSON.parse(c.secret), env.WEBDAV_ENCRYPTION_KEY, c.owner);
  const encoded = new TextEncoder().encode(`${c.username}:${password}`);
  const auth = btoa(String.fromCharCode(...encoded));
  let r: Response;
  try {r = await fetch(url,{method,body,redirect: 'manual',signal: AbortSignal.timeout(method === 'PUT' ? 120000 : 20000),headers:{Authorization:`Basic ${auth}`,...headers}});}
  catch {throw new Problem(504,'网盘连接超时或传输失败，请重试');}
  if (r.status >= 300 && r.status < 400) {await r.body?.cancel(); throw new Problem(502,'网盘要求跳转；请填写最终 HTTPS 地址');}
  if ([401,403].includes(r.status)) {await r.body?.cancel(); throw new Problem(502,'网盘授权失败，请检查账号和应用密码');}
  if (r.status === 429) {await r.body?.cancel(); throw new Problem(429,'网盘请求次数已达限制，请稍后重试');}
  return r;
}
function folderUrl(c: Connection) {return fileUrl(c.endpoint, c.directory, '__scope__').replace(/__scope__$/, '');}
async function ensureDirectory(c: Connection, env: Env) {
  let url = c.endpoint;
  for (const segment of c.directory.split('/')) {
    url += encodeURIComponent(segment) + '/';
    const r = await dav(c,env,url,'MKCOL');
    await r.body?.cancel();
    if (![201,200,204,405].includes(r.status)) throw new Problem(502,'无法创建壁纸目录，请检查写入权限');
  }
}
async function boundedText(response: Response, max: number) {
  if (!response.body) return '';
  let count = 0;
  return new Response(response.body.pipeThrough(new TransformStream<Uint8Array,Uint8Array>({transform(chunk,c) {count+=chunk.byteLength; if(count>max) throw new Problem(502,'目录响应过大'); c.enqueue(chunk);}}))).text();
}
// Read only the signature, then replay those chunks; no full image buffer.
async function imageStream(body: ReadableStream<Uint8Array>, size?: number) {
  const reader = limitedStream(body,size ?? MAX_IMAGE,size!==undefined).getReader();
  const chunks: Uint8Array[] = []; let count = 0;
  while (count < 12) {const r = await reader.read(); if(r.done) break; chunks.push(r.value); count+=r.value.length;}
  const signature = new Uint8Array(Math.min(count,12)); let offset=0;
  for(const b of chunks) {const part=b.slice(0,12-offset); signature.set(part,offset); offset+=part.length; if(offset===12) break;}
  const type = imageType(signature);
  if(!type) {await reader.cancel(); throw new Problem(415,'仅支持真实 JPEG、PNG、WebP 图片');}
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {if(chunks.length) {controller.enqueue(chunks.shift()!); return;} const r=await reader.read(); if(r.done) controller.close(); else controller.enqueue(r.value);},
    cancel(reason) {return reader.cancel(reason);},
  });
  return {type,stream};
}
export async function webdavApi(request: Request, env: Env, owner: string): Promise<Response> {
  const url = new URL(request.url), path = url.pathname;
  let c = await env.DB.prepare('SELECT * FROM webdav WHERE owner=?').bind(owner).first<Connection>();
  if (path === '/api/webdav/connection') {
    if(request.method === 'GET') return json(publicConnection(c,env));
    if(request.method === 'PUT') {
      const input = z.object({version: z.number().int().nonnegative(), endpoint: z.string().max(1024), username: z.string().min(1).max(256).refine(s=>!s.includes(':')&&!/[\r\n]/.test(s)), directory:z.string().max(512), password:z.string().max(512).optional()}).strict().parse(await readJson(request));
      let endpoint: string, directory: string;
      try {endpoint=normalizeEndpoint(input.endpoint); directory=normalizeDirectory(input.directory);} catch(e) {throw new Problem(400,(e as Error).message);}
      checkHost(endpoint,env);
      if(c && c.version !== input.version || !c && input.version !== 0) return json({error:'另一台设备已修改网盘连接，请重新加载连接后再保存'},409);
      if(!input.password && (!c || c.endpoint!==endpoint || c.username!==input.username)) throw new Problem(400,'连接账号或地址改变时须输入应用密码');
      const secret = input.password ? JSON.stringify(await seal(input.password,env.WEBDAV_ENCRYPTION_KEY,owner)) : c!.secret;
      const result = c ? await env.DB.prepare('UPDATE webdav SET endpoint=?,username=?,directory=?,secret=?,version=version+1 WHERE owner=? AND version=?').bind(endpoint,input.username,directory,secret,owner,input.version).run() : await env.DB.prepare('INSERT OR IGNORE INTO webdav(owner,version,endpoint,username,directory,secret) VALUES (?,1,?,?,?,?)').bind(owner,endpoint,input.username,directory,secret).run();
      if(!result.meta.changes) return json({error:'连接保存冲突，请重新加载'},409);
      return json(publicConnection({owner,version:input.version+1,endpoint,username:input.username,directory,secret},env));
    }
    if(request.method==='DELETE') {
      const input=z.object({version:z.number().int().nonnegative()}).strict().parse(await readJson(request));
      const result=await env.DB.prepare('DELETE FROM webdav WHERE owner=? AND version=?').bind(owner,input.version).run();
      if(c && !result.meta.changes) return json({error:'连接已改变，请重新加载'},409);
      return json(publicConnection(null,env));
    }
  }
  if(!c) throw new Problem(400,'请先保存 WebDAV 连接');
  if(path === '/api/webdav/test' && request.method === 'POST') {
    await ensureDirectory(c,env);
    const r = await dav(c,env,folderUrl(c),'PROPFIND',{Depth:'0','Content-Type':'application/xml'},'<?xml version="1.0"?><propfind xmlns="DAV:"><prop><resourcetype/></prop></propfind>');
    await r.body?.cancel();
    if(r.status!==207) throw new Problem(502,'无法读取壁纸目录，请检查服务器地址');
    return json({ok:true,message:'连接正常，壁纸目录已就绪'});
  }
  if(path === '/api/webdav/files' && request.method === 'GET') {
    const r=await dav(c,env,folderUrl(c),'PROPFIND',{Depth:'1','Content-Type':'application/xml'},'<?xml version="1.0"?><propfind xmlns="DAV:"><prop><getcontentlength/><resourcetype/></prop></propfind>');
    if(r.status===404) {await r.body?.cancel(); return json({files:[],message:'目录尚未创建，请测试连接或上传图片'});}
    if(r.status!==207) {await r.body?.cancel(); throw new Problem(502,'网盘目录读取失败');}
    return json({files:parseListing(await boundedText(r,2*1024*1024),folderUrl(c))});
  }
  if(path === '/api/webdav/upload' && request.method === 'POST') {
    const size=Number(request.headers.get('x-file-size'));
    if(!Number.isSafeInteger(size)||size<12||size>MAX_IMAGE) throw new Problem(413,'每张图片须在 20 MB 以内');
    if(!request.body) throw new Problem(400,'文件为空');
    const {type,stream}=await imageStream(request.body,size);
    const name=`${crypto.randomUUID()}.${type==='image/jpeg'?'jpg':type==='image/png'?'png':'webp'}`;
    await ensureDirectory(c,env);
    const target=fileUrl(c.endpoint,c.directory,name);
    let collision=false;
    try {
      const r=await dav(c,env,target,'PUT',{'Content-Type':type,'If-None-Match':'*'},stream);
      await r.body?.cancel();collision=r.status===412;
      if(collision)throw new Problem(409,'文件名冲突，请重试上传');
      if(![200,201,204].includes(r.status)) throw new Problem(502,'上传失败，请检查网盘容量和写入权限');
    } catch(e) {
      // A failed streaming PUT may leave a partial file. Never delete a reported pre-existing collision.
      if(!collision)try{const cleanup=await dav(c,env,target,'DELETE');await cleanup.body?.cancel();}catch{/* Best effort; keep the original sanitized failure. */}
      throw e;
    }
    return json({name,size},201);
  }
  if(path === '/api/webdav/image' && request.method === 'GET') {
    let file: string; try {file=safeFile(url.searchParams.get('file')??'');} catch {throw new Problem(400,'文件路径无效');}
    if(!/\.(jpe?g|png|webp)$/i.test(file)) throw new Problem(415,'图片格式不支持');
    const r=await dav(c,env,fileUrl(c.endpoint,c.directory,file),'GET');
    if(r.status===404) {await r.body?.cancel(); throw new Problem(404,'图片已被移除，请选择其他壁纸');}
    if(r.status!==200||!r.body) {await r.body?.cancel(); throw new Problem(502,'壁纸读取失败');}
    const size=r.headers.has('content-length')?Number(r.headers.get('content-length')):undefined;
    if(size!==undefined&&(!Number.isSafeInteger(size)||size<12||size>MAX_IMAGE)) {await r.body.cancel(); throw new Problem(413,'壁纸无效或超过 20 MB，请重新上传');}
    const {type,stream}=await imageStream(r.body,size);
    return new Response(stream,{headers:{'Content-Type':type,'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Content-Disposition':'inline'}});
  }
  throw new Problem(404,'接口不存在或方法不支持');
}
