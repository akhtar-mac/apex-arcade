import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

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

test('only signed release APKs are published on the landing site', () => {
  const downloads = new URL('../apps/web-landing/public/downloads/', import.meta.url);
  if (!existsSync(downloads)) return;
  for (const name of readdirSync(downloads)) {
    assert.doesNotMatch(name, /debug|unsigned/i, `${name} must be a signed release build`);
    if (!name.endsWith('.apk')) continue;
    const apk = readFileSync(new URL(name, downloads));
    assert.equal(apk.subarray(0, 2).toString('latin1'), 'PK', `${name} is not an APK`);
    // A signed APK carries an APK Signing Block (v2/v3) just before the ZIP central directory.
    assert.ok(apk.includes(Buffer.from('APK Sig Block 42', 'latin1')), `${name} is not signed with APK Signature Scheme v2+`);
    assert.ok(!apk.includes(Buffer.from('Android Debug', 'latin1')), `${name} is signed with the Android debug key`);
  }
  const landingEnv = read('apps/web-landing/.env.production');
  const url = landingEnv.match(/^VITE_APP_DOWNLOAD_URL=(\S+)$/m)?.[1];
  if (url) {
    assert.match(url, /^\/downloads\/apex-arcade-[\d.]+\.apk$/);
    assert.ok(existsSync(new URL(`../apps/web-landing/public${url}`, import.meta.url)), `${url} is not in web-landing/public`);
    const gradle = read('apps/mobile-app/android/app/build.gradle');
    const versionName = gradle.match(/versionName "([^"]+)"/)[1];
    assert.ok(url.endsWith(`-${versionName}.apk`), `landing download ${url} does not match versionName ${versionName}`);
  }
  const release = read('scripts/build-android-release.sh');
  assert.match(release, /assembleRelease/);
  assert.match(release, /apksigner" verify/);
  assert.doesNotMatch(release, /assembleDebug/);
});
