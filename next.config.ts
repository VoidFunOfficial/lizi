import type { NextConfig } from 'next';

const isAndroidBuild = process.env.NJUST_ANDROID_BUILD === '1';

const nextConfig: NextConfig = isAndroidBuild
  ? {
      // Capacitor serves this export from the APK. The ordinary web build keeps
      // its Worker route handlers, including /api/weather.
      output: 'export',
      images: { unoptimized: true },
    }
  : {};

export default nextConfig;
