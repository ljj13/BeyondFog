import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
if (!existsSync('.dev.vars')) {
  writeFileSync('.dev.vars', `APP_ORIGIN=http://127.0.0.1:5173\nOWNER_EMAIL=owner@example.com\nBETTER_AUTH_SECRET=${randomBytes(32).toString('base64url')}\nWEBDAV_ENCRYPTION_KEY=${randomBytes(32).toString('hex')}\n`, {mode:0o600});
  console.log('已创建本地配置 .dev.vars；测试账号与线上账号完全分开。');
} else console.log('.dev.vars 已存在，保留现有配置。');
