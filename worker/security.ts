const badSegment = (s: string) => !s || s === '.' || s === '..' || /[%\\\u0000-\u001f\u007f:#?]/u.test(s);
export function normalizeDirectory(value: string): string {
  const path = value.trim().replace(/\/+$/, '');
  if (path.length > 512 || path.split('/').some(badSegment)) throw new Error('目录须为相对路径，不能包含转义字符或上级目录');
  return path;
}
export function safeFile(value: string): string {
  if (value.length > 255 || value.includes('/') || badSegment(value)) throw new Error('无效的文件名');
  return value;
}
export function normalizeEndpoint(value: string): string {
  const u = new URL(value.trim());
  const host = u.hostname.toLowerCase();
  if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash || (u.port && u.port !== '443') || !host.includes('.') || /^\d+[.\d]*$/.test(host) || host.includes(':') || /(^|\.)(localhost|local|internal|test|invalid|onion)$/.test(host)) throw new Error('服务器必须是公网 HTTPS 域名，不能包含账号、查询参数或非标准端口');
  const rawPath = value.trim().replace(/^https:\/\/[^/]+/i, '').replace(/\/+$/, '');
  if (rawPath && rawPath.slice(1).split('/').some(s => {const decoded=decodeURIComponent(s);return badSegment(decoded)||decoded.includes('/');})) throw new Error('服务器路径无效');
  u.pathname = u.pathname.replace(/\/+$/, '') + '/';
  return u.href;
}
export function fileUrl(endpoint: string, directory: string, file: string): string {
  return normalizeEndpoint(endpoint) + normalizeDirectory(directory).split('/').map(encodeURIComponent).join('/') + '/' + encodeURIComponent(safeFile(file));
}
function bytes(value: string) { return Uint8Array.from(atob(value), c => c.charCodeAt(0)); }
function base64(value: ArrayBuffer | Uint8Array) { return btoa(String.fromCharCode(...new Uint8Array(value))); }
async function key(value: string) {
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error('加密密钥未配置');
  return crypto.subtle.importKey('raw', Uint8Array.from(value.match(/../g)!, x => parseInt(x, 16)), 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function seal(value: string, secret: string, owner: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(owner) }, await key(secret), new TextEncoder().encode(value));
  return { iv: base64(iv), data: base64(data) };
}
export async function unseal(value: {iv: string; data: string}, secret: string, owner: string): Promise<string> {
  const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(value.iv), additionalData: new TextEncoder().encode(owner) }, await key(secret), bytes(value.data));
  return new TextDecoder().decode(data);
}
export function imageType(b: Uint8Array): string | null {
  if (b[0] === 255 && b[1] === 216 && b[2] === 255) return 'image/jpeg';
  if ([137,80,78,71,13,10,26,10].every((v, i) => b[i] === v)) return 'image/png';
  if (new TextDecoder().decode(b.slice(0,4)) === 'RIFF' && new TextDecoder().decode(b.slice(8,12)) === 'WEBP') return 'image/webp';
  return null;
}
