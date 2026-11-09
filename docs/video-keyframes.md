# 图生视频首尾帧

根据本次提供的 fal API 文档，支持多图的接口实际接受首帧 image_url 和可选尾帧 end_image_url，不是任意多张主体参考图。

| 模型 | 文档能力 | 本项目 |
| --- | --- | --- |
| H3 Max / Turbo | 首帧 + 尾帧 | 已支持两张，原安全检查与积分设置保留 |
| Gemini Omni Flash 1.2 | 首帧 + 尾帧 | 文生/图生均使用 v1.2；360p 至 4K，单首帧最长 15 秒，加入尾帧最长 10 秒 |
| Seedance 2 | 首帧 + 尾帧 | 已支持两张 |
| Seedance 2.5 | 首帧 + 尾帧 | 目前不在模型目录中，本次没有新增整套模型/定价 |
| Grok Imagine Video | 单张 | 保持单张 |
| Seedance Mini / 其他未提供对应文档的模型 | 未核实 | 保持单张，不将 Seedance 2 文档套用给 Mini |

两个 Seedance 2 附件为相同接口文档，不代表两个不同模型。

上传区域分别选择首帧和尾帧，不再显示重复的“参考图片”上传按钮。删除首帧会一并清空尾帧，避免尾帧被误当首帧；切换单图模型会清理尾帧。服务端拒绝超量图片，不会静默忽略第二张。

H3 文档还支持仅尾帧输入，但本次界面统一采用“首帧必选、尾帧可选”，不新增尾帧单独生成模式。Avatar 保持原有单张人像流程。

Gemini Omni 的文生视频与图生视频已升级至 1.2。若服务器设置了 `FAL_MODEL_VIDEO_GEMINI_OMNI` 或 `FAL_MODEL_VIDEO_GEMINI_OMNI_I2V`，请改为对应的 `google/gemini-omni-flash/v1.2/text-to-video` 和 `google/gemini-omni-flash/v1.2/image-to-video`，或删除覆盖值使用新默认地址。详情见 [Omni 1.2 升级说明](gemini-omni-1.2.zh-CN.md)。
