# DreamFace 视频 Prompt 智能优化

## 实现与数据流

现有视频入口是 `studio-client.tsx` → `VideoSettings` → `/api/generate`。上传图片已有 FileReader/data URL 流程，视频任务已有 `request_settings` 元数据、幂等提交和扣费逻辑。本次替换编辑器内原来追加固定词语的 Enhance Prompt 按钮，未新增视频模型或重构积分系统。

界面只保留一个默认开启的 AI 智能增强滑动开关，独立放在 Prompt 输入容器下方；移除重复的手动 AI Optimize 按钮。开启时 Generate 先优化一次，并复用已优化或编辑后的内容；关闭时不调用 LLM。恢复原文会清除已优化状态，原文和恢复入口也在输入容器外。改变模型、时长、比例、清晰度、音频或首尾帧后，需要针对新上下文重新优化。普通键入或切换开关不会触发网络请求。空输入、无参考图和重复点击有状态保护；优化期间锁住编辑器。旧的生成任务被服务端接受后，仍可以继续排队其他生成。

`/api/ai/enhance-video-prompt` 使用既有 Bearer 登录校验和 MySQL `request_rate_limits`，每用户每分钟最多 10 次新调用。服务每进程最多 4 个 LLM 请求、每用户 1 个并发，合并相同请求，最多缓存 128 条结果，成功缓存 5 分钟、失败缓存 20 秒。跨实例限流依靠现有数据库，缓存与并发限制为进程内机制。整个优化操作 25 秒截止，前端 30 秒截止；异常返回原文，不写入积分流水。

LLM 读取当前模型能力和参数，返回纯文本；现有生成请求仅替换 `prompt` 并增加审计元数据。现有首尾帧、模型、时长、清晰度、比例、Seed、音频及其他模型参数继续通过原有请求构造器提交。幂等指纹使用最终提示词。任务保存原文、最终提示词、优化状态和 LLM 名称；项目详情显示原文与回退提示。未增加数据库表。

## API 与配置

- 文本：`https://fal.run/openrouter/router`
- 视觉：`https://fal.run/openrouter/router/vision`，通过 `image_urls` 传入原首帧和可选尾帧。
- 模型：`google/gemini-3.8-flash`，继续使用服务端 `FAL_KEY`。
- 新环境变量：`AI_PROMPT_ENHANCEMENT_ENABLED=true`、`AI_PROMPT_MODEL=google/gemini-3.8-flash`，省略时也是这两个默认值。关闭总开关后直接回退原文。
- Temperature 0.7，禁用 Web Search。真实接口要求 reasoning=true；仅使用 `output`，忽略 reasoning。短输入上限 1200 tokens；超过 1200 字符的详细脚本上限 3000 tokens，输出最多 5000 字符。详细脚本要求保留分段时序、首尾帧、品牌、引用文案及限制，不得摘要化。格式校验之外还检查时间区间、英文数字秒数、引用文字和显式英文 No/Avoid 限制；长脚本输出不足原文 75% 也回退原文。这是保守文本校验，不是语义等价判定，无法识别的改写会保留原文。允许纯文本分段时序，不允许 Markdown、解释、JSON 或控制字符。
- 日志只记录哈希请求标识、模型、工作区、状态、耗时和实际 usage/cost，不记录完整提示词、图片 URL、账户 ID 或密钥。收到 usage 的无效输出也会记录已发生的成本。
- 现有上传为 data URL，无需新增 R2 签名逻辑。接受 JPEG/PNG/WebP 并检查文件头和大小；远程图仅接受公共 HTTPS URL，不接受内网、凭证 URL 或永久访问密钥。私有对象应使用现有上传机制；本次未引入私有 R2 存储。

## 修改文件

| 文件 | 用途 |
| --- | --- |
| `src/lib/video-prompt-enhancement.ts` | 输入/输出契约、校验和两个独立导演策略 |
| `src/lib/video-prompt-enhancer.ts` | fal 调用、限流、缓存、并发、超时、日志与回退 |
| `src/app/api/ai/enhance-video-prompt/route.ts` | 鉴权后的独立优化 API |
| `src/features/studio/use-video-prompt-enhancement.ts` | 原文/结果、编辑复用、恢复和上下文保护 |
| `src/features/studio/studio-storage.ts` | 登录草稿保留增强开关和已优化记录，避免登录后重复调用 |
| `src/features/studio/video-settings.tsx` | 整合优化按钮、增强开关、预览及状态 |
| `src/app/studio/studio-client.tsx` | Generate 前增强、最终提示词幂等和任务元数据 |
| `src/app/api/generate/route.ts` | 保存经过限制的优化元数据 |
| `src/features/studio/prompt-enhancement-history.tsx`、`studio-projects.tsx` | 项目内原文和回退提示 |
| `src/lib/fal-fetch.ts` | 可选择关闭网络回退，避免 LLM 请求重试及额外费用；原调用默认行为不变 |
| `src/lib/studio-i18n-prompt-ai.ts`、`studio-i18n.ts` | 中文、繁体中文、英文文案；其他语言暂用英文 |
| `.env.example` | 两个服务端功能配置 |
| `.gitignore` | 排除本地公共样例测试临时文件 |
| `scripts/verify-video-prompt-ai.mjs`、`verify-all-locales.mjs`、`package.json` | 新回归检查并纳入 npm run check |
| `docs/video-prompt-live-results.json` | 公共样例的最终真实调用结果、token 和费用 |

此前 Eleven v4 / Nano Banana 2.1 的修改以及用户已有的其他未提交文件保留，未作为本功能重新开发。

## 验证结果与边界

2026-10-10 完成四个真实模型测试：中文橘猫、完整英文、混合语言、人物参考图“让她转身微笑”。最终均 HTTP 200、输出通过完整性检查，使用原有 `fetchFal` 调用链。视觉结果对应参考图中的老人、窗光与植物。最终一轮 cost 合计 $0.01097475，单次耗时约 6–8 秒；结果见 JSON 报告。费用仅为这一轮样例，不是固定报价或整个调试过程的合计。

本机直连 fal.run 的 DNS 路径不可用，Windows 系统代理可用；最终 fetchFal 验证在测试进程中使用与系统一致的 HTTPS_PROXY，未修改系统或持久环境配置。部署环境必须能访问 fal.run；不可访问时功能会按设计回退。

离线回归执行实际输入构造器、服务、Hook 和 API：所有现有视频模型及工作区参数不被修改、视觉策略/图片顺序、Markdown/截断/空值、OFF 不调用、编辑结果复用、恢复原文、上下文改变、并发重复调用、失败回退、缓存、用户限流、四请求并发上限、总开关、非法图片、401/400/200 以及无新增扣费。现有 Kling/Seedance/其他视频 payload、支付和积分相关隔离测试一起运行。

浏览器检查桌面和 390×844 移动布局、默认开关、空输入、登录提示和无参考图禁用。浏览器扩展未开启本地文件访问，文件选择器自动上传受阻；没有修改该权限。参考图视觉 API 已通过公共样例实际测试。未生成付费视频、未使用真实用户账户做扣费、下载或任务落库验收，也未部署；这些不能声称已实测。

## 后续扩展

复查修复：Generate 固定使用点击时的创作上下文；登录刷新期间变更设置会中止旧提交，避免将新 Prompt 配上旧模型参数。较早任务的 finally 仅能释放自身提交锁，不会清除新任务提交状态。手动 Optimize 直接使用现有登录 token，立即显示优化状态。Studio 登录链接使用同站相对路径，本地预览不会跳转到生产站。耗时的限流或图片校验超出截止时间后，不再开始 LLM 请求。

本地复查：文生视频、图生视频页面均 HTTP 200，并包含 AI Optimize / AI Enhance 控件，未登录的优化 API 返回 401。用户确认本地无法连接数据库是既定安排，不处理数据库配置或权限；本次本地预览用于查看界面。数据库链路不计入本地实测结果。本地启动只在当前进程配置既有系统代理和 `NEXT_PUBLIC_APP_URL=http://localhost:3000`，不改生产环境文件。

将两个 system prompt 组织成按工作区/创作意图选择的策略注册表，复用现有鉴权、上下文契约、预算、日志和回退。后续可增加产品展示、自然人物动作、镜头优化等 AI Video Skills；每个策略仍只返回提示词，不接管模型参数、计费或视频编排。

## 验证命令

`npm run check` 包含免费、隔离的回归检查。`node scripts/verify-video-prompt-ai.mjs --live` 是显式付费 LLM smoke test，读取 `.env.local`，仅发送公共样例，不生成视频。不应在 CI 默认调用 --live。本机 Windows 如需重跑，应在该测试进程设置既有系统代理对应的 HTTPS_PROXY。
