# 图标白边与视频默认值调整

日期：2026-11-10。

## 图标

原始图标的绿色圆角方块四周约有 5% 白色画布，缩成导航 Logo 和 favicon 后会形成明显白边。本轮使用 **内置 image_gen 编辑模式**，移除外部白底并保留绿色渐变、白色笑脸气泡和阴影；随后进行紧裁切与各尺寸格式导出。

- 最终母版：`public/brand/dreamface-mark-master.png`。
- 导航与工作台变体：`public/brand/dreamface-64-e450e7fda0.webp`、`dreamface-112-2246c2a881.webp`、`dreamface-168-8a8f9cf2f9.webp`，统一通过 `src/lib/brand-mark.ts` 引用。
- 更新 PNG favicon、四尺寸 ICO、Apple Touch 和 manifest 图标。Logo/favicon 外围透明；Apple Touch 与 maskable 图标导出为绿色不透明底，适配系统图标遮罩。
- 图标元数据、manifest 链接及其图标资源增加 `20261110-clean` 缓存版本。旧的有哈希 Logo 文件保留，以兼容已缓存页面。

内置工具最终编辑提示词：

> Edit target: the attached existing DreamFace app logo. This is a precise background-extraction and edge-cleanup job, NOT a redesign. Preserve the exact existing white smiling speech-bubble silhouette, its green circular eyes and curved smile, all proportions, placement, subtle shadow, and the green/teal gradient rounded-square tile. Remove ONLY the outside white canvas surrounding the green rounded square, replacing that outside region with genuine alpha transparency. Keep the white speech bubble fully opaque. Crop the canvas tightly to the green tile's bounds, with at most 0.5% transparent breathing room on each side. Clean antialiased edges so there is no white halo on black, grey or white website backgrounds. The outer corners must remain the original rounded corners and transparent outside them. Keep the entire rounded square and its contents intact, centered, square aspect ratio, high resolution. Do not add text, extra shadows, borders, outlines, padding, new artwork or change the colors.

## 视频默认值

HeyGen 默认值从 768p / 5 秒 / 18 积分改为 480p / 5 秒 / 15 积分，覆盖 Avatar、文生、图生和参考视频工作流。分辨率选项与积分换算规则保留；URL 明确指定的配置及登录恢复的用户草稿继续生效。Avatar 介绍页的费用表也同步为 480p 的 5/10/15 秒示例。

工作台模型报价、价格列表与服务端缺省分辨率保持一致。服务端在计算积分前规范默认值；回归测试使用隔离的模型、数据库与计费响应，不运行真实付费生成。
