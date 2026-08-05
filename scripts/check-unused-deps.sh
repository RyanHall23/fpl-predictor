#!/usr/bin/env bash

set -euo pipefail

AUTO_FIX=false

if [[ "${1:-}" == "--fix" ]]; then
  AUTO_FIX=true
fi

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

WORKSPACES=("frontend" "backend")

for WORKSPACE in "${WORKSPACES[@]}"; do
  echo
  echo "========================================"
  echo "Checking $WORKSPACE"
  echo "========================================"

  if [ ! -d "$WORKSPACE" ]; then
    echo "Skipping $WORKSPACE (directory not found)"
    continue
  fi

  pushd "$WORKSPACE" > /dev/null

  RESULT=$(npx depcheck 2>/dev/null || true)

  echo "$RESULT"

  PACKAGES=$(echo "$RESULT" |
    awk '
      /Unused dependencies|Unused devDependencies/ {
        flag=1
        next
      }
      /^[^* ]/ {
        flag=0
      }
      flag
    ' |
    sed 's/\* //' |
    sed '/^$/d')

  if [ -z "$PACKAGES" ]; then
    echo
    echo "✅ No unused dependencies found in $WORKSPACE"
    popd > /dev/null
    continue
  fi

  echo
  echo "Searching source references..."

  UNUSED_PACKAGES=()

  while read -r PACKAGE; do
    echo
    echo "----------------------------"
    echo "$PACKAGE"

    REFERENCES=$(grep -RIl \
      --exclude-dir=node_modules \
      --exclude-dir=.git \
      --exclude="package.json" \
      --exclude="package-lock.json" \
      -E "from ['\"]$PACKAGE['\"]|require\(['\"]$PACKAGE['\"]" \
      . || true)

    if [ -n "$REFERENCES" ]; then
      echo "Import references found:"
      echo "$REFERENCES"
    else
      echo "No import references found"
      UNUSED_PACKAGES+=("$PACKAGE")
    fi

  done <<< "$PACKAGES"


  if [ ${#UNUSED_PACKAGES[@]} -eq 0 ]; then
    echo
    echo "✅ No removable dependencies found in $WORKSPACE"
    popd > /dev/null
    continue
  fi


  echo
  echo "Unused packages ready for removal:"
  printf ' - %s\n' "${UNUSED_PACKAGES[@]}"


  REMOVE="n"

  if $AUTO_FIX; then
    REMOVE="y"
  else
    read -rp "Remove these packages from $WORKSPACE? (y/n): " REMOVE
  fi


  if [[ "$REMOVE" =~ ^[Yy]$ ]]; then

    echo
    echo "Removing packages..."

    popd > /dev/null

    npm uninstall -D \
      "${UNUSED_PACKAGES[@]}" \
      --workspace "$WORKSPACE"

    pushd "$WORKSPACE" > /dev/null

    echo
    echo "Verification..."

    VERIFY_RESULT=$(npx depcheck 2>/dev/null || true)

    echo "$VERIFY_RESULT"

    if echo "$VERIFY_RESULT" | grep -q "No depcheck issue"; then
      echo "✅ $WORKSPACE is clean"
    else
      echo "⚠️ Review remaining dependencies"
    fi

  else
    echo "Skipping removal"
  fi


  popd > /dev/null

done


echo
echo "========================================"
echo "Dependency cleanup complete"
echo "========================================"

git status --short
