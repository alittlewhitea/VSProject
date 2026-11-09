# 统一登录弹窗

官网导航与首页注册按钮、Studio 桌面与移动端登录入口、生成、Avatar 收藏和充值入口均使用同一个登录弹窗。普通点击保留当前 URL；新标签页、禁用 JavaScript 和旧链接继续使用原 `/auth` 页面。

英文主界面文案为：Welcome to Dreamface、Sign up and generate for free、Continue with Google、OR、Email、Continue。文案覆盖项目的 16 种语言，弹窗跟随当前页面语言。邀请码仅在邀请功能开放时展示，并默认折叠。

移动端工作台在未登录时于右上角展示登录按钮，同时将购买积分收为保留无障碍标签的图标按钮，为工作区标题留出空间。首页 Google 按钮与弹窗共用样式和多色 SVG 图标，首次点击即同步打开 Google 授权窗口；Try DreamFace 继续展示登录方式选择。授权窗口受阻时保留弹窗中的显式备用入口。

## 登录流程

- Google：在用户点击时同步打开 OAuth 小窗口，复用原 Google start/callback、state cookie、用户创建、积分与邀请逻辑；完成页通知原窗口，再由原窗口向服务端确认会话。小窗口受阻时显示显式跳转入口，离开 Studio 前保存草稿。
- 邮箱：Continue 发送原有 10 分钟有效的登录链接，弹窗进入查收邮件状态，提供更换邮箱、重发倒计时。链接完成页通过同源存储通知原标签页；回到原页面时也会重新检查会话。
- 任何窗口间通知均不携带访问令牌。令牌仍由原服务端会话接口返回，认证 cookie 继续使用 HttpOnly。
- 普通登录不触发生成。从生成按钮触发时，登录成功后继续一次生成；关闭弹窗则取消此次待办。Avatar 收藏和充值套餐选择分别恢复原操作，套餐选择不会自动创建支付订单。
- 弹窗支持 Escape、Tab 焦点约束、关闭后焦点恢复与移动端布局。底层 Studio 弹窗在登录弹窗打开期间暂停键盘处理。

## 接入方式

链接使用 `AuthLink`，保留正常链接的备用行为。需要完成后继续某个动作时，调用 `requestSignIn({ onSuccess, onBeforeRedirect, next })`；`next` 只用于必须整页跳转时的返回地址。

`AuthDialogHost` 在根布局按需加载弹窗。Google 和邮箱共用 `/auth/complete` 完成页；该页面禁止索引。服务端继续校验 OAuth state、邮箱链接有效期与一次性使用规则。

## 验证

- `npm run verify:auth`：返回地址、跨标签页会话同步、草稿保存失败时阻止跳转、Google 普通/弹窗回调、state 校验、邮箱成功/过期和 16 种语言。
- `npm run verify:studio-billing`：弹窗登录后的结账恢复与服务端计价参数。
- `node scripts/verify-auth-dialog-ui.mjs`：本机 Next 服务 `127.0.0.1:3000` 和隔离 Chrome CDP `127.0.0.1:9338`。覆盖桌面/手机弹窗、官网入口、图片与脚本保留、Google 失败/受阻恢复、邮箱跨标签页同步、单次生成、收藏与充值方式选择恢复。

浏览器与接口回归均使用模拟认证、邮件、生成、支付和数据库响应。浏览器结果及截图保存在 `outputs/auth-dialog/`，不构成真实 Google 授权或邮件送达验证。
