# CNB 构建、版本与发布

仓库：https://cnb.cool/voidfun/njustmap 。主分支 main，流水线入口 `.cnb.yml`，构建镜像 `.cnb/Dockerfile`。Node 22.16.0、pnpm 11.22.0、JDK 21、Android SDK 36 与现有项目一致。

## 自动流程

- main push：测试、lint、类型检查、版本检查、Web 构建和打包验证、Android debug 构建及 Java 单元测试；附件保存在该提交；全部通过后部署现有 Vercel 项目。
- 其他分支 push、PR 创建/更新：同样构建和检查，不读取发布密钥、不部署生产。
- 每周一北京时间 09:00：main 回归构建。原 Dependabot 仅更新 GitHub Actions，Actions 删除后该配置一并退役；此任务不修改依赖、不创建 PR。
- 推送 vX.Y.Z：先检查标签与 package.json 一致，再完整构建，使用原有 Android 正式密钥生成 APK/AAB，创建 CNB 草稿、上传并确认全部附件，最后公开版本并更新 latest。失败不会向客户端宣布新版本。
- CNB 页面选择 main 手动运行可重试 Web 构建和部署；选择 vX.Y.Z 标签手动运行可恢复草稿发布。已公开附件不覆盖；旧版本恢复不会把 latest 降级。

按当前要求，CNB 不运行 iOS。`pnpm ios`、`pnpm test:ios` 和原生源码仍可在 Mac 本地使用。没有自动上传 App Store/Google Play。

## 版本管理

应用版本只维护根 package.json。`pnpm release:version patch`（或 minor/major）修改版本；补充 CHANGELOG.md、docs/releases/vX.Y.Z.md，提交到 main，再创建并推送同名标签。

```sh
pnpm release:version patch
pnpm check
git add package.json CHANGELOG.md docs/releases
git commit -m "chore: release vX.Y.Z"
git push origin main
git tag vX.Y.Z
git push origin vX.Y.Z
```

示例中的 vX.Y.Z 必须替换成 package.json 的实际版本。Android/iOS 构建号仍按 major * 1000000 + minor * 1000 + patch 生成。Release Please 及其 manifest 已删除，避免保留不会执行的 GitHub 配置。

## CNB 密钥文件

在 voidfun 组织下建立 **密钥类型** 仓库 `njustmap-secrets`，main 分支包含下面两个文件。不要放进公开 njustmap 仓库。流水线仅在对应签名或部署步骤导入。

android.yml：

```yaml
allow_slugs: [voidfun/njustmap]
allow_events: [tag_push, web_trigger]
allow_branches: ['v*']
ANDROID_KEYSTORE_BASE64: <现有 keystore 的 Base64>
ANDROID_KEYSTORE_PASSWORD: <现有密码>
ANDROID_KEY_ALIAS: <现有 alias>
ANDROID_KEY_PASSWORD: <现有密码>
```

vercel.yml：

```yaml
allow_slugs: [voidfun/njustmap]
allow_events: [push, web_trigger]
allow_branches: [main]
VERCEL_TOKEN: <现有 Vercel 部署令牌>
VERCEL_ORG_ID: <现有 Vercel 团队 ID>
VERCEL_PROJECT_ID: <现有 lizi 项目 ID>
```

CNB 自动提供临时 CNB_TOKEN 给当前仓库流水线，用来创建 Release、上传附件，无需在源码写入令牌。Android 四项签名配置缺失时直接失败，不回退为不同签名的 debug 正式更新。沿用本地 outputs/signing 中已备份的 v1 签名材料，不重新生成密钥。

仓库设置 → 云原生构建需开启事件自动触发与定时任务。GitHub Actions 中加密的旧 Secrets 无法读回；Android 从现有本地备份迁移，Vercel 需使用有效部署令牌。

## 发布附件

- njustmap-android.apk：固定文件名的正式签名 APK，供 App 自动更新和官网下载。
- 带版本号的 debug APK：仅调试。
- 带版本号的 bundle.aab：正式签名 AAB。
- njustmap-web.tar.gz：`.vercel/output`，含静态页、天气、教务与更新代理 Node 函数。
- BUILD-INFO.txt、SHA256SUMS.txt：提交、签名模式和附件校验和。

## 自动更新与旧版本过渡

Android/iOS 原生 HTTP 读取 `https://cnb.cool/voidfun/njustmap/-/releases/latest`，请求头为 `Accept: application/vnd.cnb.api+json`。不要换成 api.cnb.cool：该开放 API 域名要求登录。Web 读取同站点 `/api/updates`，服务端访问 CNB 公开接口，解决浏览器 CORS 限制，不使用私密令牌。

启动后、回到前台和恢复网络时检查；成功间隔 6 小时、失败退避 5 分钟，保留手动检查。仅接受非草稿、非预发布、版本更高且固定 APK 附件已存在的发布；下载必须来自本仓库该版本。官网下载通过 `/api/updates?download=android` 跳转到验证后的 CNB APK。网络错误不会阻断地图。

旧 v1.0.0/v1.1.0 已经把 GitHub 地址编入安装包，无法远程改写。需要在原 GitHub Release 发布一次相同签名的 v1.1.1 迁移 APK；用户通过原有更新弹窗安装后，后续更新全部访问 CNB。仅修改仓库网址不能让已安装旧版自动切源。

## 官方参考

- [CNB 触发规则](https://docs.cnb.cool/zh/build/trigger-rule.html)
- [CNB 密钥文件引用](https://docs.cnb.cool/zh/build/file-reference.html)
- [CNB OpenAPI](https://api.cnb.cool/)
- [Vercel 自定义 CI](https://vercel.com/kb/guide/using-vercel-cli-for-custom-workflows)
