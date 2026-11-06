import { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.CAPACITOR_SERVER_URL;
if (serverUrl && !serverUrl.startsWith('https://') && !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(serverUrl)) {
  throw new Error('CAPACITOR_SERVER_URL must use HTTPS except for local development.');
}

const config: CapacitorConfig = {
  appId: 'com.surratnd.gaming',
  appName: 'SURRAT ND',
  webDir: 'dist',
  server: serverUrl
    ? { url: serverUrl, cleartext: /^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(serverUrl), androidScheme: 'https' }
    : { androidScheme: 'https', cleartext: false },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#080a0f',
      androidSplashResourceName: 'splash',
      showSpinner: false
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#080a0f',
      overlaysWebView: false
    }
  }
};

export default config;
