# iOS 编译与 iPhone 安装

## 准备环境

- Mac，完整的 Xcode 26 或更新版本（只有 Command Line Tools 不够）。第一次打开 Xcode，完成组件安装，并在 Xcode Settings → Components 中安装 iOS 平台支持；运行模拟器还需安装对应的 iOS Simulator runtime。
- Node.js 22.13+，项目声明的 pnpm 版本。
- iPhone 需运行 iOS 15+，且当前 Xcode 支持该手机的系统版本。
- 首次构建需要联网下载 npm 和 Swift Package Manager 依赖。新工程使用 SPM，无需 CocoaPods。

如果 `xcodebuild -version` 没有指向完整 Xcode，可执行：

```bash
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
xcodebuild -version
```

依据：[Capacitor iOS 环境要求](https://capacitorjs.com/docs/ios)、[SPM 与环境配置](https://capacitorjs.com/docs/getting-started/environment-setup)。

## 编译脚本

在项目根目录执行：

```bash
pnpm ios                  # 默认：编译模拟器 Debug App，不需要 Apple 账号
pnpm ios:open             # 准备最新网页与原生工程，然后打开 Xcode
pnpm ios web              # 只构建静态网页，不要求 macOS/Xcode
pnpm ios --skip-checks    # 跳过测试与 lint，仍重新导出网页并编译
pnpm ios --help
```

默认流程会安装锁定依赖，运行测试与 lint，以 `NJUST_IOS_BUILD=1` 静态导出网页，必要时创建 `ios` 工程，再执行 `cap sync ios`、补齐定位权限说明和生成校徽图标/启动图，最后调用 `xcodebuild`。

- 模拟器产物：`outputs/ios/simulator/Build/Products/Debug-iphonesimulator/App.app`。
- 工程：`ios/App/App.xcodeproj`；请保留工程内的签名设置与原生修改。
- 地图与网页打包在 App 内，入口为 `/app.html`，不需要先部署网站。
- 重新修改网页后，再运行 `pnpm ios:open`。只按 Xcode 的 Run 不会自动重新构建前端。

模拟器 `.app` 不能安装到 iPhone。脚本默认不导出 IPA。

## 第一次安装到自己的 iPhone（推荐）

1. 用数据线连接 iPhone 和 Mac，解锁手机，在手机上选择“信任此电脑”。
2. 执行 `pnpm ios:open`，等待 Xcode 完成 Swift Package 依赖解析。
3. 在 Xcode **Settings → Accounts** 添加你的 Apple 账号。
4. 点左侧蓝色 **App** 工程，再选 **TARGETS → App → Signing & Capabilities**：勾选 **Automatically manage signing**，将 **Team** 设为自己的团队。免费账号显示 **Personal Team**。
5. 如果 `com.njust.campusmap` 无法注册，把 **Bundle Identifier** 改成个人唯一值，例如 `com.yourname.njustmap`。之后保留该值，以便覆盖安装更新。
6. 在 Xcode 顶部运行目标中选择已连接的 iPhone，等待配对和准备完成。
7. iOS 16 及以上如提示开发者模式，在手机 **设置 → 隐私与安全性 → 开发者模式** 中开启，按提示重启并确认。若看不到此选项，先通过 Xcode 配对手机，再查看。
8. 按 **⌘R**（Product → Run），Xcode 自动签名、安装并启动 App。如手机提示不受信任的开发者，在 **设置 → 通用 → VPN 与设备管理** 中信任相应开发者，再次运行。
9. 首次点击定位时允许“使用 App 期间”访问位置，开启“精确位置”。

免费 Apple 账号可以给自己的设备安装开发版本；Personal Team 的 provisioning profile 有效期为 **7 天**，到期后需要重新通过 Xcode 签名安装。TestFlight / App Store 分发需要加入 Apple Developer Program。首次在个人手机调试无需先付费。

依据：[Apple 真机运行说明](https://help.apple.com/xcode/mac/current/en.lproj/dev5a825a1ca.html)、[开发者模式](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device)、[Personal Team 与 7 天限制](https://developer.apple.com/help/account/basics/about-your-developer-account)、[分发方式](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases)。

## 已配置签名后，命令行编译真机版

先在 Xcode 登录并完成一次真机安装，使开发证书、团队与设备配置可用。将下面的占位值换成实际值：

```bash
IOS_TEAM_ID=ABCDEFGHIJ IOS_BUNDLE_ID=com.yourname.njustmap pnpm ios:device
```

`IOS_TEAM_ID` 为 10 位开发团队 ID；`IOS_BUNDLE_ID` 可省略，此时使用工程保存的 Bundle Identifier。命令行覆盖不会修改 Xcode 工程里的设置。脚本启用自动签名及 `-allowProvisioningUpdates`，允许 Xcode 更新必要的签名配置。

产物：`outputs/ios/device/Build/Products/Debug-iphoneos/App.app`。这一步只编译，安装仍推荐用 Xcode **⌘R**。签名配置必须包含目标设备；把 `.app` 压缩成 `.ipa` 或用 AirDrop 发送，并不能绕过签名安装要求。

如果需要向其他人分发，在 Xcode 配置自己的付费开发团队后，选择真机目标，执行 **Product → Archive**，再通过 Organizer 的 **Distribute App** 选择 TestFlight / App Store 或适用的设备分发方式。归档不等于已导出可安装 IPA，也不等于已发布。

## 当前能力和验证边界

- 定位使用已有的 `@capacitor/geolocation` iOS 实现；脚本添加插件要求的两项定位用途说明，不开启后台定位。
- 地图、导航界面和课表本地文件导入沿用现有网页代码；是否在具体 iPhone 上正常运行仍需真机验证。
- 教务系统一键登录导入的 `JwImport` 和实时手机罗盘 `Heading` 目前只有 Android 原生实现，本次编译脚本不包含它们的 iOS 移植。
- 实时天气等联网能力需网络，不能由编译成功推断可用。
- 模拟器编译通过只验证编译与打包；Apple 账号签名、iPhone 安装、GPS 和设备传感器需分别验证。

本次执行记录：93 项测试及 lint 通过，静态网页、iOS 工程同步、定位权限和图标检查通过，Swift 依赖解析成功。当前 Mac 的 Xcode 26.6 在编译时报告 `iOS 26.5 is not installed`，需要先在 **Xcode Settings → Components** 安装对应组件，再运行 `pnpm ios`。尚未完成原生 App 编译、签名或 iPhone 安装。

## 常见问题

- **要求选择 Team / 找不到 provisioning profile**：在 Xcode 登录账号、选择 Team 和唯一 Bundle Identifier，连接手机并先用 ⌘R 完成自动配置。
- **没有可用 iOS 目标或 SDK**：在 Xcode Settings → Components 安装 iOS 平台支持。若 Xcode 不支持手机当前系统，更新 Xcode。
- **`generic/platform=iOS Simulator` 找不到目标**：先执行 `xcrun simctl list runtimes`。如果列表为空，运行 `xcodebuild -downloadPlatform iOS` 下载并安装当前 Xcode 对应的模拟器运行时（下载可能达数 GB），等待完成后重试 `pnpm ios`。脚本现在会在构建前检测这种情况。下载方式参考 [Apple 官方组件安装说明](https://developer.apple.com/documentation/xcode/downloading-and-installing-additional-xcode-components)。
- **运行时已安装，仍提示 `iOS 26.5 is not installed`**：查看 Xcode Settings → Components 的 **Platform Support**。即使 **Other Installed Platforms** 已有 iOS Simulator，上方 iOS 平台支持仍可能显示 **Get**；此时需点击上方对应 iOS 的 **Get**，等待平台支持安装完成，而不是反复同步 Capacitor 或修改 App 的 deployment target。
- **Swift Package 下载失败**：确认 Mac 可连接 GitHub，在 Xcode File → Packages → Resolve Package Versions 中重试，然后重新执行脚本。
- **pnpm 提示 Unexpected store location**：让 pnpm 使用这份 `node_modules` 原有的 store，或重新安装依赖；不要混用不同 store 的安装。脚本不会主动改写全局 pnpm 配置。
- **安装后还是旧界面**：执行 `pnpm ios:open` 重新构建和同步网页，再按 ⌘R。
