#!/usr/bin/env bash

set -Eeuo pipefail

readonly APP_DIR=/opt/dsm-p5-g02
readonly BACKEND_ENV=/etc/dsm-p5-g02/backend.env
readonly ML_VENV=/opt/dsm-p5-g02-venv
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

sudo systemctl reload nginx.service
for _ in {1..15}; do
  if curl --fail --silent --show-error http://127.0.0.1/health >/dev/null; then
    break
  fi
  sleep 1
done
curl --fail --silent --show-error http://127.0.0.1/health >/dev/null

printf 'Deployed revision %s\n' "$(git rev-parse HEAD)"
