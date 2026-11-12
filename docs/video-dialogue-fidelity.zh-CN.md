# 视频台词保留与时长检查

2026-11-12。针对 HeyGen Video 用户输入整段未加引号的问候、AI 润色后只剩画面描述、生成语音未说完的问题。修改和本地验证完成，提交状态以 Git 记录为准，生产发布仍需部署。

## 确认的问题

1. 原有润色规则要求保留意图，但硬性校验主要保护引号内文字、时间段和明确禁止项。未加引号的 35 词个人消息可以被错误转换为 “speaks tenderly / delivering heartfelt words”，并通过旧校验。
2. 所选视频为 5 秒，35 个英文词无法按当前保守语速估算自然完整说完。共用的 HeyGen 语速估算为约 14 秒讲话，加停顿约 16 秒；这是估计而非实际音频测量。当前模型只允许 5–15 秒。
3. 原提交给 HeyGen 的 `prompt_enhancement` 固定为 `turbo`。网站已润色、用户关闭润色或明确要求逐字对白时，供应商仍会再次改写。

## 修改

- 视频工作区的 AI Enhance 默认关闭，用户可手动开启；登录草稿没有明确开启记录时保持关闭。
- `video-spoken-script.ts` 识别明确的 Dialogue/Voiceover 标记、人物说话引号和常见个人问候。普通场景、海报/衣服文字与导演指令不会直接当作整段对白。多段对白保持原始顺序。
- 文生视频、图生视频的 LLM 指令明确：未加引号的个人消息也属于要说的台词；逐字保留、保留语言和顺序，将视觉描述放在对白之外，不以“温柔地说话”等描述替代内容，不为适配短视频偷偷压缩原文或改时长。
- 润色输入增加识别到的对白和估算时长；输出若丢失对白、缩写或翻译，回退原文。完整的对白引号可作为合法结尾，不要求在用户台词中补标点。
- HeyGen Video 原始口语输入在生成提交时明确包装为 `Dialogue`，即使 AI Enhance 关闭、失败或未启用，也按对白发送。原始 prompt 保留，实际提交文本记录于任务设置。
- 识别到对白、或网站已处理增强状态时，HeyGen 二次增强使用 `disabled`。没有网站增强元数据且未识别对白的普通场景 API 请求，以及普通参考视频创意，保留既有 `turbo` 行为。Avatar 已包装的明确对白也关闭二次改写。
- HeyGen Video 的对白预计超过所选时长时，界面显示本地化提示并禁用生成；接口在建任务、扣款和付费提交之前返回 `video_dialogue_too_long`。不会自动增加时长、提高费用或删改台词。超过 15 秒估算上限时要求先缩短。

提示覆盖全部 16 种语言，已重新生成按语言拆分的 Studio 字典。

## 验证

- 原始 35 词输入及丢词后的视觉描述作为回归：旧坏输出现在被拒绝，服务返回完整原文。
- 模拟实际生成路由：过长台词无扣款、无供应商请求；短对白保持原文并关闭二次增强；手选可容纳的时长保持不变；原有计费、图生视频、参考视频和 Avatar 回归通过。
- `npm run check` 通过：26 个单测、全部现有验证与生产构建；新增 `verify-video-dialogue.mjs` 随 `verify:video-prompt-ai` 执行。
- 自有无头 Chrome 的手机/桌面检查通过：中文超长警告、禁用生成、增加时长后恢复按钮、原文不变、语言切换和任务导航保持正常。所有接口和外部资源均模拟，没有创建真实付费视频。

本地记录：`outputs/video-dialogue/check.log`；手机截图：`outputs/studio-performance/dialogue-warning-mobile-zh.png`。

## 能力边界

没有声音识别或重生成已完成视频；此次验证不代表已做付费供应商逐字朗读验收。识别器覆盖明确对白与常见口语，复杂混合创意应将需要说的话明确写为 `Dialogue: "完整台词"`。HeyGen 的原生语音仍由视频模型生成，文本完整、长度适配后也不能保证每次逐字发音完全一致。

供应商字段依据：[fal 文生视频](https://fal.ai/models/heygen/heygen-video/text-to-video/api)、[图生视频](https://fal.ai/models/heygen/heygen-video/image-to-video/api)、[参考视频](https://fal.ai/models/heygen/heygen-video/reference-to-video/api)，三者均提供 `prompt_enhancement: disabled`。
