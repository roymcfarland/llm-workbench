#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 || -z "$1" ]]; then
  echo "Usage: $0 <branch>" >&2
  exit 1
fi

BRANCH="$1"
# A single-ref checkout has no tracking ref for this branch, so a bare lease
# rejects updates. An empty expected SHA means the remote branch must not exist.
EXPECTED="$(git ls-remote --heads origin "refs/heads/${BRANCH}" | cut -f1)"
git push -u origin "$BRANCH" --force-with-lease="${BRANCH}:${EXPECTED}"
