# BeyondFog

个人雾景搜索首页，简体中文，React + TypeScript + Vite / Cloudflare Workers + SQLite Durable Object + D1。个人壁纸通过 WebDAV 流式读取，账号只有管理员，默认 Google 搜索。

## 本地运行

需要 Node.js 24+。先运行：

```powershell
npm ci
npm run setup:local
npm run db:local
node scripts/seed-test.mjs
npm run dev
```

打开 http://127.0.0.1:5173 。本地测试邮箱 `owner@example.com`，测试密码 `BeyondFog-test-password-2026`。`seed-test.mjs` **只访问本地 D1**，会重建这一测试账号及其测试配置；线上账号由独立交互脚本创建。不要在 `.dev.vars` 使用线上密钥。`.dev.vars`、构建目录、日志、浏览器截图和测试附件不提交。

也可自行创建本地账号：修改 `.dev.vars` 的 OWNER_EMAIL，执行 `npm run account:create -- --local`。脚本隐藏密码输入，邮箱须匹配配置。

```powershell
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

测试包括真实 SQLite 上的 Better Auth 原生 D1 协议、真实本地 Worker/D1/DO、两个独立浏览器的配置同步和 CAS 冲突，以及超限/非法路径/重置链接/会话/流式上传。外部网盘在单元测试中替换为受控 HTTPS 响应；真实网盘仍需联调。

部署、账号引导、免费资源限额、邮件、WebDAV 白名单和回滚参见 [部署说明](docs/DEPLOYMENT.md)。已批准规格参见 [PLAN.md](docs/PLAN.md)，测试记录参见 [PROGRESS.md](docs/PROGRESS.md)，素材许可参见 [ASSETS.md](docs/ASSETS.md)。
