# Production Deploy

DreamFace uses a Next.js deployment ID to keep browser assets aligned with the build that served the page. The app now falls back to the current Git commit automatically, but setting the ID explicitly during production deploy is still recommended.

## RackNerd deploy

Run from the production project directory:

```bash
cd /www/wwwroot/VSProject
git pull
export NEXT_DEPLOYMENT_ID="$(git rev-parse --short HEAD)"
npm ci
npm run build
pm2 restart VSProject --update-env
```

Before deploying a release that introduces new tables, apply the idempotent schema update in MySQL:

```bash
mysql -h "$MYSQL_HOST" -u "$MYSQL_USER" -p "$MYSQL_DATABASE" < migration/mysql-schema.sql
```

When the app and MySQL run on the same BT server, keep `MYSQL_HOST=127.0.0.1`, bind MySQL to localhost, and remove public TCP 3306 firewall access after maintenance. Do not leave an application database user as `user@'%'` with broad privileges.

For an existing database upgrading to PayPal checkout, run the focused migration before deploying the new application build. It preserves historical Stripe records and adds provider-neutral fields plus the payment incident review table:

```bash
mysql -h "$MYSQL_HOST" -u "$MYSQL_USER" -p "$MYSQL_DATABASE" < migration/add-payment-providers.sql
```

## PayPal checkout

PayPal is the only provider used for new checkouts. Start with `PAYPAL_ENV=sandbox`. Configure `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, and all six `PAYPAL_PLAN_*` values from `.env.example`. Each recurring plan must be `ACTIVE` and use the exact USD amount and weekly, monthly, or yearly interval of its matching DreamFace plan. The Admin page validates these values against PayPal before reporting checkout as ready.

Register this webhook URL in the matching PayPal sandbox or live app:

```text
https://dreamface.io/api/billing/paypal/webhook
```

Subscribe to these PayPal event groups:

- `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.PENDING`, `PAYMENT.CAPTURE.REFUNDED`, and `PAYMENT.CAPTURE.REVERSED`
- `PAYMENT.SALE.COMPLETED`, `PAYMENT.SALE.REFUNDED`, and `PAYMENT.SALE.REVERSED`
- `BILLING.SUBSCRIPTION.*`
- `CUSTOMER.DISPUTE.CREATED`, `CUSTOMER.DISPUTE.UPDATED`, and `CUSTOMER.DISPUTE.RESOLVED`

Refunds, reversals, disputes, and amount mismatches create a review item in Admin instead of automatically deducting credits that may already have been spent. Keep the Stripe webhook configured while historical Stripe subscriptions remain active; the application no longer creates new Stripe checkouts.

Schedule PayPal reconciliation at least hourly using the same bearer secret as the existing generation cron:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://dreamface.io/api/cron/reconcile-paypal
```

After sandbox checkout, renewal, cancellation, refund, dispute, duplicate-webhook, and reconciliation tests pass, switch `PAYPAL_ENV=live`, install the live credentials, live webhook ID, and live Plan IDs, then restart with `--update-env`. Confirm the Admin page reports all six plans verified before opening checkout traffic.

`--update-env` matters when the PM2 process already exists because the deployment ID is part of the build and should stay visible to the restarted process.

## Verify the build

Check the origin before checking Cloudflare:

```bash
curl -I "http://127.0.0.1:3002/studio?mode=image"
curl -s "http://127.0.0.1:3002/api/deploy/version"
curl -s "http://127.0.0.1:3002/" | grep -o 'dpl=[^"&]*' | head
curl -s "http://127.0.0.1:3002/studio?mode=image&workflow=text-to-image" | grep -o 'page-[a-z0-9]*\.js' | head
```

The headers should include `Cache-Control: no-store...` for HTML/API routes and `X-DreamFace-Deploy: <git-sha>`. The `dpl=` grep should print the deployment ID in static asset URLs after a build with `NEXT_DEPLOYMENT_ID`.

## Cache notes

Cloudflare should bypass cache for HTML and API/RSC traffic:

```text
(http.host eq "ai.ottomob.com" and (
  starts_with(http.request.uri.path, "/studio") or
  starts_with(http.request.uri.path, "/auth") or
  starts_with(http.request.uri.path, "/billing") or
  starts_with(http.request.uri.path, "/creations") or
  starts_with(http.request.uri.path, "/admin") or
  starts_with(http.request.uri.path, "/api") or
  http.request.uri.query contains "_rsc="
))
```

Set this rule to **Bypass cache**. Keep hashed `/_next/static/` assets cacheable so the deployment ID can bust old asset URLs without treating every static file as dynamic HTML.

After deploy, purge these URLs if Cloudflare ever serves an old document:

```text
https://ai.ottomob.com/
https://ai.ottomob.com/studio
https://ai.ottomob.com/studio?mode=image
https://ai.ottomob.com/studio?mode=video
```
