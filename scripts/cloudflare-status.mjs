// Read-only account and zone discovery. OAuth material is used in memory and never printed.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ProxyAgent,fetch } from 'undici';
const file=join(process.env.APPDATA,'xdg.config','.wrangler','config','default.toml');
const text=readFileSync(file,'utf8'), token=text.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
if(!token)throw new Error('Wrangler OAuth 未找到，请运行 npx wrangler login');
const proxy=process.env.HTTPS_PROXY||process.env.HTTP_PROXY;
const dispatcher=proxy?new ProxyAgent(proxy):undefined;
async function get(path) {
  const r=await fetch(`https://api.cloudflare.com/client/v4/${path}`,{headers:{Authorization:`Bearer ${token}`},dispatcher});
  const body=await r.json();if(!body.success)throw new Error(`Cloudflare API ${r.status}: ${body.errors?.map(e=>e.message).join(',')}`);return body.result;
}
const zones=await get('zones?name=beyondfog.cc.cd');
console.log(JSON.stringify({zones:zones.map(z=>({id:z.id,name:z.name,status:z.status,nameServers:z.name_servers}))},null,2));
const recipients=await get('accounts/05201dce1f81fa08db008509ccc4a441/email/routing/addresses');
console.log(JSON.stringify({recipients:recipients.map(r=>({email:r.email,verified:Boolean(r.verified)}))},null,2));
console.log(JSON.stringify({workersSubdomain:await get('accounts/05201dce1f81fa08db008509ccc4a441/workers/subdomain')},null,2));
try {const subs=await get('accounts/05201dce1f81fa08db008509ccc4a441/subscriptions');console.log(JSON.stringify({subscriptions:subs.map(s=>({name:s.rate_plan?.public_name??s.rate_plan?.id,state:s.state,price:s.price}))},null,2));}catch(e){console.log('付费订阅检查不可用：'+e.message);}
const dns=await fetch('https://cloudflare-dns.com/dns-query?name=beyondfog.cc.cd&type=NS',{headers:{Accept:'application/dns-json'},dispatcher});
const answer=await dns.json();console.log(JSON.stringify({dnsStatus:answer.Status,dnsServers:answer.Answer?.map(a=>a.data)??[]},null,2));
