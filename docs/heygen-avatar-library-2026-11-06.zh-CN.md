# HeyGen 公共 Avatar 素材库（2026-11-06）

## 接口与范围

使用 [List Avatar Groups](https://developers.heygen.com/reference/list-avatar-groups) 的 `GET https://api.heygen.com/v3/avatars?ownership=public` 展示人物；使用 [List Avatar Looks](https://developers.heygen.com/reference/list-avatar-looks) 的 `GET /v3/avatars/looks?ownership=public&group_id=...` 展示服装、姿态等造型。

官方返回 `data` 数组、`has_more` 与 `next_token`；分页最多 50 条。人物和造型分别有 `preview_image_url`、`preview_video_url`，视频字段缺失时展示静态图。仅展示 API 实际提供的素材，不用演示人物替代。

本地服务端代理 `/api/avatars/heygen` 固定使用公共 ownership，不接收客户端 API Key 或上游地址。Key 使用 `X-Api-Key` 发往官方域名，不允许重定向；超时 15 秒。相同分页请求合并、按 Key 摘要缓存五分钟，缓存最多 128 页；失败不缓存，Key 变更隔离旧缓存。

不接入 HeyGen `/v3/videos` 或 Video Agent 生成服务。当前人物或造型的“去创建”把预览图选入 Avatar 工作台，保留口播文字，替换旧上传图片并聚焦输入框；不自动生成或扣积分。点击生成后通过现有 fal HeyGen Video 图生视频接口生成原生带声视频。详见 [Avatar 简洁口播工作台](avatar-composer-2026-11-06.zh-CN.md)。

## 界面与播放

- Avatar 工作区下方新增 Public Avatars / My Avatars。
- 人物卡片显示主封面和两张真实造型缩略图；没有足够附图时显示单封面，不复制封面凑数。造型缩略图进入视口附近才请求，客户端并发最多两个请求，上游每次仅取前三个造型。
- 点击人物进入造型网格，支持返回人物、搜索、分页。当前分类仅保留全部、收藏，筛选仅保留 gender 性别；官方人物列表未提供风格分类，抽样造型标签为空，不依据姓名、文件名或外观猜测职业及生活分类。
- 桌面悬停显示右下角“去创建”和收藏。键盘焦点也能显示操作；触屏持续显示操作，点击造型可播放预览。
- 视频仅在悬停或明确点击预览时创建元素并加载。移开、离开视口、切换标签页、打开人物详情或卸载组件时停止并释放媒体地址。同一时间只播放一个 Avatar 预览，尊重减少动态效果设置。
- 适配项目现有浅色、深色、RTL 与 16 种语言。API 未配置或暂时不可用只显示库状态，不阻断现有 Avatar 表单。

## 收藏与数据库

用户选择按登录账号保存并跨设备同步。`/api/avatars/favorites` GET/POST 通过服务端 Bearer Token 解析用户，不信任客户端用户 ID。收藏以 `(user_id, avatar_kind, avatar_id)` 为唯一键，可分别收藏人物或具体造型，取消收藏只删除当前用户记录。

新增 `studio_avatar_favorites` 表：第一次访问收藏接口时执行幂等 `CREATE TABLE IF NOT EXISTS`；不会改已有业务表。数据库账号没有建表权限时，管理员可预先执行 `migration/add-avatar-favorites.sql`。本次测试未连接真实数据库，也未实际创建线上表。

收藏保存素材信息快照，不下载原始图片或视频。My Avatars 展示用户真实收藏；未登录提示登录，服务端保存失败会显示失败状态，不以本地缓存假装同步成功。

## 配置和验证

`.env.example` 与 `.env.local` 已加入服务端字段：

```dotenv
HEYGEN_API_KEY=
```

应用运行读取 `.env.local`，不会自动读取 `.env.example`。用户可在 `.env.example` 填写用于本地联调，随后仅将这一项同步至 `.env.local`；真实 Key 不应进入版本提交或前端变量。改 Key 后需重启本地服务。已有 fal 的 `FAL_KEY` 继续用于 HeyGen Video 生成。

全量 `npm run check` 与生产构建已通过；新回归 `npm run verify:avatars` 覆盖官方两种 GET、公共 ownership、游标与预览页大小、缺少/无效 Key、缓存、并发合并、轮换 Key、错误脱敏、账号隔离、收藏增删及未登录拒绝，并检查 16 语言文本。

浏览器隔离报告：`outputs/avatar-library-20261106/browser-regression.json`。验证人物拼图、57 条造型的分页、悬停播放及停止、跨浏览器上下文收藏、搜索、HeyGen Video 跳转与输入保留、移动端及 RTL 深色布局。素材和账号均为明确的测试请求拦截，未调用真实生成或操作真实数据库。

2026-11-06 用户已在 `.env.example` 填入 Key，仅此字段已同步到 `.env.local` 并重启服务。真实接口验证通过：人物首页返回 50 条并有下一页；首位 Dante 的造型返回 27 条，每条具有图片与视频地址。真实 Chrome 已验证图片加载、悬停播放与移开停止、人物详情，无客户端异常和生成调用。报告：`outputs/avatar-library-20261106/live-preview.json`。

真实人物项未提供视频地址，改为使用其造型预览视频；用户提前悬停时，懒加载返回地址后会自动衔接播放。真实 API Key 不得随 `.env.example` 提交，后续提交前需将模板中的值清空，运行值保留在已忽略的 `.env.local`。

本地预览为 `http://127.0.0.1:3012/studio?mode=avatar&workflow=avatar-video&provider=minimax-h3-max-turbo-video`。未 push 或部署。

## 加载性能优化（同日）

真实测量发现主要开销来自直接显示 1920×1080 原图：抽样每张约 200–350KB。服务端目录缓存命中约 60ms，原图抽样请求耗时约 0.2–1.5 秒。

- Avatar 卡片复用现有图片优化器，按实际显示区域选择尺寸、WebP / quality 75；仅新增允许 `resource2.heygen.ai`，不代理任意外部域名或带用户凭据的 URL。优化失败回退原图。
- 图片仍懒加载。现有图片缓存上限保持 256MiB，未把素材复制进仓库。
- 客户端缓存最近 64 个公共目录分页，五分钟有效。返回人物列表、重开已浏览人物可以直接复用数据；显式重试绕过缓存。账号收藏不使用这份公共缓存。
- “去创建”仍传入原始素材 URL，不把缩略图用于视频生成。

单图实测：283,609 字节原图 → 8,864 字节缩略图，约减少 96.9%；首次缩略图生成 285ms，缓存命中 4ms。此为样本，不代表所有图片或总页面提速幅度。

真实浏览器返回人物列表约 111ms，没有新增人物目录请求；重开同一造型列表也没有新增目录请求。报告 `outputs/avatar-library-20261106/performance-regression.json`。Avatar 桌面/移动/RTL、收藏、跳转与输入保留回归、类型/安全检查、生产构建通过。本地预览已重启。
