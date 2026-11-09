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

Events are stored in `analytics_events` and displayed in the admin funnel panel. Most events use `/api/analytics/track`; `login_success` uses the dedicated atomic claim described below.

`login_success` means a completed Google OAuth or email-link authentication. Restoring an existing session, refreshing a page, checking session state on focus, and opening the embedded billing workspace do not generate new login events. A later real authentication by the same account counts again.

Successful authentication callbacks create a short-lived, signed HttpOnly receipt bound to the new login session. `/api/auth/session` exposes only its opaque event ID and `method` (`google` or `email`). The shared browser auth bridge claims the event through `/api/analytics/login-success`, which inserts the existing analytics row using that event ID as its primary key. Concurrent tabs and repeated callbacks therefore receive only one successful claim. Only its winner pushes `login_success` to `dataLayer`; it does not make a second generic mirror request. Legacy `login_success` submissions to `/api/analytics/track` are ignored. The event name is unchanged, so existing GTM triggers can continue to use it. The optional `login_event_id` parameter helps audit an authentication; GA4 is not relied on to deduplicate it.

The browser caches completed event IDs, while database uniqueness also covers blocked browser storage and simultaneous tabs. Google popups with a live parent leave reporting to the parent that stays open; standalone completion pages wait for pending reporting before closing. Tracking is best-effort: database or network failures do not block signing in, leave the receipt retryable during its ten-minute lifetime, and do not emit an unverified success. An accepted claim is an at-most-once reporting attempt, not a guarantee of GA4 delivery if the winning page closes or tracking is blocked. Existing historical analytics are not rewritten.

`npm run verify:analytics` covers login receipt verification, concurrent claims, existing-session restoration, repeat real logins, reloads, restricted storage, transient retries and the existing purchase/value regressions. The isolated auth browser smoke test additionally counts one GTM data-layer event per mocked Google/email authentication across homepage, popup, email-tab, Studio and embedded billing flows. No real accounts, database records or GTM requests are used by these tests.

`trackPurchaseEvent` deduplicates by `transaction_id` before both the data-layer push and internal mirror. A shared in-memory guard prevents repeated callbacks; localStorage retains the marker across reloads and later visits, with sessionStorage as a fallback. This is browser-side suppression, not a delivery acknowledgment: clearing storage, using another browser, or simultaneous first reports in separate tabs can bypass it. If all storage is blocked, suppression lasts only for the current module lifetime. Previously reported orders without a marker can still report once after rollout, and historical metrics are unchanged.

In GTM, create a Version 2 Data Layer Variable for `transaction_id`. Map it to the GA4 purchase event's `transaction_id` parameter and the Google Ads conversion tag's Transaction ID field; map `value` and `currency` as before. These container changes require a separate GTM publish. Sharing the purchase trigger between GA4 and Ads is expected. Check Ads conversion actions separately for overlapping direct website and GA4-imported primary purchase conversions. Validate the published site and container in Preview: complete one order, reload the success page, and confirm no second purchase event. Local tests do not prove production deployment or tag delivery.

Only `purchase` carries the completed payment's monetary `value`. Otherwise one $4.99 payment contributes $4.99 from `checkout_success` plus $4.99 from `purchase` to GA4's **Event value** total, even with only one purchase event. Generic events clear `value`, `currency`, `transaction_id`, and `ecommerce` in the GTM data model before applying their own parameters, preventing a previous purchase's fields from leaking into later events. `amount_cents` remains available for operational reporting; do not map it to GA4 `value` on checkout-success tags. Ensure GTM does not assign default monetary values to those events or recreate `purchase` from them. This change affects future events; historical GA4 event values are not rewritten. For revenue reports, use Purchase revenue or filter Event value to `purchase`.
