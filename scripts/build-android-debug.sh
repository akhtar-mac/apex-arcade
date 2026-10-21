#!/bin/bash
# Builds a local debug APK from the player web app.
# Debug artifacts are never copied into the public website.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${JAVA_HOME:-}" ]; then
  JDK_DIR=$(ls -d "$HOME/.local/jdk"/jdk-21* 2>/dev/null | head -1 || true)
  if [ -n "$JDK_DIR" ] && [ -x "$JDK_DIR/Contents/Home/bin/java" ]; then
    export JAVA_HOME="$JDK_DIR/Contents/Home"
  fi
fi
if [ -n "${JAVA_HOME:-}" ]; then
  export PATH="$JAVA_HOME/bin:$PATH"
fi
if ! command -v java >/dev/null 2>&1; then
  echo "A JDK is required to compile the Android project. None is installed."
  exit 1
fi
if [ -z "${ANDROID_HOME:-}" ] && [ ! -d "$HOME/Library/Android/sdk" ]; then
  echo "ANDROID_HOME is not set and ~/Library/Android/sdk does not exist."
  exit 1
fi
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"

npm --workspace=apps/mobile-app run build
(cd apps/mobile-app && npx cap sync android)
(cd apps/mobile-app/android && ./gradlew assembleDebug)

APK="apps/mobile-app/android/app/build/outputs/apk/debug/app-debug.apk"
BYTES=$(wc -c < "$APK" | tr -d ' ')
SIG=$(head -c 2 "$APK")
if [ "$BYTES" -lt 1000000 ] || [ "$SIG" != "PK" ]; then
  echo "Invalid debug artifact at $APK ($BYTES bytes)."
  exit 1
fi
echo "Local debug APK created at $APK ($BYTES bytes). Do not publish it."
echo "Authorized releases must use bundled assets and organization-controlled signing outside Git."
