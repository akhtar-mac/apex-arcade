#!/bin/bash
# Builds, signs, and verifies the Android release APK, then stages it for the landing site.
#
# Signing material never lives in Git. Point these at files outside the repository:
#   APEX_KEYSTORE        path to the release keystore (.jks)
#   APEX_KEYSTORE_ENV    optional file that exports APEX_KEYSTORE_PASSWORD, APEX_KEY_ALIAS
#                        and (optionally) APEX_KEY_PASSWORD
# Defaults: $HOME/apex-arcade-signing/apex-release.jks and keystore.env next to it.
set -euo pipefail
cd "$(dirname "$0")/.."

SIGNING_DIR="${APEX_SIGNING_DIR:-$HOME/apex-arcade-signing}"
APEX_KEYSTORE="${APEX_KEYSTORE:-$SIGNING_DIR/apex-release.jks}"
APEX_KEYSTORE_ENV="${APEX_KEYSTORE_ENV:-$SIGNING_DIR/keystore.env}"
if [ -f "$APEX_KEYSTORE_ENV" ]; then
  # shellcheck disable=SC1090
  . "$APEX_KEYSTORE_ENV"
fi
: "${APEX_KEYSTORE_PASSWORD:?Set APEX_KEYSTORE_PASSWORD (or provide APEX_KEYSTORE_ENV)}"
APEX_KEY_ALIAS="${APEX_KEY_ALIAS:-apex-release}"
export APEX_KEYSTORE_PASSWORD
export APEX_KEY_PASSWORD="${APEX_KEY_PASSWORD:-$APEX_KEYSTORE_PASSWORD}"

case "$(cd "$(dirname "$APEX_KEYSTORE")" && pwd)/" in
  "$(pwd)/"*) echo "Refusing to use a keystore inside the repository: $APEX_KEYSTORE"; exit 1 ;;
esac
[ -f "$APEX_KEYSTORE" ] || { echo "Keystore not found: $APEX_KEYSTORE"; exit 1; }

if [ -n "${JAVA_HOME:-}" ]; then export PATH="$JAVA_HOME/bin:$PATH"; fi
command -v java >/dev/null 2>&1 || { echo "A JDK (21) is required."; exit 1; }
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
BUILD_TOOLS="${ANDROID_BUILD_TOOLS:-$(ls -d "$ANDROID_HOME"/build-tools/* | sort -V | tail -1)}"

# The APK always talks to production and never exposes demo login.
export VITE_API_URL="${VITE_API_URL:-https://apex-arcade-api.onrender.com}"
export VITE_ENABLE_DEMO_LOGIN=false
unset CAPACITOR_SERVER_URL

npm --workspace=apps/mobile-app run build
(cd apps/mobile-app && npx cap sync android)
(cd apps/mobile-app/android && ./gradlew --no-daemon clean assembleRelease)

VERSION=$(sed -nE 's/^[[:space:]]*versionName "([^"]+)".*/\1/p' apps/mobile-app/android/app/build.gradle)
UNSIGNED="apps/mobile-app/android/app/build/outputs/apk/release/app-release-unsigned.apk"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

"$BUILD_TOOLS/zipalign" -P 16 -f 4 "$UNSIGNED" "$WORK/aligned.apk"
"$BUILD_TOOLS/apksigner" sign \
  --ks "$APEX_KEYSTORE" --ks-key-alias "$APEX_KEY_ALIAS" \
  --ks-pass env:APEX_KEYSTORE_PASSWORD --key-pass env:APEX_KEY_PASSWORD \
  --out "$WORK/signed.apk" "$WORK/aligned.apk"
"$BUILD_TOOLS/apksigner" verify --verbose --print-certs "$WORK/signed.apk"
if "$BUILD_TOOLS/apksigner" verify --print-certs "$WORK/signed.apk" | grep -q 'CN=Android Debug'; then
  echo "Refusing to publish an APK signed with the Android debug key."
  exit 1
fi

OUT_DIR="apps/web-landing/public/downloads"
mkdir -p "$OUT_DIR"
rm -f "$OUT_DIR"/apex-arcade-*.apk
cp "$WORK/signed.apk" "$OUT_DIR/apex-arcade-$VERSION.apk"
( cd "$OUT_DIR" && sha256sum "apex-arcade-$VERSION.apk" > "apex-arcade-$VERSION.apk.sha256" )
echo "Signed release APK staged at $OUT_DIR/apex-arcade-$VERSION.apk"
printf '# Public build-time settings for the landing site (no secrets). Render env vars override these.\n# Must point at a signed release APK in public/downloads; tests/android-config.test.js checks it exists.\nVITE_APP_DOWNLOAD_URL=/downloads/apex-arcade-%s.apk\nVITE_APP_VERSION=%s\n' "$VERSION" "$VERSION" > apps/web-landing/.env.production
echo "Updated apps/web-landing/.env.production to /downloads/apex-arcade-$VERSION.apk. Commit the APK and that file together."
