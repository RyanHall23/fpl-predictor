#!/usr/bin/env bash

set -euo pipefail

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

  cd "$WORKSPACE"

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
    cd ..
    continue
  fi

  echo
  echo "Searching source references..."

  UNUSED_PACKAGES=()

  while read -r PACKAGE; do
    echo
    echo "----------------------------"
    echo "$PACKAGE"

    MATCHES=$(grep -RIl \
      --exclude-dir=node_modules \
      --exclude-dir=.git \
      --exclude="package.json" \
      --exclude="package-lock.json" \
      -E "from ['\"]$PACKAGE['\"]|require\(['\"]$PACKAGE['\"]" \
      . || true)

    if [ -n "$MATCHES" ]; then
      echo "Import references found:"
      echo "$MATCHES"
    else
      echo "No import references found"
      UNUSED_PACKAGES+=("$PACKAGE")
    fi

  done <<< "$PACKAGES"


  if [ ${#UNUSED_PACKAGES[@]} -gt 0 ]; then
    echo
    echo "Unused packages ready for removal:"
    printf ' - %s\n' "${UNUSED_PACKAGES[@]}"

    read -rp "Remove these packages from $WORKSPACE? (y/n): " REMOVE

    if [[ "$REMOVE" =~ ^[Yy]$ ]]; then
      echo
      echo "Removing packages..."

      (
        cd ..
        npm uninstall -D "${UNUSED_PACKAGES[@]}" --workspace "$WORKSPACE"
      )

      echo
      read -rp "Run verification check for $WORKSPACE? (y/n): " VERIFY

      if [[ "$VERIFY" =~ ^[Yy]$ ]]; then
        echo
        echo "Running verification..."

        VERIFY_RESULT=$(npx depcheck 2>/dev/null || true)

        echo "$VERIFY_RESULT"

        if echo "$VERIFY_RESULT" | grep -q "No depcheck issue"; then
          echo "✅ $WORKSPACE is clean"
        else
          echo "⚠️ Review remaining dependencies"
        fi
      fi
    else
      echo "Skipping removal"
    fi
  fi

  cd ..
done
