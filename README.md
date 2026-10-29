# Research OS · 个人科研工作台

连接科研目标、每日记录、实验与阶段成果的私人全栈应用。默认浅色，支持深色和移动端。线上数据由 D1 和 R2 持久化，核心记录不保存在 localStorage。

支持独立的邮箱密码登录部署（Supabase Auth + 自有 Cloudflare Worker），包括验证邮件与密码恢复。代码与本地契约测试已完成；真实服务连接与独立上线尚待配置。入口、迁移和上线步骤见 [邮箱登录说明](docs/EMAIL_LOGIN.md)。原 Sites 地址继续使用原有认证。

## 功能

- 科研总览：真实时长、任务和阶段进度、今日任务、最近活动、活跃度热力图。
- 研究目标：项目、阶段、任务、一级子任务 CRUD、归档、筛选和任务看板。
- 每日日志：结构化模板、Markdown / LaTeX、图片、月历、云端自动保存、草稿恢复和计时。
- 实验：通用参数键值表 / JSON / 原始配置、指标、结论、Git Commit、附件及实验对比。
- 成果：图文文档、多任务和多实验关联、图片放大、标签 / 类型 / 阶段筛选、版本恢复。
- 科研统计：按日 / 周 / 月及日期区间统计、项目时间分布、任务 / 成果分布、周度复盘。
- 数据管理：完整 JSON、CSV、含 Markdown 和原始附件的 ZIP，验证后合并恢复。

## 技术与目录

React 19、TypeScript、Vinext App Router、Cloudflare Workers、D1、Drizzle 迁移、R2、Zod；Sites 负责私人 HTTPS 和 ChatGPT 登录。Markdown 使用 react-markdown、GFM、KaTeX、代码语法高亮；不执行原始 HTML。

| 目录 | 内容 |
| --- | --- |
| app/ | 页面、样式、认证助手及 API 路由 |
| components/research/ | 导航、编辑器、统计、备份、计时及统一视图 |
| lib/ | 数据类型、验证、关联授权、备份格式及文件清理 |
| db/、drizzle/ | 数据模型和不可变正式迁移 |
| tests/ | 本地域逻辑和 API 集成测试 |
| public/fonts/ | 自托管数学公式字体 |
| scripts/、worker/ | Sites / Vinext 运行、构建和发布集成 |
| .openai/hosting.json | 持久站点身份及存储绑定 |

开始开发、迁移、权限、部署更新、备份恢复和维护见 [运维文档](docs/OPERATIONS.md)。验证范围与限制见 [测试说明](docs/TESTING.md)。

## 快速开始

需要 Node.js >=22.13。首次执行 npm ci、npm run build，再依次应用 drizzle/ 下的 SQL 到本地 D1；完整 PowerShell 命令见运维文档。之后运行 npm run dev。

默认 Sites 模式的本地测试登录仅用于回环开发服务器；生产身份由 Sites 网关提供。独立模式必须使用 `npm run deploy:email`，设置 `AUTH_MODE=email` 并配置 Supabase。不要将默认 Sites 模式的原始 Worker 在没有可信身份网关时直接公开。

## 验证

- node tests/domain.mjs
- npx tsc --noEmit
- node tests/integration.mjs（先启动本地开发服务器；生成仅存在本机的测试记录）
- npm run build

## 资料安全和已知限制

单文件 10 MB，ZIP 附件合计 20 MB，恢复文件 25 MB。完整 ZIP 是推荐备份方式；JSON 仅含附件元信息。草稿日志不计入时长统计。长文编辑采用 Markdown 工具栏和预览，没有拖动块编辑或多人协作。列表尚无服务端分页，自动异地备份和高级时间轴未实现。完整限制及替代备份方法见运维文档。

研究资料、数据库文件、环境密钥和短期发布凭据不得提交到 GitHub。项目初始不含演示研究数据。
