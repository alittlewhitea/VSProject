# KyrenPay 一次性积分包部署说明

## 1. 本次改动

- `/en/price`（及其他语言价格页）、`/billing`、工作台购买弹窗统一销售一次性积分包。
- 新订阅下单返回 HTTP 410；不会取消已经存在的订阅。老订阅仍可能自动续费，用户仍可在账单页管理、取消。若要停止所有老订阅续费，需要单独制定迁移方案，本次没有批量取消。
- 每个积分包提供 PayPal 和 KyrenPay 两个购买按钮，金额和积分一致。原有 PayPal 回调、付款确认、对账和历史订阅管理保留。**Admin 旧按钮是 Reconcile PayPal（对账），不是关闭开关。**保留 PayPal 密钥和 Webhook。
- PayPal 一次性购买需要 `PAYPAL_CLIENT_ID`、`PAYPAL_CLIENT_SECRET`、`PAYPAL_WEBHOOK_ID`，以及正确的 `PAYPAL_ENV`（生产使用 `live`）。无需创建订阅 Plan，支付成功仍通过原 `/api/billing/paypal/capture` 和 Webhook 确认到账。
- `KYRENPAY_CHECKOUT_ENABLED` 仅控制 KyrenPay 新下单，不影响 PayPal。某个支付方式未配置时，仅该方式返回暂不可用，不会自动切换渠道。`checkout_success` / `purchase` 继续在返回网站并确认到账后上报，支付渠道取实际订单记录。
- 只卖积分，不额外承诺订阅专属队列、会员身份或新版权权益。生成消耗规则不变。

| 包 | 产品配置变量 | 积分 | KyrenPay 商品价格 |
| --- | --- | ---: | ---: |
| Starter Pack | `KYRENPAY_PRODUCT_STARTER` | 800 | USD 4.99 |
| Creator Pack | `KYRENPAY_PRODUCT_CREATOR` | 1,800 | USD 9.99 |
| Studio Pack | `KYRENPAY_PRODUCT_STUDIO` | 4,800 | USD 24.99 |
| Pro Pack | `KYRENPAY_PRODUCT_PRO` | 11,000 | USD 49.99 |

Pro Pack 的内部 ID 仍为 `pro-topup`，保留历史订单兼容。每次下单实时检查商品为 ACTIVE、价格和 USD 币种完全匹配。不要填错商品或将商品设置为人民币同数值价格。站内金额换算以 Studio Pack 为参考，不是额外扣费，也不代表所有包单积分单价一致。

## 2. KyrenPay 后台需要做什么

1. 检查四个已创建商品：名称可自行设置，价格、USD 币种必须与上表一致，商品处于 ACTIVE。
2. 复制每个商品的 Product ID（不是收款链接、不是订单号），填入服务器对应变量。
3. 在 Developer settings 获取生产 API Key（`kyren_live_...`）。只放服务器环境变量，**不要放 NEXT_PUBLIC 变量、GitHub 或聊天记录**。
4. 创建 Webhook：`https://dreamface.io/api/billing/kyrenpay/webhook`，选择 `order.paid`、`order.refunded`、`order.closed`。
5. 将该 Webhook 对应的签名密钥填入 `KYRENPAY_WEBHOOK_SECRET`。这是支付商为该端点提供的密钥，不是随意生成的本地 CRON_SECRET。
6. 确认 Cloudflare / Nginx 不缓存、不跳转、不拦截该 POST 路径；不要给支付回调加验证码或登录验证。应用本身会验签，不能移除验签。

文档依据：[创建结账](https://docs.kyrenpay.com/api-reference/checkouts/create-a-checkout-session)、[查单](https://docs.kyrenpay.com/api-reference/orders/retrieve-an-order)、[签名](https://docs.kyrenpay.com/webhooks/signatures)、[事件](https://docs.kyrenpay.com/webhooks/events)。

## 3. 宝塔数据库和环境变量

先备份站点数据库；以下 SQL 必须导入 **Dreamface 项目使用的数据库**，不是新建一个空数据库。

1. 宝塔 → 数据库 → 对应库 → phpMyAdmin → 导入。
2. 导入仓库里的 `migration/add-kyrenpay.sql`。可重复执行；只新增 `kyren_checkouts` 表，不清空积分或历史订单。
3. 项目以前已接 PayPal，通常已有 `credit_purchases` 中立支付字段、`payment_incidents`、`payment_webhook_events`。如果是旧库尚无这些字段/表，先执行 `migration/add-payment-providers.sql`；新安装先执行基础 `migration/mysql-schema.sql`。
4. 宝塔文件管理 → `/www/wwwroot/VSProject/.env.local`，加入：

```dotenv
KYRENPAY_CHECKOUT_ENABLED=false
KYRENPAY_API_KEY=填生产API密钥
KYRENPAY_WEBHOOK_SECRET=填该Webhook签名密钥
KYRENPAY_PRODUCT_STARTER=填Starter商品ID
KYRENPAY_PRODUCT_CREATOR=填Creator商品ID
KYRENPAY_PRODUCT_STUDIO=填Studio商品ID
KYRENPAY_PRODUCT_PRO=填Pro商品ID
NEXT_PUBLIC_APP_URL=https://dreamface.io
```

保留现有 MySQL、登录、PayPal、Referral 和 `CRON_SECRET` 配置，不要覆盖整个文件。环境变量填实际值，不保留中文占位符。

完成 SQL、商品配置和 Webhook 配置后，将 `KYRENPAY_CHECKOUT_ENABLED=true`。该开关只停止**新下单**；已付款回调和对账不受影响，避免关掉收款时漏发已付订单积分。配置变更后重启 PM2。

## 4. 部署

确认本次代码已经 push 后，在服务器执行（不要提前拉取一个并不存在的新提交）：

```bash
cd /www/wwwroot/VSProject
git status
git pull --ff-only origin main
```

如果提示本地 `package-lock.json` 修改挡住拉取，先检查差异，再仅备份这两个已知生成/依赖文件：

```bash
git diff -- package-lock.json tsconfig.tsbuildinfo
git stash push -m "server files before KyrenPay deployment" -- package-lock.json tsconfig.tsbuildinfo
git pull --ff-only origin main
```

不要删除 `.data/`、`.env.local`，不要自动 stash pop 覆盖新依赖锁文件。SQL 和环境配置完成后：

```bash
export NEXT_DEPLOYMENT_ID="$(git rev-parse --short HEAD)"
npm ci && npm run build && pm2 restart dreamface --update-env
nginx -t && nginx -s reload
pm2 describe dreamface
```

`dreamface` 的工作目录应为 `/www/wwwroot/VSProject`，端口为 3002。不要重启同服务器上的 `ottomob`。构建失败不要继续重启。

## 5. 新增宝塔计划任务：支付对账

这个是**新增任务**，不替换现有邀请奖励定时任务。

- 任务类型：Shell 脚本
- 名称：Dreamface KyrenPay reconciliation
- 执行用户：root（与现有 PM2/文件权限保持一致）
- 周期：每 5 分钟
- 只复制下面代码内部，不要复制 Markdown 的三反引号。

```bash
#!/bin/bash
set -euo pipefail
cd /www/wwwroot/VSProject
/usr/local/bin/node --env-file=.env.local -e '
(async () => {
  if (!process.env.CRON_SECRET) throw new Error("CRON_SECRET is missing");
  const response = await fetch("http://127.0.0.1:3002/api/cron/reconcile-kyrenpay", {
    headers: { Authorization: "Bearer " + process.env.CRON_SECRET },
    signal: AbortSignal.timeout(240000)
  });
  if (!response.ok) throw new Error("HTTP " + response.status);
  const result = await response.json();
  console.log(new Date().toISOString(), JSON.stringify(result));
  if (result.ok !== true || result.failed !== 0) throw new Error("Payment reconciliation reported failures");
})().catch(error => { console.error(error.message); process.exitCode = 1; });
'
```

使用已有 `CRON_SECRET`，不要为新任务换掉它导致邀请任务失效。正常无订单时：`{"ok":true,"processed":0,"completed":0,"failed":0}`。401 是密钥问题，404 多为旧代码未部署，500 需要检查表、API Key 和付款商服务状态。Admin 的 KyrenPay 卡片显示配置是否齐全，但不代表已做真实支付测试。

## 6. 安全和验收

- 原始请求体验 HMAC-SHA256 签名，时间戳使用毫秒，超过正负 5 分钟拒绝。
- 服务器再次调用 KyrenPay 查单，以本地快照核对用户、商品、包、结账 ID、订单 ID、原始付款金额和 USD 币种。不是按扣除手续费后的净额发积分。
- 回调、返回页、定时任务统一使用事务和订单唯一键；余额、流水、购买记录一起提交，重复回调不能重复到账。
- 即使用户没返回网站，Webhook 仍可发积分；漏回调由对账补偿。返回 URL 本身不能证明付款成功。
- 退款不会直接自动扣余额，会阻止尚未发放的订单继续加积分，并进入 Admin → Payment Incidents 人工复核。已有积分如果需要追回，须人工核对已消耗量后处理。此次不新增主动退款操作。
- API 请求失败、支付金额不一致时不发积分。保留支付商订单号排查，不能手工伪造 success URL 补款。

本地 `node scripts/verify-kyrenpay.mjs` 使用模拟 API/事务，验证验签、重复通知、事务失败回滚、订单归属、金额/币种、退款乱序、新订阅关闭等。**不等于完成真实支付或真实 MySQL 迁移验收。**

上线后需由你完成一笔真实小额购买或向 Kyren 申请测试环境，检查一次性付款、到账 800、刷新不重复到账、订单和流水正确。不要拿公开测试卡直接在生产收银台测试；Kyren 文档说明商户后台暂无自助测试密钥，测试环境须由支付商提供。[测试环境说明](https://docs.kyrenpay.com/testing)
