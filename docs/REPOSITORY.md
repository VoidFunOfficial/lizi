# 仓库范围与清理记录

导航应用与宣传片源码共存，分别使用各自的依赖和类型配置。主项目 CI 只构建导航应用；宣传片入口和素材说明见 `ad/README.md`。

本次标准化：

- 删除 3 份与校园导航无关的 AR 方案草稿（原 `1.md`、`2.md`、`3.md`）。
- 删除 57 个无引用的 UI 模板组件、未使用的 mobile hook，以及 Capacitor 的示例测试。保留实际使用的 Badge、Button、Input 和业务测试。
- 从依赖表移除 8 个未使用的直接依赖，重新生成 pnpm 锁文件。
- 将视频导出、复制的 SDK 编译产物及 node_modules 链接移出版本控制，本地文件保留。宣传片源码、字体、地图和校徽原图保留。
- 旧官网 APK 移到本地 `outputs/android/legacy-download.apk`。官网使用 GitHub Release 的固定附件地址。
- 新增 EditorConfig、Git attributes、Node 版本文件、开发与发布说明、GitHub CI/Release 和 Actions 依赖更新配置。

已有 Git 历史保留，删除的旧文件仍能从历史中恢复；本次没有重写历史，所以首次推送仍会包含历史中的旧产物。后续提交不会再跟踪这些输出。
