# 邮箱登录与独立部署

## 当前状态

代码支持两种明确分开的部署：默认 `AUTH_MODE=sites` 继续使用原有私人 Sites 入口；`AUTH_MODE=email` 在独立 Cloudflare Worker 上使用 Supabase 邮箱密码认证。独立版不会读取或信任 `oai-authenticated-user-*` 请求头，也不需要 ChatGPT 账户。

**当前邮箱独立版尚未上线。** 本机 Cloudflare 尚未授权，Supabase 项目和邮件服务尚未连接。构建和本地契约测试成功不代表真实邮件已经送达。原有站点仍通过原账户访问，原站点的访问策略不会因本次代码更新而放开。

## 认证和权限

- 注册、邮箱验证、登录、密码重置、密码更新、退出；密码交给 Supabase Auth 处理，本项目不存储密码。
- 服务端通过 `auth.getUser()` 验证每次访问的真实身份，不信任 cookie 中自报的 user 对象。`proxy.ts` 处理续期并写回 cookie。
- 只用服务端 SDK，cookie 为 HttpOnly、SameSite=Lax，HTTPS 部署启用 Secure；密码和 token 不写入 localStorage 或日志。
- 必须设置 `AUTH_ALLOWED_EMAILS`。这是个人系统，只允许列表内邮箱注册、登录和访问；多个邮箱用逗号隔开。删除邮箱后该身份的后续 API 访问被拒绝。
- 新的所有者标识为 `email:<Supabase UUID>`。不会根据相同邮箱自动认领旧 ChatGPT 身份的数据。本机草稿也按账户分区。
- 改密码后请求全局退出，Supabase 将撤销相关刷新会话；已有 access token 的失效时机取决于服务商策略与 JWT 有效期。上线前应确认项目会话和密码安全设置。
- 身份 API 对写请求严格验证 Origin，重置和验证链接只能返回站内固定地址。上游服务负责验证码、邮件和认证请求的速率限制；应在 Supabase 生产设置中配置合理限制。

## 1. 连接账户

启用并连接 Supabase 插件，或在自己的 Supabase 控制台准备一个项目。项目用于 Auth，不替换现有业务数据结构。

在本机项目目录执行 Cloudflare 官方登录，授权由你在浏览器中完成：

```powershell
npx wrangler login
npx wrangler whoami
```

不要把密码、SMTP 密码、service_role key 或 Cloudflare token 粘贴到聊天或提交到仓库。本实现只需要 Supabase Project URL 和 publishable key（旧项目可用 anon key），不需要 service_role key。

## 2. 配置 Supabase 邮件

在 Authentication 中启用 Email / Password，**保持 Confirm email 开启**。Site URL 配为新的独立 HTTPS 地址。Redirect URLs 至少添加：

```text
https://你的独立域名/auth/callback
https://你的独立域名/auth/callback?next=/account/password
```

推荐配置自己的 SMTP，验证发件域名，并实际测试注册确认和密码恢复。默认发送服务只适合试用，有严格发送限制；发送成功响应不等于收件成功。

推荐修改邮件模板，使用一次性 token hash，支持在另一设备打开邮件：

确认注册模板：

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">确认邮箱并进入 Research OS</a>
```

重置密码模板：

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">设置新密码</a>
```

默认模板的 PKCE 回调也受支持，但需要在发起请求的同一浏览器完成；跨设备优先使用上述 token hash 模板。不要在日志中记录完整验证 URL。

## 3. 建立独立数据库和文件存储

独立部署使用你自己的 Cloudflare 资源，不能把 Sites 平台管理的资源 ID 直接当成自己账户的资源：

```powershell
npx wrangler d1 create research-os-email
npx wrangler r2 bucket create research-os-email-files
```

在项目根目录新建 `wrangler.email.local.json`（已被 Git 忽略），例如：

```json
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "research-os-email",
  "main": "worker/index.ts",
  "compatibility_date": "2026-05-15",
  "compatibility_flags": ["nodejs_compat"],
  "workers_dev": true,
  "vars": {
    "AUTH_MODE": "email",
    "APP_ORIGIN": "https://research-os-email.你的子域.workers.dev",
    "SUPABASE_URL": "https://你的项目.supabase.co",
    "SUPABASE_PUBLISHABLE_KEY": "你的 publishable key",
    "AUTH_ALLOWED_EMAILS": "你的邮箱@example.com"
  },
  "d1_databases": [{
    "binding": "DB",
    "database_name": "research-os-email",
    "database_id": "创建数据库返回的真实 ID",
    "migrations_dir": "drizzle"
  }],
  "r2_buckets": [{ "binding": "BUCKET", "bucket_name": "research-os-email-files" }]
}
```

`APP_ORIGIN` 必须为准确的 HTTPS origin，无尾部斜杠或路径。可在 Cloudflare Workers 控制台确认账户 workers.dev 子域，也可使用自己的域名；如改 Worker 名称或域名，同时修改 APP_ORIGIN、Supabase Site URL 和 Redirect URLs。邮箱与 publishable 配置仅保存在本机忽略文件和 Worker 运行配置中。

## 4. 验证与发布

```powershell
npm ci
npm run typecheck
npm run test:unit
npm run build:email
npm run test:email
npm run deploy:email
```

`deploy:email` 先检查独立 HTTPS 地址、邮箱允许列表、认证配置和真实 D1/R2 绑定，然后构建、应用 D1 正式迁移并发布。**迁移会写入配置所指向的数据库，请确认是新建的 Research OS 数据库。** 缺少配置时会明确停止，不自动退回免登录或 ChatGPT 请求头认证。

Sites 和独立版共用 `dist/` 输出，切换模式时重新构建，不要同时运行两种构建或直接部署残留产物。不要用 `npm run start` 把默认 Sites 模式的原始 Worker 暴露到公网；独立发布必须用 `deploy:email`。

本地 UI 开发：`npm run dev:email`，默认地址 http://127.0.0.1:5175。未配置服务时显示明确提示并禁用提交。使用真实服务本地测试时，单独设置 APP_ORIGIN 和 Supabase 允许回调为该本地地址；完成后恢复 HTTPS 配置。生产预检拒绝本地地址。

## 5. 迁移原有科研资料

1. 在原 Sites 站点用原 ChatGPT 账户登录，先将本机草稿保存到云端，再从“数据管理”导出**完整 ZIP**并保存副本。旧版没有账户前缀的本机草稿不会自动加载到新账户。
2. 新邮箱站点注册允许列表内的邮箱，点击确认邮件后登录。
3. 在新站点“数据管理 → 恢复备份”选择原 ZIP，确认仅合并。
4. 核对项目、日志、实验、成果、关联和附件。新站点恢复时将记录、修订和文件归属设置为当前已验证邮箱账户，不沿用备份中的旧 owner_id。
5. 在第二台设备登录邮箱账户复核，重新导出一次完整 ZIP。验收前保留旧站点和原备份。

JSON 不含附件原始内容，存在附件时用完整 ZIP；上限与原应用一致。此流程复制资料，不自动删除旧站点数据。不会通过邮箱字符串匹配静默转移所有权。

## 6. 快捷入口

登录页和设置页可下载 Windows `.url` 桌面快捷方式、复制当前站点网址，并查看手机添加主屏幕的方法。快捷方式指向**当前 origin**；邮箱站点上线后请在新站点重新下载，旧快捷方式仍指向旧站点。

## 验证边界与官方参考

`test:email` 使用仅监听本机的认证 HTTP 契约服务，配合真实 Supabase SDK、生产构建 Worker、D1 和 R2 验证；不会向真实邮箱发信。它不替代 Supabase 实例、SMTP、真实账户、跨设备邮件和独立 HTTPS 域名的上线验收。

- [Supabase SSR cookie 与续期](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [邮箱密码、验证邮件与密码恢复](https://supabase.com/docs/guides/auth/passwords)
- [Cloudflare Workers Vite 部署](https://developers.cloudflare.com/workers/vite-plugin/)
