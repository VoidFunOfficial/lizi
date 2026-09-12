# NJustMap 宣传片

80 秒，1920 × 1080，60 fps。20 个分镜，每镜 4 秒。使用 Fourier SDK 的独立 React artifact、声明式 FourierMotion，以及根 Project / Scene / Template 组合。

有音效成片：`output/NJustMap-1080p60-SFX.mp4`。先前无声版保留为 `output/NJustMap-1080p60.mp4`。

## 渲染

`main.tsx` 默认合成各分镜目录中的 `rendered.mp4` 与音效总轨。这些片段由对应的 Fourier SDK `Visual.tsx` 独立渲染，包含全部 4800 帧；主入口不会再次调用 Chromium 抓帧。

直接使用原命令即可合成：

```bash
fourier render ad/main.tsx -o 123.mp4
```

修改画面源码后，在项目根目录重新生成分镜片段与成片：

```bash
python3 ad/scripts/render.py
```

或在 `ad` 中运行 `bun run render`。该脚本会同步更新各 Scene 的 `rendered.mp4`。分镜仍然由 Fourier 官方 Core 接口渲染；FFmpeg 只负责无损拼接视频和编码音效，不另建画面渲染器。

使用更明确的输出路径与质量参数：

```bash
FOURIER_DOM_TIMEOUT_MS=60000 fourier render ad/main.tsx \
  -o ad/output/NJustMap-1080p60-SFX.mp4 \
  --overwrite --crf 17 --dom-pages 1 --frame-concurrency 1
```

也可在 `ad` 中运行 `bun run render:cli`。此配置下不依赖截图超时设置。此前直接让 CLI 渲染 React 时，即使单页、单帧并发也出现过 Playwright screenshot timeout，故默认改为预渲染片段合成。第 15 镜及其余全部分镜都已独立输出完整 240 帧。`FOURIER_DOM_TIMEOUT_MS` 只控制外层操作超时，不改变 Playwright screenshot 内部默认的 30 秒超时。

根 Scene ID 使用 `shot-` 前缀。后十镜放进 `templates/student-life`，避免 20 个根 Scene 同时编译超过当前安全执行队列容量。分镜本身仍独立，画面时长不变。

## 编辑与预览

- 前十镜：`scenes/<分镜>/Visual.tsx`。
- 后十镜：`templates/student-life/scenes/<分镜>/Visual.tsx`。
- 通用地图、手机、课程、指示线：`components/Kit.tsx`。
- 每镜 `main.tsx` 可单独交给 `fourier render`。
- 每镜 `main.tsx` 的 `USE_RENDERED_CLIPS` 默认是 `true`；保留的 `ReactLayer` 分支仅供渲染器修复后恢复直接渲染。通常修改 `Visual.tsx` 后运行 `bun run render` 更新分镜片段即可。
- 在 `ad` 内运行 `bun scripts/preview.ts 08` 可检查第 8 镜；`python3 scripts/preview-all.py` 会逐个进程检查所有分镜，保存开头、中间、结尾及乱序 seek 校验。
- 字体取自项目 `fonts/STHeiti.ttc`、`fonts/Montserrat-Medium.ttf` 和系统 San Francisco，经 `scripts/fonts.py` 子集化。修改中文文案后重新运行字体脚本。

## 音效

`assets/audio/sfx-master.wav` 是 80 秒、48 kHz 立体声总轨，通过根工程的 `Audio` 节点参与渲染。未引用 `sfx/bgm.mp3` 和 `sfx/bgm_master.wav`。

`scripts/build-sfx.py` 定义每镜的局部音效，并生成 `sound/scene-cues.json`、总轨及 `review/sfx-master.json`。修改脚本中的对应分镜，然后运行：

```bash
python3 ad/scripts/build-sfx.py
```

复用 click、snap、kacha、woosh、shua、wind、correct 七个已有声音；纸面摩擦、短气流、低频落位、轻敲和雨滴用固定随机种子合成。每个声音有独立起止、音量、淡入淡出和左右声像。

手写镜头与音效共用 `assets/signature.json`，包含 9 条字形笔画、下划线和定位标记；抬笔期间不持续播放纸面摩擦声。`review/sfx-master.json` 记录每个声音的来源哈希、时间和样本位置。

若整片浏览器进程无法稳定运行，可运行 `bun run render:isolated`：它仍通过 Fourier Core 的公开 artifact 渲染接口逐镜导出，再由 FFmpeg 无损拼接视频并加入同一音效总轨。

## 验收

```bash
./node_modules/.bin/tsc -p ad/tsconfig.json
bun ad/scripts/check.ts
fourier validate ad/main.tsx
python3 ad/scripts/verify-media.py
```

预览、渲染和媒体验收证据放在 `review/`。这是一部依据项目功能制作的 MG 宣传片；课程、天气、定位变化和建筑投影属于示例或原理动画，不是实机操作录屏。来源与画面边界见 `REFERENCE.md`。
