# DreamFace 积分购买支付接入说明（中文）

本项目使用 Dodo Payments 官方 TypeScript SDK 接入一次性积分购买。前台按钮显示 **Credit Card**，附带 Visa、Mastercard 文字标识，用户不需要了解支付服务商名称。PayPal 作为另一个入口保留。内部订单和统计仍用 `dodo` 标识通道，方便对账。

官方参考：[托管收银台](https://docs.dodopayments.com/developer-resources/checkout-session)、[Webhook 验签](https://docs.dodopayments.com/developer-resources/webhooks)、[信用卡和借记卡](https://docs.dodopayments.com/features/payment-methods/cards)。收银台支持的卡品牌不限于 Visa 和 Mastercard；网站展示这两个常见品牌作为提示。用户在托管收银台选择具体付款方式，网站不接触完整卡号。

## 一、当前接入范围

- 账单页 `/billing` 和工作台的积分购买弹窗使用同一套支付按钮。
- 一次付款购买固定数量积分，不创建订阅、不自动续费。
- 积分沿用网站自己的余额和流水系统，Dodo 产品里的“积分”“权益”不用添加。
- 只有服务器确认付款成功、金额和产品匹配后才加积分。
- 同一笔付款的重复回调不会重复加积分。
- 退款、争议和异常付款进入后台人工审核，不自动扣除已经到账的积分。

## 二、数据库

2026 年 10 月 12 日已只读连接你的 MySQL 5.7 数据库，确认现有支付表及唯一索引齐全；后续复查也确认新表 `dodo_credit_checkouts` 已存在，字段和索引符合接入要求。检查过程没有改动线上数据。

你目前已经完成建表，不需要重复执行。以后在另一套已有数据库部署时，执行：

```text
migration/add-dodo-credit-checkouts.sql
```

这份 SQL 兼容 MySQL 5.7+，只创建一张新表，可重复运行。不要用整个 `mysql-schema.sql` 替代现有数据库的增量迁移。

| 表 | 作用 |
| --- | --- |
| `dodo_credit_checkouts` | 新增：保存本地结账编号、关联订单、Dodo 会话及产品 ID、测试/正式环境、实际付款总额及税额 |
| `credit_purchases` | 复用：保存用户、积分包、积分数量、价格、付款状态和通道交易编号 |
| `user_credit_accounts` | 复用：用户当前积分余额 |
| `credit_ledger` | 复用：积分收支流水，Dodo 入账引用为 `dodo:payment:pay_...` |
| `payment_webhook_events` | 复用：支付通知的处理记录 |
| `payment_incidents` | 复用：退款、争议及金额不匹配等审核记录 |

订单、积分流水、余额和回调处理记录在同一个事务内提交。中途失败会回滚，Webhook 返回失败状态，等待 Dodo 重试。

## 三、创建积分包产品

在 Dodo 后台对应的测试或正式环境里创建四个产品：

| 环境变量 | 产品名 | 积分 | USD 价格 |
| --- | --- | ---: | ---: |
| `DODO_PRODUCT_STARTER` | Starter Pack | 800 | 4.99 |
| `DODO_PRODUCT_CREATOR` | Creator Pack | 1800 | 9.99 |
| `DODO_PRODUCT_STUDIO` | Studio Pack | 4800 | 24.99 |
| `DODO_PRODUCT_PRO_TOPUP` | Pro Pack | 11000 | 49.99 |

当前代码要求：

1. 计费类型选择“一次性”，货币为 USD。
2. “适用折扣”设为 0%，不启用折扣码、自由付款金额或地区优惠。
3. **不要勾选“含税定价”**。当前代码采用税外价格校验：`实际付款总额 - 税额 = 网站积分包价格`。
4. 产品不启用购买力平价、地区定价或自适应货币定价，避免实际扣款币种和价格与网站不一致。
5. 产品中的“积分”“权限项”“元数据”留空。网站在创建结账会话时自行传递订单关联信息。

适用税费由 Dodo 根据买家情况计算并在收银台展示，不需要你手动填写税率。税外定价可能使用户最终支付高于网站标价。如希望采用含税总价，应先修改产品验证和付款核对逻辑，不能直接勾选后继续使用当前代码。

## 四、API 密钥权限

按当前代码的 API 调用，仅需以下权限：

| 资源 | 权限 | 用途 |
| --- | --- | --- |
| 支付 | 读取 | 查询真实付款状态、金额和商品 |
| 产品 | 读取 | 核对产品类型、货币和价格 |
| 结账会话 | 写入（包含读取） | 创建收银台并查询会话付款状态 |
| 其他资源 | 无 | 当前代码没有直接调用这些资源的管理接口 |

Webhook 在后台手动创建，不需要给 API 密钥 Webhooks 写入权限。验签使用单独的 Webhook 签名密钥。

## 五、配置环境变量

项目实际读取的是 **`.env.local`**。`.env.example` 和 `.env.dodo.example` 都是参考文件，不会自动生效。

把以下配置填写到本地或服务器的 `.env.local`：

```env
DODO_PAYMENTS_ENVIRONMENT=test_mode
DODO_PAYMENTS_API_KEY=对应环境的API密钥
DODO_PAYMENTS_WEBHOOK_KEY=对应端点的Webhook签名密钥
DODO_PRODUCT_STARTER=Starter产品ID
DODO_PRODUCT_CREATOR=Creator产品ID
DODO_PRODUCT_STUDIO=Studio产品ID
DODO_PRODUCT_PRO_TOPUP=Pro产品ID
```

测试环境使用 `test_mode`；正式环境使用 `live_mode`。切换环境时，API 密钥、四个产品 ID、Webhook 端点和签名密钥必须一起切换，不能混用。未填写模式时默认测试环境。

这些变量仅供服务器使用，不要添加 `NEXT_PUBLIC_` 前缀，也不要提交真实密钥到 GitHub。本地服务修改变量后要重新启动。

## 六、Webhook 设置

在 Dodo 后台创建端点：

```text
https://dreamface.io/api/billing/dodo/webhook
```

选择以下事件：

- `payment.succeeded`
- `payment.failed`
- `payment.cancelled`
- `refund.succeeded`
- 所有 `dispute.*` 争议事件：发起、申诉、接受、过期、取消、胜诉和败诉。

将该端点的签名密钥填入 `DODO_PAYMENTS_WEBHOOK_KEY`，不要填成 API 密钥。服务器校验请求原文、签名和时间戳，再查询 Dodo 的最新付款记录。成功处理并提交数据库事务后才返回成功响应。

争议胜诉或取消事件也会记录为人工审核，需要管理员确认后关闭审核记录；当前不会根据争议结果自动恢复订单状态或调整积分。

## 七、用户付款与积分到账

1. 用户在账单页或工作台选择积分包，点击 **Credit Card**。
2. 后端根据积分包 ID 读取网站价格和对应产品，创建本地订单快照及托管收银台。
3. 用户进入 Dodo 托管收银台完成付款。
4. 付款通知验签通过后，后端核对币种、商品、数量、会话归属及税外金额，并一次性加积分。
5. 返回网站时，页面也会查询该用户自己的结账会话，处理延迟到账；最多顺序检查 12 次，没有并发轮询。

浏览器 URL 中的 `status=succeeded` 或 `payment_id` 不构成付款凭证，不能直接用来加积分。用户不返回网站，只要有效 Webhook 到达，积分也会到账。

四个产品 ID 和两个密钥齐全时，网站会显示 Credit Card 入口。这只代表配置已填写，不代表密钥、产品或 Webhook 已通过真实验证。网站只有标准 `purchase` 事件携带 GA4 `value`，付款成功流程事件不会再次计入价值；当前 `purchase` 的金额是税外积分包价格。

## 八、检查与部署

本地检查：

```bash
npm run verify:dodo
npm run check
```

前者使用签名通知和隔离的 API/事务模拟，不会真实扣款或写线上数据库。后者包含全部项目检查和生产构建。

代码推送到 GitHub 后，在服务器执行（目录及 PM2 名称沿用当前项目）：

```bash
cd /www/wwwroot/VSProject &&
git pull --ff-only origin main &&
export NEXT_DEPLOYMENT_ID="$(git rev-parse --short HEAD)" &&
npm ci &&
npm run build &&
pm2 restart dreamface --update-env &&
pm2 status dreamface
```

查看当前服务端是否已启用银行卡入口：

```bash
curl --fail --silent --show-error https://dreamface.io/api/billing/payment-methods
```

响应中出现 `"dodo"`，表示配置检查通过。前台仍显示 Credit Card；响应里的名字是内部通道标识。

上线前先在测试环境验证付款成功、正确积分到账、重复通知不重复入账、付款失败、延迟通知及退款审核。完成后再切换整套正式环境配置。没有配置并验证真实测试付款前，不能把自动化测试通过等同于支付上线成功。

## 九、常见问题

- **没有 Credit Card 按钮**：检查 `.env.local` 是否包含四个产品 ID、API 密钥和签名密钥，并重新启动服务。
- **产品查询返回 401**：检查 API 密钥是否完整、有效且匹配环境；确认产品读取权限。不要把签名密钥误填为 API 密钥。
- **查询返回 403**：检查对应资源的权限。
- **产品找不到**：核对产品 ID 是否来自当前测试/正式环境。
- **产品价格校验失败**：检查一次性、USD、四档固定价格、0% 折扣和不含税设置。
- **付款已扣款但积分未到账**：检查 Dodo Webhook 送达记录、服务器日志和后台支付审核记录，不要再次付款来解决。
- **修改模式后仍不生效**：确认改的是服务器 `.env.local`，执行 PM2 重启；模式、API 密钥、签名密钥及产品 ID 应成套更新。

本次本地环境已同步你提供的 Dodo 配置，并显示支付入口；此前测试和正式环境的只读产品查询均返回 401，因此尚未确认真实收银台和付款到账链路可用。实际状态应以后续密钥核对及测试付款结果为准。
