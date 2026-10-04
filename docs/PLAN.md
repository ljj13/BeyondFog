# BeyondFog 已批准规格与执行计划

产品为个人简体中文搜索首页：雾山摄影、蓝灰控件、轻微毛玻璃、设备当地时钟和日期、居中搜索、同屏平铺捷径。Google 默认，支持必应/百度；默认新标签页，正确编码中文与特殊字符。捷径添加/编辑/删除、拖动和按钮排序。手机和键盘均可操作。设置位于侧栏。访客默认首页，登录后加载私人设置。

React/TypeScript/Vite，Cloudflare Worker 静态资源及 API 入口，SQLite Durable Object 执行认证/私人 API，D1 保存账号、会话、偏好和加密 WebDAV 连接。Better Auth 原生 D1 邮箱密码认证。关闭公开注册，只引导创建 OWNER_EMAIL 账号。密码以本地脚本交互输入，不放进命令历史。安全 HttpOnly Cookie，服务器验证身份与归属，私人响应 no-store。支持退出、修改密码、单次 30 分钟邮件重置，重置撤销全部会话。重置邮件仅发送到 Cloudflare 已验证地址，请求限流。

WebDAV 为公网 HTTPS + 账号 + 应用密码，内置坚果云地址。默认 BeyondFog/wallpapers/ 相对目录。服务端代理连接测试、MKCOL、Depth=1 列表、读取、上传，不依赖网盘 CORS。JPEG/PNG/WebP 原文件，最大 20 MiB，无 1 MB/20 张限制。UUID 上传 + If-None-Match，不覆盖已有文件。图片流式传输，不使用 R2、不持久保存到 Cloudflare。密码 AES-GCM + 每条随机 nonce + 用户 AAD，密钥 Workers Secret；响应不返回密码。服务端锁定存储连接、目录、文件路径，禁止任意代理/跨主机跳转。

偏好版本 CAS，自动保存；重开/恢复焦点读取最新版本。冲突保留本地编辑并提示手动加载云端。网络故障保留编辑、允许重试。退出和会话失效清除私人显示/编辑。网盘故障恢复内置壁纸并可重试。目录只在打开网盘面板或手动刷新/完成上传/连接测试时读取。

Cloudflare Free，达到平台限制不自动付费。域名 beyondfog.cc.cd，账号 fogpurification@gmail.com。WebDAV 配置用户登录后自行填写。3 张 Unsplash 摄影在 public/wallpapers；来源与许可在 ASSETS.md。

执行阶段：
1. 基础项目与安全验证（搜索、路径、加密、图片签名）。
2. D1 schema / Better Auth / Durable Object 限流和偏好 CAS。
3. WebDAV 连接、列表解析、流式上传/读取与异常测试。
4. 首页、设置、账号界面与跨设备同步。
5. 单元、SQLite 认证、真实本地 Worker、双浏览器与视觉验证。
6. 一次独立完整代码审查，修复重要问题；Cloudflare 上线、HTTPS/真实邮件/网盘联调，记录回滚方案。

审查重点：登录/重置限流、reset 原子消费与会话撤销、路径/SSRF/跳转/XML、数据归属、超限流取消、隐私日志、异步加载/保存竞态、版本冲突、跨设备退出清除、键盘焦点、部署密钥和免费方案边界。真实网盘、初始密码交互与 Gmail 收件需要用户参与，禁止把缺少这些外部验证称为已完成。
