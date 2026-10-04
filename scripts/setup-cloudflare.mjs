import { readFileSync,writeFileSync,mkdtempSync,rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const cli='node_modules/wrangler/bin/wrangler.js';
function run(args, options={}) {
  const r=spawnSync(process.execPath,[cli,...args],{encoding:'utf8',...options});
  if(r.status!==0) throw new Error(r.stderr||r.stdout||'Wrangler 失败');
  return r.stdout;
}
const config=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
if(config.d1_databases[0].database_id.startsWith('00000000')) {
  const databases=JSON.parse(run(['d1','list','--json']));
  let db=databases.find(d=>d.name==='beyondfog');
  if(!db) {const out=run(['d1','create','beyondfog']); const id=out.match(/"database_id"\s*:\s*"([a-f0-9-]+)"/i)?.[1]; if(!id) throw new Error('无法识别 D1 ID'); db={uuid:id};}
  config.d1_databases[0].database_id=db.uuid;
  writeFileSync('wrangler.jsonc',JSON.stringify(config,null,2)+'\n');
}
console.log(run(['d1','migrations','apply','beyondfog','--remote']));
let existing;
try {existing=JSON.parse(run(['secret','list']));}
catch(e) {if(/not found|does not exist|10007/i.test(e.message))existing=[];else throw e;}
const names=new Set(existing.map(s=>s.name));
const secrets={};
if(!names.has('BETTER_AUTH_SECRET')) secrets.BETTER_AUTH_SECRET=randomBytes(32).toString('base64url');
if(!names.has('WEBDAV_ENCRYPTION_KEY')) secrets.WEBDAV_ENCRYPTION_KEY=randomBytes(32).toString('hex');
if(Object.keys(secrets).length) {
  const dir=mkdtempSync(join(tmpdir(),'beyondfog-secrets-'));
  try {const file=join(dir,'secrets.json');writeFileSync(file,JSON.stringify(secrets),{mode:0o600});console.log(run(['secret','bulk',file]));}
  finally {rmSync(dir,{recursive:true,force:true});}
}
console.log('Cloudflare D1 和密钥准备完成；现有密钥保留，没有启用付费服务。');
