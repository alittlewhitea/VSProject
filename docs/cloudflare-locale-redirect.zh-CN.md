# Cloudflare 首页自动语言跳转

2026-11-12。共享识别逻辑和独立 Worker 已完成验证。Worker 已在 Cloudflare 绑定并通过线上法语、保存英语偏好及显式法语 URL 检查；源站兜底代码仍需随项目部署，Git push 不等于源站已更新。

## 行为

访问 `https://dreamface.io/` 时，按以下顺序选择首页：

1. 用户手动选择语言后保存的 `dreamface_locale` cookie。
2. 浏览器 `Accept-Language` 中按 q 权重排序的首个受支持语言；同权重保留原顺序，q=0 和无效参数跳过。
3. 没有可用偏好时使用 `/en`。

支持当前全部 16 种语言。`fr-FR`、`fr-CA` 对应 `/fr`，`pt-PT` 对应项目现有 `/pt-BR`；`zh-Hant`、`zh-HK`、`zh-TW` 对应繁体中文，`zh-Hans` 等对应简体中文，显式脚本标签优先于地区。兼容旧 Hebrew 标签 `iw`。

直接访问 `/en`、`/fr` 等语言 URL 时保留该语言，浏览器和 cookie 不会覆盖路径。自动选择不写入 cookie；用户手动切换语言时，现有 LanguageSwitcher/Studio 会保存偏好。

根路径仅对 GET/HEAD 返回 307，完整保留 UTM、gclid、next、重复参数及原始查询编码。跳转返回 `Cache-Control: private, no-store` 和 `Vary: Accept-Language, Cookie`，避免共享某个用户的语言选择。

Worker 仅为主域名根路径执行语言跳转；其他路径、POST、登录和支付请求保持原始 Request/Response 转发，不读写请求体、不重复提交、不重建 cookie 或缓存头。未知主机返回 404，避免把这个 Worker 当作其他站点的代理。

## 文件

- `cloudflare/locale-redirect-worker.mjs`：可整份复制到 Cloudflare Dashboard 的 **JavaScript 模块 Worker**，无依赖、无环境绑定。
- `cloudflare/wrangler.jsonc`：可选的 Wrangler 配置；手动 Dashboard 发布时不需要复制它。
- `src/i18n/locale-preference.ts`：共享识别规则。
- `scripts/generate-locale-redirect-worker.mjs`：从共享规则和项目语言列表生成独立脚本，防止两套语言映射分叉。
- `src/middleware.ts`：源站兜底；`/`、`/price`、`/auth`、`/billing` 的 GET/HEAD 使用相同选择规则。已带语言前缀的路径保持原行为。

修改规则后运行 `npm run generate:locale-redirect`。生产构建自动生成，检查会拒绝过期脚本。

## 配置顺序

建议先发布本次 Next.js 修改，再配置 Worker，确保边缘绕过或配额不足时源站能按相同规则处理。

1. Cloudflare 账户中进入 **Workers & Pages**，创建 Worker。名称使用 **`dreamface-locale-redirect`**，可从 Hello World 示例开始。
2. 打开编辑代码，将 `cloudflare/locale-redirect-worker.mjs` **完整替换**到默认脚本中并部署；保留 `export default`，不使用旧的 Service Worker 语法。
3. 在 Worker 的 **Settings → Domains & Routes → Add → Route** 中绑定：
   - Zone：`dreamface.io`
   - Route：**`dreamface.io/*`**
   - 路由 Failure mode：**Fail open / 失败时继续回源**。
   - 使用 **Route**，保留当前源站和 DNS 设置。
4. 确认脚本和路由已就绪后，停用之前新增的 **“首页跳转到英文首页”** 固定 `/en` 规则。它会提前结束请求，导致语言脚本没有执行机会。
5. 保留原有的 **www → 主域名** 规则。
6. 按下一节验证。Worker 返回的跳转带 `X-DreamFace-Locale-Redirect: edge`；源站兜底带 `origin`，便于区分。

Worker 路由匹配包含查询字符串，因此仅绑定 `dreamface.io/` 无法覆盖带广告参数的首页访问。使用 `dreamface.io/*` 后，脚本内部仍只跳转根路径，其余请求原样回源。其他请求也会计入 Workers 调用量；Free 套餐需将路由设为 Fail open，配额耗尽时继续使用源站兜底。根路径 GET/HEAD 的脚本异常也启用回源；原始 POST 不启用异常重试，避免重复提交付费任务。

不要通过公开 Cache Rule 强制缓存根路径的个性化 307。`/fr`、`/en` 等确定语言的公开页面仍可按原来的公开页面缓存方案配置。

参考：[Dashboard 创建 Worker](https://developers.cloudflare.com/workers/get-started/dashboard/)、[路由与查询字符串匹配](https://developers.cloudflare.com/workers/configuration/routing/routes/#matching-behavior)、[调用限制与 Fail open](https://developers.cloudflare.com/workers/platform/limits/#daily-requests)、[异常回源边界](https://developers.cloudflare.com/workers/runtime-apis/context/#passthroughonexception)。

## 上线验证

```bash
# 法语浏览器 → /fr；应看到 X-DreamFace-Locale-Redirect: edge
curl -sS -D - -o /dev/null 'https://dreamface.io/?utm_source=test&gclid=fixture' \
  -H 'Accept-Language: fr-FR,fr;q=0.9,en;q=0.8'

# 用户已选择英语 → /en，优先于浏览器的法语
curl -sS -D - -o /dev/null 'https://dreamface.io/' \
  -H 'Accept-Language: fr-FR,fr;q=0.9' \
  -H 'Cookie: dreamface_locale=en'

# 直接指定 /fr → 保持法语页面，返回 200
curl -sS -D - -o /dev/null 'https://dreamface.io/fr' \
  -H 'Accept-Language: en-US,en;q=0.9'
```

首个请求的 `Location` 应是 `https://dreamface.io/fr?utm_source=test&gclid=fixture`，状态 307，跳转响应不缓存。若始终跳到 `/en` 且没有 `edge` 标记，先检查固定跳转规则是否已停用、Worker Route 是否绑定正确。

Worker 的 `workers.dev` 域名不属于允许主机，访问它显示 404 属于预期；以主域名的实际路由测试为准。

## 本地检查

```sh
npm run verify:locale-redirect
npm run check
```

实际执行同一组 67 个解析/Next 中间件/生成 Worker 用例，覆盖全部语言、cookie 优先级、q 权重、中文脚本与地区、畸形 cookie、查询参数、HEAD、显式语言路径、原样转发以及付费 POST 不重试。Worker 上游 fetch 全部模拟。

本地生产构建启动后，运行 `node scripts/verify-locale-redirect-http.mjs` 验证真实响应中的法语跳转、偏好 cookie、变体、认证入口、查询保留、公开语言页面、RTL 与缓存隔离。普通检查将数据库覆盖为本机禁用端口；没有使用真实支付或供应商任务验收。2026-11-12 已在线验证法语请求进入 `/fr` 并保留广告参数、英语偏好 cookie 进入 `/en`，两者均带 `edge` 标记；直接访问 `/fr` 返回 200。后续变更可按上述命令复查。
