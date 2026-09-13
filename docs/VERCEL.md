# Vercel 网站部署

Web 保留现有 Vercel 项目和域名，改由 CNB 上传构建产物。项目根目录保持 `./`。根目录 `vercel.json` 已配置：

- Framework Preset：Other（`framework: null`）。
- Install Command：`pnpm install --frozen-lockfile`。
- Build Command：`pnpm build:vercel`。
- Output：由脚本生成 `.vercel/output`，使用 Vercel Build Output API。
- Node.js：22.x。

Vercel 部署 `/` 官网、`/app` 导航、`/editor` 标注工具和静态资源。构建脚本将共享的应用 API 打包成自包含的 Vercel Node.js Functions，并适配 Node HTTP 与 Web Request/Response；天气代理、教务请求来源校验及大小/超时限制继续生效。

源码迁至 CNB 后，由 `.cnb.yml` 在 main 测试及构建成功后执行 `scripts/cnb-deploy.mjs`，通过 Vercel CLI 上传已验证的 `.vercel/output` 并部署 Production。配置现有项目的 VERCEL_TOKEN、VERCEL_ORG_ID、VERCEL_PROJECT_ID 到 CNB 密钥仓库，见 [发布文档](RELEASING.md)。完成 CNB 实际部署验收后，断开旧 GitHub Git 集成，避免双重部署。CNB PR 目前构建验收而不自动部署 Preview。

本地预先验证：

```bash
pnpm check
pnpm vercel:package
node scripts/test-vercel-package.mjs
```

`outputs/vercel/njustmap` 是独立部署包，包含静态页和已打包的 Node API；另生成 `.vercel/output` 作为 CNB 自动部署的产物，CNB Release Web 附件包含此目录，可使用 Vercel CLI `deploy --prebuilt` 上传。它可以通过 Vercel Drop 或 Vercel CLI 部署。普通 `pnpm build` 仍保留原来的 Worker 构建供现有开发工具使用，线上部署应使用 `pnpm build:vercel`。

部署后的验收：访问首页、`/app` 和 `/editor`；`/api/weather` 应返回 JSON；对 `/api/student/jw` 发送同源 JSON 空对象应返回 400，跨站请求应返回 403。真实教务登录还依赖学校网络服务与用户账号，不能用入口检查代替真实导入验证。

官网 Android 下载经更新接口跳转到 CNB Release。在首次版本标签成功发布前，下载附件尚不存在。

参考：[Vercel 自定义 CI](https://vercel.com/kb/guide/using-vercel-cli-for-custom-workflows)、[Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js)。

## 页面跳转验收

静态页面之间使用原生 `<a href>` 跳转。当前 Vinext 版本的 `next/link` 在生产构建中可能因客户端导航函数缺失而报错，导致官网 Web 入口无响应。部署后必须在浏览器从官网点击 Web 入口，再检查地图、课表等交互；仅检查 HTML HTTP 200 不足以证明页面可用。
