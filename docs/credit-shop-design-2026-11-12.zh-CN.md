# 价格页与积分商店设计重构

设计依据：用户提供的 `optimized_saas_credit_pack_modal.html`。将其中的布局、视觉层次和用途预览转为现有 React 组件；HTML 中模拟支付成功、固定余额与固定产量的脚本不作为真实支付或计费逻辑使用。

## 展示与交互

- `/en/price`、其他语言价格页、工作台积分商店与账单页共用积分商店组件：暖色渐变标题、余额胶囊、四档卡片、用途切换、工具与支付说明。
- Creator 默认作为突出推荐项：紫色描边、浮动 Most Popular 标签和主按钮；其他套餐使用次级按钮，Pro 显示绿色 Best value。生成时余额不足的场景继续按缺口推荐能覆盖的积分包。
- 价格与积分仍来自 `CREDIT_PACKS` / `CREDIT_PACK_PRICES`：$4.99/800、$9.99/1,800、$24.99/4,800、$49.99/11,000。Creator 的 200 赠送积分包含在 1,800 中，未额外增加到账积分。
- 视频、图片、Avatar/配音估算使用项目现有 `creditUsageCapacity()`，标明模型和规格。Avatar 使用已有 Kling Avatar Standard、5 秒、自备音频的估算，不将积分数换算成原稿中没有计费依据的“分钟数”。单积分价格与折扣从实际套餐计算。
- 订单摘要显示所选套餐、增加积分、购买后预计余额、优惠档位和应付金额。未知余额显示占位；已支付后的父级余额刷新不会再叠加一次充值积分。
- 工作台登录后主动获取一次余额，并保留支付成功事件触发的余额刷新。
- 桌面四列，768–1023px 两列，小于 768px 一列；手机用途切换为两行，弹窗自身可滚动。保留登录门槛、Tab 键焦点约束、Escape 逐层关闭与关闭后的滚动恢复。
- 新文案覆盖 16 个语言，营销页 next-intl 和 Studio 平面字典都经过实际格式化检查。Inter 字体在本站托管，附带 SIL Open Font License；没有引入运行时 Tailwind CDN 或 Lucide CDN。

## 支付边界

沿用既有 PayPal 跳转、PayPal Hosted CardFields、Apple Pay、Google Pay、服务端报价、capture、积分入账及 pending order 恢复。银行卡入口仍展开真实受托管表单，钱包按设备资格显示。不因选择套餐、预热 SDK 或打开弹窗创建订单；未经服务端确认不显示支付成功、不增加余额。Dodo 的现有停用开关保持生效。

## 验证

- `npm run typecheck`、`npm run verify:wallets`、`npm run verify:studio-billing`、语言包一致性检查通过。
- `npm run check`：通过全部现有检查与 Next.js 生产构建；运行时将数据库指向不可连接的本机端口，未查询线上数据库。
- `node scripts/verify-credit-shop-design-ui.mjs`：1440/768/640/390/320px，价格页与工作台弹窗、四种用途、四档订单摘要、首次余额加载、登录门槛、支付拒绝后恢复、嵌套关闭与滚动、中文/德语/法语/西班牙语/阿拉伯语无横向溢出。全部业务 API 模拟。
- `node scripts/verify-paypal-cards-ui.mjs`：桌面、390px、320px，Hosted Fields 不重叠、无效输入不创建订单、重复点击、同订单确认恢复、3DS 拒绝后切换、资格判断、加载失败重试。全部 SDK/API 模拟。
- `node scripts/verify-paypal-wallets-ui.mjs`：预加载、独立钱包就绪、局部重试、设备不支持、配置失败恢复、Apple Pay 成功、Google Pay 原订单恢复、余额更新后不重复叠加。全部 SDK/API 模拟。
- 对照原始 HTML 截图并检查实现截图；截图保存在被 Git 忽略的 `outputs/credit-shop-design/`，银行卡截图在 `outputs/paypal-cards/`。

没有使用真实客户账户、创建真实支付订单或执行线上数据库写入。转化率效果需部署后结合真实购买数据评估；本次不保证转化率提升幅度。
