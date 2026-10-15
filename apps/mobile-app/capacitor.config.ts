import { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.CAPACITOR_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'com.apexarcade.gaming',
  appName: 'Apex Arcade',
  webDir: 'dist',
  server: serverUrl
    ? { url: serverUrl, cleartext: serverUrl.startsWith('http://'), androidScheme: 'https' }
    : { androidScheme: 'https', cleartext: false },
  android: {
    allowMixedContent: true,
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
