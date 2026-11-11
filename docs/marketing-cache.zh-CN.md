# 首页与公开落地页缓存（审计 #15）

2026-11-11。应用侧修改、本地完整检查及生产 HTTP 验证已完成。提交和 push 状态以 Git 记录为准，尚未部署或修改线上 CDN/宝塔配置。

## 当前行为

| 内容 | 缓存策略 |
| --- | --- |
| 16 种语言首页、现有公开英文落地页及西语/葡语落地页 | `public, max-age=0, s-maxage=300, stale-while-revalidate=60` |
| 首页的 8 条公开推荐案例 | Next 服务端数据缓存 300 秒，所有语言复用同一查询结果 |
| 登录、积分购买、价格/支付、工作台、Admin、账户 API、动态 Gallery/Creations | 保持原有不缓存策略 |
| RSC/预取、Action、Authorization、非 GET/HEAD、未知查询参数、未知或已下线页面 | 不启用公开缓存 |
| 开发环境、语言入口重定向 | 不缓存 |

浏览器 `max-age=0`，不会长期保留不经校验的旧 HTML。支持共享缓存的代理/CDN 可缓存公开页面 5 分钟，并在过期后的 60 秒窗口内异步更新。不同语言使用不同 URL，不按用户 cookie 拼接公共内容。登录态、余额和支付状态仍由客户端通过实时接口取得。

UTM、gclid、fbclid 等现有广告归因参数保持原样；没有为了提高命中率删除或重写查询参数。未知参数不会自动被视为可缓存请求。

## 实现与边界

- `src/lib/marketing-cache-settings.json`：公开路由白名单、语言列表、TTL 和导航/鉴权请求头列表，供 Next 配置和中间件共同使用。
- `next.config.mjs`：在能读取原始请求头的配置层，为白名单文档添加正向缓存规则；RSC、预取和其他非 HTML 请求不能命中这些规则。
- `src/lib/marketing-cache-policy.ts`、`src/middleware.ts`：未知页面、未知参数、非只读请求和重定向维持 `no-store`，保留语言及部署标记。
- `src/lib/gallery-server.ts`：使用 `unstable_cache` 缓存固定的公开推荐查询。查询失败继续抛出，由页面降级展示，不把失败转换成成功的空数据缓存。
- `src/lib/gallery-cache.ts`、Admin Gallery 路由：新增、编辑、删除成功后执行 tag 失效；包括取消发布、切换推荐和修改提示词。不合法、无权限、重复及失败写入不触发失效。

Next 15 会在进入中间件前移除 Flight 请求头和内部 `_rsc` 参数，因此不能只靠中间件判断后直接设置公开缓存。当前规则由配置层先区分原始请求，中间件只补充禁止缓存的条件。生产 HTTP 测试检查真实 RSC 响应，避免仅靠模拟 NextRequest 得出错误结论。保留 Next 返回的 `Vary`，用于区分 HTML 和导航响应。

这轮没有把页面强制改成静态页面。根布局仍根据请求设置语言，整页源站渲染仍存在；应用内确定生效的是推荐案例数据缓存。整页共享缓存的命中与收益取决于部署环境是否启用并遵循响应缓存规则。没有 CDN/代理缓存时，不能把响应头当作已获得源站整页 ISR。

Admin 操作会使服务端案例数据失效，但不会自动清除外部 CDN 已保存的整页 HTML；该页面按上面的短期 TTL 更新。需要立即更新时，应清除对应公开页面的 CDN 缓存。

## 本地验证

```sh
npm run verify:marketing-cache
npm run check
```

规则回归覆盖全部语言、路由白名单、追踪/未知参数、真实中间件和 Next 配置、开发环境、RSC/Action/Authorization 绕过、固定查询、TTL/tag、查询故障以及 Admin 成功/拒绝/失败分支。

另在本地生产构建启动后执行：

```sh
node scripts/verify-marketing-cache-http.mjs
```

检查实际响应的 Cache-Control、Vary、公开 HTML、语言/RTL、cookie/header 不覆盖 URL 语言、追踪链接、真实 Flight/预取、账户页面和已下线/不存在页面。该脚本只访问本地 HTTP，不执行页面脚本；运行服务器时将数据库连接覆盖为本机禁用端口，不访问生产用户数据、支付、发信或付费供应商。

测试记录在忽略目录 `outputs/marketing-cache/check.log` 与 `http-verification.json`。没有根据本地热请求时间宣称线上提速百分比。

## 部署后需要确认

检查 CDN/宝塔是否启用共享缓存、是否尊重 `no-store` 与 `Vary`，以及是否正确区分完整路径和查询参数；不要用全站“缓存所有内容”覆盖这些规则。通过连续请求的 `Age` 或平台缓存命中头确认公开页面命中，账户与 RSC 请求应继续绕过。

发布新版本时清除公开页面的旧 HTML 缓存，或保留上一版静态资源至少覆盖 6 分钟缓存窗口，避免旧页面引用已经删除的 JS/CSS。这些线上设置和命中验收本轮没有执行。
