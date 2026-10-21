import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Capacitor uses the bundled build and rejects unsafe remote server URLs', () => {
  const config = read('apps/mobile-app/capacitor.config.ts');
  assert.match(config, /webDir:\s*'dist'/);
  assert.match(config, /CAPACITOR_SERVER_URL must use HTTPS/);
  assert.match(config, /allowMixedContent:\s*false/);
  assert.match(config, /webContentsDebuggingEnabled:\s*false/);
});

test('Android disables backup and cleartext traffic', () => {
  const manifest = read('apps/mobile-app/android/app/src/main/AndroidManifest.xml');
  assert.match(manifest, /android:allowBackup="false"/);
  assert.match(manifest, /android:usesCleartextTraffic="false"/);
});

test('Android release builds enable code and resource shrinking', () => {
  const gradle = read('apps/mobile-app/android/app/build.gradle');
  assert.match(gradle, /release\s*\{[\s\S]*minifyEnabled true/);
  assert.match(gradle, /release\s*\{[\s\S]*shrinkResources true/);
  assert.doesNotMatch(gradle, /storePassword|keyPassword/);
});

test('debug APKs are not linked or copied into the public website', () => {
  const player = read('apps/mobile-app/src/App.tsx');
  const landing = read('apps/web-landing/src/App.tsx');
  const buildScript = read('scripts/build-android-debug.sh');
  assert.doesNotMatch(player, /apex-arcade-debug\.apk/);
  assert.doesNotMatch(landing, /apex-arcade-debug\.apk/);
  assert.doesNotMatch(buildScript, /cp "\$APK" apps\/web-landing/);
});
