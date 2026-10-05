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
- 首个功能部署：`ae7696be-7136-4225-9ad7-393a478477c7`，2026-10-04T17:37:26Z；HTTPS、私人接口保护和注册关闭已在线检查。完整验收状态见 [PROGRESS.md](PROGRESS.md)。
- 当前部署：`18466d09-6c84-4ddb-9f2f-08489e64c602`，2026-10-05 19:51:33（新加坡时间）；可选文件夹捷径模式，平铺仍为默认。线上电脑/手机访客操作已验证；实际切回兼容平铺版本并验证其编辑仍保留分组字段，再恢复本版本。京东狗头像与毛玻璃引擎菜单保留。

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

首次功能版本 `ae7696be-7136-4225-9ad7-393a478477c7` 已保留，可恢复最初的可用首页。更早的版本只是配置 Secrets 时产生的空 Worker，不能作为可用网站的回滚目标。图标更新的前一版本 `2b53c607-1edb-4fb1-af3b-e99c53ea786a` 已确认保留；狗头像更新的前一版本 `88826713-aa28-45ca-a3cc-0be560478f18` 也已确认保留；文件夹更新后仅使用兼容桥接版本 `53ecc2d4-9a8e-400a-9d8d-6ffeadd9981f` 回滚，详见下文。Cloudflare 部署列表也保留中间版本；回滚时选择已验收的功能版本。

只读线上检查可运行 `node scripts/production-smoke.mjs`，验证文档响应头、资源、匿名私人接口、关闭注册及错误密码。它会消耗一次登录尝试额度。加 `--send-reset` 会额外请求一封真实重置邮件，仅在需要联调时使用，成功请求仍需在 Gmail 确认实际收件。

诊断使用 `npx wrangler tail --format json`，生产错误日志只记录异常类型；不打印 request URL、headers、password、token、连接密文或上游错误正文。实时 tail 本身会包含平台请求 URL，包含重置 token 的会话不分享日志；项目关闭持久 Observability 日志，避免保存私密链接。控制台 Metrics 检查 Worker/DO CPU、D1 行数与配额；认证计算位于 DO，静态页不触发密码哈希。

上线尚缺的外部验证须记录在 PROGRESS.md；不因为单元测试替代真实 Gmail/WebDAV 联调。

## 网站捷径图标

首页和设置直接加载 HTTPS 原站 `/favicon.ico`，请求不包含捷径路径、查询参数或片段，并使用 no-referrer。保留原色和比例；加载中、失败或 HTTP 地址时显示名称首字。不使用第三方图标服务、服务端代理或图片存储；网页图标按浏览器自身规则缓存。部分网站没有可跨站加载的根目录图标（本次 Gmail 显示 G），这是首版的预期兜底。

京东例外：精确域名 `jd.com` 及其子域名使用京东 HTML 声明的官方图标 `https://storage.360buyimg.com/retail-mall/mall-common-component/favicon.ico`（白色狗头像）。这是直接读取京东 CDN，不是第三方图标服务；保存的 home.jd.com 跳转地址不变。根目录图标在部分京东域名上返回网页，在 www.jd.com 上是旧的 JD 字母，因此不适合用作当前标签图标。其他网站维持现有根目录读取与首字兜底。


## 文件夹模式与兼容回滚

设置 → 捷径 → 平铺/文件夹，默认平铺。最多100网站/20自定义文件夹，一层分组；未分组网站在文件夹模式显示“未分类”。删除文件夹先确认，保留网站。模式、名称、分组与全局网站/文件夹顺序均保存在原 preferences JSON 中，不需 D1 表结构迁移。旧 JSON 读取时补默认字段；缺少 shortcutLayout/folders 的旧页面保存返回409并提示刷新。

先发布的平铺兼容版本为 `53ecc2d4-9a8e-400a-9d8d-6ffeadd9981f`（commit `ce46ee0`）。它可读取并保留分组字段，作为本功能的回滚目标。请勿回滚到此版本之前的旧代码：旧严格 schema 不接受新增字段。若回到兼容版本，界面显示平铺，但已保存文件夹数据保留，恢复新版本后重新显示。

文件夹功能版本：`18466d09-6c84-4ddb-9f2f-08489e64c602`，commit `7c42dfd`。2026-10-05 已实际执行兼容版本100%流量切换，再恢复功能版本100%；兼容性验证使用实际线上静态资源与隔离的模拟私人响应，确认平铺编辑保留模式、文件夹及归属，不修改真实账号配置。两设备并发/冲突测试使用本地真实 D1/认证接口。
