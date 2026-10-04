export interface Env {
  DB: D1Database;
  SERVICE: DurableObjectNamespace;
  ASSETS: Fetcher;
  APP_ORIGIN: string;
  OWNER_EMAIL: string;
  BETTER_AUTH_SECRET: string;
  WEBDAV_ENCRYPTION_KEY: string;
  WEBDAV_ALLOWED_HOSTS?: string;
  EMAIL_FROM: string;
  EMAIL?: SendEmail;
}
export class Problem extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const json = (value: unknown, status = 200) => Response.json(value, {status, headers: {'Cache-Control': 'no-store, private'}});
export async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Problem(415, '请使用 JSON 请求');
  let size = 0;
  const chunks:Uint8Array[]=[];
  const reader=request.body?.getReader();
  if(!reader)throw new Problem(400,'请求为空');
  try {
    while(true){const item=await reader.read();if(item.done)break;size+=item.value.byteLength;if(size>65536){await reader.cancel();throw new Problem(413,'请求过大');}chunks.push(item.value);}
  } finally {reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const raw=new TextDecoder().decode(bytes);
  if (raw.length > 65536) throw new Problem(413, '请求过大');
  try { return JSON.parse(raw); } catch { throw new Problem(400, '无效的 JSON'); }
}
