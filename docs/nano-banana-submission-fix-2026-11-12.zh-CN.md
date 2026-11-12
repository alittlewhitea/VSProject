# Nano Banana 2.1 提交失败复查

核查日期：2026-11-12。Git 提交、push 与部署状态以实际操作为准。

## 原因与证据

用户看到的 `The service is temporarily unavailable... retry will reuse the same task key` 是工作台统一处理 HTTP 5xx 后生成的提示，并不是 fal 返回的原始错误。

只读核对线上记录，最近三次 Nano Banana 2.1 请求均为 `provider_not_submitted`，没有供应商任务 ID，也没有持久化的供应商提交阶段。分别为两个文生图任务和一个图片编辑任务。

`src/lib/generation-submission.ts` 的 `providerTracking()` 对模型 ID 使用了仅允许字母、数字、下划线和连字符的正则表达式。`google/nano-banana-2.1` 和 `google/nano-banana-2.1/edit` 中的版本号小数点被误判为非法字符。实际提交函数先调用该校验，因此请求在发往 fal 之前即被拒绝。这是新增任务追踪校验引入的兼容性回归。

现有 Nano Banana 文生图输入与用户提供的 API 文档对应：模型 ID、prompt、num_images、aspect_ratio、output_format、safety_tolerance、resolution、limit_generations、enable_web_search、thinking_level。没有为本次修复更换模型、修改价格或自动切换供应商。

线上积分账本对应三次任务的扣款/退款分别为 `-8/+8`、`-8/+8`、`-7/+7`，合计 23 积分已经全额退回。本轮仅查询，未修改线上记录或余额。

## 修复

- 按模型 ID 的路径段分别校验，允许版本号包含小数点；继续拒绝空路径段、以点开头的路径段、路径穿越、查询参数、片段、编码注入、反斜线和空白字符。供应商任务 ID 仍有字符和长度约束。
- 同一处修复同时覆盖其他带小数点版本号的配置模型，包括 Veo 3.1、Seedance 2.0、MiniMax Music v2.6 等；没有据此断言这些模型在线上都发生了故障。
- 明确未提交且已经完成退款的响应增加 `provider_not_submitted` 错误码，前端展示退款说明并刷新余额。
- 确认失败时清理任务 key 和“会复用 key”的提示；通用 5xx、网关错误或未确认提交结果时保留原 key，避免重试创建第二个付费任务。

## 验证

- `npm run typecheck`：通过。
- `npm test`：26 个测试通过。
- `npm run verify:audit-security`：通过，新增真实 `submitTrackedFal()` 实现的回归测试，模拟 SQL 和供应商响应，41 个配置/版本化端点均执行真实提交模块，覆盖六路并发仅一次 POST、追踪信息持久化、非法路径拒绝和前端错误分支。
- `npm run verify:mysql-generation`：在本机隔离 MySQL 5.7.44 中通过。根据当前工作台 `WORKFLOW_META` 动态枚举，并补充 Nano 分辨率，共 49 组模型/工作流请求执行真实生成 POST 路由、并发准入、扣款、持久化提交、追踪与重复请求；没有替换提交模块。包括 Nano 文生图/编辑 1K/2K/4K、Kling Avatar 的 TTS + 视频两阶段、供应商明确拒绝后只退款一次、提交结果丢失后返回待核对且不重发。身份、报价查询和供应商 HTTP 响应为模拟数据；仅生成的测试数据库被写入。
- `node scripts/verify-model-upgrades.mjs`：通过，现有 Nano 参数构造与计费回归保持通过。
- `npm run verify:studio-inputs`：通过，模型切换保留用户参考图。
- `npm run check`：通过，包含全部既有回归检查和 Next.js 生产构建；构建时将数据库指向不可连接的本机端口，避免读取线上数据。

新增检查已接入现有 GitHub Actions：普通提交测试由 `npm run check` 执行，真实数据库模型链路由 CI 的隔离 MySQL 步骤执行。以后增加工作台模型会自动进入数据库链路检查；这些检查仍不能替代真实供应商 API 参数验收和实际出图验收。

未调用真实付费生图接口。供应商实际出图仍需部署后以真实任务验收。无需数据库迁移或 Cloudflare 配置变更。
