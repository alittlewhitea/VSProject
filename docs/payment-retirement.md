# PayPal-only 部署说明

本版本仅保留 PayPal 新购买入口，仍销售一次性积分包，不恢复订阅销售。

## 部署前

1. 在 KyrenPay 商户后台停止创建新订单，检查已有 pending / paid / refund 订单。先用旧版本完成已付款订单的入账和对账，再部署本版本；有未结订单时请先处理，避免回调下线后漏发积分。
2. 在宝塔计划任务中停用调用 `/api/cron/reconcile-kyrenpay` 的任务。不要关闭邀请奖励或 PayPal 的定时任务。
3. 对账结束后停用 KyrenPay 商户后台指向本项目的 webhook。
4. 检查 PayPal 的 API 凭据与 webhook ID 已配置，正式环境使用 `PAYPAL_ENV=live`。积分包不需要订阅 Plan ID。

## 本版本行为

- 已删除 KyrenPay 客户端、下单/同步/webhook/对账接口及 More 按钮；旧客户端显式请求该支付方式会收到 400，不会悄悄改用 PayPal。
- 数据库表、历史订单、积分流水及历史支付方式类型保留，未执行任何 DROP 或余额修改。`migration/add-kyrenpay.sql` 仅作为历史迁移保留；新部署无需执行。
- `checkout_success` 和 `purchase` 仍由已确认的支付记录触发。
- 部署后可从服务器环境配置中移除所有 `KYRENPAY_*` 变量。不要删除 PayPal、邀请奖励或 cron 的共享配置。

按 DEPLOY.md 正常拉取、安装依赖、构建并重启 dreamface。若需恢复旧接入，可从 Git 历史找回代码，但请先核对订单与积分记录，避免重复发放。
