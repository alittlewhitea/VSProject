# 搜索索引边界和页面元信息（2026-10-27）

## 本次处理

| URL | 搜索策略 | 说明 |
| --- | --- | --- |
| `/{locale}/auth` 及其参数 | 保留已有索引设置 | GSC 六个月导出中登录页合计有42次点击；在核对对应搜索词和近期表现前，暂缓 noindex。`/auth` 仍重定向到英语登录页并保留参数。 |
| `/studio` | 自指 canonical，可索引 | 已列入 sitemap，保留当前公开入口。 |
| `/studio` 加仅追踪参数 | canonical 为 `/studio` | 仅限 `utm_*`、`gclid`、`dclid`、`fbclid`、`msclkid`、`gbraid`、`wbraid`。 |
| Studio 功能及未知参数 | 暂不指定 canonical 或 noindex | 模式、工作流、模型、语言和其他参数可能影响实际内容，先查看 GSC，不强制归并。 |
| Studio `view=projects`、`view=referrals` 或 `taskId` | `noindex, follow`，无 canonical | 用户作品、邀请等私人工作区，不作为公开搜索落地页。 |
| `/gallery` | 独立标题、描述、自指 canonical | 客户端 Gallery 内容和筛选交互保留。 |
| Gallery 仅追踪参数 | canonical 为 `/gallery` | 与基本列表相同的追踪参数。 |
| Gallery 搜索、分类、排序或未知参数 | 暂不指定 canonical 或 noindex | 过滤结果不一定等价于全部列表；待 GSC 审核后再定。 |
| `/about` | 独立标题、描述、自指 canonical | 移除重复品牌后缀，社交分享说明与页面一致。 |

robots.txt 的既有 `/auth` 规则保持不变；对于有语言前缀的登录页，保留原有 canonical 与 hreflang。私有工作台的 `noindex` 是索引信号，不是访问控制；登录和私有数据仍依赖原有鉴权。

Next.js 默认将部分 Googlebot 元信息流式输出到正文之后；配置额外将 Googlebot 作为需要首屏 HTML 元信息的抓取器，同时保留 Next.js 现有 HTML-only 爬虫列表。Googlebot 接收的响应头部包含索引指令和规范链接；普通浏览器的元信息流式行为不变。此设置可能影响搜索爬虫的首字节时间，上线后应结合日志观察。

首页和价格页的 canonical 与 16 语言 + x-default hreflang 保持原样。此项不处理 Gallery 首屏服务端渲染，不新建功能落地页，也不修改 GA4 或归因链路。

## 验证与上线后核对

本地生产构建、类型检查、多语言字典检查和 `scripts/verify-search-metadata.mjs`（使用本机隔离服务、数据库不可连接、Googlebot UA）验证原始 HTML 的标签、16 个登录页、32 个营销页、参数策略、重定向、robots 与 sitemap。浏览器模拟验证 Gallery 分类、排序、搜索交互，以及 Studio 图生视频与 Grok 模型参数预选；API 请求全部使用隔离数据，未生成付费内容。

2026-10-27 收到的 GSC 六个月汇总导出有页面和查询两个独立维度，但无逐页面查询交叉明细、URL Inspection 或最近28天页面拆分。登录页共42次点击（2026-05-25 至 10-24）；在取得登录页过滤后的查询数据前维持原状。部署后使用 URL Inspection 抽查各类 URL 的抓取 HTML、用户声明和 Google 选择的 canonical，再结合 28/90 天页面与查询数据审查 Studio 功能参数和 Gallery 筛选 URL；任何后续批量 noindex 或归并先确认既有流量与用户意图。
