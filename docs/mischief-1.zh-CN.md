# TBC mischief 1 接入

核对日期：2026-11-10。依据用户提供的 fal API 文档，以及 fal、TBC 和 OpenRouter 公开页面。

- 页面：`/video/mischief-1`，包含能力说明、参数、费用、十个 FAQ、来源链接、canonical、FAQ 与面包屑结构化数据；加入页脚、sitemap 和增长来源白名单。
- 工作台 provider：`mischief-video`，仅出现在图生视频。使用既有服务端 `FAL_KEY`，端点为 `tbc/mischief-1/image-to-video`，通过现有 fal 队列提交和任务同步流程处理。
- 单张起始图，无尾帧、视频参考或文生视频；3/5 秒，480p/720p，默认 5 秒、720p。固定横屏，480p 实际为 832×480，720p 为 1280×720，16 fps。
- 输入居中裁切，上传 JPEG/PNG/WebP 最大 25 MiB，供应商检查最大 100 MP；fal 文件输入支持公开 URL 和 Base64 Data URI。此集成不发送音频或安全检查开关。
- 默认 `image_transform=center_crop`、`prompt_processing=enhanced`。填写 seed 时为避免未设种子的重写环节引入变化，改用 `original`；seed 范围 0–2147483647，0 正常保留。
- 供应商按请求秒数收费：480p $0.005/s、720p $0.01/s。49/81 帧带来的 3.0625/5.0625 秒文件时长不增加请求报价。按现有积分换算与高清系数，3/5 秒分别为 480p 3/4 积分、720p 6/9 积分。
- 服务端在扣费前校验工作流、图片数量、格式、参数、密钥及报价；拒绝把它当作每日免费任务。重复提交、任务输出解析和失败退款复用现有机制。
- 品牌图标与供应商起始示例图片本地缓存。示例明确标为输入图；页面的改写提示词没有冒充实测结果。

验证：`npm run check`、`node scripts/verify-mischief.mjs`、`node scripts/verify-mischief-ui.mjs`。浏览器脚本使用隔离 Chrome CDP 9463 和本地 3000 端口，所有业务 API、GTM、生成、数据库及扣费响应均隔离；本轮没有运行真实付费生成。

来源：

- https://fal.ai/models/tbc/mischief-1/image-to-video/api
- https://openrouter.ai/tbc/mischief-1
- https://www.tbc.co/
