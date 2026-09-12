#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { appVersion } from './app-version.mjs';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const versionInfo = appVersion();
const modes = ['simulator', 'open', 'device', 'web'];
const mode = args.find((arg) => !arg.startsWith('-')) ?? 'simulator';

function fail(message) {
  console.error(`\n错误：${message}`);
  process.exit(1);
}

function run(command, arguments_, options = {}) {
  console.log(`\n› ${command} ${arguments_.join(' ')}`);
  const result = spawnSync(command, arguments_, {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
    shell: false,
    ...options,
  });
  if (result.error) fail(`${command} 无法启动：${result.error.message}`);
  if (result.status !== 0) {
    if (result.stderr) console.error(String(result.stderr));
    fail(`${command} 执行失败，请查看上方错误。`);
  }
  return result;
}

if (args.includes('--help') || args.includes('-h')) {
  console.log(`NJUST iOS 编译

用法：pnpm ios [simulator|open|device|web] [--skip-checks]

  simulator  编译模拟器 Debug App，无需 Apple 账号（默认）
  open       准备网页、权限和原生工程，然后打开 Xcode 进行真机签名安装
  device     编译已签名的真机 Debug App；需 IOS_TEAM_ID 和 Xcode 登录账号
  web        只构建静态网页，无需 Xcode

  --skip-checks  跳过测试与 lint，仍安装锁定依赖并重新构建网页

真机可选变量：IOS_BUNDLE_ID（覆盖签名用 Bundle ID）
真机必填变量：IOS_TEAM_ID（Apple 开发团队 ID）
产物：outputs/ios/{simulator|device}/Build/Products/Debug-*/App.app
安装说明：docs/IOS.md
注意：模拟器 App 不能装到 iPhone；真机 App 仍须通过 Xcode 安装。`);
  process.exit(0);
}
if (!modes.includes(mode))
  fail(`未知模式“${mode}”，可用：${modes.join('、')}。`);
if (
  args.some((arg) => ![mode, '--skip-checks'].includes(arg)) ||
  args.filter((arg) => !arg.startsWith('-')).length > 1
) {
  fail('参数无效，请运行 pnpm ios --help。');
}
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13))
  fail('需要 Node.js 22.13 或更新版本。');
if (mode !== 'web') {
  if (process.platform !== 'darwin')
    fail('iOS 原生编译需要 macOS 和完整 Xcode。');
  const version = run('xcodebuild', ['-version'], {
    encoding: 'utf8',
    stdio: 'pipe',
  }).stdout;
  if (Number(version.match(/Xcode (\d+)/)?.[1] ?? 0) < 26) {
    fail('Capacitor 8 需要 Xcode 26 或更新版本，请安装并选择完整 Xcode。');
  }
  if (mode === 'simulator') {
    const result = run('xcrun', ['simctl', 'list', 'runtimes', '--json'], {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    const { runtimes } = JSON.parse(result.stdout);
    if (
      !runtimes.some(
        (runtime) =>
          runtime.isAvailable && runtime.identifier.includes('.iOS-'),
      )
    ) {
      fail(
        '尚未安装可用的 iOS 模拟器运行时。请在 Xcode → Settings → Components 下载 iOS，或先执行 xcodebuild -downloadPlatform iOS，再运行 pnpm ios。若要安装到真机，请使用 pnpm ios:open。',
      );
    }
  }
}
if (
  mode === 'device' &&
  !/^[A-Z0-9]{10}$/.test(process.env.IOS_TEAM_ID ?? '')
) {
  fail(
    '请设置 10 位 IOS_TEAM_ID；首次安装建议使用 pnpm ios:open，在 Xcode 中选择 Team。',
  );
}
if (
  process.env.IOS_BUNDLE_ID &&
  !/^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(process.env.IOS_BUNDLE_ID)
) {
  fail('IOS_BUNDLE_ID 应为反向域名，例如 com.yourname.njustmap。');
}

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
run(pnpm, ['install', '--frozen-lockfile']);
if (!args.includes('--skip-checks')) {
  run(pnpm, ['test']);
  run(pnpm, ['lint']);
}
run(pnpm, ['run', 'build:ios:web']);
for (const file of ['index.html', 'app.html']) {
  if (!existsSync(join(root, 'dist/client', file)))
    fail(`静态导出缺少 ${file}。`);
}
if (mode === 'web') {
  console.log(`\niOS 静态网页已生成：${join(root, 'dist/client')}`);
  process.exit(0);
}

const iosRoot = join(root, 'ios');
const project = join(iosRoot, 'App/App.xcodeproj');
if (!existsSync(project)) {
  if (existsSync(iosRoot))
    fail('ios 目录存在但缺少 App/App.xcodeproj，请检查现有工程。');
  run(pnpm, ['exec', 'cap', 'add', 'ios', '--packagemanager', 'SPM']);
}
run(pnpm, ['exec', 'cap', 'sync', 'ios']);

// Add only missing descriptions: preserve any wording customized in Xcode.
const plist = join(iosRoot, 'App/App/Info.plist');
for (const key of [
  'NSLocationWhenInUseUsageDescription',
  'NSLocationAlwaysAndWhenInUseUsageDescription',
]) {
  const present = spawnSync(
    '/usr/bin/plutil',
    ['-extract', key, 'raw', plist],
    { stdio: 'ignore' },
  );
  if (present.status !== 0) {
    run('/usr/bin/plutil', [
      '-insert',
      key,
      '-string',
      '用于在校园地图上显示你的位置，并在导航时更新路线。',
      plist,
    ]);
  }
}
run(process.execPath, ['scripts/generate-ios-assets.mjs']);
if (mode === 'open') {
  run(pnpm, ['exec', 'cap', 'open', 'ios']);
  console.log(
    '\n在 Xcode 中选择 App → Signing & Capabilities → Team，然后选择 iPhone 并按 ⌘R。',
  );
  process.exit(0);
}

const device = mode === 'device';
const derivedData = join(root, 'outputs/ios', mode);
mkdirSync(derivedData, { recursive: true });
// Also supports an existing CocoaPods project when one is present.
const workspace = join(iosRoot, 'App/App.xcworkspace');
const buildArgs = [
  ...(existsSync(workspace)
    ? ['-workspace', workspace]
    : ['-project', project]),
  '-scheme',
  'App',
  '-configuration',
  'Debug',
  '-destination',
  device ? 'generic/platform=iOS' : 'generic/platform=iOS Simulator',
  '-derivedDataPath',
  derivedData,
  ...(device
    ? [
        '-allowProvisioningUpdates',
        'CODE_SIGN_STYLE=Automatic',
        `DEVELOPMENT_TEAM=${process.env.IOS_TEAM_ID}`,
      ]
    : ['CODE_SIGNING_ALLOWED=NO']),
  ...(process.env.IOS_BUNDLE_ID
    ? [`PRODUCT_BUNDLE_IDENTIFIER=${process.env.IOS_BUNDLE_ID}`]
    : []),
  `MARKETING_VERSION=${versionInfo.version}`,
  `CURRENT_PROJECT_VERSION=${versionInfo.code}`,
  'build',
];
run('xcodebuild', buildArgs);
const app = join(
  derivedData,
  'Build/Products',
  device ? 'Debug-iphoneos' : 'Debug-iphonesimulator',
  'App.app',
);
if (!existsSync(join(app, 'App')))
  fail(`编译结束但找不到 App 可执行文件：${app}`);
const config = JSON.parse(
  readFileSync(join(app, 'capacitor.config.json'), 'utf8'),
);
if (
  config.server?.appStartPath !== '/app.html' ||
  !existsSync(join(app, 'public/app.html'))
) {
  fail('App 缺少校园导航网页或启动路径不正确。');
}
console.log(`\niOS 编译完成：${app}`);
console.log(
  device
    ? '真机安装请参考 docs/IOS.md。'
    : '这是模拟器 App；安装到 iPhone 请运行 pnpm ios:open。',
);
