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

`checkout_success` is sent after the Stripe purchase is confirmed in DreamFace, and includes `value` in major currency units plus `currency` for GA4 conversion value reporting.

The same events are mirrored into `public.analytics_events` through `/api/analytics/track` and displayed in the admin funnel panel.
