import { DurableObject } from 'cloudflare:workers';
import { z } from 'zod';
import { createAuth } from './auth';
import { defaults, preferencesSchema } from '../src/shared/preferences';
import { webdavApi } from './webdav';
import { json, Problem, readJson, type Env } from './types';

export class BeyondFogService extends DurableObject<Env> {
  private auth: ReturnType<typeof createAuth>;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.auth = createAuth(env);
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS request_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, until INTEGER NOT NULL)');
  }
  private limit(key: string, max: number, seconds: number) {
    const now = Date.now();
    // Synchronous SQLite avoids interleaving check/increment on parallel requests.
    const row = this.ctx.storage.sql.exec<{count: number}>('INSERT INTO request_limits(key,count,until) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count = CASE WHEN until < ? THEN 1 ELSE count + 1 END, until = CASE WHEN until < ? THEN excluded.until ELSE until END RETURNING count', key, now + seconds*1000, now, now).one();
    if (row.count > max) throw new Problem(429, '操作过于频繁，请稍后重试');
    this.ctx.storage.sql.exec('DELETE FROM request_limits WHERE until < ?', now - 86400000);
  }
  async fetch(request: Request): Promise<Response> {
    try {
      const path = new URL(request.url).pathname;
      if (!this.env.BETTER_AUTH_SECRET || !this.env.OWNER_EMAIL) throw new Problem(503, '账号服务尚未配置');
      if (!['GET','HEAD'].includes(request.method) && request.headers.get('origin') !== this.env.APP_ORIGIN) throw new Problem(403, '请求来源不受信任');
      if (path.startsWith('/api/auth/')) {
        const ip = request.headers.get('cf-connecting-ip') ?? 'local';
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
        const id = Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');
        this.limit(`auth:${id}`, 60, 60);
        if (path === '/api/auth/sign-in/email') this.limit(`login:${id}`, 8, 300);
        if (path === '/api/auth/request-password-reset') {
          this.limit(`reset:${id}`, 3, 900); this.limit('reset:global', 10, 3600);
          if (!this.env.EMAIL) throw new Problem(503, '密码重置邮件尚未配置，请联系管理员');
        }
        // Expose only the required auth endpoints; account mutation and signup remain closed.
        if (!['/api/auth/sign-in/email','/api/auth/sign-out','/api/auth/get-session','/api/auth/change-password','/api/auth/request-password-reset','/api/auth/reset-password'].includes(path)) throw new Problem(403, '此认证功能未开放');
        if(request.method === 'POST') {
          const input=await readJson(request);
          const headers=new Headers(request.headers);headers.delete('Content-Length');
          request=new Request(request.url,{method:'POST',headers,body:JSON.stringify(input)});
        }
        return await this.auth.handler(request);
      }
      const session = await this.auth.api.getSession({headers: request.headers});
      if (!session || session.user.email.toLowerCase() !== this.env.OWNER_EMAIL.toLowerCase()) throw new Problem(401, '请先登录，或重新登录已过期的会话');
      const owner = session.user.id;
      this.limit(`private:${owner}`, 180, 60);
      if (path === '/api/preferences') {
        await this.env.DB.prepare('INSERT OR IGNORE INTO preferences(owner,version,data,updatedAt) VALUES (?,0,?,?)').bind(owner,JSON.stringify(defaults),new Date().toISOString()).run();
        if (request.method === 'GET') return json(await this.preferences(owner));
        if (request.method === 'PUT') {
          const input = z.object({version: z.number().int().nonnegative(), data: preferencesSchema}).strict().parse(await readJson(request));
          const result = await this.env.DB.prepare('UPDATE preferences SET data=?,version=version+1,updatedAt=? WHERE owner=? AND version=?').bind(JSON.stringify(input.data), new Date().toISOString(), owner, input.version).run();
          if (!result.meta.changes) return json({error: '另一台设备已修改设置，本地编辑仍被保留。', current: await this.preferences(owner)},409);
          return json({version: input.version+1, data: input.data});
        }
        throw new Problem(405,'方法不支持');
      }
      if (path.startsWith('/api/webdav/')) {
        this.limit(`dav:${owner}`, 30, 60);
        return await webdavApi(request, this.env, owner);
      }
      throw new Problem(404, '接口不存在');
    } catch (e) {
      if (e instanceof Problem) return json({error: e.message}, e.status);
      if (e instanceof z.ZodError) return json({error: '填写内容无效，请检查网址、路径和字段长度'},400);
      // Never log request URLs (reset tokens), headers, bodies or underlying provider exceptions.
      console.error('BeyondFog service error', {type: e instanceof Error ? e.name : 'Unknown'});
      return json({error: '服务暂时不可用，请稍后重试；免费额度耗尽时需等待恢复。'},503);
    }
  }
  private async preferences(owner: string) {
    const row = await this.env.DB.prepare('SELECT version,data FROM preferences WHERE owner=?').bind(owner).first<{version:number;data:string}>();
    return {version: row!.version, data: preferencesSchema.parse(JSON.parse(row!.data))};
  }
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    let response: Response;
    if (url.pathname.startsWith('/api/')) {
      try { response = await env.SERVICE.get(env.SERVICE.idFromName('beyondfog-private-service')).fetch(request); }
      catch { response = json({error: '服务暂时不可用或免费额度已耗尽，请稍后重试'},503); }
    } else response = await env.ASSETS.fetch(request);
    const result = new Response(response.body, response);
    result.headers.set('X-Content-Type-Options', 'nosniff');
    result.headers.set('Referrer-Policy','no-referrer');
    result.headers.set('X-Frame-Options','DENY');
    result.headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    if (url.protocol === 'https:') result.headers.set('Strict-Transport-Security','max-age=31536000');
    if (url.pathname.startsWith('/api/')) result.headers.set('Cache-Control','no-store, private');
    // Vite HMR needs ws/eval in development only.
    if (url.protocol === 'https:') result.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: https:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
    return result;
  },
} satisfies ExportedHandler<Env>;
