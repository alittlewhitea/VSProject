# 生成计费、并发与异常任务处理

更新：2026-11-11。覆盖本轮优先四项和 DreamFace IO 删除。提交和 push 状态以 Git 记录为准；没有部署、生产迁移或生产余额变更。

## 本轮实际完成

1. **真实数据库验收**：线上连接只读核对到 MySQL 5.7.40、核心 InnoDB 表与账本唯一索引。实际并发、扣款、退款和触发器故障注入全部运行在本机隔离的 MySQL 5.7.44、8.4.13，使用自动生成后删除的 `dreamface_test_*` 库。
2. **音频精确计费**：上传和远程音频不再使用 15 秒兜底报价。PCM WAV 按已校验的采样格式和数据长度测量；其他格式用系统 FFmpeg 解码成 16 kHz 单声道 PCM，以采样字节数测时。向上按秒计费，保留 0.05 秒编码误差容限。生成的语音脚本流程仍沿用原脚本估价；这里的精确测时针对用户提供的音频。
3. **原子并发和扣款**：同一账户行锁内检查最多 5 个待处理任务、创建任务并扣款；H3 免费任务也受相同锁与上限约束。隐藏、超时仍未结束的任务继续占用名额。限流存储异常返回 503，不提交付费请求。
4. **异常任务恢复**：每个供应商阶段先持久化提交意图；付费 POST 只发送一次。签名回调可找回完全丢失的提交响应；已接受的任务 ID 单独落库，后续普通更新失败不会丢掉。TTS 恢复只继续尚未发出的下一阶段。Admin 具备核对、取消、补绑和人工结算入口。

没有增加数据库表、字段或存储过程。新 RPC、JSON 元数据和 MySQL advisory lock 都由应用代码实现。既有唯一账本索引继续负责幂等退款。

## 服务器运行条件

- 继续使用现有 MySQL、网站 URL、FAL_KEY、认证与 cron 配置。
- 在服务器安装由发行版或维护者持续提供安全更新的 **FFmpeg**。默认执行 PATH 中的 `ffmpeg`；可设置 `FFMPEG_PATH` 为绝对可执行路径。新版本没有捆绑旧版静态 FFmpeg，也没有新增 npm 运行依赖。
- 部署前运行 `npm run verify:audio-runtime`。该命令只验证本地可执行程序和 PCM 输出，不连接数据库或供应商。若路径只配置在 `.env.local`，检查命令也会读取该文件中的单独 FFMPEG_PATH 设置。
- 音频文件存入现有 `.data/uploads/generation-inputs/<user-id>/audio-<sha256>.wav`，应用需要写入权限。`/api/uploads/…` 返回 `audio/wav`，必须能被供应商通过公网 HTTPS 访问。
- `/api/generate/webhook/fal` 需要允许供应商通过公网 HTTPS POST。`FAL_WEBHOOK_SECRET` 可单独设置为稳定随机密钥；未设置时复用现有 AUTH_SESSION_SECRET / MYSQL_PASSWORD。处理中的任务期间不要随意更换签名密钥。
- 可选 `FAL_WEBHOOK_USER_ID` 用于固定允许的 fal 账户 ID。无论是否设置，都会校验 fal Ed25519 签名、时间戳、原始请求体，以及绑定站内任务/阶段的 HMAC。JWKS 从固定 fal 官方 HTTPS 地址获取并缓存 1 小时。
- 本地 localhost 不配置供应商回调，继续轮询；上线后的公网回调、文件可达性和实际供应商账单仍需联调。本轮没有为测试创建真实付费任务。

## 账本和状态规则

- 已完成任务不接受失败回写、退款或重新扣款。
- 明确失败时，状态与可退积分在同一事务内提交。退款上限为实际扣款与任务估价的较小值。
- TTS + 视频属于同一站内任务时，退款核算包括已消费的语音费用；语音费用尚无证据则继续待核对，不当作零成本。
- 供应商运行超过预计时间，或取消仅返回 `CANCELLATION_REQUESTED`，都不等于失败或可全额退款。
- 供应商明确 `OK` 移除排队任务后，核对其余已执行阶段成本再结算；不会给已经生成过语音的任务无条件全退。
- 人工结算会在事务锁内重新检查是否刚收到有效跟踪信息、是否出现新提交阶段，避免基于过期页面退款。
- 同一个供应商 request ID 的认领在 MySQL 中串行化，锁持有到提交后再释放。不能同时绑定到两个站内任务。

## Admin 操作

进入 `/admin/tasks`，勾选 **Show tasks awaiting provider confirmation** 查看异常待核对任务，包括仍会产生成本的隐藏任务。

- **Sync provider**：读取已存储的任务信息并核对结果，不自动重发生成请求。
- **Request cancellation**：向已知任务发送一次取消请求。运行中的取消信号继续等待最终状态；已确认从队列移除才进入退款核算。
- **Review → Verify and attach request**：填写供应商任务 ID 和证据。服务器会验证模型、输入指纹以及任务 ID 是否已分配；不接受任意供应商 URL。没有指纹的旧任务不能盲目自动认领。
- **Review → Settle confirmed failure**：用于没有可用跟踪信息的旧异常任务。至少等待 10 分钟，先向供应商确认没有仍在运行的任务，再填写包含所有阶段的总成本和支持凭据，并勾选确认。根据确认的成本核算可退积分；仍有有效跟踪的活动任务必须通过同步或取消处理。
- 核对操作记录操作者、时间、说明与证据类型，保留于任务设置；Admin 可展开 **Reconciliation history** 查看最近 20 条记录。完成结算后，后续操作不会覆盖最终凭据。

没有按“时间相近/提示词相同”猜测归属或自动认领供应商任务。老的无跟踪任务必须走明确的供应商凭据处理。

## DreamFace IO 删除范围

删除了生成接入模块、每日额度/退款函数和 adapter RPC、运行开关、Admin 开关、可用性接口、模型配置、计费分支、工作台状态与控件、专用国际化文案，以及各同步入口的专用处理。

只在通用已移除模型名单中保留旧 ID，用于拒绝旧链接请求、排除调度和并发名额。没有删除线上历史任务、积分账本、备份或旧迁移数据；它们仍可供查询和一般人工核对。旧免费额度无需继续处理，也不会再恢复或重试。

## 验证与证据

- `npm test`：26 个单元测试。
- `npm run check`：类型检查、单元测试、安全、模型/报价、登录、支付/钱包、国际化、工作台和生产构建。
- `npm run verify:audit-security`：实际音频解码、伪造 WAV、超长/无效媒体、同一保存文件复用、DNS pinning、私网/保留地址、混合 DNS、私网重定向、字节上限、供应商阶段成本。
- `npm run verify:mysql-generation`：实际 InnoDB 事务和锁；20 路付费并发、免费/付费混合并发、重复提交、已隐藏/过期任务不绕过名额、20 路退款、完成/失败竞争、真实触发器导致的扣款/退款回滚、12 路阶段提交只发一次、签名回调找回、跟踪写入失败重试、跨任务 request ID 竞争、过期人工页面保护、TTS 下一阶段只发一次、取消与人工凭据审计、限流故障拒绝实际 POST。
- `node scripts/verify-priority-four-ui.mjs`：本地生产构建 + 自有无头 Chrome；手机/桌面 Admin 表单、缺少确认时禁止结算、操作请求内容和 Avatar 远程音频检查。全部 API 和外部资源模拟，截图位于忽略的 `outputs/priority-ui/`。
- GitHub Actions 已配置隔离 MySQL 5.7 与 FFmpeg；远程执行结果以 GitHub Actions 记录为准，本地验证不代表远程 CI 已通过。

隔离 MySQL 示例（测试实例必须已启动且非生产）：

```powershell
$env:RUN_MYSQL_INTEGRATION='1'
$env:TEST_MYSQL_HOST='127.0.0.1'
$env:TEST_MYSQL_PORT='13318'
npm run verify:mysql-generation
```

测试程序拒绝业务环境变量指定的数据库，拒绝非本机和默认 3306 端口，只创建、删除自己生成且名称经过校验的测试库。

供应商协议依据：[fal 队列提交与回调参数](https://fal.ai/docs/api-reference/inference-api/queue/submit)、[fal 回调验签](https://fal.ai/docs/documentation/model-apis/inference/webhooks)、[取消状态语义](https://fal.ai/docs/api-reference/inference-api/queue/cancel)、[请求证据查询](https://fal.ai/docs/platform-apis/v1/models/requests/by-endpoint)。

剩余范围：代理入口清洗、通用图片上传迁移与存储保留策略、Admin 大数据聚合，仍按总审计报告继续。缓存与 Studio 拆包已另行完成应用侧优化，见总审计报告；CDN 命中仍需部署验收。
