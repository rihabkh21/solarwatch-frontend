import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.solarwatch.iot',
  appName: 'SolarWatch',
  webDir: 'dist',
  server: {
    url: 'http://192.168.100.146:5173',
    cleartext: true
  }
};

export default config;