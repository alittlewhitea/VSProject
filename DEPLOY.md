# Production Deploy

DreamFace uses a Next.js deployment ID to keep browser assets aligned with the build that served the page. Set a fresh ID before every production build.

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
curl -s "http://127.0.0.1:3002/" | grep -o 'dpl=[^"&]*' | head
curl -s "http://127.0.0.1:3002/studio?mode=image&workflow=text-to-image" | grep -o 'page-[a-z0-9]*\.js' | head
```

The first command should print the deployment ID in static asset URLs after a build with `NEXT_DEPLOYMENT_ID`.

## Cache notes

Bypass HTML and API caching for work surfaces such as `/studio`, `/auth`, `/billing`, `/creations`, `/admin`, and `/api`. Keep hashed `/_next/static/` assets cacheable so a deployment ID can bust old asset URLs without treating every static file as dynamic HTML.
