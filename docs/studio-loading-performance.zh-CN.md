# Studio 加载优化：审计第 9、10 项

2026-11-11。本轮针对多语言包体和 Studio 单体组件完成本地修改与验证。提交和 push 状态以 Git 记录为准，尚未部署。

## 结果与测量口径

同一台机器、相同生产构建方式，保留原有业务逻辑和模型配置：

| 指标 | 修改前 | 修改后 | 降幅 |
| --- | ---: | ---: | ---: |
| Next 构建报告 `/studio` 的 First Load JS | 553 kB | 211 kB | 约 62% |
| Studio 入口及共享 layout 的 JS 文件 gzip 合计 | 562,722 B | 250,702 B | 约 55% |
| 同组文件未压缩合计 | 2,018,019 B | 910,490 B | 约 55% |

First Load JS 是构建工具的入口依赖统计。进入具体工作区仍会下载该编辑器，滚动到模板区也会加载模板代码；表中不是所有页面资源的总量，也不是实测打开耗时。当前语言的初始字典通过服务端页面数据提供，其传输不计入这组 JS 文件统计。

本地详细产物在忽略目录 `outputs/studio-performance/`：`before.json`、`after.json`、`dictionary-compatibility.json`、`browser-verification.json`、`check.log` 和手机/桌面截图。

## 第 9 项：按语言加载字典

- Studio 和 CreditShop 均生成 16 份独立语言字典，浏览器按当前语言加载，不再导入全部语言的文案源文件。
- `/studio` 在服务端读取当前语言并提供初始字典。其他复用入口在字典就绪后挂载工作台，首次加载失败可重试。
- 切换语言时保留现有界面和草稿；较早请求晚返回时不能覆盖最新选择。请求失败保留当前语言，再次选择会重试。
- 翻译函数和语言切换函数保持稳定引用；localStorage 不可用时仍可使用 cookie 保存语言。
- 原有覆盖优先级、英语回退、插值和 RTL 规则保留。16 种语言、每种 899 个合并键，逐项对照修改前的实际查找结果一致。

维护时仍修改现有翻译源文件。`src/lib/studio-message-catalog.ts` 保存合并规则，仅供生成和验证使用，不被浏览器入口引用。

```sh
npm run generate:studio-messages
npm run verify:studio-messages
```

生成文件位于 `messages/studio/`、`messages/credit-shop/`，需要随代码提交。`npm run build` 自动生成；`npm run check` 会在构建前检查生成结果是否过期。

## 第 10 项：拆分 Studio 与按需挂载

原约 4,151 行的 `studio-client.tsx` 拆为：

| 文件 | 职责 |
| --- | --- |
| `src/app/studio/studio-client.tsx` | 语言数据入口与工作台装配 |
| `src/features/studio/use-studio-controller.tsx` | 跨视图保留的输入状态、配置和生成流程 |
| `src/features/studio/studio-shell.tsx` | 导航、页头、视图切换和弹窗挂载 |
| `src/features/studio/studio-creation-workspace.tsx` | 创建界面、模型设置与编辑器装配 |
| `src/features/studio/use-studio-task-history.ts` | 登录用户的任务历史加载与会话缓存 |
| `src/features/studio/studio-workspace-config.ts` | 工作流类型、常量和配置辅助函数 |
| `src/features/studio/studio-deferred-section.tsx` | 接近可视区域后挂载模板内容 |

首页、项目、积分、邀请页及创建区分别按需加载。首页和项目页不再挂载隐藏创建表单；支付弹窗仅打开时挂载；图片、音频、Avatar 设置及编辑器按当前工作区加载。

草稿与任务由持续挂载的 controller/history hook 管理，创建区卸载不会清空输入或中断已接受任务的更新。保留原有跨工作区图片隔离、生成提交锁、幂等键、扣费显示、登录草稿与导航行为。引用图片列表、模型选项和活跃任务列表增加 memo，减少无关状态更新时的重复计算。

本轮完成状态层、页面外壳、创建界面、任务历史和配置的边界拆分。controller 中仍集中保留跨模型生成流程，后续可按模型逐步抽取；本轮没有重写付费任务调度协议。

## 验证

- `npm run check` 通过：类型检查、26 个单元测试、现有安全/支付/模型/工作台回归、16 种语言与生产构建。
- 新增字典完整性、过期文件检查及执行实际语言 hook 的回归，覆盖异步竞争、加载失败、卸载、稳定函数引用、RTL 和禁用 localStorage。
- `scripts/verify-studio-loading-ui.mjs` 在本地生产构建与自有无头 Chrome 上通过：手机/桌面、首页不下载创建/支付/语音编辑器 chunk、语言切换与往返项目页保留草稿、一次生成提交、导航中任务完成、图片/音频/Avatar 工作区、按需打开积分弹窗。
- 浏览器接口和外部资源全部模拟；普通检查将数据库连接覆盖为本机禁用端口。本轮没有访问线上数据库，也没有真实生成、支付、发信或部署。

浏览器回归需先完成生产构建、启动本地 `:3000` 服务和自有 Chrome 调试端口 `:9353`，再执行 `node scripts/verify-studio-loading-ui.mjs`。该脚本只用于本地模拟验证，不属于付费供应商或线上验收。
