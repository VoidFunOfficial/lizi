import type { NextConfig } from 'next';

const isNativeBuild =
  process.env.NJUST_ANDROID_BUILD === '1' ||
  process.env.NJUST_IOS_BUILD === '1';

const nextConfig: NextConfig = isNativeBuild
  ? {
      // Capacitor serves this export inside Android and iOS. The web build keeps
      // its Worker route handlers, including /api/weather.
      output: 'export',
      images: { unoptimized: true },
    }
  : {};

export default nextConfig;
