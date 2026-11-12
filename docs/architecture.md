# Application architecture

## Request flow

Marketing routes live in `src/app/[locale]`; the studio lives in `src/app/studio`, with reusable workspace logic in `src/features/studio`. API routes authenticate using `src/lib/server-auth.ts` and call the MySQL adapter through `src/lib/supabase-admin.ts`. Credit prices and provider payload construction are separate stages in the generation route.

The browser uses an HttpOnly session cookie. The session JSON contains a stable `cookie:` placeholder, which is not a bearer credential. Non-browser clients may continue sending real Bearer tokens. Cookie authentication checks browser Origin and fetch metadata against the configured canonical public origin; proxy host headers do not extend the allowlist.

## Generation and credits

`src/app/api/generate/route.ts` validates input, normalizes billable parameters, applies server safety policy, checks prices and allowance, then reserves a task and charges credits atomically before provider submission. Existing idempotency keys prevent ordinary replays. Base64 images and the large provider dispatch remain migration work.

`src/lib/fal-task-sync.ts` is the shared fal reconciliation implementation for explicit polling, history synchronization, cron and both Admin task interfaces. It uses only stored allowed fal queue URLs. DreamFace IO's integration, UI, free allowance, runtime toggle and synchronization code have been removed. A generic tombstone rejects old requests and excludes that removed provider from scheduling and capacity; historical rows and credit ledgers remain intact.

`settle_generation_task` is an application RPC implemented in `src/lib/mysql-supabase-adapter.ts`, not a new SQL stored procedure. It locks the owned task with `SELECT ... FOR UPDATE`, rejects changes to settled tasks, updates task state and applies eligible refund ledger/account mutations together. Refunds cannot exceed the recorded charge or estimate. Admin-only failed-refund repair may backfill an already failed task once; completed tasks remain immutable. Documented manual resolutions are stored under the same lock and recheck newly arrived tracking before any refund.

`reserve_generation_task` holds the user's credit-account lock while checking the pending-task cap, inserting the task and applying its charge. The active H3 free opportunity uses the same account lock and cap. Pending jobs remain counted after timeout or hiding. A limiter-storage outage refuses new work without charging. Provider-ID assignment uses a MySQL advisory lock held through commit to prevent two tasks claiming the same request across processes.

Paid provider POST requests are attempted once. `generation-submission.ts` persists a per-stage intent and input fingerprint in existing task settings before network access. Accepted tracking is recorded independently; signed fal callbacks recover lost responses using a task/attempt HMAC and fal Ed25519 signature, then poll canonical endpoints. Stalled TTS pipelines may submit only their previously unsent video stage. Unknown or already submitted stages are not replayed.

Admin task review supports provider-evidence matching, cancellation and documented no-active-job settlement with confirmed total cost. Cancellation requested on a running job is not a refund authorization; confirmed queue removal permits cost reconciliation. Voice-stage costs are included, and unknown auxiliary costs keep the refund pending. Legacy requests without fingerprints need operator/provider evidence. Public callback delivery still requires deployed HTTPS and a reachable endpoint; this has not been tested against paid live jobs.

No new database table, column, stored procedure or migration is introduced. Real MySQL 5.7.44 and 8.4.13 tests verify transactions, locks, cross-process coordination semantics and fault recovery; production 5.7.40 metadata was inspected read-only. Production data was not used as test fixtures.

## Database, files and scheduled work

`src/lib/mysql.ts` owns pooling and transactions. Adapter mutations require filters and inserted-row readback requires a reliable key. SQL schema and reviewed migrations remain the source for actual table constraints.

Local uploads use `.data/uploads`; existing image requests may still contain Data URIs. Avatar audio is bounded to 20 MiB, downloaded through DNS-pinned public addresses with redirect revalidation, verified as PCM WAV or decoded by a constrained system FFmpeg process, then saved as an owned content-addressed WAV. Quotes and provider requests use the same saved bytes. The authenticated audio-inspection endpoint supplies exact billable seconds to the browser. File hashes and ownership are verified on reuse. Upload retention and a general image-upload migration remain separate work.

Cron authorization uses `CRON_SECRET` in production. Reconciliation selects pending real tasks by `last_checked_at`, then creation time, including hidden tasks that can still incur charges. Removed providers are excluded. Checked tasks record progress through provider outages, allowing other pending work a turn.

## Studio loading and state

`studio-client.tsx` composes `useStudioController` and `StudioShell`. The controller retains drafts and generation state while the shell loads the current view on demand. Task history fetching and session caching live in `useStudioTaskHistory`; creation UI lives in `studio-creation-workspace.tsx`. Home and Projects do not mount hidden creation controls. Editors, billing and near-viewport template sections load on demand.

Studio and CreditShop messages are generated as separate JSON chunks per locale. The Studio server page supplies its initial dictionary; language changes keep the previous UI usable and ignore stale requests. Run `npm run generate:studio-messages` after editing translation sources. `verify:studio-messages` checks generated files, fallback semantics and the actual asynchronous locale hook. See [loading measurements and validation](studio-loading-performance.zh-CN.md).

## Public page caching

Public marketing documents use a short shared-cache policy selected by an explicit route allowlist. Positive rules live in `next.config.mjs`, where raw Flight headers are available; middleware handles query/method exclusions and redirects. Next strips Flight headers before middleware, so middleware alone must not set public caching. Account routes and RSC variants remain uncached. The fixed public home-gallery query uses a 300-second Next data cache, invalidated by successful Admin Gallery mutations.

The root layout still reads request locale headers. Public pages are not forced into static rendering; whole-document cache hits require a correctly configured proxy/CDN. See [cache scope, HTTP validation and deployment boundaries](marketing-cache.zh-CN.md).

## Language negotiation

Root marketing redirects share a weighted language-preference resolver with a generated standalone Cloudflare Worker. Saved language cookies take precedence over browser preferences; explicit language URLs remain authoritative. The origin middleware handles the same negotiation when edge routing is bypassed. The Worker preserves tracking queries and proxies non-root requests unchanged, with no retries for failed origin POSTs. See [edge deployment and fallback validation](cloudflare-locale-redirect.zh-CN.md).

## Validation boundaries

Unit and security fixtures exercise real routes and services with simulated boundaries. The opt-in MySQL suite additionally executes actual SQL/locks/rollback against disposable databases. Headless browser checks cover Admin review, audio inspection and Studio lazy loading/draft retention using mocked APIs. Local production HTTP checks verify marketing cache headers, language and RSC separation. These are not paid provider, CDN deployment or production callback acceptance tests. Trusted-proxy configuration, broad upload retention, CDN deployment verification, Admin aggregation and further generation-service decomposition remain in the audit.
