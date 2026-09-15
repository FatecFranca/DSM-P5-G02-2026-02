#!/usr/bin/env bash

set -Eeuo pipefail

readonly PUBLIC_KEY_FILE="${1:?usage: install-deploy-key.sh <public-key-file>}"
readonly SSH_DIR="$HOME/.ssh"
readonly AUTHORIZED_KEYS="$SSH_DIR/authorized_keys"

key_id=$(awk '{print $2}' "$PUBLIC_KEY_FILE")
if [[ -z "$key_id" ]]; then
  echo "Invalid SSH public key." >&2
  exit 1
fi

umask 077
install -d -m 0700 "$SSH_DIR"
touch "$AUTHORIZED_KEYS"

if grep -Fq "$key_id" "$AUTHORIZED_KEYS"; then
  exit 0
fi

cp -a "$AUTHORIZED_KEYS" "$AUTHORIZED_KEYS.backup.$(date -u +%Y%m%dT%H%M%SZ)"
printf 'restrict,command="/usr/local/sbin/dsm-deploy-command" %s\n' "$(cat "$PUBLIC_KEY_FILE")" >> "$AUTHORIZED_KEYS"
chmod 0600 "$AUTHORIZED_KEYS"
