# 参与开发

1. 使用 Node（见 `.nvmrc`）和 `package.json` 锁定的 pnpm。
2. `pnpm install --frozen-lockfile` 安装依赖，`pnpm dev` 启动。
3. `pnpm check` 执行测试、lint、类型检查。原生变更另运行对应平台构建。
4. 使用 `feat:`、`fix:`、`docs:` 等 Conventional Commits 标题，提交 PR。

源码：`app/`（页面和 API）、`lib/`（导航与业务）、`components/ui/`（实际使用的通用控件）、`data/`（校园数据）、`tests/`、`android/`、`ios/`、`scripts/`、`docs/`。

`ad/` 是独立的宣传片工程，`fonts/`、`fourier-sdk/` 是其配套素材/源码。它们不参与导航应用的 TypeScript 和 CI 构建。保留原始地图及校徽素材，避免覆盖用户导入的数据。原生测试、模拟器验证和真机验证应分别说明。

不要提交 `node_modules`、编译缓存、视频成品、APK、签名密钥或本机 SDK 路径。详细版本和签名设置见 [发布文档](docs/RELEASING.md)。
