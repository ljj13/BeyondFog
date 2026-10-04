import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ProxyAgent,fetch } from 'undici';
const token=readFileSync(join(process.env.APPDATA,'xdg.config','.wrangler','config','default.toml'),'utf8').match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
if(!token)throw new Error('请先运行 Wrangler 登录');
const proxy=process.env.HTTPS_PROXY||process.env.HTTP_PROXY,dispatcher=proxy?new ProxyAgent(proxy):undefined;
const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
const endpoint='https://api.cloudflare.com/client/v4/zones/1845df61064ecf840a2189f13a73c4ab/email/routing';
const r=await fetch(endpoint,{headers,dispatcher}),settings=await r.json();
if(!settings.success)throw new Error(settings.errors?.map(e=>e.message).join(',')||'无法读取域名邮件配置');
if(settings.result.enabled)console.log('Email Routing 已开启。');
else {
  // This only enables free Email Routing; it never calls a paid Email Sending or subscription API.
  const response=await fetch(endpoint+'/dns',{method:'POST',headers,dispatcher,body:'{}'}),value=await response.json();
  if(!value.success)throw new Error(value.errors?.map(e=>e.message).join(',')||'邮件域名启用失败');
  console.log('已创建免费 Email Routing 域名 DNS 配置。');
}
