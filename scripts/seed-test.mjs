// Only seeds the local Wrangler database with a publicly documented test password.
import { writeFileSync,mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { accountSql } from './account-lib.mjs';
mkdirSync('.artifacts',{recursive:true});
writeFileSync('.artifacts/test-account.sql',"DELETE FROM user WHERE email='owner@example.com';\n"+await accountSql('owner@example.com','BeyondFog-test-password-2026'));
const r=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','execute','beyondfog','--local','--file','.artifacts/test-account.sql'],{stdio:'inherit'});
if(r.status!==0) process.exitCode=1;
