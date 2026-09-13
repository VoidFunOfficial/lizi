# 构建、版本与发布

仓库：<https://github.com/VoidFunOfficial/lizi>。主分支使用 `main`；工作流也兼容默认分支为 `master` 的已有仓库。

## 日常开发

使用 `.nvmrc` 指定的 Node 22 和 `package.json` 指定的 pnpm。运行 `pnpm install --frozen-lockfile`、`pnpm check`。`pnpm build` 构建包含天气和教务 API 的 Cloudflare Worker；`pnpm android` 生成调试 APK；macOS/Xcode 26 上 `pnpm ios` 生成模拟器 App。

PR、普通分支 push、手动 CI 都会检查 Web、Android 和 iOS。默认分支 push 由 Release 工作流调用同一套 CI，成功后处理版本。Actions Artifacts 保留 14 天，Release 附件长期保留。

## 版本管理

唯一手工维护的应用版本是根 `package.json` 的 `version`，初始值 `0.1.0`。Release Please 根据 Conventional Commits 自动维护版本 PR、`.release-please-manifest.json` 和 `CHANGELOG.md`。使用 squash merge，PR 标题写成：

- `fix: 修复定位偏移`：补丁版本。
- `feat: 新增收藏地点`：次版本。
- `feat!: 修改课表数据格式` 或提交正文 `BREAKING CHANGE:`：破坏性变化（0.x 阶段按 Release Please 的 pre-major 策略升级）。

`docs:`、`chore:`、`ci:` 本身通常不产生版本发布。合并自动生成的版本 PR 后，下一次 Release 运行先完成三端构建，再创建 `vX.Y.Z` 标签和 GitHub Release，并上传本次构建产物。无需手动修改 Gradle 的版本。

Android/iOS 构建号由 `major * 1000000 + minor * 1000 + patch` 生成，例如 `0.1.0 → 1000`。minor/patch 上限为 999，只支持稳定版本，确保升级时构建号递增。`pnpm version:check` 验证版本；`node scripts/app-version.mjs v0.1.0` 额外验证标签。iOS CLI 将版本传入 Xcode；直接使用 Xcode 时请手动同步其版本设置。

## 当前启用：标签自动发布

按仓库所有者要求，Actions 创建/批准 PR 权限保持关闭。默认分支 push 执行三端 CI；推送版本标签时自动创建 Release 并上传附件。不会创建、批准或合并任何 PR。

发布步骤：

1. 运行 `pnpm release:version patch`（也可使用 `minor` 或 `major`），同时更新 package.json 与版本 manifest。
2. 执行 `pnpm check`，提交版本变更并推送 main。
3. 为该提交创建与 package.json 相同版本的标签，例如 `git tag v0.1.1`，然后 `git push origin v0.1.1`。

标签和包版本不一致时发布失败。无需手工修改 Android/iOS 构建号。

## 可选：开启自动版本 PR

上方描述的 Release Please 流程需要设置仓库变量 `ENABLE_RELEASE_PLEASE=true`，再开启下方权限。默认未启用，不影响标签自动发布。

## GitHub 一次性设置

在 Settings → Actions → General 开启 **Allow GitHub Actions to create and approve pull requests**。工作流已声明所需的最小任务权限。

默认使用 `GITHUB_TOKEN`。它创建的版本 PR 不会自动触发另一个 CI 事件；版本 PR 合并到默认分支后仍会在 Release 流程中运行完整检查。若分支保护要求版本 PR 的 CI 必须先通过，可配置 `RELEASE_PLEASE_TOKEN`（受限到本仓库的 GitHub App token 或 fine-grained PAT，需 Contents、Pull requests、Issues 读写权限），或者在该 PR 分支上手动运行 CI。参见 [Release Please 官方说明](https://github.com/googleapis/release-please-action#other-actions-on-release-please-prs)。

### Android 签名

在 Settings → Secrets and variables → Actions 配置：

| Secret | 内容 |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | 现有发布 keystore 的 Base64 内容 |
| `ANDROID_KEYSTORE_PASSWORD` | keystore 密码 |
| `ANDROID_KEY_ALIAS` | 签名 alias |
| `ANDROID_KEY_PASSWORD` | alias 密码 |

四项齐全时自动构建正式 APK 和 AAB；部分配置时任务失败并要求补全。全部未配置时发布明确标注的 debug APK，用于体验。不同 runner 的 debug 签名不同，升级可能需要卸载旧版，正式分发应配置长期使用并安全备份的同一把密钥。不要把 keystore 或密码提交到 Git。

Release 的 `njustmap-android.apk` 是官网使用的固定下载文件名。它按签名配置指向正式包或调试包；`BUILD-INFO.txt` 记录签名模式和提交 SHA。首次 Release 完成前该下载链接尚不可用。旧官网 APK 已移到本地 `outputs/android/legacy-download.apk`，没有删除原始产物。

### 附件与恢复

- `njustmap-web.tar.gz`：Vercel Build Output API 部署包（`.vercel/output`），含静态页面与 Node.js API，可用 `vercel deploy --prebuilt` 上传。
- `njustmap-android.apk`：固定下载入口；另附带版本号的 debug APK，配置签名后附带 AAB。
- `njustmap-ios-simulator.zip`：仅模拟器 App；不是可装到 iPhone 的 IPA。iPhone 签名分发见 [IOS.md](IOS.md)。
- `BUILD-INFO.txt`、`SHA256SUMS.txt`：构建信息和全部附件校验和。

若 Release 已创建但附件上传失败，在默认分支手动运行 **Release**，输入现有标签（如 `v0.1.1`）。流水线检出该标签，重建并检查版本一致性，然后补传附件；不会创建新版本。自动标签由 `GITHUB_TOKEN` 创建时，不依赖另一个 tag/release 事件触发，附件任务直接在同一工作流运行。

Web 通过 Vercel Git 集成随 main 提交自动部署，详见 [VERCEL.md](VERCEL.md)。GitHub Release 不负责提交 App Store/Google Play。

## App 更新检测（v1 起）

根 package.json 版本同时嵌入 App 界面。启动 1.5 秒后自动读取 GitHub 最新正式 Release，回到前台或网络恢复时再次检查；成功检查间隔 6 小时，失败退避 5 分钟。「我的 → 应用更新」可立即手动重试。忽略草稿、预发布和比当前更旧的版本，只接受本仓库对应版本且已上传完成的固定 APK 附件；网络失败不会弹窗或阻断地图。选择稍后提醒后，同一版本在本次 App 会话内不再自动弹窗，手动检查仍可打开。

Android 通过原生 HTTP 检查并在外部浏览器下载 APK，由系统确认安装；iOS/Web 展示发布页入口，iOS 模拟器包不会被作为 iPhone 更新包提供。公开读取不使用 GitHub 凭据；国内网络不可达时可以稍后重试。

标签发布先创建草稿，上传所有附件后才公开并设为 latest，避免用户收到尚不可下载的更新。可在 docs/releases/vX.Y.Z.md 提供该版本的中文发布说明。手动恢复仍支持补传已有草稿或正式版本。

v1 已配置固定 Android 发布签名。私钥和密码仅存本地忽略目录 outputs/signing 与加密的仓库 Actions Secrets，不可放进源码或公开附件。请安全备份本地签名材料；丢失或更换签名将影响后续覆盖升级。0.x debug 包迁移到 v1 前，应导出课表并记录个人设置。
