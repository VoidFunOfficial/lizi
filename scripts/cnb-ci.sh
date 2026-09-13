#!/usr/bin/env bash
set -euo pipefail
pnpm install --frozen-lockfile
pnpm check
pnpm version:check
# Web and native builds share dist/client, so archive Web before Android.
pnpm build:vercel
node scripts/prepare-vercel.mjs --skip-build
node scripts/test-vercel-package.mjs
rm -rf release-assets
mkdir -p release-assets
tar -czf release-assets/njustmap-web.tar.gz .vercel/output
pnpm android --skip-checks
(cd android && ./gradlew --no-daemon testDebugUnitTest)
cp outputs/android/*-debug.apk release-assets/
