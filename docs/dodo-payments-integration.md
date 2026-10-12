# Dodo Payments — one-time credit packs

中文版本：[Dodo Payments 积分购买接入说明](./dodo-payments-integration.zh-CN.md)。网站按钮显示 **Credit Card**，辅以 Visa / Mastercard 标识，后台通道仍为 `dodo`。

Implementation follows the official [Checkout Sessions guide](https://docs.dodopayments.com/developer-resources/checkout-session) and [webhook verification guide](https://docs.dodopayments.com/developer-resources/webhooks), using the official `dodopayments` TypeScript SDK. Installing an agent plugin is optional; the runtime integration uses the SDK directly.

## Database

The production database was inspected read-only on 2026-10-12: MySQL 5.7.40; existing `credit_purchases`, `user_credit_accounts`, `credit_ledger`, `payment_webhook_events` and `payment_incidents` have the needed columns and unique indexes. No production records or schema were changed during this inspection.

Run **only** `migration/add-dodo-credit-checkouts.sql` against this existing database before enabling Dodo. It adds one table, `dodo_credit_checkouts`, and does not alter existing tables. Do not rerun the whole bootstrap schema or the historical payment-provider migration on this checked database.

| Table | Purpose |
| --- | --- |
| `dodo_credit_checkouts` (new) | Local checkout UUID, linked order, Dodo session ID, product ID, test/live mode and actual paid total/tax |
| `credit_purchases` (existing) | User, immutable pack/credits/price snapshot, provider `dodo`, local UUID as order ID and verified payment ID as transaction/capture ID |
| `user_credit_accounts` / `credit_ledger` (existing) | Current balance and once-only `payment_purchase` entry with reference `dodo:payment:pay_...` |
| `payment_webhook_events` (existing) | Receipt recorded in the fulfillment transaction; repeat deliveries do not grant credits again |
| `payment_incidents` (existing) | Product/amount/currency mismatch, refund and dispute review |

The new table has unique purchase and session indexes plus a foreign key to the existing purchase. The checkout snapshot is persisted **before** the API creates a hosted checkout. Fulfillment locks the order and balance, inserts the ledger, updates balance/order, saves paid tax and records the webhook receipt in one MySQL transaction. Failure rolls everything back and returns a non-2xx webhook response so Dodo retries.

## Dodo dashboard configuration

Create four **one-time**, fixed-price products in the selected environment:

| Environment variable | Pack | Credits | USD price |
| --- | --- | ---: | ---: |
| `DODO_PRODUCT_STARTER` | Starter Pack | 800 | 4.99 |
| `DODO_PRODUCT_CREATOR` | Creator Pack | 1800 | 9.99 |
| `DODO_PRODUCT_STUDIO` | Studio Pack | 4800 | 24.99 |
| `DODO_PRODUCT_PRO_TOPUP` | Pro Pack | 11000 | 49.99 |

Use **tax-exclusive USD** prices. Dodo calculates applicable tax; the checkout can therefore charge the pack price plus tax. The server verifies `total_amount - tax` against the original pack price, and stores the actual total/tax separately. Disable product discounts, pay-what-you-want, purchasing-power-parity and localized/adaptive pricing for these products. Checkout currency selection and discount entry are also disabled. Currency/product/amount mismatches never grant credits and create a review incident. Subscriptions, mixed carts, alternate quantities and Dodo credit entitlements are not part of this integration; the site's existing credit ledger remains authoritative.

Add the settings from `.env.dodo.example` to the server's **`.env.local`**. Set `DODO_PAYMENTS_ENVIRONMENT=test_mode` for test keys/products; switch all keys, product IDs, webhook secret and mode together to `live_mode` for production. Missing mode defaults to test mode. API keys and the webhook signing key must never use a `NEXT_PUBLIC_` prefix.

Create a webhook endpoint:

```text
https://dreamface.io/api/billing/dodo/webhook
```

Enable `payment.succeeded`, `payment.failed`, `payment.cancelled`, `refund.succeeded`, and the available `dispute.*` lifecycle events. Copy the endpoint's signing key into `DODO_PAYMENTS_WEBHOOK_KEY` (not the API key). Test and live endpoints/secrets are separate. The handler uses `webhooks.unwrap` on the exact request body, including timestamp/signature verification, and retrieves the canonical payment before processing it. Unrelated products without this site's checkout reference are ignored.

## Website flow

The existing billing page and Studio credit-shop modal fetch `/api/billing/payment-methods`. The Credit Card button appears next to PayPal after the API key, webhook key and all four product IDs are present. Its internal provider identifier remains dodo. The backend also verifies the actual product price/type when checkout starts; the UI readiness flag is configuration presence, not a live dashboard/product or database health check.

`POST /api/billing/checkout` accepts `{ "type": "credits", "packId": "starter", "provider": "dodo" }` with the existing Bearer login token. Price, product and credits come from the server, never the browser. Hosted checkout returns to `/billing?checkout=dodo_return&provider=dodo&checkout_id=...`; browser `status`/`payment_id` parameters are not used as proof of payment. A signed webhook can fulfill without the customer returning. For delayed webhooks the logged-in return page checks the locally owned session and canonical payment through `/api/billing/dodo/sync` (12 sequential attempts, no overlapping polling); this uses the same transaction/validation as webhooks. Other users cannot confirm the checkout. After verified completion it enters the existing billing success/reporting flow, matching either the local order ID or provider payment ID.

Only `purchase` carries GA4 monetary `value`; the checkout-success funnel still does not count value a second time. Its value is the pack's tax-exclusive USD price. Refund/dispute events set the purchase to `review_required` and appear in the existing admin incident list; they **do not automatically subtract credits**, because credits may already have been consumed. Review the transaction and use the existing administrative credit-adjustment tools before resolving the incident.

## Deployment and validation

1. Execute the single new-table SQL on the existing database.
2. Configure test keys, four test products, webhook and `.env.local` settings.
3. Run `npm ci`, `npm run check`, and restart the app (`pm2 restart dreamface --update-env`).
4. Verify Dodo's test checkout, correct balance, one ledger entry, repeated webhook delivery, payment failure, return-page recovery, and a test refund's admin incident. Use test mode, not a real charge.
5. Replace with live configuration and restart for launch.

`npm run verify:dodo` uses signed Standard Webhooks fixtures, the actual SDK verifier, isolated API/transaction mocks and no real account or database writes. The full project check includes it. Live Dodo checkout remains to be tested with the merchant's test credentials and dashboard products; no Dodo test/live purchase was performed without those credentials. Production DB connectivity/schema inspection does not prove fulfillment transaction behavior. The application migration was supplied, not applied to production.
