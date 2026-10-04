# Cloudflare 部署与运行

## 免费方案

Cloudflare 账号必须使用 Workers Free，域名选 Free。项目不调用升级、订阅或付费产品 API，不使用 R2、Images、Workers Paid、付费任意收件人发信。免费额度按 Cloudflare 当前规则执行：Worker 入口转发私人请求给 SQLite Durable Object；D1 保存少量配置；壁纸只从自备网盘流式传输。

资源参考：[Workers 限制](https://developers.cloudflare.com/workers/platform/limits/)、[Durable Objects 免费价格](https://developers.cloudflare.com/durable-objects/platform/pricing/)、[D1 免费价格](https://developers.cloudflare.com/d1/platform/pricing/)、[Email Service 免费已验证收件人](https://developers.cloudflare.com/email-service/platform/pricing/)。控制台核对 Workers 免费计划和用量；当前 OAuth 无账单读取权限，脚本不能读取订阅。额度满时 Cloudflare 停止相关请求，UI 显示可恢复故障。不要为解除限制点击升级。

## 当前配置

- 站点：https://beyondfog.cc.cd
- Worker：beyondfog；账号 ID：05201dce1f81fa08db008509ccc4a441
- D1：beyondfog，UUID 在 wrangler.jsonc（已创建并迁移）
- Durable Object：BeyondFogService，SQLite 类，稳定实例名 beyondfog-private-service
- 初始邮箱：fogpurification@gmail.com
- DNSHE 自定义服务器：guy.ns.cloudflare.com、uma.ns.cloudflare.com
- 注册关闭；密码重置只发送到该已验证 Gmail。send_email 绑定额外限制发送人 noreply@beyondfog.cc.cd。

## 初次部署

```powershell
npx wrangler login
npm run setup:cloudflare
npm run account:create
npm run deploy
```

`setup:cloudflare` 创建/复用 D1 并应用 migrations，创建一次 BETTER_AUTH_SECRET（高熵 32 字节）与 WEBDAV_ENCRYPTION_KEY（AES 256 位 hex），使用受限临时文件上传后删除；**不重置现有密钥**。脚本与命令输出不打印密钥。不要删除或随意轮换加密密钥，否则已有网盘密码无法解密；重新输入网盘应用密码才能恢复。

`account:create` 在本地交互终端输入邮箱及两次密码（12–128 字符），只把 Better Auth scrypt 哈希写进临时迁移 SQL；唯一邮箱约束防止覆盖已有账号。线上 OWNER_EMAIL 要与输入一致。若账号已经存在，通过网站「忘记密码」重置，不要重复创建。

域名先在 Cloudflare 添加并选择 Free；在 DNSHE 修改 nameserver，等待 active。Wrangler routes 的 custom_domain 自动创建站点 DNS 与 HTTPS 证书，不需要手工 A 记录。域名更换时同步修改 APP_ORIGIN、EMAIL_FROM、routes 和发信绑定，重新构建/部署。Workers.dev 可加载访客静态页；认证只信任 APP_ORIGIN，私人使用统一走主域名。

## 免费密码重置邮件

脚本 `node scripts/setup-email.mjs` 请求/读取 Gmail 的 Cloudflare Email Routing 收件验证；点击验证邮件。`node scripts/enable-email-domain.mjs` 为本项目新域名开启免费 Email Routing DNS 记录，不启用付费 Email Sending。固定收件绑定 `destination_address` 强制约束，即使应用错误也不能给任意邮箱发信。

账号创建后，用网站「忘记密码」发送一次真实邮件。收到后打开链接，输入新密码；再次打开同一链接应被拒绝，所有旧会话失效。链接 30 分钟过期。每 IP 登录 8 次/5 分钟；重置 3 次/15 分钟及全局 10 次/小时；认证总请求 60 次/分钟，私人接口 180 次/分钟，网盘操作 30 次/分钟。限流状态持久保存于 DO SQLite，超限返回 429。

## WebDAV

登录后在设置 → 网盘填写。坚果云：`https://dav.jianguoyun.com/dav/`，输入账号邮箱及在坚果云安全设置生成的**应用密码**。目录默认 `BeyondFog/wallpapers`。保存后测试连接会创建专用目录，然后可列表、上传及选择。JPEG/PNG/WebP 原文件，单张最多 20 MiB。上传 UUID 文件名、If-None-Match 不覆盖；传输失败只尝试清理这一新建的随机路径，不能删除用户已有图片。

其他公网 HTTPS WebDAV：在 wrangler.jsonc 的 WEBDAV_ALLOWED_HOSTS 加入精确域名，逗号分隔，部署后再配置网址。无通配符、无任意代理；不支持私网地址、IP、非 443 端口、跨主机/同主机跳转、查询参数或账号嵌入 URL。允许域名属于部署者信任边界，不能填写内部服务域名。目录/文件路径禁止上级路径、反斜杠、百分号转义。云端应用密码 AES-GCM 加密，接口只显示已配置状态；账号和连接地址也属于私人配置，不放进客户端构建。

首次上线请验证创建目录、上传真实图片、选择及重开页面、两台设备加载同一壁纸、关闭网盘后默认壁纸恢复、撤销应用密码后授权失败。目录只在网盘面板及显式操作时加载。读取图片不得超过 20 MiB；无 Content-Length 的响应也有流式总字节限制。列表 XML 限 2 MiB，只解析当前专用目录的直接文件，拒绝 DTD/entity。

## 发布与回滚

```powershell
npm test
npm run test:e2e
npm run deploy
npx wrangler deployments list
npx wrangler rollback <previous-version-id>
```

保留 Cloudflare 前一版本，不删除旧部署。D1 迁移仅向前追加，回滚代码不会撤销数据库结构；发布 schema 不兼容变更前在 D1 Time Travel 创建恢复书签（免费可用窗口按平台规则），文档记录迁移兼容性。本版 0001 为初始 schema，无破坏性修改。

诊断使用 `npx wrangler tail --format json`，生产错误日志只记录异常类型；不打印 request URL、headers、password、token、连接密文或上游错误正文。实时 tail 本身会包含平台请求 URL，包含重置 token 的会话不分享日志；项目关闭持久 Observability 日志，避免保存私密链接。控制台 Metrics 检查 Worker/DO CPU、D1 行数与配额；认证计算位于 DO，静态页不触发密码哈希。

上线尚缺的外部验证须记录在 PROGRESS.md；不因为单元测试替代真实 Gmail/WebDAV 联调。
