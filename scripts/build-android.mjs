#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { appVersion } from './app-version.mjs';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { homedir, platform } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(
  readFileSync(join(projectRoot, 'package.json'), 'utf8'),
);
const versionInfo = appVersion();
const arguments_ = process.argv.slice(2);
const mode =
  arguments_.find((argument) => !argument.startsWith('--')) ?? 'debug';
const skipChecks = arguments_.includes('--skip-checks');
const showHelp = arguments_.includes('--help') || arguments_.includes('-h');
const supportedModes = new Set(['debug', 'release', 'bundle', 'web']);

function printHelp() {
  console.log(`NJUST Android 一键打包

用法：
  pnpm android [debug|release|bundle|web] [--skip-checks]

模式：
  debug    生成可直接安装的调试 APK（默认）
  release  生成已签名的发布 APK
  bundle   生成已签名的 Google Play AAB
  web      只验证并生成 APK 内要使用的静态网页

发布签名环境变量：
  ANDROID_KEYSTORE_PATH
  ANDROID_KEYSTORE_PASSWORD
  ANDROID_KEY_ALIAS
  ANDROID_KEY_PASSWORD

可选版本环境变量：
  ANDROID_VERSION_CODE（默认根据 package.json 版本计算）
  ANDROID_VERSION_NAME（默认 package.json 的 version）`);
}

function fail(message) {
  console.error(`\n错误：${message}`);
  process.exit(1);
}

function executable(command) {
  return platform() === 'win32' ? `${command}.cmd` : command;
}

function run(command, args, options = {}) {
  console.log(`\n› ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? projectRoot,
    env: options.env ?? process.env,
    shell: false,
    stdio: 'inherit',
  });
  if (result.error) fail(`${command} 无法启动：${result.error.message}`);
  if (result.status !== 0) {
    fail(`${command} 执行失败（退出码 ${result.status ?? '未知'}）`);
  }
}

function findAndroidSdk() {
  const userHome = homedir();
  const candidates = [
    process.env.ANDROID_SDK_ROOT,
    process.env.ANDROID_HOME,
    platform() === 'darwin' ? join(userHome, 'Library/Android/sdk') : undefined,
    platform() === 'linux' ? join(userHome, 'Android/Sdk') : undefined,
    platform() === 'win32'
      ? join(process.env.LOCALAPPDATA ?? '', 'Android/Sdk')
      : undefined,
  ].filter(Boolean);

  return candidates.find(
    (candidate) =>
      existsSync(candidate) &&
      (existsSync(join(candidate, 'platforms')) ||
        existsSync(join(candidate, 'cmdline-tools'))),
  );
}

function findJavaHome() {
  const configured = process.env.JAVA_HOME;
  if (configured && existsSync(join(configured, 'bin', 'java')))
    return configured;

  const studioHomes =
    platform() === 'darwin'
      ? [
          '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
          join(
            homedir(),
            'Applications/Android Studio.app/Contents/jbr/Contents/Home',
          ),
        ]
      : [];
  return studioHomes.find((candidate) =>
    existsSync(join(candidate, 'bin', 'java')),
  );
}

function requireReleaseSigning() {
  const names = [
    'ANDROID_KEYSTORE_PATH',
    'ANDROID_KEYSTORE_PASSWORD',
    'ANDROID_KEY_ALIAS',
    'ANDROID_KEY_PASSWORD',
  ];
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    fail(
      `发布包缺少签名变量：${missing.join(', ')}。运行 pnpm android --help 查看说明。`,
    );
  }

  const keystore = resolve(projectRoot, process.env.ANDROID_KEYSTORE_PATH);
  if (!existsSync(keystore)) fail(`找不到签名文件：${keystore}`);
  return keystore;
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

if (showHelp) {
  printHelp();
  process.exit(0);
}
if (!supportedModes.has(mode)) {
  fail(`未知模式“${mode}”。可用模式：debug、release、bundle、web。`);
}
if (Number(process.versions.node.split('.')[0]) < 22) {
  fail(`需要 Node.js 22 或更新版本，当前为 ${process.version}。`);
}

process.chdir(projectRoot);
const pnpm = executable('pnpm');

console.log(`NJUST 校园导航 Android 打包（${mode}）`);
run(pnpm, ['install', '--frozen-lockfile']);
if (!skipChecks) {
  run(pnpm, ['test']);
  run(pnpm, ['lint']);
}

run(pnpm, ['run', 'build:android:web'], {
  env: { ...process.env, NJUST_ANDROID_BUILD: '1' },
});

const webIndex = join(projectRoot, 'dist/client/index.html');
const appIndex = join(projectRoot, 'dist/client/app.html');
if (!existsSync(webIndex) || !existsSync(appIndex)) {
  fail('静态导出不完整：应同时生成 dist/client/index.html 与 app.html。');
}
if (mode === 'web') {
  console.log(
    `\n完成：Android 静态网页位于 ${join(projectRoot, 'dist/client')}`,
  );
  process.exit(0);
}

const androidRoot = join(projectRoot, 'android');
if (!existsSync(join(androidRoot, 'gradlew'))) {
  run(pnpm, ['exec', 'cap', 'add', 'android']);
}
run(pnpm, ['exec', 'cap', 'sync', 'android']);
run(process.execPath, ['scripts/generate-android-assets.mjs']);

const manifest = join(androidRoot, 'app/src/main/AndroidManifest.xml');
const manifestSource = existsSync(manifest)
  ? readFileSync(manifest, 'utf8')
  : '';
for (const permission of [
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_FINE_LOCATION',
]) {
  if (!manifestSource.includes(permission)) {
    fail(
      `AndroidManifest.xml 缺少 ${permission}，请恢复项目内的 Android 原生配置。`,
    );
  }
}

const androidSdk = findAndroidSdk();
if (!androidSdk) {
  fail(
    '未找到 Android SDK。请先安装 Android Studio 2025.2.1+ 与 Android SDK 36，或设置 ANDROID_SDK_ROOT。静态网页和 Android 工程已经生成。',
  );
}

const javaHome = findJavaHome();
const gradleEnvironment = {
  ...process.env,
  ANDROID_HOME: androidSdk,
  ANDROID_SDK_ROOT: androidSdk,
  ANDROID_VERSION_CODE:
    process.env.ANDROID_VERSION_CODE ?? String(versionInfo.code),
  ANDROID_VERSION_NAME: process.env.ANDROID_VERSION_NAME ?? packageJson.version,
  ...(javaHome ? { JAVA_HOME: javaHome } : {}),
};

if (mode === 'release' || mode === 'bundle') {
  gradleEnvironment.ANDROID_KEYSTORE_PATH = requireReleaseSigning();
}

const gradle =
  platform() === 'win32'
    ? join(androidRoot, 'gradlew.bat')
    : join(androidRoot, 'gradlew');
const task =
  mode === 'debug'
    ? 'assembleDebug'
    : mode === 'release'
      ? 'assembleRelease'
      : 'bundleRelease';
run(gradle, ['--no-daemon', task], {
  cwd: androidRoot,
  env: gradleEnvironment,
});

const builtArtifact =
  mode === 'debug'
    ? join(androidRoot, 'app/build/outputs/apk/debug/app-debug.apk')
    : mode === 'release'
      ? join(androidRoot, 'app/build/outputs/apk/release/app-release.apk')
      : join(androidRoot, 'app/build/outputs/bundle/release/app-release.aab');
if (!existsSync(builtArtifact))
  fail(`Gradle 已完成，但找不到产物：${builtArtifact}`);

const outputDirectory = join(projectRoot, 'outputs/android');
mkdirSync(outputDirectory, { recursive: true });
const extension = mode === 'bundle' ? 'aab' : 'apk';
const outputArtifact = join(
  outputDirectory,
  `njust-campus-map-${packageJson.version}-${mode}.${extension}`,
);
copyFileSync(builtArtifact, outputArtifact);

console.log('\nAndroid 打包完成');
console.log(`产物：${outputArtifact}`);
console.log(
  `大小：${(statSync(outputArtifact).size / 1024 / 1024).toFixed(1)} MiB`,
);
console.log(`SHA-256：${sha256(outputArtifact)}`);
