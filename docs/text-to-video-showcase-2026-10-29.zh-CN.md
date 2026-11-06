# 文生视频展示页素材接入

页面地址：`/video/text-to-video`、`/es/video/text-to-video`、`/pt-BR/video/text-to-video`。

素材统一在 `src/features/landing-pages/text-video-media.ts` 配置，三种语言共用一组视频。当前所有素材为 `null`，页面展示明确标注的提示词创意，没有假视频、假播放按钮或虚构的模型参数。

共预留 5 个位置：`hero`（首屏主视频）、`product`（产品）、`cinema`（电影场景）、`illustration`（插画动画）、`nature`（自然景观）。可先只填部分位置。

将对应的 `null` 替换为以下对象，地址使用 Cloudflare 上可直接播放的公开 HTTPS MP4 或 WebM；不要填写控制台地址或需要登录的链接。

```ts
{
  videoUrl: "https://你的域名/实际视频.mp4",
  posterUrl: "https://你的域名/实际封面.webp",
  model: "实际生成模型",
  duration: "实际时长",
  resolution: "实际分辨率",
  prompt: "这段视频真实使用的完整提示词"
}
```

`videoUrl` 和 `prompt` 必填；封面、模型、时长、分辨率可选。不要根据画面猜模型或将网页创意提示词当成实际生成提示词。配置里的真实提示词保留原文，各语言界面会共用它。

视频使用浏览器原生播放控件，支持音量、暂停和全屏，不自动播放，预加载设为 `none`。建议准备 16:9 视频和封面；其他比例会完整展示并留边。素材视频应有相应展示权限。

素材接入后，检查三个语言页的实际播放、封面、提示词与参数，再执行构建并部署。页面的 FAQ 与 FAQPage 数据使用同一份内容，不添加尚无真实视频素材支持的 VideoObject 数据。
