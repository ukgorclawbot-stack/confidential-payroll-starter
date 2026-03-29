#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STARTER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
GIT_ROOT="$(git -C "${STARTER_DIR}" rev-parse --show-toplevel)"
PREFIX="${STARTER_DIR#${GIT_ROOT}/}"

SOURCE_REF="${SOURCE_REF:-HEAD}"
TARGET_REPO="${TARGET_REPO:-ukgorclawbot-stack/confidential-payroll-starter}"
TARGET_BRANCH="${TARGET_BRANCH:-main}"
DRY_RUN="${DRY_RUN:-false}"

print_usage() {
  cat <<'EOF'
Usage:
  bash scripts/publish-subtree.sh
  bash scripts/publish-subtree.sh --dry-run

Optional environment variables:
  SOURCE_REF=HEAD
  TARGET_REPO=ukgorclawbot-stack/confidential-payroll-starter
  TARGET_BRANCH=main
  DRY_RUN=true
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  print_usage
  exit 0
fi

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN="true"
fi

SUBTREE_STATUS="$(git -C "${GIT_ROOT}" status --short -- "${PREFIX}")"
if [[ -n "${SUBTREE_STATUS}" ]]; then
  echo "Refusing to publish with uncommitted subtree changes in ${PREFIX}:"
  echo "${SUBTREE_STATUS}"
  exit 1
fi

SPLIT_SHA="$(git -C "${GIT_ROOT}" subtree split --prefix="${PREFIX}" "${SOURCE_REF}")"
REMOTE_URL="https://github.com/${TARGET_REPO}.git"
PUSH_REF="${SPLIT_SHA}:refs/heads/${TARGET_BRANCH}"

echo "git_root=${GIT_ROOT}"
echo "subtree_prefix=${PREFIX}"
echo "source_ref=${SOURCE_REF}"
echo "target_repo=${TARGET_REPO}"
echo "target_branch=${TARGET_BRANCH}"
echo "split_sha=${SPLIT_SHA}"

if [[ "${DRY_RUN}" == "true" ]]; then
  echo "dry_run=true"
  echo "push_command=git -C ${GIT_ROOT} push ${REMOTE_URL} ${PUSH_REF}"
  exit 0
fi

git -C "${GIT_ROOT}" push "${REMOTE_URL}" "${PUSH_REF}"

echo "published_subtree=${PREFIX}"
echo "published_sha=${SPLIT_SHA}"
echo "published_url=https://github.com/${TARGET_REPO}"
