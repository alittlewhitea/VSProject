# 邀请奖励：部署与验收

本文按你现有的宝塔部署方式编写：项目目录 `/www/wwwroot/VSProject`、PM2 进程 `dreamface`，示例应用端口 `3002`。端口必须在宝塔网站反向代理配置中核对；不要把本地开发的 `3000` 直接当成服务器端口。以下是需要你在服务器执行的步骤，当前仅完成本地代码和模拟测试，尚未执行线上迁移或开启真实奖励。

## 你需要做的清单（按顺序）

- [ ] 1. 确认新版代码已经提交、推送，再在服务器拉取；备份数据库和现有配置。
- [ ] 2. 在现有业务数据库导入邀请专用 SQL，不创建第二个业务数据库。
- [ ] 3. 配置可信国家/IP 来源，确认只有注册赠送 100 积分的地区开放。
- [ ] 4. 配置服务器 `.env.local`：功能开关、签名密钥、定时任务密钥、正式域名和管理员。
- [ ] 5. 构建并重启 `dreamface`，检查邀请管理后台；先保持后台活动关闭。
- [ ] 6. 宝塔新增 **1 个每分钟运行的 Shell 计划任务**，手动执行一次检查日志。
- [ ] 7. 隔离测试环境验收通过后，在后台开启活动，核对双方各 100 积分和限额。
- [ ] 8. 检查允许/受限地区页面及真实任务日志，后续每天看审核队列和失败情况。

不需要新增 Redis、消息队列、第三方发奖服务、支付 Webhook 或单独的常驻 Worker。现有 MySQL、Next.js/PM2 和宝塔计划任务即可；但国家识别必须来自可信代理，宝塔本身不会自动补齐这个能力。

## 1. 拉取代码、备份与核对环境

先确认邀请代码已经推送到 GitHub。否则 `git pull` 不会把本地未提交的新功能带到服务器。

在宝塔终端执行：

```bash
cd /www/wwwroot/VSProject
git status
```

如有服务器本地修改，先确认内容并备份，不执行强制重置。工作区确认无冲突后：

```bash
git pull --ff-only origin main
git rev-parse --short HEAD
ls migration/add-referrals.sql migration/update-referral-rewards-100.sql
pm2 list
node -v
command -v node
command -v flock
```

记下 `node` 的绝对路径，第 6 步会用到。应使用项目现有、能成功构建的 Node 版本；计划任务脚本至少要求 Node 18 的内置 `fetch`，不要为邀请功能随意降级运行环境。`flock` 缺失时先在服务器安装对应发行版的 util-linux 工具，不能删掉互斥锁后继续上线。

在宝塔完成以下备份：

1. **数据库 → 当前项目数据库 → 备份**，确认生成了可下载的 SQL 备份，另存一份到安全位置。
2. **文件 → `/www/wwwroot/VSProject/.env.local`**，私下保存原配置；不要把密钥文件放到网站公开下载目录或提交 Git。
3. **网站 → 当前域名 → 配置文件/反向代理**，保存当前 Nginx 配置，记下代理目标端口。
4. 记录本次部署前的 Git 提交号，方便代码回退。数据库备份是故障恢复用，不要用整库恢复来回退一个邀请开关，否则可能覆盖之后的充值和生成记录。

## 2. 数据库：用原业务库导入，不新建业务库

### 2.1 确认你选的是哪个库

在宝塔文件编辑器查看服务器 `.env.local` 的 `MYSQL_DATABASE`，到宝塔 **数据库 → 对应数据库 → 管理/phpMyAdmin**，选中同名数据库。不要选 `mysql`、`information_schema` 或其他站点数据库。

这是已运行项目的增量部署，**不需要重跑整份 `migration/mysql-schema.sql`**。只有从零安装整个项目时才先初始化基础结构。

### 2.2 首次安装邀请功能

在 phpMyAdmin 中选中业务数据库 → **导入** → 选择最新版 `migration/add-referrals.sql` → 执行。也可通过宝塔终端导入，先把示例中的用户名和库名替换成实际值：

```bash
cd /www/wwwroot/VSProject
mysql -h 127.0.0.1 -P 3306 -u '实际数据库用户名' -p '实际数据库名' < migration/add-referrals.sql
```

密码在命令提示后输入，**不要写在 `-p` 后面**。若数据库不在本机，使用现有连接地址、端口及所需 TLS 参数，不要为导入而开放公网 3306。导入账号需要建表和外键相关权限。

脚本新建 9 张邀请表：`referral_settings`、`referral_profiles`、`referral_auth_contexts`、`referral_devices`、`referral_device_users`、`referrals`、`referral_client_signals`、`referral_device_claims`、`referral_audit`。积分入账继续使用原来的 `user_credit_accounts` 和 `credit_ledger`。

### 2.3 已经导入过旧版邀请脚本

如果表已存在但后台金额还是 50/30，执行：

```bash
cd /www/wwwroot/VSProject
mysql -h 127.0.0.1 -P 3306 -u '实际数据库用户名' -p '实际数据库名' < migration/update-referral-rewards-100.sql
```

此脚本只调整活动设置和列默认值到 100/100，不开启活动、不发积分，也不改已绑定邀请的金额快照。首次使用最新版 `add-referrals.sql` 创建成功则不必执行该更新。

`CREATE TABLE IF NOT EXISTS` 不会自动修复旧表缺列。如果导入的是开发中间版本，不能假定再导入一次就已升级；若报缺列/外键错误，先保留活动关闭并对比建表结构，不要删表重建。

### 2.4 检查结果

在 phpMyAdmin 的 SQL 页面执行以下只读查询：

```sql
SHOW TABLES LIKE 'referral%';
SELECT id, enabled, inviter_credits, invitee_credits,
       daily_limit, monthly_limit, daily_budget, launched_at
FROM referral_settings WHERE id = 1;
SHOW INDEX FROM credit_ledger;
```

首次安装应是：`enabled=0`、双方金额 `100/100`、每日 `3`、每月 `30`、全站日预算 `10000`。原积分流水应有 `(user_id, reason, reference_id)` 组合唯一索引，它是防重复入账的一部分。不要手动插入奖励流水、修改用户余额或把历史邮箱全部标记为已验证。

## 3. 配好地区识别（这一步缺失会看不到入口）

地区名单直接复用 `src/lib/credits.ts` 的 `LIMITED_SIGNUP_BONUS_COUNTRIES`，不需要在宝塔另建一份名单。

- 受限名单之外、且服务器能识别国家的用户：地区条件通过。
- 受限地区、未知国家、`XX` 等无有效国家信息的请求：隐藏入口、拒绝邀请。
- 这里判断的是地区规则，不是当前余额是否等于 100；同 IP 注册奖励未领取，也不自动等于地区黑名单。
- 邮箱、设备、账号阻止标记等规则仍独立生效。地区允许不代表一定能拿奖励。

### 3.1 站点已经通过 Cloudflare 代理

1. 在 Cloudflare 确认实际业务域名走代理（橙云）。
2. 进入该域名 **Network → IP Geolocation → On**，让回源请求带上 `CF-IPCountry`。官方说明见 [Cloudflare IP Geolocation](https://developers.cloudflare.com/network/ip-geolocation/)。
3. 确认公网访问该业务源站必须经过你的可信 Cloudflare 入口，不能直接访问源站并自行伪造国家头。可以结合源站防火墙允许 Cloudflare 网段、认证回源或 Tunnel 实现；具体取决于现有网络配置。更改防火墙前保留 SSH/宝塔管理通道，避免锁住自己。参考 [Cloudflare 源站保护](https://developers.cloudflare.com/fundamentals/security/protect-your-origin-server/)。
4. 确认 Node 应用端口（例如 3002）不向公网裸露，公网仅经受控 Nginx/代理访问。
5. 在宝塔 **网站 → 当前站点 → 反向代理/配置文件**，找到实际代理到应用的 `location`，确认国家和客户端 IP 头没有被清空、缓存或替换。以下仅为请求头片段，不是完整 Nginx 配置：

```nginx
# 前提：此业务入口只接受可信 Cloudflare 回源！
proxy_set_header CF-IPCountry $http_cf_ipcountry;
proxy_set_header CF-Connecting-IP $http_cf_connecting_ip;
```

不要创建第二个冲突的 `location /`，也不要覆盖原来的 WebSocket、Host 和超时配置。此方案中应用使用 `REFERRAL_IP_HEADER=cf-connecting-ip`，避免把 Cloudflare 节点 IP 当成用户 IP。现有注册/风控如果依赖 X-Real-IP，也须确认其真实 IP 恢复配置正确，不能把所有用户记为同一代理节点。已有 Nginx realip 配置应只信任明确的代理网段，不能使用 `set_real_ip_from 0.0.0.0/0`。[Nginx realip 官方说明](https://nginx.org/en/docs/http/ngx_http_realip_module.html)

修改后先执行 `nginx -t`，通过才 `nginx -s reload`。如果命令不在 PATH，用宝塔 Nginx 管理界面的配置检查/重载功能。

### 3.2 没有 Cloudflare 或可信国家头

仅添加 `proxy_set_header X-Real-IP $remote_addr;` 能提供 IP，**不能推算国家**。需要你现有的可信 CDN 国家头，或另行配置服务端 GeoIP，再把 `REFERRAL_COUNTRY_HEADER` 指向由该代理覆盖的国家头。当前项目没有自动查询国家的外部接口。

没有配置好时保持活动关闭，联系维护人员完成这一层；不要让浏览器上报国家、相信任意客户端 `x-country-code`，也不要固定写 `US`/`CN` 让所有人通过。非 Cloudflare 方案的具体 Nginx 配置需要根据现有代理和 GeoIP 模块另行确定。

## 4. 环境变量：在服务器 `.env.local` 编辑

宝塔 **文件 → `/www/wwwroot/VSProject` → 显示隐藏文件 → 编辑 `.env.local`**。只补充或修改下面字段，保留原数据库、支付、模型和登录配置。同一个变量只保留一处定义。

以已完成源站保护的 Cloudflare 方案为例：

```dotenv
REFERRAL_ENABLED=true
REFERRAL_SECRET=替换成独立生成的随机密钥
REFERRAL_IP_HEADER=cf-connecting-ip
REFERRAL_COUNTRY_HEADER=cf-ipcountry
REFERRAL_EXCLUDED_IPS=
REFERRAL_EMAIL_DENYLIST=
REFERRAL_EMAIL_ALLOWLIST=

CRON_SECRET=保留现有定时任务密钥或首次生成的新密钥
NEXT_PUBLIC_APP_URL=https://你的正式业务域名
ADMIN_EMAILS=你的管理员登录邮箱
```

说明：

- `REFERRAL_ENABLED=true` 仅打开程序侧能力；数据库活动开关仍为 0，尚不会开放新邀请或发奖。两个开关都打开才正式运行。
- `REFERRAL_SECRET` 在宝塔终端执行 `openssl rand -hex 32` 生成，复制 64 位结果填入。单独保存、不要截图发群；这是设备/邀请签名密钥，不要每次部署重新生成，否则现有签名和设备关联会失效。
- `CRON_SECRET` 如果原来已有生成同步、PayPal 对账等定时任务，应沿用原值。若原来没有，再独立执行一次 `openssl rand -hex 32` 生成另一份。不要和 `REFERRAL_SECRET` 共用。变更它时所有旧定时任务都必须同步更新。
- `NEXT_PUBLIC_APP_URL` 填用户真正访问的 HTTPS 域名，不能是 localhost、IP 或旧域名；修改后需要重新构建。
- `ADMIN_EMAILS` 保留原管理员，多人用英文逗号分隔。这里不是数据库用户名。
- `REFERRAL_EXCLUDED_IPS` 默认留空即可，地区黑名单不填写在这里；需要额外排除网段时才使用英文逗号分隔的 IP/CIDR。
- 临时邮箱黑名单已内置，两项邮箱补充列表可先留空。
- `REFERRAL_IP_POLICY` 已不使用，旧配置可以删除。受限地区不能通过切换该变量放开。
- 环境文件只允许应用运行账户及受信任运维读取；不要放进 `public/`。宝塔 Node 项目/PM2 若另外设置了同名环境变量，应同步修改或去掉冲突，进程环境可能覆盖 `.env.local`。

## 5. 构建、重启并检查后台

在管理 `dreamface` 的同一个系统账户下，逐条执行；任一步失败就停下，不继续重启：

```bash
cd /www/wwwroot/VSProject
export NEXT_DEPLOYMENT_ID="$(git rev-parse --short HEAD)"
npm ci
npm run build
pm2 restart dreamface --update-env
pm2 status dreamface
nginx -t
nginx -s reload
```

首次已经在第 1 步拉过代码，这里不必再 pull。以后普通代码更新可以沿用你原来的部署流程；数据库脚本不需要每次重复执行。

检查：

```bash
curl --fail --silent --show-error http://127.0.0.1:3002/api/deploy/version
pm2 logs dreamface --lines 60 --nostream
```

日志中如有数据库、SQL 缺列或配置错误先处理，分享日志时移除个人数据与密钥。

用 `ADMIN_EMAILS` 中的账号登录正式站点，再打开 `https://你的正式业务域名/admin/referrals`：

1. 确认显示 `Environment: ready`，且能看到设置。
2. 此提示仅证明基础环境开关/密钥格式合格，不证明国家头、源站安全或定时任务正常。
3. 保持 **Enable campaign** 未勾选，先核对以下值并点击 **Save settings**；弹出的审计备注至少填写 3 个字符，例如“首次部署，确认双方100积分，活动暂不开启”。

| 后台字段 | 填写值 | 含义 |
| --- | --- | --- |
| inviter credits | 100 | 邀请人每次获得的积分 |
| invitee credits | 100 | 新人每次获得的积分 |
| daily limit | 3 | 每位邀请人每日奖励名额 |
| monthly limit | 30 | 每位邀请人每月奖励名额 |
| daily budget | 10000 | 全站每日奖励积分总预算，包含双方 |

100/100 合计每次 200，因此全站日预算 10000 最多容纳当天预留的 50 次完整邀请奖励。待发/已预留审核占用预算；不要把 10000 理解为每个用户的限额。

## 6. 宝塔新增一个每分钟的计划任务

### 6.1 面板怎么填

进入 **计划任务 → 添加任务**（不同宝塔版本名称略有差别）：

- 任务类型：**Shell 脚本**，不要选普通“访问 URL”，因为本接口需要 Authorization 请求头。
- 任务名称：`DreamFace 邀请奖励发放`。
- 执行周期：**每 N 分钟，N=1**；如果填写 cron 表达式，则为 `* * * * *`。
- 执行用户：有权限读取项目 `.env.local` 和运行项目 Node 的账户；沿用服务器的应用运维账户，不额外开放文件权限。
- 脚本内容：粘贴下面完整代码，把 `REFERRAL_NODE` 替换成第 1 步 `command -v node` 输出的真实绝对路径，端口按实际调整。

宝塔支持 Shell 计划任务与任务日志，操作入口可参考 [宝塔计划任务官方文档](https://docs.bt.cn/category/%E8%AE%A1%E5%88%92%E4%BB%BB%E5%8A%A1)。

### 6.2 可复制的任务脚本

```bash
#!/bin/bash
set -euo pipefail
cd /www/wwwroot/VSProject

# 必须替换为服务器 command -v node 输出的绝对路径。
REFERRAL_NODE='/请替换为实际路径/bin/node'
if [ ! -x "$REFERRAL_NODE" ]; then
  echo 'ERROR: 请先填写 REFERRAL_NODE 的真实路径'
  exit 1
fi

# 锁被另一批任务占用时跳过，不重复并发启动。
# 读取项目环境文件，不把密钥写在 URL、脚本内容或命令行参数中。
flock -n -E 0 /tmp/dreamface-referral-rewards.lock "$REFERRAL_NODE" <<'NODE'
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd(), false);

(async () => {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error('CRON_SECRET is missing');
  const response = await fetch('http://127.0.0.1:3002/api/cron/referral-rewards', {
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(240000)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const result = await response.json();
  console.log(new Date().toISOString(), JSON.stringify(result));
  if (result.disabled === true) throw new Error('Referral environment is disabled or incomplete');
  if (result.ok !== true || result.failed !== 0) throw new Error('Referral processing reported failures');
})().catch(error => {
  console.error('Referral cron failed:', error.message);
  process.exitCode = 1;
});
NODE
```

此脚本的请求发到本机，不经过 CDN/WAF，避免挑战页和公网超时；定时发奖依赖已保存的风控状态，因此无需给这个内部请求伪造国家头。应用端口仍不能对公网开放。不要把服务端生成接口、浏览器页面 URL 当成发奖地址。

脚本通过项目已有的 `@next/env` 加载生产环境文件，而不是 `source .env.local`；无需另外安装 npm 包。不打印密钥。任务账户必须能读到与 PM2 一致的配置；如果密钥只放在 PM2 环境里而没有环境文件，需先统一配置，否则任务会失败。

### 6.3 保存后点“执行”，查看日志

空队列时正常示例：

```json
{"ok":true,"processed":0,"failed":0,"disabled":false}
```

处理了两条记录时可能是：

```json
{"ok":true,"processed":2,"failed":0,"disabled":false}
```

`processed` 是本次检查的记录数，**不是成功发奖人数**，可能仍在等待邮箱/生成/延迟。`disabled` 仅反映程序环境配置，后台数据库活动关闭时也可能显示 `disabled:false`；必须同时确认后台 **Enable campaign** 状态。

后台尚未开启时，任务可以正常完成但不会发奖。上线后只建这一份邀请任务，不要再复制一份域名 curl 任务重复轮询；现有生成同步、PayPal 对账任务继续保留，不能被本任务替代。

每次最多检查 50 条等待/待发记录。10～30 分钟从任务首次确认条件、预留名额开始，不是从点邀请链接或注册开始；积压、人工审核和停机可能进一步延迟。`failed>0` 即使 HTTP 200 也必须排查。

## 7. 开启与上线验收

涉及真实注册、模型扣费和奖励到账的完整演练先在隔离测试环境进行，使用独立数据库、密钥和测试账户，不能把本地预览当成真实联调完成。不要在生产库改任务状态、插入虚假生成或强行调整到期时间来“测试”。

准备完成后在正式后台：勾选 **Enable campaign → Save settings**，填写“正式开启邀请活动，双方100积分”等审计备注。从这一步起允许地区用户会看到入口，并可以开始产生真实奖励。

检查顺序：

1. 从允许地区网络访问正式站点，在浏览器打开 `/api/referrals/availability`，应得到 `{"visible":true}`；此接口是匿名地区/活动检查，不代表具体账号通过所有风控。
2. 从受限地区实际网络检查应为 `{"visible":false}`，桌面侧栏、手机菜单和注册邀请码输入均隐藏。国家信息缺失时也应隐藏。
3. 普通用户重新登录并刷新工作台。已有邀请人需要在启用程序后再通过邮箱或已验证 Google 邮箱登录一次，以记录可信邮箱验证状态；仅数据库有 email 不够。
4. 确认分享链接是正式 HTTPS 域名，前端显示双方各 100 积分、每日 3/月度 30，而不是本地模拟 URL。
5. 观察正常新用户邀请记录：`waiting → pending → paid`。成功入账后双方积分流水的 reason 为 `referral_reward`，各增加 100；设备或弱信号异常可能转到 `review`，不是自动到账。
6. 检查桌面/手机及切换地区后的入口。登录账号可能已有持久 IP 排除标记，匿名 `visible:true` 不保证该账号能看到入口；后台先核实原因再考虑解除，不能批量清空风控记录。
7. CDN/Nginx 不缓存 `/api/referrals*`、`/api/admin/referrals*`、`/api/cron/*`、`/r/*` 和认证/工作台 HTML；防止把某个地区的可见性或邀请跳转缓存给另一个用户。

可在数据库运行这些只读查询，辅助核对任务而不改业务数据：

```sql
SELECT status, COUNT(*) AS count FROM referrals GROUP BY status;
SELECT id, status, reason, bound_at, due_at, paid_at,
       inviter_credits, invitee_credits
FROM referrals ORDER BY bound_at DESC LIMIT 20;
SELECT user_id, amount, reference_id, created_at
FROM credit_ledger WHERE reason = 'referral_reward'
ORDER BY created_at DESC LIMIT 20;
```

数据库任务时间是 UTC，界面/日志核对时注意与北京时间相差 8 小时；额度按北京时间自然日/月，不需要把服务器系统时区强行改成北京时间。

## 8. 常见问题、日常维护与暂停

| 现象 | 优先检查 |
| --- | --- |
| 后台 403 / Forbidden | 是否登录 `ADMIN_EMAILS` 中的邮箱；修改环境后是否重启正确 PM2 进程 |
| 后台 Environment: not configured | `REFERRAL_ENABLED=true`、签名密钥长度、IP 头名称及 PM2 同名变量冲突 |
| 后台 503 / migration required | 是否导入到项目实际连接的库、表/列是否完整、数据库权限及连接 |
| 所有人都看不到入口 | 活动两个开关、可信 `CF-IPCountry` 是否传到应用、CDN 缓存；不一定是数据库问题 |
| 匿名允许但某账号无入口 | 账号阻止/IP 排除标记、临时邮箱；检查账号后台记录 |
| cron 401 | 文件中的 CRON_SECRET 和运行中 PM2 不一致或为空；同步配置并重启 |
| cron HTTP 404 / ECONNREFUSED | 端口、应用是否在线、新代码是否确实部署 |
| cron HTTP 503 / failed 大于 0 | 数据库结构/锁/连接错误，查 PM2 日志；不要手动重复补积分 |
| node not found / 无权限 | 计划任务使用 Node 绝对路径，执行账户能读项目和环境文件 |
| require('@next/env') 失败 | 工作目录是否正确，npm ci 是否成功，是否部署了项目依赖 |
| 一直 waiting | 双方邮箱验证、真实成功扣分生成、7 天期限是否满足 |
| 一直 pending | due_at 是否到期、计划任务是否正常执行、是否有积压 |
| review | 查看原因后人工审核；不要直接改 paid 或绕过同设备等硬规则 |

每天查看计划任务最近执行时间、`failed` 和后台审核队列；定期更新临时邮箱库、复核活动预算与隐私说明。脚本以非零退出码报告失败，但不等于已经配置好手机/邮件告警，需按宝塔现有告警能力另行设置。

暂停活动：在 `/admin/referrals` 取消 **Enable campaign** 并保存，停止新绑定及发奖、隐藏入口；也可将 `REFERRAL_ENABLED=false` 后重启 PM2，进一步停止邀请采集。维护数据库或回退代码时同时暂停该计划任务。停用不会扣回已经发出的积分，恢复后待发记录继续复核，不重置额度。

如果后台无法访问但必须紧急暂停，可在**已确认的业务数据库**执行这一条明确的开关修改，并记录运维原因：

```sql
UPDATE referral_settings SET enabled = 0 WHERE id = 1;
```

不要删除邀请表、清空流水或恢复整库来暂停活动；它们保留了去重依据和审计记录。正常操作优先走后台，以上应急 SQL 不会自动生成应用审计备注。

## 默认规则

- 邀请人 +100 Credits，被邀请人 +100 Credits。双方同一事务入账，不能提现，不增加订阅权益。
- 邀请人每天最多 3 位、每月最多 30 位有效邀请，北京时间自然日/月；待发和已预留的审核记录都占额度。
- 全站每天默认 10,000 奖励积分预算，包含双方奖励。超额邀请不自动排到次日发放。
- 双方验证邮箱，双方至少一次真实成功且扣积分的生成。被邀请人的生成必须在绑定后、注册后 7 天内完成。失败、退款、无输出、模拟及每日免积分任务不计入。注册赠送积分可使用。
- 条件满足后预留额度，随机延迟 10～30 分钟，再次检查后发放。技术故障只重试，不重复发奖。
- 同设备互邀、同设备重复新人奖励、临时邮箱、排除用户不奖励。滚动 24 小时同设备出现第三个不同账户时暂停关联待发奖励，人工审核；不封禁使用或充值。
- 仅一级邀请，新账户在首次注册时绑定，旧账户不能补绑。绑定后不可换邀请人。链接先到先得，Cookie 默认有效 30 天。

## 简要部署原则

按上方第 1～8 节操作即可；不要额外创建第二份邀请计划任务。数据库只做增量迁移，正式上线需同时完成程序配置与后台活动开关。新部署全项目才初始化基础 schema，现有站点不重建业务库。

## 工作台与后台

- 工作台：`/studio?view=referrals`，桌面侧栏与移动端菜单均有入口。
- 登录页可填邀请码；`/r/邀请码` 会保存邀请并引导注册。邀请人的完整邮箱和设备信息不会提供给被邀请人，邀请记录仅显示匿名编号、状态和日期。
- 后台：`/admin/referrals`。可配置奖励、额度、活动预算，查看原因、审核软风险、拒绝未发奖励、阻止账户参与奖励及查看操作日志。
- 审核通过只解除设备频率/弱信号审核，不跳过邮箱、同设备、生成、IP、预算等硬规则。已预留奖励审核通过后至少再等 10 分钟。已到账或已拒绝的记录不直接重开，不提供任意绕过规则的发奖按钮。
- 若确认误判但记录已最终拒绝，可在原有管理员积分调整工具中补偿，写清对应邀请记录 ID，避免重复补偿。
- 修改奖励金额仅影响之后绑定的邀请，已绑定邀请保留金额快照。修改额度不会撤回已预留/已到账名额。
- 当前新增邀请文案提供简体中文、繁体中文和英文，其余语言暂回退英文。

## 风控能力与限制

第一方设备 Cookie 使用 HttpOnly / SameSite / HTTPS Secure 与 HMAC 签名。只保存 HMAC 后的设备标识；不能将浏览器标识等同于不可伪造的物理设备 ID。清除 Cookie、换浏览器、换设备和代理都可能影响识别，不能保证阻止所有自邀。

补充信号使用可信 IP + User-Agent + Accept-Language 的服务端 HMAC；不存储原始组合，不使用 Canvas/音频等高侵入指纹。这只是弱证据：同网络同浏览器的互邀或短时间多账户进入人工审核，不直接按同设备拒绝。全站预算和管理员复核仍是必要控制。

IP 排除在认证开始、认证回调和已登录工作台访问时检查，并保留排除标记，避免换 IP 后自动恢复奖励。管理员可以清除已核实的排除标记，但下一次命中仍会排除。更改网段名单不会反向推算历史 HMAC，已有待发奖励若需要重新排查，应先暂停活动并人工检查。

临时邮箱库使用锁定版本的 `disposable-email-domains`，没有运行时外部查询。名单不是百分之百完整，需定期审核更新依赖及额外黑名单，误报可配置精确域名白名单。不要删除任何邮箱的 `+suffix` 或点号来粗暴合并不同邮箱。

活动上线前应审核现有隐私说明，告知设备/反滥用记录的用途及申诉方式。认证上下文 15 分钟过期，由计划任务清理。设备和领取标记用于防止重复领取，不自动按 24 小时删除；应明确活动期和活动结束后的留存、清理策略，避免无限期积累。新增页面不是法律合规意见。

## 必测验收

- [ ] 新邀请链接、手动邀请码、邮箱登录、Google 登录；旧账户不能补绑，重复认证不能换邀请人。
- [ ] 邮箱未验证、临时邮箱、邮箱改变、同设备、重复设备奖励、指定 IP/地区排除均不能到账。
- [ ] 两个账户不触发“超过两个”，第三个账户进入审核；相同网络/浏览器仅软审核。
- [ ] 成功扣积分任务合格；失败、退款、模拟、无结果和每日免积分任务不合格。
- [ ] 7 天未完成过期；已完成并预留后跨日期/审核延迟不重新占名额。
- [ ] 每日 3/月度 30、全站预算与并发预占，拒绝释放预占但不自动顺延超额邀请。
- [ ] 延迟到期前余额不变；多进程并发、服务重启和重复任务同一笔不多发。
- [ ] 第二个人入账时数据库故障，双方余额和流水一起回滚，恢复后只发一次。
- [ ] 管理员审核不能跳过硬规则，普通用户访问管理接口被拒绝。
- [ ] 桌面和手机验证邀请页面、复制、状态刷新、登录失效和暂停活动提示。

自动化：`npm run verify:referrals`、`npm run check`。自动测试使用隔离模拟存储，不替代实际 MySQL 并发、宝塔代理头和生产登录/生成链路验收；不要在生产库制造测试奖励。

## 本地界面预览

运行 `npm run dev -- --hostname 127.0.0.1 --port 3000`，打开 `http://localhost:3000/dev/referral-preview`。此页面仅开发模式存在，使用双方各 100 积分的模拟数据，不请求邀请 API、不连接奖励数据库、不创建真实奖励；生产构建访问返回 404。
