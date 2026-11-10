# Gemini 3.8 Flash TTS 接入

核对日期：2026-11-10。依据用户提供的 fal 文档和对应公开 OpenAPI schema。

- 音频工作区的 Text-to-Speech 默认模型改为 Gemini 3.8 Flash TTS，内部 provider 为 `gemini-flash-tts`，端点为 `google/gemini-3.8-flash-tts`，沿用服务端 `FAL_KEY` 和既有 fal 任务队列。
- 默认声音 Kore；提供文档列出的 30 种声音。支持单人旁白、双人对话、全局语气及逐段语气指令，保留 `<laugh>`、`<sigh>` 等文本内声音事件。
- 双人对话使用两个不同的 `speaker_id` 和有序 turns，每段引用其中一个说话人。提交对话时省略供应商的 prompt/voice 字段，只提交 speakers/turns 与全局语气；每段语气按供应商规则覆盖全局语气。
- 输出固定 WAV。隐藏当前模型未提供的 ElevenLabs 稳定性、时间戳、语言选择，以及音乐的 MP3/PCM/采样率设置；ElevenLabs 和 MiniMax 音乐工作流仍可切换。
- 模型成本依据文档的 $0.045 / 1000 个朗读字符，复用现有积分换算；1000 字符报价为 7 积分。使用 Unicode code point 计数字符；双人模式只拼接每段实际文本，排除人为添加的说话人名称、段落分隔符、全局与逐段语气指令。
- 供应商完整输入上限为 8192 tokens。项目无该模型的精确离线 tokenizer，因此采用更严格的 **8192 UTF-8 字节（包括序列化输入）** 作为本地输入预算，并限制最多 100 个 turns。这是项目预检策略，不把字节数当成供应商精确 token 数；超过预算时提示缩短文本或拆分，提交前拒绝，不扣费。
- 服务端在扣费前校验工作区、声音、对话结构、输入预算、报价和密钥，保留安全检查；不接受视频/图片/音频参考，也不参加每日免费视频计划。
- 使用现有幂等、成功结果同步与失败退款流程；保存完整供应商输入到 `request_settings.gemini_tts`。前端生成指纹包含声音、语气及所有对话轮次；登录草稿保存并恢复这些设置。
- Text-to-Speech 的模型偏好启用 `:v2` 命名空间，让已有用户首次看到新默认模型。明确指定的模型链接与此后主动选择的模型仍然有效；其他工作流偏好不受影响。
- 创建记录展示新模型名称；WAV 下载识别 `audio/wav`、`audio/x-wav` 和 `audio/wave`。

验证：

- `npm run check` 包含新 `scripts/verify-gemini-tts.mjs`，验证 30 个声音、单人/对话真实构造函数、朗读计费、非法输入、旧报价拒绝、重复提交、WAV 结果和一次性失败退款。
- `scripts/verify-gemini-tts-ui.mjs` 使用隔离 Chrome CDP 9766 和本地 3000 端口，验证手机/桌面默认模型迁移、声音、对话、参数提交、旧模型切换及登录草稿恢复。
- 所有业务 API、GTM、模型、数据库及扣费操作均使用隔离响应。本轮未运行真实付费生成，不声称已验证真实声音质量或生成延迟。

来源：

- https://fal.ai/models/google/gemini-3.8-flash-tts/api
- https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=google/gemini-3.8-flash-tts
