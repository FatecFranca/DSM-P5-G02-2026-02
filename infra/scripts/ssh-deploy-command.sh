#!/usr/bin/env bash

set -Eeuo pipefail

readonly requested_command="${SSH_ORIGINAL_COMMAND:-}"

if [[ "$requested_command" =~ ^deploy\ ([0-9a-f]{40})$ ]]; then
  exec /opt/dsm-p5-g02/infra/scripts/deploy.sh "${BASH_REMATCH[1]}"
fi

echo "Unsupported deployment command." >&2
exit 1
