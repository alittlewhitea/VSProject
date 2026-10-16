# PayPal Apple Pay / Google Pay：统一支付弹窗

## 页面流程

官网积分购买页、工作台充值和余额不足弹窗共用积分包组件。选择套餐后打开支付弹窗，展示套餐、积分、USD 总额及可用的 Apple Pay、Google Pay、PayPal、Credit Card。

- 钱包 SDK 仅在打开支付弹窗后加载，不随工作台首页加载。
- 根据 PayPal 商户配置和设备能力展示钱包官方按钮。钱包不可用或脚本加载失败时，仍保留原有支付方式。
- Apple Pay、Google Pay 均通过 PayPal 收款；Credit Card 继续使用既有 Dodo 托管结账。
- 未登录时先进入现有登录流程，不创建钱包订单。
- 钱包付款成功后，服务端确认扣款及积分发放，当前页面刷新余额，无需离开工作台。

## 商户配置与上线

商户注册国家已由站点所有者确认为 **GB**，Google Pay 交易国家默认使用 GB，不使用买家 IP 国家。可在服务器 `.env.local` 中用 `PAYPAL_MERCHANT_COUNTRY=GB` 显式覆盖；如果以后切换商户账号，应改成新账号实际国家。

继续使用现有服务端 `PAYPAL_ENV`、`PAYPAL_CLIENT_ID`、`PAYPAL_CLIENT_SECRET`、`PAYPAL_WEBHOOK_ID`。没有新增密钥，也不需要新建数据库表。只有 PayPal 公共 Client ID 会提供给浏览器用于官方 SDK，Secret 和 Webhook ID 不公开。

上线前确认对应 Live 应用已开通 Apple Pay 和 Google Pay。站点所有者已完成 `dreamface.io` 的 Apple Pay 域名登记，宝塔的验证文件及精确匹配 Nginx 配置应持续保留。如果实际收银页面使用 `www.dreamface.io`，也需要登记该子域，或在服务器上统一跳转到已登记域名。

本次需要构建并重新部署应用，包含支付组件和 CSP / Permissions-Policy 对官方 SDK、钱包页面及支付框架的域名许可。只上传域名验证文件不会启用网站钱包按钮。

## 服务端流程与保护

1. `GET /api/billing/paypal/wallet-config` 返回公开的 SDK 配置。
2. `POST /api/billing/paypal/wallet-orders` 要求登录、有效积分包和钱包类型。金额和积分来自服务端套餐表；若浏览器显示的报价过期，拒绝建单。
3. 为钱包创建没有预选 PayPal 跳转资金来源的 Orders v2 订单，并保存到已有 `credit_purchases` 表。钱包仍记为 `payment_provider=paypal`。
4. 浏览器官方 SDK 验证 Apple 商户会话、提交钱包授权。Google Pay 需要额外身份验证时执行 3DS；验证失败不进入扣款。
5. `POST /api/billing/paypal/capture` 验证订单归属，从 PayPal 读取真实订单，核对金额、币种和授权状态，再执行 Capture。只在捕获状态为 COMPLETED、金额及币种与本地订单一致时发放积分。
6. 积分流水沿用 `paypal:capture:<capture_id>` 幂等键。重复回调、客户端重试、Webhook 同时到账均不能重复发积分。原有 Webhook 和对账流程继续适用。

创建订单沿用每用户每分钟 6 次的频率限制；Capture 每分钟 20 次。仅购买一次性积分包，不新增订阅。

## 取消、超时与恢复

Apple 会话及 Google 支付面板必须从用户点击同步发起，避免浏览器拦截。用户取消且尚未确认扣款时，不发积分。

钱包授权后、扣款确认前，在本标签页 sessionStorage 保存订单号和积分包 ID（不保存银行卡、钱包 Token 或登录凭证）。如果扣款确认超时，弹窗提供“检查付款状态”，重试同一订单，不自动创建新的付款。确认前禁止发起其他付款；重新打开弹窗也会读取待确认记录。服务器始终检查订单归属。

关闭浏览器后，可以通过账单记录和既有 Webhook / 对账确认最终结果。浏览器显示“成功”不是积分到账依据。

GA4 的 `purchase` 只在服务端确认后报告，使用与现有 PayPal 跳转流程一致的 Order ID 作为 transaction_id，金额来自服务端收据。普通 `checkout_success` 只记录 amount_cents，不重复设置事件 value。

## 验证

`npm run verify:wallets` 覆盖服务端报价、身份归属、金额/币种校验、重复到账、额外身份验证以及钱包用户点击流程。原有 PayPal、Dodo、GA4 测试继续执行。

自动测试使用隔离订单、模拟 SDK 和模拟数据库，不创建真实付款。生产钱包资格、iPhone/Apple Wallet 以及真实 Google Wallet 支付仍需要在正式域名上验证。

## 官方文档

- [PayPal Apple Pay](https://developer.paypal.com/v5/apple-pay/integrate/)
- [PayPal Google Pay](https://developer.paypal.com/v5/google-pay/integrate/)
- [PayPal 3D Secure 参数](https://developer.paypal.com/platforms/checkout/advanced/customize/3d-secure/response-parameters/)
