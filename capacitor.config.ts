import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.njust.campusmap',
  appName: 'NJUST 校园导航',
  webDir: 'dist/client',
  backgroundColor: '#f3f2ed',
  // The Capacitor bridge otherwise logs plugin arguments, including login fields.
  loggingBehavior: 'none',
  android: {
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
    hostname: 'localhost',
    appStartPath: '/app.html',
  },
};

export default config;
