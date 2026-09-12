# Vercel 网站部署

Web 使用 Vercel Git 集成：导入 `VoidFunOfficial/lizi`，项目根目录保持 `./`。根目录 `vercel.json` 已配置：

- Framework Preset：Other（`framework: null`）。
- Install Command：`pnpm install --frozen-lockfile`。
- Build Command：`pnpm build:vercel`。
- Output：由脚本生成 `.vercel/output`，使用 Vercel Build Output API。
- Node.js：22.x。

Vercel 部署 `/` 官网、`/app` 导航、`/editor` 标注工具和静态资源。构建脚本将共享的应用 API 打包成自包含的 Vercel Node.js Functions，并适配 Node HTTP 与 Web Request/Response；天气代理、教务请求来源校验及大小/超时限制继续生效。

项目连接 GitHub 后，推送 main 自动部署 Production，PR 自动生成 Preview。该流程由 Vercel 的 Git 集成执行，不需要为 GitHub Actions 开放创建/批准 PR 权限，也无需把 Vercel token 写进仓库。

本地预先验证：

```bash
pnpm check
pnpm vercel:package
node scripts/test-vercel-package.mjs
```

`outputs/vercel/njustmap` 是独立部署包，包含静态页和已打包的 Node API；另生成 `.vercel/output` 作为 Git 集成实际部署的产物，GitHub Release Web 附件包含此目录，可使用 Vercel CLI `deploy --prebuilt` 上传。它可以通过 Vercel Drop 或 Vercel CLI 部署。普通 `pnpm build` 仍保留原来的 Worker 构建供现有开发工具使用，线上部署应使用 `pnpm build:vercel`。

部署后的验收：访问首页、`/app` 和 `/editor`；`/api/weather` 应返回 JSON；对 `/api/student/jw` 发送同源 JSON 空对象应返回 400，跨站请求应返回 403。真实教务登录还依赖学校网络服务与用户账号，不能用入口检查代替真实导入验证。

官网 Android 下载指向 GitHub Release。在首次版本标签成功发布前，下载附件尚不存在。

参考：[Vercel GitHub 集成](https://vercel.com/docs/git/vercel-for-github)、[Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js)。
