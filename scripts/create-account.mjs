import { createInterface } from 'node:readline/promises';
import { stdin,stdout } from 'node:process';
import { mkdtempSync,writeFileSync,rmSync,readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { accountSql } from './account-lib.mjs';
function hidden(prompt) {
  if(!stdin.isTTY) throw new Error('密码必须在交互终端输入');
  stdout.write(prompt); stdin.setRawMode(true); stdin.resume();
  return new Promise((resolve,reject)=>{
    let value='';
    function finish() {stdin.off('data',input); stdin.setRawMode(false); stdin.pause(); stdout.write('\n');}
    function input(chunk) {
      for(const c of chunk.toString('utf8')) {
        if(c==='\u0003') {finish(); reject(new Error('已取消')); return;}
        if(c==='\r'||c==='\n') {finish();resolve(value);return;}
        if(c==='\u007f'||c==='\b') value=value.slice(0,-1); else if(c>=' ') value+=c;
      }
    }
    stdin.on('data',input);
  });
}
const local=process.argv.includes('--local');
const rl=createInterface({input:stdin,output:stdout});
const email=(await rl.question(`账号邮箱${local?'（本地测试建议 owner@example.com）':''}：`)).trim(); rl.close();
const allowed=local?readFileSync('.dev.vars','utf8').match(/^OWNER_EMAIL=(.+)$/m)?.[1]?.trim():JSON.parse(readFileSync('wrangler.jsonc','utf8')).vars.OWNER_EMAIL;
if(email.toLowerCase()!==allowed?.toLowerCase())throw new Error('邮箱必须与 OWNER_EMAIL 配置一致');
const password=await hidden('初始密码（12–128 字符，不显示）：');
if(password!==await hidden('再次输入密码：')) throw new Error('两次密码不一致');
const dir=mkdtempSync(join(tmpdir(),'beyondfog-account-'));
try {
  const file=join(dir,'account.sql'); writeFileSync(file,await accountSql(email,password),{mode:0o600});
  const result=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','execute','beyondfog',local?'--local':'--remote','--file',file],{stdio:'inherit'});
  if(result.status!==0) throw new Error('创建失败，未覆盖已有账号');
  console.log('账号已创建。密码未写入配置或命令历史。');
} finally {rmSync(dir,{recursive:true,force:true});}
