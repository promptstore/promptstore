#!/usr/bin/env bash
#
# Bump the Prompt Store version across VERSION and the Helm chart files.
#
# Usage:
#   ./bump-version.sh                       bump the patch version (default)
#   ./bump-version.sh patch|minor|major     bump the current VERSION
#   ./bump-version.sh 0.8.0                 set an explicit version
#   ./bump-version.sh 0.7.64                re-sync charts to the current VERSION
#   ./bump-version.sh --show                print the current version and exit
#
# All charts are kept at one version: the AWS/EKS chart under deployment/ and
# the legacy GCP charts (helm-chart/, helm-chart2/, openaiplatform/).
#
# Options:
#   -n, --dry-run          show what would change, write nothing
#   -s, --skip-legacy      leave the legacy GCP charts alone
#   -h, --help             show this help
#
set -euo pipefail

cd "$(dirname "$0")"

VERSION_FILE="VERSION"

# The active AWS/EKS chart.
CHART_FILES=(
  "deployment/helm-chart/Chart.yaml"
)
VALUES_FILES=(
  "deployment/helm-chart/values-testing.yaml"
  "deployment/helm-chart/values-staging.yaml"
  "deployment/helm-chart/values-production.yaml"
)

# Legacy GCP charts, deployed by deploy.sh / deploy2.sh.
# Bumped by default; skipped with --skip-legacy.
LEGACY_CHART_FILES=(
  "helm-chart/Chart.yaml"
  "helm-chart2/Chart.yaml"
)
LEGACY_VALUES_FILES=(
  "helm-chart/values.yaml"
  "helm-chart/values-dev.yaml"
  "helm-chart2/values.yaml"
  "helm-chart2/values-dev.yaml"
  "openaiplatform/values.yaml"
  "openaiplatform/values-dev.yaml"
  "openaiplatform/values-prod.yaml"
)

usage() {
  sed -n '3,18p' "$0" | sed 's/^# \{0,1\}//'
}

die() { echo "error: $*" >&2; exit 1; }

DRY_RUN=0
SKIP_LEGACY=0
ARG=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -n|--dry-run)     DRY_RUN=1 ;;
    -s|--skip-legacy) SKIP_LEGACY=1 ;;
    -h|--help)        usage; exit 0 ;;
    --show)           ARG="--show" ;;
    -*)                  die "unknown option: $1" ;;
    *)
      [[ -n "$ARG" ]] && die "unexpected argument: $1"
      ARG="$1"
      ;;
  esac
  shift
done

[[ -f "$VERSION_FILE" ]] || die "$VERSION_FILE not found"
CURRENT="$(tr -d '[:space:]' < "$VERSION_FILE")"
[[ "$CURRENT" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "$VERSION_FILE holds '$CURRENT', expected MAJOR.MINOR.PATCH"

if [[ "$ARG" == "--show" ]]; then
  echo "$CURRENT"
  exit 0
fi

# No argument means a patch bump.
ARG="${ARG:-patch}"

IFS=. read -r MAJOR MINOR PATCH <<< "$CURRENT"

case "$ARG" in
  major) NEW="$((MAJOR + 1)).0.0" ;;
  minor) NEW="${MAJOR}.$((MINOR + 1)).0" ;;
  patch) NEW="${MAJOR}.${MINOR}.$((PATCH + 1))" ;;
  *)
    [[ "$ARG" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "'$ARG' is not patch|minor|major or a MAJOR.MINOR.PATCH version"
    NEW="$ARG"
    ;;
esac

# An explicit MAJOR.MINOR.PATCH equal to the current one is a deliberate
# re-sync of drifted charts, not a mistake. A patch/minor/major bump that
# lands on the current version would be one.
if [[ "$NEW" == "$CURRENT" && "$ARG" =~ ^(major|minor|patch)$ ]]; then
  die "new version is the same as the current one ($CURRENT)"
fi

targets=( "${CHART_FILES[@]}" "${VALUES_FILES[@]}" )
if [[ $SKIP_LEGACY -eq 0 ]]; then
  targets+=( "${LEGACY_CHART_FILES[@]}" "${LEGACY_VALUES_FILES[@]}" )
fi

if [[ "$NEW" == "$CURRENT" ]]; then
  echo "re-syncing everything to $NEW"
else
  echo "$CURRENT -> $NEW"
fi
[[ $DRY_RUN -eq 1 ]] && echo "(dry run, nothing written)"
echo

# VERSION
if [[ "$NEW" == "$CURRENT" ]]; then
  printf '  %-48s %s\n' "$VERSION_FILE" "already $NEW"
else
  [[ $DRY_RUN -eq 0 ]] && printf '%s' "$NEW" > "$VERSION_FILE"
  printf '  %-48s %s\n' "$VERSION_FILE" "$CURRENT -> $NEW"
fi

# Helm charts and values files: the single top-level `version:` key.
# Existing quoting is preserved so the diff stays to one line per file.
changed=0
missing=0
for f in "${targets[@]}"; do
  if [[ ! -f "$f" ]]; then
    printf '  %-48s %s\n' "$f" "MISSING - skipped"
    missing=1
    continue
  fi

  old="$(perl -ne 'if (/^version:\s*"?([0-9][^"\s]*)"?\s*$/) { print $1; exit }' "$f")"
  if [[ -z "$old" ]]; then
    printf '  %-48s %s\n' "$f" "no top-level version: key - skipped"
    missing=1
    continue
  fi

  if [[ "$old" == "$NEW" ]]; then
    printf '  %-48s %s\n' "$f" "already $NEW"
    continue
  fi

  if [[ $DRY_RUN -eq 0 ]]; then
    NEW="$NEW" perl -i -pe 's/^(version:\s*)(")?[0-9][^"\s]*(")?\s*$/"$1" . ($2 \/\/ "") . $ENV{NEW} . ($3 \/\/ "") . "\n"/e' "$f"
  fi
  printf '  %-48s %s\n' "$f" "$old -> $NEW"
  changed=1
done

echo
if [[ $DRY_RUN -eq 1 ]]; then
  echo "Dry run complete."
else
  echo "Done. Review with: git diff"
  echo "Then build and deploy: ./build.sh"
fi

[[ $SKIP_LEGACY -eq 1 ]] && echo "Legacy GCP charts (helm-chart/, helm-chart2/, openaiplatform/) left alone."
[[ $missing -eq 1 ]] && echo "Some targets were skipped - see above." >&2
exit 0
