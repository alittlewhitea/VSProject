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
