# DreamFace GTM / GA4 Events

Create one GTM Custom Event trigger per event name below, then map the same event parameters into a GA4 Event tag.

Core funnel:
- `home_view`
- `hero_slide_clicked`
- `nav_clicked`
- `studio_view`
- `studio_mode_selected`
- `studio_model_selected`
- `studio_size_selected`
- `studio_reference_uploaded`
- `generate_clicked`
- `generate_login_required`
- `generation_queued`
- `generation_completed`
- `generation_failed`
- `auth_view`
- `login_started`
- `login_success`
- `login_magic_link_sent`
- `login_failed`
- `billing_view`
- `balance_refreshed`
- `checkout_started`
- `checkout_success`
- `subscription_checkout_started`
- `subscription_checkout_success`
- `purchase`
- `checkout_cancelled`

Recommended GA4 conversion events:
- `generate_clicked`
- `generate_login_required`
- `login_success`
- `generation_queued`
- `generation_completed`
- `checkout_started`
- `checkout_success`
- `subscription_checkout_started`
- `subscription_checkout_success`
- `purchase`

Common parameters pushed to `dataLayer`:
- `anonymous_id`
- `session_id`
- `page_path`
- `mode`
- `workflow`
- `provider`
- `estimated_credits`
- `task_id`
- `transport`
- `signed_in`
- `has_references`
- `pack_id`
- `plan_id`
- `cycle`
- `credits`
- `amount_cents`
- `value`
- `currency`
- `stripe_checkout_id`
- `transaction_id`
- `item_id`
- `item_name`
- `item_category`

`checkout_success` is sent after the payment is confirmed in DreamFace. It records the funnel step with `amount_cents` and `currency`, but does not carry a GA4 `value`.

`subscription_checkout_success` records the historical subscription funnel step with `plan_id`, `cycle`, `credits`, `amount_cents`, and `currency`, without a GA4 `value`.

For GA4 ecommerce reporting, DreamFace also pushes the standard `purchase` event to `dataLayer` for both one-time credit packs and subscription checkouts. The event includes `transaction_id`, `value`, `currency`, and an `ecommerce.items` array. In GTM, create a GA4 Event tag named `purchase` and map the ecommerce object from the data layer.

The same events are mirrored into `public.analytics_events` through `/api/analytics/track` and displayed in the admin funnel panel.

Only `purchase` carries the completed payment's monetary `value`. Otherwise one $4.99 payment contributes $4.99 from `checkout_success` plus $4.99 from `purchase` to GA4's **Event value** total, even with only one purchase event. Generic events clear `value`, `currency`, `transaction_id`, and `ecommerce` in the GTM data model before applying their own parameters, preventing a previous purchase's fields from leaking into later events. `amount_cents` remains available for operational reporting; do not map it to GA4 `value` on checkout-success tags. Ensure GTM does not assign default monetary values to those events or recreate `purchase` from them. This change affects future events; historical GA4 event values are not rewritten. For revenue reports, use Purchase revenue or filter Event value to `purchase`.
