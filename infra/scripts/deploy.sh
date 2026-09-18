#!/usr/bin/env bash

set -Eeuo pipefail

readonly APP_DIR=/opt/dsm-p5-g02
readonly BACKEND_ENV=/etc/dsm-p5-g02/backend.env
readonly ML_VENV=/opt/dsm-p5-g02-venv
readonly FRONT_RELEASES_DIR=/var/www/dsm-p5-g02/releases
readonly FRONT_CURRENT_LINK=/var/www/dsm-p5-g02/current
readonly FRONT_KEEP_RELEASES=5
readonly REVISION="${1:?usage: deploy.sh <git-revision>}"

exec 9>/tmp/dsm-p5-g02-deploy.lock
flock -n 9 || {
  echo "Another deployment is already running." >&2
  exit 1
}

if ! sudo test -s "$BACKEND_ENV"; then
  echo "Missing $BACKEND_ENV." >&2
  exit 1
fi

cd "$APP_DIR"

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Refusing to deploy over tracked local changes." >&2
  exit 1
fi

git fetch --prune origin main
git cat-file -e "${REVISION}^{commit}"
git checkout --detach "$REVISION"

# The running copy is the previous revision's script (the open file
# descriptor survives checkout), so re-execute the checked-out revision's own
# script to guarantee the deployed logic governs this deploy.
if [[ -z "${DSM_DEPLOY_REEXECED:-}" ]]; then
  export DSM_DEPLOY_REEXECED=1
  exec "$0" "$REVISION"
fi

npm ci --prefix backend
npm run build --prefix backend
npm prune --omit=dev --prefix backend

if [[ ! -x "$ML_VENV/bin/python" ]]; then
  sudo install -d -o "$(id -un)" -g dsmapp -m 0755 "$ML_VENV"
  python3 -m venv "$ML_VENV"
fi
"$ML_VENV/bin/python" -m pip install --disable-pip-version-check -r ml/requirements.txt
"$ML_VENV/bin/python" -m pip check

sudo install -m 0644 infra/systemd/dsm-backend.service /etc/systemd/system/dsm-backend.service
sudo install -m 0644 infra/systemd/dsm-ml.service /etc/systemd/system/dsm-ml.service
sudo install -m 0644 infra/nginx/dsm-p5-g02.conf /etc/nginx/sites-available/dsm-p5-g02
sudo install -m 0755 infra/scripts/ssh-deploy-command.sh /usr/local/sbin/dsm-deploy-command
sudo ln -sfn /etc/nginx/sites-available/dsm-p5-g02 /etc/nginx/sites-enabled/dsm-p5-g02
if [[ -L /etc/nginx/sites-enabled/default ]]; then
  sudo unlink /etc/nginx/sites-enabled/default
fi

sudo nginx -t
sudo systemctl daemon-reload
sudo systemctl enable dsm-ml.service dsm-backend.service
sudo systemctl restart dsm-ml.service

for _ in {1..30}; do
  if curl --fail --silent --show-error http://127.0.0.1:8001/health >/dev/null; then
    break
  fi
  sleep 2
done
curl --fail --silent --show-error http://127.0.0.1:8001/health >/dev/null

sudo systemctl restart dsm-backend.service
for _ in {1..30}; do
  if curl --fail --silent --show-error http://127.0.0.1:3000/health >/dev/null; then
    break
  fi
  sleep 2
done
curl --fail --silent --show-error http://127.0.0.1:3000/health >/dev/null

npm ci --prefix front
npm run build --prefix front

if [[ ! -f front/dist/index.html ]]; then
  echo "Frontend build did not produce front/dist/index.html." >&2
  exit 1
fi
if [[ -z "$(ls -A front/dist/assets 2>/dev/null)" ]]; then
  echo "Frontend build did not produce front/dist/assets." >&2
  exit 1
fi

sudo install -d -m 0755 -o root -g www-data /var/www/dsm-p5-g02 "$FRONT_RELEASES_DIR"
STAGE_DIR="$(mktemp -d)"
cp -a front/dist/. "$STAGE_DIR"/
sudo rm -rf "$FRONT_RELEASES_DIR/$REVISION"
sudo cp -a "$STAGE_DIR" "$FRONT_RELEASES_DIR/$REVISION"
rm -rf "$STAGE_DIR"
sudo chown -R root:www-data "$FRONT_RELEASES_DIR/$REVISION"
sudo find "$FRONT_RELEASES_DIR/$REVISION" -type d -exec chmod 0755 {} +
sudo find "$FRONT_RELEASES_DIR/$REVISION" -type f -exec chmod 0644 {} +
sudo ln -sfn "$FRONT_RELEASES_DIR/$REVISION" "$FRONT_CURRENT_LINK"

current_target="$(readlink "$FRONT_CURRENT_LINK")"
kept=0
while IFS= read -r candidate; do
  candidate_path="$FRONT_RELEASES_DIR/$candidate"
  if [[ "$candidate_path" == "$current_target" ]]; then
    continue
  fi
  kept=$((kept + 1))
  if ((kept >= FRONT_KEEP_RELEASES)); then
    sudo rm -rf "$candidate_path"
  fi
done < <(ls -1t "$FRONT_RELEASES_DIR")

sudo systemctl reload nginx.service
for _ in {1..15}; do
  if curl --fail --silent --show-error http://127.0.0.1/health >/dev/null; then
    break
  fi
  sleep 1
done
curl --fail --silent --show-error http://127.0.0.1/health >/dev/null

front_body="$(curl --fail --silent --show-error http://127.0.0.1/)"
front_content_type="$(curl --fail --silent --show-error -o /dev/null -w '%{content_type}' http://127.0.0.1/)"
if [[ "$front_content_type" != text/html* ]]; then
  echo "Frontend root did not return text/html (got $front_content_type)." >&2
  exit 1
fi
if ! grep -q 'id="root"' <<<"$front_body"; then
  echo "Frontend root did not return the React application." >&2
  exit 1
fi
while IFS= read -r front_asset; do
  [[ -n "$front_asset" ]] || continue
  curl --fail --silent --show-error -o /dev/null "http://127.0.0.1$front_asset"
done < <(grep -o '/assets/[^"]*' <<<"$front_body" | sort -u)

printf 'Deployed revision %s\n' "$(git rev-parse HEAD)"
