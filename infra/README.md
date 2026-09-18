# Production deployment

The Ubuntu VM runs both application processes behind Nginx without Docker:

- Backend: `127.0.0.1:3000`
- ML API: `127.0.0.1:8001`
- Nginx: public port 80, proxying API requests to the Backend

The Backend reads secrets from `/etc/dsm-p5-g02/backend.env`. This file must be
owned by `root:dsmapp`, have mode `0640`, and define at least `MONGODB_URI`.
It is never stored in Git or replaced during deployment.

Run a deployment as the SSH deployment user:

```bash
/opt/dsm-p5-g02/infra/scripts/deploy.sh <git-revision>
```

The script refuses tracked local changes, installs locked dependencies, builds
the Backend, updates systemd and Nginx configuration, restarts both services,
and verifies their local health endpoints.

## Continuous deployment

`.github/workflows/cd.yml` deploys the exact tested revision after a successful
CI run caused by a push to `main`. It requires the Repository Actions Secret
`DEPLOY_SSH_PRIVATE_KEY`. The corresponding public key is restricted on the VM
to `/usr/local/sbin/dsm-deploy-command`; it cannot open a general SSH shell.

## Web frontend

`GET /` serves the React production build as static files; it no longer returns
the Backend root JSON (still available internally at `http://127.0.0.1:3000/`).
`/health`, `/docs` and `/api/*` keep proxying to Fastify on `127.0.0.1:3000`,
which reaches MongoDB Atlas and the ML API on `127.0.0.1:8001`. Ports 3000 and
8001 stay loopback-only, and the Vite dev server (5173) is never used or
exposed in production.

The build is deterministic: `npm ci` plus `npm run build` in `front/`, output
in `front/dist/` (never versioned). The bundle uses relative `/api/...` and
`/health` paths, so the frontend and the API share the same public origin and
need no absolute API URL. Nginx applies SPA fallback
(`try_files $uri $uri/ /index.html`; the app uses hash routing), long cache
for hashed `/assets/*`, no long cache for `index.html`, gzip for HTML, CSS,
JavaScript, JSON and SVG, and basic headers (`X-Content-Type-Options`,
`X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`). No CSP is enforced yet:
Swagger UI and external fonts/images must be allow-listed first (future
hardening). The public URL stays `http://158.158.48.119/` on port 80; HTTPS
waits for a domain and a proper certificate.

## Frontend releases and rollback

Each deploy builds revision `$REVISION` and publishes it atomically:

- `/var/www/dsm-p5-g02/releases/<sha>/` holds the complete build;
- `/var/www/dsm-p5-g02/current` is a symlink to the active release;
- Nginx serves `root /var/www/dsm-p5-g02/current`;
- the newest 5 releases are retained (the current one included and never
  deleted);
- release files are owned `root:www-data` (`0755` directories, `0644` files).

`deploy.sh` verifies the release before finishing: `/` returns `text/html`
containing the React root, every `/assets/*` referenced by the deployed
`index.html` returns 200, and `/health` still reports the API as connected.
Any failure aborts the deploy with a non-zero exit before CD reports success.

Roll back the frontend to a previous release (list candidates with
`ls -1t /var/www/dsm-p5-g02/releases` and pick the desired `<previous-sha>`):

```bash
sudo ln -sfn /var/www/dsm-p5-g02/releases/<previous-sha> /var/www/dsm-p5-g02/current
sudo nginx -t
sudo systemctl reload nginx
curl --fail http://127.0.0.1/ | grep -q 'id="root"'
curl --fail --silent --show-error http://127.0.0.1/health
```

Roll back the Nginx configuration using the timestamped backup in
`/var/backups/dsm-p5-g02/<timestamp>/` (previously active site config,
`nginx -T` dump, `nginx -t` output, systemd units and `SHA256SUMS`):

```bash
sudo cp -a /var/backups/dsm-p5-g02/<timestamp>/nginx-site-dsm-p5-g02.conf \
  /etc/nginx/sites-available/dsm-p5-g02
sudo nginx -t
sudo systemctl reload nginx
```

## Public smoke tests

```bash
curl --fail -s -D - http://158.158.48.119/ -o /tmp/dsm-index.html
grep -q 'id="root"' /tmp/dsm-index.html
grep -o '/assets/[^"]*' /tmp/dsm-index.html | sort -u
curl --fail -s http://158.158.48.119/health
curl --fail -s "http://158.158.48.119/api/temas?source=CAMARA" -o /dev/null
curl --fail -s "http://158.158.48.119/api/parlamentares/deputados?page=1&limit=1" -o /dev/null
curl --fail -s "http://158.158.48.119/api/parlamentares/senadores?page=1&limit=1" -o /dev/null
curl --fail -s "http://158.158.48.119/api/proposicoes?page=1&limit=3&source=CAMARA" -o /dev/null
curl --fail -s "http://158.158.48.119/api/proposicoes?page=1&limit=3&source=SENADO" -o /dev/null
curl --fail -s http://158.158.48.119/api/ml/health
curl --fail -s http://158.158.48.119/docs -o /dev/null
```

Never run `POST /api/sync/*` as a smoke test.
