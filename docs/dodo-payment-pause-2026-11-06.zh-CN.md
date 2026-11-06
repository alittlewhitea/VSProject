# 暂停 Dodo 新支付（2026-11-06）

因商户审核问题，暂停 Dodo Payments 新订单。PayPal 及其现有钱包支付保持原有行为。

统一开关：`src/lib/payment-release.ts` 的 `DODO_CHECKOUT_SUSPENDED = true`。

- 前端所有共用支付弹窗隐藏 Dodo 对应的 Credit Card 按钮，不再查询 Dodo 是否可用。即使残留状态曾显示 Dodo 可用，也不会显示该入口或发起跳转。
- 支付方式列表接口只返回 PayPal；旧页面或直接调用 `/api/billing/checkout` 请求 Dodo 时返回 503，不创建订单。
- 新建 Dodo 订单的底层服务也有同一开关，在访问供应商或写数据库之前拒绝，防止内部调用绕过入口。
- 不删除商户密钥、产品配置、支付表或历史订单。已付款订单的签名回调与本人补单、重复通知幂等、退款/争议处理继续保留。
- 不调用 Dodo 后台修改或取消已经发出的托管收银台会话。

恢复方法：确认审核通过后，将开关改为 `false`，核实原有 test/live 密钥与四个产品配置，回归支付后构建部署。无需数据库迁移。

验证：Dodo 暂停与历史回调、PayPal 订单、PayPal 钱包、工作台 Billing、类型检查与生产构建均通过。Chrome 隔离浏览器确认独立 Billing 与工作台 Billing 的 Dodo 按钮均隐藏、PayPal 保留，没有客户端异常；本地真实支付方式接口仅返回 PayPal。测试没有发起真实支付或写入真实数据库。代码需要部署后才在线上生效，本次未 push 或部署。
