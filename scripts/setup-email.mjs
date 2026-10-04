import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ProxyAgent,fetch } from 'undici';
const token=readFileSync(join(process.env.APPDATA,'xdg.config','.wrangler','config','default.toml'),'utf8').match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
if(!token)throw new Error('请先通过 Wrangler 登录');
const proxy=process.env.HTTPS_PROXY||process.env.HTTP_PROXY,dispatcher=proxy?new ProxyAgent(proxy):undefined;
const endpoint='https://api.cloudflare.com/client/v4/accounts/05201dce1f81fa08db008509ccc4a441/email/routing/addresses';
const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
const r=await fetch(endpoint,{headers,dispatcher}), list=await r.json();
if(!list.success)throw new Error('无法读取收件验证状态');
const existing=list.result.find(x=>x.email.toLowerCase()==='fogpurification@gmail.com');
if(existing) console.log(existing.verified?'邮箱已验证':'验证邮件已发送，请检查 Gmail。');
else {const created=await fetch(endpoint,{method:'POST',headers,dispatcher,body:JSON.stringify({email:'fogpurification@gmail.com'})});const value=await created.json();if(!value.success)throw new Error(value.errors?.map(e=>e.message).join(',')||'验证邮件发送失败');console.log('Cloudflare 已向 fogpurification@gmail.com 发送收件验证邮件。请点击邮件内的验证链接。');}
