# NJUST 校园混合通行导航

这是一个以南京理工大学江阴校区导览图为底图的 React 校园标注与步行导航应用。默认底图 `public/campus-guide-georectified-high.png` 从用户提供的 `7500×4710` 高清 `map-high.jpg` 做全局仿射几何纠偏，保留原图的建筑、道路、水体和中文名称，并重采样到北向上的固定 WGS-84 网格。高清栅格用于缩放显示，路线、区域、障碍物、地点和定位仍位于稳定的 `2038×1279` SVG 逻辑坐标空间。

纠偏过程会旋转、错切和缩放整张原图，但不会生成式重绘建筑或改写标签。原图和历史精修图上的归一化标注会经过同一 WGS-84 变换自动迁移，不能再原位照搬。`public/campus-precise.svg` 仍保留为可选的 WGS-84 校核层，不是默认导览底图。

## 使用 pnpm 启动

```bash
pnpm install
pnpm dev
```

验证与生产构建：

```bash
pnpm test
pnpm lint
pnpm build
```

## 一键封装 Android APP

先安装 Android Studio 2025.2.1 或更新版本，并在 SDK Manager 中安装 Android SDK 36。随后在项目根目录运行：

```bash
pnpm android
```

脚本会自动安装锁定依赖、运行测试与检查、静态导出 `/app`、同步 Capacitor、生成校徽图标与启动图，并输出可直接安装的 debug APK：

```text
outputs/android/njust-campus-map-0.1.0-debug.apk
```

APK 内置地图、路网和导航界面，不依赖 Web 部署；实时小米天气仍需联网。Android 定位使用原生精确定位权限，网页版本继续使用浏览器定位与现有 `/api/weather` 代理。

发布 APK 需要已有的 Android keystore，并通过环境变量传入签名信息（脚本不会把密码写入文件）：

```bash
export ANDROID_KEYSTORE_PATH=/absolute/path/to/release.jks
export ANDROID_KEYSTORE_PASSWORD='你的仓库密码'
export ANDROID_KEY_ALIAS='你的别名'
export ANDROID_KEY_PASSWORD='你的密钥密码'
pnpm android:release
```

生成 Google Play AAB 使用 `pnpm android:bundle`。可以用 `ANDROID_VERSION_CODE` 和 `ANDROID_VERSION_NAME` 覆盖发布版本；使用 `pnpm android web` 只验证 APK 内的静态网页，使用 `--skip-checks` 可跳过测试与 lint。首次原生构建需要联网下载 Gradle/Maven 依赖。

重新生成几何纠偏底图：

```bash
pnpm basemap:guide
```

## 推荐标注顺序

1. 默认载入几何纠偏后的江阴校区导览图，以及随应用发布的真实标注路网（173 个节点、215 条通行段、18 个地点、6 个通行面）。底图和路网都是本地文件，不依赖地图 API、密钥或在线瓦片。
2. 用“直线路径”标注普通步道；连续点击会连接节点，点击已有曲线附近时会按固定的屏幕半径自动吸附并拆分原通行段。续画时不会再吸回当前起点，也不会被相邻线段投影回该起点；需要完全自由落点时按住 `Option`（macOS）或 `Alt`（Windows/Linux）再点击。地图可放大到 500%，用于标注很短的支路。
3. 用“曲线路径”沿弯路依次放置控制点，再点击“完成当前绘制”。控制点越密，形状越贴近导览图。
4. 用“通行面”圈出可以自由斜穿的运动场、广场或草坪。区域内的通行节点会自动建立可见直达路线。
5. 若通行面里有看台、球网区、花坛或施工区，用“障碍物”圈出；自动路线会绕过它。
6. 用“楼内穿行”标注教学楼中允许借道的走廊。两端自动成为门户，默认是室内、100% 遮阴、仅校内人员、每日 07:00–22:00 开放；这些属性都能在右侧修改。
7. 新建二层、地下层等层级后，用“跨层连接”标注楼梯、电梯或坡道。无障碍方案会自动排除楼梯。
8. 用“地点”添加可搜索的起点和目的地；地点经纬度由统一校准换算。
9. 检查右侧“网络检查”，处理自交边界、无连接区域、错误跨层类型和校准质量提醒，再导出 JSON。

所有编辑会自动保存在当前浏览器的 `localStorage`，也可以导出为 v2 JSON；已有用户数据始终优先于内置路网。旧版本若只保存了未经编辑的 12 个参考地点空壳，启动后会自动恢复内置路网；一旦存在用户新增内容则不会替换。载入旧 `map.jpg`、历史 `campus-guide-refined.jpg`、上一版 `campus-guide-georectified.png` 或可选矢量底图的数据时，节点、曲线、区域和障碍物会先换算到 WGS-84，再进入新版固定网格；显式保存的经纬度优先。上一版纠偏图与高清图共享相同网格，因此升级时坐标保持不变。未知且没有控制点的底图会拒绝迁移，避免静默错位。

## 导航能力

导航模式支持手动输入已标注地点，也支持浏览器或原生 App 高精度持续定位。定位启动后会持续更新当前位置并跟随居中，位置刷新不会清除正在显示的路线。尚未直接连接路段的参考地点会在计算时接入最近的已标注道路，因此不会再因孤立地点而丢失导航路线。一次会计算五种方案：

- 最快：以有效通行距离和跨层成本为主。
- 均衡：晴天时在距离之外轻度考虑实时直晒。
- 少晒：晴天时优先建筑投影阴影、连廊和室内教学楼通道。
- 避雨：显著偏好室内和有顶环境。
- 无障碍：排除楼梯及未声明轮椅可通行的路径，偏好电梯和坡道。

每次查询都会根据出发时刻重新检查开放星期、开放时间、校内/访客身份、临时关闭状态和单向限制。楼内通道关闭后不会进入候选路线，而不是只显示一条事后警告。

### 晴天建筑阴影

日晒计算只在小米天气将所选出发时刻判定为“晴”（天气码 `0`）且太阳位于地平线以上时启用。当前小时使用实时观测，未来时间严格匹配逐小时预报；天气不可用、超出逐小时预报范围、多云或降水时关闭日晒权重，不回退到旧的室外人工遮阴比例。

模型只包含导览图上标明的 20 栋学生宿舍和 7 栋“致”字楼，共 27 个长方体：所有宿舍高 `35 m`，致理楼、致新楼、致知楼、致真楼、致道楼、致源楼、致远楼均高 `30 m`，其他建筑不参与投影。太阳高度角和方位角按江阴校区中心、所选绝对时间计算；阴影长度使用 `建筑高度 / tan(太阳高度角)`，方向与太阳方位相反。地图会显示同一组二维投影多边形，路线引擎也直接求道路折线落入这些多边形的实际长度。

建筑平面范围是从当前纠偏导览图人工贴合的定向矩形，并非测绘轮廓；因此太阳位置和投影公式是物理计算，建筑边界精度仍受底图约 `10–20 m` 的校准误差及长方体简化限制。更换或导入不受支持的底图会关闭该模型，避免错位投影。

开发时可打开 `/debug_sunshine` 独立界面。该页面固定模拟晴天，不读取天气服务；日期控件与 `00:00–23:59` 时间滑动条直接驱动同一套太阳位置和建筑投影算法，适合检查清晨、正午、傍晚及夜间的阴影变化。

## 底图处理、精度与校准

默认底图修订号为 `njust-jiangyin-guide-georectified-high-2026-08-30`。新图与旧校准画幅的 40 个特征块全部匹配，几何拟合 RMS 为 `0.0193` 个旧图像素，因此无需重估控制点；生成脚本沿用 12 个校界控制点得到的全局仿射，将 `7500×4710` 原像素重采样到固定范围 `120.14590–120.16115°E / 31.90105–31.90918°N`。输出使用无损 RGB PNG，当前 SHA-256 为 `d7ee892f3d74471b01527f4fe62b17d22afca3509e7de5da5d7f35f8ac009c14`。完整矩阵和说明见 `data/campus-guide-georectification.json` 与 `docs/BASEMAP.md`。

几何纠偏消除了原图坐标系的整体旋转、错切和横纵比例差，使图像与标注共享可逆的北向上网格；它不会把开放数据变成测绘真值。源模型拟合 RMS 为 `11.38 m`、留一 RMS 为 `15.85 m`、最大控制点残差为 `18.82 m`，所以仍只适合路线绘制、地点检索和校园内方向表达，不应作为测绘图、施工图或米级入口判定依据。道路、桥头、建筑入口和施工变化需要现场 GNSS 或校方测绘数据复核。

可选的 `public/campus-precise.svg` 使用 OpenStreetMap 校界和 Overture 建筑轮廓，将导览图放进可逆的 WGS-84 参考框架，便于检查整体朝向、边界和建筑相对位置。开放建筑轮廓并不会自动纠正原导览图中的示意道路，也不会让路线达到测绘级精度。

有校准时，曲线路线会在本地米制空间中自适应细分并计算长度；寻路权重、显示距离和预计时间都使用米。浏览器定位可以从长路段中间或自由通行面内部接入网络。定位使用 `enableHighAccuracy: true`，需要 HTTPS 或 `localhost`；实际精度仍取决于设备、环境和校准质量。

用户提供的百度页面只作为人工视觉核对入口；项目不会下载、缓存或打包百度瓦片或截图。可选校核层的数据与许可依据：[Overture attribution](https://docs.overturemaps.org/attribution/)、[Overture Buildings](https://docs.overturemaps.org/guides/buildings/)、[OpenStreetMap copyright](https://www.openstreetmap.org/copyright)、[W3C Geolocation](https://www.w3.org/TR/geolocation/#coordinates_interface)。

## v2 数据模型

节点和几何点使用 `0..1` 归一化坐标，因此页面缩放不会造成标注偏移。导出文件的核心结构如下：

```json
{
  "version": 2,
  "map": {
    "image": "campus-guide-georectified-high.png",
    "width": 2038,
    "height": 1279,
    "basemapRevision": "njust-jiangyin-guide-georectified-high-2026-08-30"
  },
  "levels": [{ "id": "level-ground", "name": "地面层", "elevationMeters": 0 }],
  "nodes": [
    {
      "id": "node-a",
      "x": 0.2,
      "y": 0.4,
      "levelId": "level-ground",
      "kind": "portal"
    }
  ],
  "places": [{ "id": "place-a", "name": "图书馆", "nodeId": "node-a" }],
  "links": [
    {
      "id": "link-a",
      "from": "node-a",
      "to": "node-b",
      "kind": "building-passage",
      "direction": "both",
      "geometry": [
        { "x": 0.2, "y": 0.4 },
        { "x": 0.4, "y": 0.45 }
      ],
      "environment": { "setting": "indoor", "shade": 1 },
      "access": {
        "audience": "campus",
        "wheelchair": true,
        "temporarilyClosed": false
      },
      "costMultiplier": 1
    }
  ],
  "areas": []
}
```

`lib/campus-navigator.ts` 是唯一的导航入口。它在内部把通行段、自由通行面和障碍物编译为统一网络，再执行动态准入过滤和加权最短路径搜索；React 页面不直接依赖寻路内部结构。
