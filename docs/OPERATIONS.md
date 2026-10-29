# Research OS 运维、备份与部署

如需不依赖 ChatGPT 的邮箱密码登录，使用 [邮箱独立部署指南](EMAIL_LOGIN.md)。下文默认描述原 Sites 部署；两种模式不要混用构建产物。

## 架构与数据位置

React 19 + TypeScript + Vinext（App Router 接口）运行于 Cloudflare Workers。Sites 负责 HTTPS、私人访问策略及 ChatGPT 登录。D1 是权威关系数据库，R2 保存私有图片与研究附件。发布只更新代码并追加迁移，不清空数据库或文件。

`.openai/hosting.json` 中的 `project_id` 是站点身份，后续更新必须保留；`d1: DB`、`r2: BUCKET` 是逻辑绑定。不要为了重新发布创建新站点，否则会得到另一个数据库及身份空间。

数据库有 users、projects、milestones、tasks、logs、experiments、achievements、revisions、sessions、attachments 和 reviews 表，以及延迟清理文件的 file_garbage 队列。关联键、所有者、日期、状态和版本有独立列；各类结构化科研字段存于经 Zod 验证的 JSON data 列。成果的多任务、多实验关系在 data.taskIds / data.experimentIds 中保存，由服务端验证存在性、所有权和项目归属。

项目 → 阶段 → 任务 → 一级子任务；日志和实验关联项目与任务；成果关联项目、阶段、多个任务和实验。数据库外键保护单值关联，服务端阻止删除仍被 JSON 多选关系引用的记录。移动存在下级内容的阶段或任务时，先解除关联。

## 本地开发

需要 Node.js >= 22.13、npm、Git；Windows PowerShell 可直接运行。

```powershell
npm ci --prefer-offline --no-audit --no-fund
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_special_morg.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_empty_sleeper.sql
npm run dev -- --hostname 127.0.0.1
```

两个迁移只在新建本地数据库时按顺序执行一次。以后仅应用未执行的新迁移。预览地址通常为 `http://127.0.0.1:5173`，以终端实际输出为准。本地数据在被 Git 忽略的 `.wrangler/state/`，删除该目录会清空本地预览数据，不会影响线上。

本地 `/signin-with-chatgpt?return_to=/` 使用模板提供的开发身份，固定为 `local_seedy`。这个模拟登录仅存在于本地开发插件，生产构建不包含它。不要把开发服务器公开到公网。

## 发布和更新

本项目已保留 Sites 构建集成和原始站点身份。使用 Sites 技能工作流，在相同目录取得该 project_id 的短期源码凭据，再运行插件的 `site-workflow.mjs`，通过标准输入传递凭据、构建命令和归档路径。凭据不可放入仓库、脚本参数或日志。源码推送、构建、归档必须对应相同 commit SHA，再调用私人部署操作。

Sites 会自动配置 D1 / R2 并在上线前执行正式迁移。不要在 API 请求中创建表，也不要修改已经应用的 SQL、快照或 Drizzle 日志。变更 `db/schema.ts` 后执行 `npm run db:generate`，审阅并提交新增迁移，再部署。

GitHub 是代码管理仓库；网站源码托管仓库与其分别同步。GitHub 推送本身不会触发 Sites 发布，也不能把科研数据库提交到 GitHub。网站的研究数据、附件、`.wrangler`、本机草稿与短期凭据不应进入源码仓库。

如转移到自管 Cloudflare，应重新配置 D1 / R2、可信认证网关及生产域名。应用从可信 Sites 网关注入的身份头取得用户身份；切勿直接把接受任意客户端身份头的 Worker 暴露为公开服务。单独运行 `npm start` 仅供本地构建验证，不代表完整生产认证部署。

## 登录与权限

站点默认为 owner-private，仅站点所有者可访问。Sites 网关执行登录和站点访问策略，应用的每个 API 还会检查当前身份和 owner_id。匿名请求返回 401，读取不存在或不属于自己的记录返回 404。写操作拒绝跨源 Origin；数据库查询参数化；Markdown 不执行原始 HTML，危险链接由渲染器过滤。附件下载检查身份及所有权，响应使用 nosniff、私有缓存控制和受限 CSP。

不要自行扩大站点访问范围。若将来支持协作，需要额外设计共享模型，而非移除所有者检查。API 密钥和自管服务凭据只能通过平台环境变量配置；当前基本功能无需额外 API 密钥。

## 数据备份

在「数据管理」中：

1. **完整 ZIP**：推荐。包含 backup.json、所有修订与计时、日志和成果的 Markdown，以及 files/ 下的原始附件。Markdown 图片使用相对路径，解压后可离线阅读。附件使用稳定 ID 命名，原始文件名、类型保存在 backup.json 中。
2. **JSON**：包含带格式版本的全部科研记录、关联、附件元信息、修订和计时，不包含附件字节。它适合作为轻量数据副本；不能单凭 JSON 重建已经丢失的图片。
3. **CSV**：任务、实验、日志可分别导出。data 列保留 JSON 扩展字段；对 Excel 公式前缀做转义。科研时长在日志 data.hours 中。

单文件上传最多 10 MB；支持 PNG、JPG、WebP、PDF、DOCX、XLSX、CSV、Python、TXT、JSON、YAML、Markdown。图片上传检查扩展名和文件签名；不允许 SVG、HTML、可执行程序或匿名上传。旧版 DOC / XLS、超大视频暂不支持，可使用现代格式或在正文关联外部资源。

为适应 Worker 128 MB 内存，单次 ZIP 的附件合计最多 **20 MB**；恢复包最多 **25 MB**，服务端解码后的附件总量也最多 20 MB。超过限制会明确失败，不会生成缺少附件却声称完整的 ZIP。较大资料集可以导出 JSON，然后在每条记录中逐项下载原始附件，按元信息文件 ID 归档；大量资料建议由有存储管理权限的管理员通过 Cloudflare R2 控制台或 S3 兼容工具下载整个 bucket，并使用数据库导出留存元信息。Sites 未向本应用暴露 bucket 管理凭据，不能虚构自动批量下载权限。

建议每周做完整备份，在重要成果完成后额外备份；保留至少三代离线副本。不要只保留浏览器下载目录中的一份文件。当前未配置自动异地备份。后续可在具备独立存储管理权限后，通过计划任务导出 D1 与 R2，并定期执行恢复演练。

## 恢复

选择站点导出的 JSON / ZIP，页面先展示条数，再确认“仅合并，不覆盖”。服务端验证格式版本、字段、日期、关系和附件完整性。相同 ID 的记录跳过，不会覆盖当前版本；因此它不是“回滚所有现有记录”的工具。需要恢复某个成果旧版本时，使用成果详情中的历史修订。

恢复附件应选 ZIP。仅导入 JSON 时，如果当前存储中还存在同 ID 附件，则可复用；若文件缺失，将拒绝导入并提示使用 ZIP。新记录和元信息在 D1 batch 中原子写入；文件先写 R2，如数据库失败则清理本次写入的对象。恢复的计时统一标记为 ended，避免重启旧计时。首次恢复到空站点可保留原始 ID；与其他用户或类型发生 ID 冲突时拒绝，不能覆盖他人记录。

用户设置当前只有设备级主题，因此备份中的 users.settings 为扩展预留；恢复时不会覆盖本机主题或账户身份。

## 图片、附件及版本维护

正文可插入多张图片，说明文字采用 Markdown `![说明](链接)`，阅读模式点击图片放大。上传前先保存记录，以获得稳定记录 ID。单独删除仍被正文或成果历史版本引用的附件会被阻止；替换图片后，旧图在历史版本仍可读取。

删除整条记录会删除自己的修订和附件元信息，并把文件加入清理队列；其他记录引用了其附件时会阻止删除。R2 清理失败时保留 file_garbage 队列，后续删除操作会重试，不会留下可被匿名访问的文件。数据库删除先以事务完成，避免存储删除失败导致主记录处于半删除状态。重要资料优先使用归档，删除前导出备份。

## 自动保存和计时策略

日志和成果在停止输入约 1.8 秒后自动保存至数据库，显示保存中、已保存、失败。未提交输入保留为本机草稿；本机草稿不是权威数据，也不能代替跨设备备份。关闭有未保存内容的编辑器会确认；浏览器离开页面时会提示。有草稿时重新打开编辑器可选择恢复或丢弃。

每条记录用 version 做乐观锁，旧版本更新返回 409。冲突时重新打开最新记录，再根据本机草稿合并；系统不会静默覆盖另一设备的改动。成果每次编辑保存前保留上一版本，可查看时间并载入旧版本重新保存。

计时关联指定日志，每 20 秒向服务端心跳。每次心跳最多确认过去 40 秒，页面关闭或休眠后不无限累计；暂停、刷新后可以继续或结束。计时显示的是已由服务端确认的秒数，约 20 秒刷新一次。结束后累计到日志 data.hours（最多 24 小时），可手动修正；草稿日志不计入统计，提交为其他状态后才纳入。

## 测试

```powershell
node tests/domain.mjs
npx tsc --noEmit
# 保持本地开发服务器运行，再执行：
node tests/integration.mjs
```

集成测试只允许连接本地回环地址，并会写入明确标注的测试记录。生产不播种数据。不要把 `.wrangler/state`、outputs 中的测试数据库、备份或测试资料上传到生产。

生产模式本地复测可使用独立的 SITES_RUNTIME_ROOT，启动 npm start -- --port 5174，再运行 node tests/isolation.mjs。完整集成测试可设置 TEST_BASE_URL=http://127.0.0.1:5174 和 TEST_AUTH_MODE=headers 后执行；测试身份头仅可用于本地构建验证，生产网关会提供可信身份。

## 当前边界

- 编辑器是 Markdown + 工具栏 + 实时预览，支持公式、表格、代码高亮和图片；没有 Notion 式拖动块或实时多人协同。
- 阶段目标支持列表及关联任务计算进度，尚无高级时间轴或甘特图。
- 每条日志 / 实验有一个主关联任务；成果支持多任务和多实验关联。
- 任务支持一级子任务；进度按关联任务条目统计，子任务也是独立任务。
- 列表与搜索目前加载当前用户全部记录，适合个人 V1；多年大量数据建议后续增加服务端分页、全文索引和分批备份。
- ZIP 有上述容量边界；尚未配置自动备份与附件杀毒扫描。
- 手机已做 390×844 布局与录入验证；尚未在真实 iOS / Android 和多种实体设备上全面验收。
- 不包含 AI、文献管理、自动实验分析或多人协作。
