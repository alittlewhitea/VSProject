# Claude 审查复核与后续修复

更新：2026-11-11。本轮已按用户要求完成前四个优先项的应用改造和隔离验收，并删除 DreamFace IO 的运行代码，后续完成第 9、10、15 项应用侧优化。提交和 push 状态以 Git 记录为准；没有部署或生产数据变更，本地环境配置及无关工作文件未纳入提交。

## 重点结论

Claude 原来的三项修复确实存在，但初查发现仍有退款先于状态更新的并发窗口、可伪造的 WAV 字节率、来源校验依赖代理 host 等遗漏。第一轮已补退款事务、会话和参数防护；第二轮继续完成真实 MySQL 验收、用户音频精确计费、严格并发/限流故障处理，以及异常任务恢复。

详细规则、Admin 操作和部署检查见 [生成结算与恢复说明](generation-settlement-and-recovery.zh-CN.md)，整体入口见 [README](../README.md) 与 [架构](architecture.md)。

## 本轮前四项

| 项目 | 当前结果 |
|---|---|
| 真实 MySQL 验收 | 线上只读核对 MySQL 5.7.40 的表引擎和索引；本机隔离 MySQL 5.7.44、8.4.13 通过真实行锁、并发、幂等、触发器故障回滚及回调恢复测试。生产用户和余额没有作为测试数据。 |
| 用户音频精确计费 | PCM WAV 校验数据长度与采样格式；MP3/M4A/AAC/OGG/WebM/FLAC 等经受限系统 FFmpeg 解码，以 PCM 样本数计时。远程下载限制大小、时间、跳转和地址，并固定 DNS 解析地址。保存同一份内容寻址音频用于核价与提交，拒绝私网、伪造与超长媒体。客户端使用服务端返回的秒数核价。 |
| 严格并发/限流 | 付费任务在账户行锁内一起检查名额、创建并扣款；H3 免费任务共用锁和 5 个任务上限。隐藏和超时未结束的任务不释放名额。限流存储故障返回 503，无付费提交和扣款。 |
| 异常任务核对与恢复 | 阶段提交意图、指纹和受理信息持久化；每阶段最多发送一次。HMAC + fal Ed25519 回调可补回丢失的任务 ID；TTS 可恢复尚未发出的下一阶段。Admin 加入待核对筛选、请求补绑、申请取消和供应商凭据人工结算。取消信号不立即退款；费用包括已执行的语音阶段；人工操作在锁内重查新跟踪，避免过期页面退款。 |

没有新增数据库表、字段或数据库存储过程，使用既有任务 JSON、账本唯一索引、事务和 MySQL advisory lock。系统 FFmpeg 是压缩音频的新增运行条件，上线前应运行 `npm run verify:audio-runtime`。公网回调与文件可达性尚未在生产部署后联调，没有创建真实付费生成任务。

## DreamFace IO

已删除生成接入、每日额度/退款函数及 RPC、Admin 与运行开关、可用性 API、模型/价格配置、工作台控件与状态、专用国际化模块、同步处理。只在通用已移除模型名单保留旧 ID，拒绝旧请求并排除调度/并发；历史任务、账本、数据库旧迁移数据和备份没有删除。旧每日额度不再重试或恢复。

## 21 项当前矩阵

状态代表当前代码和已完成验证，不代表已经发布。`FIXED — NEEDS INTEGRATION TEST` 表示仍需真实供应商或部署环境验收；`FIXED — NEEDS DEPLOYMENT TEST` 表示应用侧通过、本轮未做线上配置和命中验收。数据库事务本身已做真实隔离集成测试。

| # | 项目 | 状态 | 证据和剩余边界 |
|---|---|---|---|
| 1 | 退款漏洞 | VERIFIED FIXED | `generation-task-settlement.ts`、adapter 和共享 fal 同步；真实 MySQL 竞争退款、完成/退款竞争、触发器回滚、扣款上限、Admin 与过期页面保护通过。供应商实际费用仍以可取得的证据及明确人工核对为准。 |
| 2 | 计费和参数一致性 | FIXED — NEEDS INTEGRATION TEST | `generation-billing-normalize.ts`、`avatar-audio.ts`、检查 API 与 Studio hook；用户音频实际测时、保存字节与报价一致，模型 payload/报价回归通过。脚本生成语音仍沿用原估价；生产文件可达性和付费供应商账单未实测。 |
| 3 | 浏览器令牌暴露 | VERIFIED FIXED | HttpOnly cookie + 非凭据占位符，严格 Origin/协议校验和 logout 防护；真实路由与 Bearer 兼容隔离测试通过，未实际发送 Google/邮件登录。 |
| 4 | 限流和并发 | PARTIALLY FIXED | 账户锁内原子接纳、建任务与扣款；免费/付费混合并发通过真实 MySQL；存储故障拒绝新工作；流式请求限长。代理入口清洗与更完整的跨账户 IP 策略仍待后续，不声称所有代理/IP 风险关闭。 |
| 5 | Base64 上传架构 | PARTIALLY FIXED | Avatar 用户音频已保存为独立、归属用户的内容寻址 WAV；图片及其他请求仍可能持有 Data URI，通用上传生命周期和保留清理策略未迁移。 |
| 6 | 服务端内容安全 | FIXED — NEEDS INTEGRATION TEST | 服务端强制必要策略，保留现有 H3 接入例外；策略和实际 POST payload 隔离验证通过，未付费调用每个供应商。 |
| 7 | 巨型路由/同步重复 | PARTIALLY FIXED | fal 轮询、历史、cron、Admin 统一同步；提交、恢复、Admin 核对已抽成服务。生成模型分派仍较大，未完成 registry 改造。 |
| 8 | 测试/CI | PARTIALLY FIXED | 26 个单测、完整本地检查、真实 MySQL 集成、音频与浏览器验证；CI 配置隔离 MySQL 5.7 和 FFmpeg，远程执行状态以 GitHub Actions 为准；没有独立 lint，付费 provider 测试未做。 |
| 9 | 国际化包体 | VERIFIED FIXED | Studio/CreditShop 拆为 16 份语言包，服务端提供 Studio 初始字典；覆盖顺序与回退逐项对照一致，异步切换、失败重试与 RTL 回归通过。 |
| 10 | Studio 拆分 | VERIFIED FIXED | 已拆 controller、页面外壳、创建界面、任务历史 hook 与配置；各视图/编辑器按需加载，隐藏创建区不再挂载。First Load JS 553→211 kB；手机/桌面模拟接口回归通过。跨模型生成流程仍保留在 controller，未做业务协议重写。 |
| 11 | 设计系统 | PARTIALLY FIXED | 已有公共变量/组件；本轮新增 Admin 表单适配手机和桌面，未统一所有内联/Tailwind/CSS 样式。 |
| 12 | MySQL adapter 安全 | VERIFIED FIXED | 拒绝无过滤更新/删除，插入回读要求可靠键，未知操作不默认删除。实际隔离 MySQL 验证通过，现有业务回归通过。 |
| 13 | 重复付费/不明超时 | FIXED — NEEDS INTEGRATION TEST | 每阶段持久化意图和单次提交；丢响应签名回调找回、TTS 下一阶段恢复、取消/费用核对和 Admin 凭据结算通过真实数据库与模拟供应商测试。老任务无指纹时需要人工凭据，公网回调未上线联调。 |
| 14 | Admin 查询 | NOT FIXED | ops 仍有 5,000 条上限和 600 条分析事件窗口，部分汇总在 JS。已完成退款/任务核对安全，不代表大数据聚合和分页完成。 |
| 15 | 缓存/媒体 | FIXED — NEEDS DEPLOYMENT TEST | 公开首页/落地页配置 5 分钟共享缓存，RSC/账户页面绕过；首页案例增加服务端缓存与 Admin tag 失效。完整检查及生产 HTTP 规则/语言回归通过；线上 CDN 命中、部署清理未验收，未将源站整页强制改成静态页面。见 [缓存说明](marketing-cache.zh-CN.md)。 |
| 16 | IP/密钥 | PARTIALLY FIXED | 生产签名不接受固定开发兜底，限流故障不再放行；没有验证宝塔/Nginx/Cloudflare 对代理 IP 头的清洗配置。 |
| 17 | 仓库卫生 | PARTIALLY FIXED | 测试输出忽略，既有备份、SQL 迁移、用户文档均保留；仍跟踪 tsconfig.tsbuildinfo，未做无关清理。 |
| 18 | 错误信息 | PARTIALLY FIXED | generate/status/tasks/cron/Admin 主要新路径通用错误和稳定代码；其余 API 还需逐路由检查。 |
| 19 | 废弃/模拟集成 | PARTIALLY FIXED | DreamFace IO 运行与免费额度代码删除；Mischief 不可新建但保留原 fal 历史核对；生产缺配置禁止静默 mock。旧支付渠道的历史处理没有删掉。 |
| 20 | Cron 饥饿 | FIXED — NEEDS INTEGRATION TEST | 按 last_checked_at/created_at 轮转，检查进度在供应商故障时保留，继续核对隐藏但活跃的任务，排除完全移除的模型；大批量吞吐、调度时限和索引优化仍待实测。 |
| 21 | 项目入口文档 | VERIFIED FIXED | README、架构、审计和生成结算/恢复操作说明齐备，不含真实密钥。 |

## 本地验证记录

- `npm test`：26/26。基线是 25 个，第一轮新增防伪 WAV 后为 26；不把源码字符串断言等同端到端验收。
- `npm run check`：完整通过，含类型、单测、鉴权、限流/退款、模型、价格、免费机会、支付/钱包、国际化、工作台与生产构建。
- `npm run verify:mysql-generation`：MySQL 5.7.44、8.4.13 都通过。覆盖付费/免费混合并发、真实行锁、唯一索引、重复扣款/退款、触发器回滚、阶段单发、丢响应和写入失败恢复、验签、取消、人工核对、跨任务供应商 ID 竞争以及过期人工页面防护。测试后删除自身生成的测试库。
- `npm run verify:audit-security`：真实系统 FFmpeg 解码 + 模拟下载/网络；私网/保留地址、DNS 绑定、重定向、大小限制、伪造时长、成本合并与零成本证据均检查。
- 自有无头 Chrome：Admin 手机/桌面表单、无证据禁用结算、操作请求与 Avatar 远程音频检查通过。接口、外部脚本和资源全部模拟，未向真实供应商发出任务。
- 线上仅以只读事务查询版本、引擎和索引；没有读取用户素材或修改用户余额。普通检查数据库地址覆盖为本机禁用端口，真实集成使用单独显式 TEST_MYSQL 配置。
- 构建成功，仍有既有 Browserslist 数据过期和 next-intl webpack 扫描提示；没有因此升级无关依赖。

## 后续工作顺序

1. 部署前确认 FFmpeg 运行检查；发布后用受控案例验证公网回调、保存音频的供应商可达性和账单结果。这些线上操作本轮没有执行。
2. 代理入口清洗、跨账户 IP 策略、上传存储保留/清理及通用图片上传迁移。
3. Admin SQL 聚合与分页；部署后验收公共页面 CDN 缓存命中及版本清理，见 [缓存说明](marketing-cache.zh-CN.md)。Studio 和字典拆包已完成本轮优化，指标与边界见 [Studio 加载优化](studio-loading-performance.zh-CN.md)。

当前没有将这 21 项全部标记为完成；已完成的本轮四项与后续架构工作分别列明。
