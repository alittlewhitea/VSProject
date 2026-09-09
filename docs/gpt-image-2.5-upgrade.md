# GPT Image 2.5 接入与积分（2026-09-09）

## 模型与示例

| 工作流 | 展示模型 | fal Endpoint ID | 默认 Quality |
| --- | --- | --- | --- |
| 文生图 | GPT Image 2.5 Flare / Fast | `openai/gpt-image-2.5/flare/text-to-image` | low |
| 文生图 | GPT Image 2.5 Sunburst / Pro | `openai/gpt-image-2.5/sunburst/text-to-image` | low |
| 图生图 | GPT Image 2.5 Flare / Fast | `openai/gpt-image-2.5/flare/edit` | low |
| 图生图 | GPT Image 2.5 Sunburst / Pro | `openai/gpt-image-2.5/sunburst/edit` | low |

保留旧内部 provider `chatgpt-image` 作为 Flare 的兼容入口，旧收藏链接不会失效。Sunburst 使用 `gpt-image-2.5-sunburst`。实际请求已不再发送给 GPT Image 2 旧接口。

四组用户提供的 prompt、参考图和预览链接集中在 `src/lib/gpt-image-models.ts`。Sunburst 文生图使用完整海报提示词，未截短。切换模型/工作流会更换内置示例；已输入的自定义提示词和用户参考图不会仅因两个 GPT 模型间切换而覆盖。示例图是用户提供的展示素材，不是本次实测的 Low 输出，也不保证 Low 必然复现同样效果。

Flare 默认尺寸 1024×768；Sunburst 默认 1536×864（16:9）。尺寸发送明确宽高，均符合 16 的倍数及最小像素限制。旧 512×512 square 参数按 1024×1024 处理，不发送低于新 API 最小像素限制的尺寸。图生图需要至少一张、最多 16 张参考图，可生成 1～4 张。

当前工作台开放 Low / Medium / High；fal 虽支持 Auto / XHigh / Max，但暂无足够明确的这些档位成本基线，因此未开放这些选项。后端不发送新 API 文档未列出的 `seed`。图生图使用工作台选定的具体输出尺寸，而非不可预先定价的 auto。

## 价格来源与限制

用户提供的四份 fal 文档列出的 token 费率相同：文本输入 $5/百万 token、图片输入 $8/百万 token、图片输出 $30/百万 token。不要因为 Sunburst 标为 Pro 就假定它有另一个固定费率。

[fal Flare 文生图价格页](https://fal.ai/models/openai/gpt-image-2.5/flare/text-to-image) 当前列出输出尺寸参考价：1024×768 的 Low/Medium/High 为 $0.005/$0.037/$0.145；1024×1024 为 $0.006/$0.053/$0.211。它们不是任意 prompt、任意参考图的最终固定账单。

[fal Sunburst 编辑价格页](https://fal.ai/models/openai/gpt-image-2.5/sunburst/edit) 的单参考图价格表标题仍写 GPT Images 2.0。不能把该表直接宣称为已验证的 2.5 单次真实成本。[OpenAI Sunburst 模型说明](https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst) 同样提醒，旧 GPT Image 2 计算器不能估算 2.5 的 token 消耗。

因此以下是**本站预扣积分策略**，不是 fal 实时报价，也不是实际 token 结算；没有运行付费生成来校准。账单可能高于或低于这个预估，上线初期应核对 fal 用量和成本后调整，不保证所有尺寸/输入都维持同样利润率。

## 当前积分算法

沿用原项目 `150 credits/USD × 1.65` 的换算/加价系数：

```text
单张预算美元 = 输出尺寸/质量基线
             + 参考图张数 × $0.012
             + ceil(prompt 的 UTF-8 字节数 / 3) × $5 / 1,000,000
单张积分 = max(2, ceil(单张预算美元 × 150 × 1.65))
总积分 = 单张积分 × 输出张数
```

- 每张参考图 $0.012 是本站暂定输入预算，不是 fal 按张报价；实际取决于图片尺寸、细节和 token。参考图多时积分递增。
- UTF-8 字节数/3 是输入文本 token 的估算，不是真实 tokenizer；中文、长 prompt 等会影响预算。
- 4:3 / 3:4 暂用 standard 基线；1:1 用 square 基线。1536×864 / 864×1536 无已核实逐档成本表，暂用 $0.006/$0.053/$0.211 的方图基线作预算参考，并非该尺寸的官方价格。
- 批量输出按单张积分乘张数，参考图输入预算也逐张预留；缓存等实际费用降低不进行自动返差额。
- Flare 与 Sunburst 使用同一策略；相同参数和相同 prompt 的积分相同。
- token 定价模型不会被“一个通用 image 单价”覆盖，避免忽略 Quality。
- 生成前展示并预扣此积分；失败继续走原项目退款流程。未实现按 fal 最终 token 账单追扣或返差。

### 四个默认示例：Low、输出 1 张

| 示例 | 参考图 | 当前预算美元（非实测） | 积分 | 界面约值 |
| --- | --- | --- | --- | --- |
| Flare 文生图，坐标 prompt，1024×768 | 0 | $0.00519 | 2 | 约 $0.01 |
| Sunburst 文生图，完整海报 prompt，1536×864 | 0 | $0.01324 | 4 | 约 $0.02 |
| Flare 图生图，两幅 Wyeth 参考图，1024×768 | 2 | $0.02915 | 8 | 约 $0.04 |
| Sunburst 图生图，Vermeer 参考图，1536×864 | 1 | $0.01808 | 5 | 约 $0.03 |

界面金额沿用项目 Premium Lite 月付套餐的积分约值，不等于 fal 成本，也不是额外扣款。更改 prompt、质量、参考图或输出张数后，前后端会使用同一函数重新计算。

## 部署

不需要 SQL 迁移、新定时任务或 OpenAI 直连密钥，继续使用原 `FAL_KEY` 调用 fal。旧 `FAL_MODEL_IMAGE_CHATGPT` 和 `FAL_MODEL_IMAGE_CHATGPT_EDIT` 不再覆盖这两个新版模型，避免服务器残留变量把请求导回 GPT Image 2。其他模型的环境变量保持不变。

代码提交并推送后，沿用原部署流程：拉取、`npm ci`、`npm run build`，成功后 `pm2 restart dreamface --update-env`。本轮实现不自动提交/推送、部署或运行付费生成。

## 验证

- `npm run verify:gpt-image`：四个端点、完整示例、Low 默认、合法尺寸、参考图/质量/数量积分与请求字段。
- `npm run check`：类型、语言、安全、邀请回归、图片模型测试和生产构建。
- `node scripts/verify-gpt-image-ui.mjs`：可选隔离浏览器测试，需本地应用 3000 和独立 Edge/Chrome 调试端口 9338；所有 API 请求均被拦截，不调用真实生成。检查四组 prompt/参考图/预览、模型切换及桌面/手机无横向溢出。
- 正式上线前仍需用获授权的测试账号验证实际 fal 权限、生成返回、失败退款和真实 token 消耗；本轮只做无付费的本地验证。
