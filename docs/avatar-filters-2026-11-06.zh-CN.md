# Avatar 分类、筛选与简洁控制栏

- 分类仅显示 All、Favorites，覆盖全部 16 种现有语言。移除没有可靠供应商字段对应的 Professional、Lifestyle、UGC、Community，以及基于名称和图片文件名的风格推测。Favorites 使用当前账号已收藏条目。
- 搜索、分类与性别筛选组合生效。性别可多选，选项间为“或”；Reset 清空草稿，Done 应用。Escape 或点击外部取消草稿并恢复焦点。
- 筛选面板只保留接口明确返回的 gender 字段，删除年龄、族裔及其不可用说明；不根据姓名、图片或视频猜测属性。原 API 返回结构及收藏快照保持兼容。
- 过滤范围是已加载的分页结果，不假装已搜索供应商全部人物。保留“加载更多”、分组造型、账号收藏、悬停播放及已有图片优化/目录缓存。
- 删除输入区 Avatar image URL 入口；保留上传和人物库选择。取消“设置”入口，以轻量模型按钮打开现有选择对话框。HeyGen 时长在原位置可手动选 5–15 秒，报价和提交使用同一时长。

验证使用隔离 API 与浏览器数据，不发起付费生成，不写真实用户收藏。相关命令：`npm run check`、`npm run verify:avatars`、`npm run verify:heygen-video`。浏览器报告位于 `outputs/avatar-refinement-20261106/` 和 `outputs/avatar-composer-20261106/`。

补充核对（2026-11-06）：官方 V3 人物列表没有风格分类字段，造型列表有 `tags` 和 `avatar_type`。本次只读抽样的 50 个人物无 category/categories/tags；50 个造型的 tags 全为空，avatar_type 均为 photo_avatar，不能映射为 UGC 或生活风格。字段摘要记录于 `outputs/avatar-premium-20261106/category-field-audit.json`。本次 UI 收尾报告位于 `outputs/avatar-library-polish-20261106/`。
