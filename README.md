# DreamFace

DreamFace is a Next.js application for AI image, video, avatar and audio creation, with shared credit accounts, email/Google authentication and PayPal checkout.

## Local development

Use Node.js 24, npm and a maintained system FFmpeg executable for compressed audio verification. Install dependencies with `npm ci`, configure a private `.env.local`, then run `npm run dev`. The default address is `http://localhost:3000`. Check the audio runtime with `npm run verify:audio-runtime`; set `FFMPEG_PATH` when FFmpeg is outside the application's PATH.

Configuration is read by the server; never paste production credentials into documentation or commit environment files. The database requires `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`. Public authentication origin uses `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL` or `SITE_URL`; configure the canonical public HTTPS origin. Authentication, Google, email, PayPal and AI credentials are described in their respective files under `src/lib` and existing documentation. Only explicitly public values belong in `NEXT_PUBLIC_*` variables.

Existing database schema and migrations live in `migration/` and `supabase.sql`. Provision a separate development database; migrations and backup restoration must be reviewed against its actual schema. The MySQL adapter exposes a Supabase-like interface; it does not require a hosted Supabase database for normal operation.

## Checks

- `npm test`: compiled unit tests for limits, billing, task guards and session transport.
- `npm run verify:audit-security`: executable tests for settlements, authentication, authoritative provider URLs, bounded bodies, actual audio decoding, SSRF guards and compound provider costs. Provider responses and database transactions are simulated here.
- `npm run verify:mysql-generation`: opt-in real MySQL tests on an isolated loopback instance. Requires `RUN_MYSQL_INTEGRATION=1`, `TEST_MYSQL_HOST`, a non-3306 `TEST_MYSQL_PORT`, and optional test-only credentials. Creates and drops only its own randomly named `dreamface_test_*` database; never loads application environment files. Includes real transactions, trigger failures, concurrent admission, callback recovery and Admin reconciliation.
- `npm run typecheck`: TypeScript checks.
- `npm run check`: all configured verification scripts and production build. No lint command is currently configured.

Run verification without production credentials. Tests simulate providers; never substitute live requests for fixtures. When a local environment contains database credentials, override `MYSQL_HOST=127.0.0.1` and `MYSQL_PORT=1` for ordinary checks. Stop an existing local Next.js server before a production build because both use `.next`. The GitHub workflow installs FFmpeg and runs the checks plus integration tests on its isolated MySQL 5.7 service, without deployment or production secrets.

## Architecture and operations

See [the architecture guide](docs/architecture.md), [generation operations](docs/generation-settlement-and-recovery.zh-CN.md) and [the November audit](docs/claude-review-verification-2026-11-11.zh-CN.md) for settlement guarantees, recovery procedures and remaining limitations.

After reviewing and deploying a change through the usual release process, run the application with `npm run build` and `npm run start` or the existing PM2 setup. Deployment and production reconciliation are separate operational actions; running local checks does not perform them.
