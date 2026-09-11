# 江阴校区底图

路线标注默认使用 `public/campus-guide-georectified-high.png`。它以用户提供的高清 `map-high.jpg` 为像素来源，通过全局仿射重采样到固定、北向上的 WGS-84 网格；建筑、道路、水体和中文名称均来自原像素，不使用生成式重绘。`public/campus-precise.svg` 是同范围的独立开放数据校核层，不替代默认导览图。

## 默认几何纠偏底图

| 字段         | 固定值                                                             |
| ------------ | ------------------------------------------------------------------ |
| 源文件       | `map-high.jpg`                                                     |
| 源像素尺寸   | `7500 × 4710`                                                      |
| 输出文件     | `public/campus-guide-georectified-high.png`                        |
| 输出像素尺寸 | `7500 × 4710`                                                      |
| 逻辑画布     | `2038 × 1279` SVG 坐标空间                                         |
| 修订号       | `njust-jiangyin-guide-georectified-high-2026-08-30`                |
| CRS          | `EPSG:4326` / WGS-84                                               |
| 范围         | `120.14590–120.16115°E`、`31.90105–31.90918°N`                     |
| SHA-256      | `d7ee892f3d74471b01527f4fe62b17d22afca3509e7de5da5d7f35f8ac009c14` |

旧图归一化坐标 `(x, y)` 按下式进入新版坐标 `(x′, y′)`：

```text
x′ =  0.953049188183460 x + 0.027032500055909 y + 0.009791071421222
y′ = -0.028335415588065 x + 0.941544114138144 y + 0.042666112736829
```

源像素到目标像素的矩阵为：

```text
X =  0.953049188183460 x + 0.043045382254632 y + 73.4330356591650
Y = -0.017794640989305 x + 0.941544114138144 y + 200.957390990465
```

归一化矩阵行列式为 `0.89810`，条件数为 `1.0298`，没有镜像或局部折叠。它实际改变像素位置，例如在旧逻辑画布中西南校界移动约 85 像素，所以未经纠偏的旧图不能继续使用坐标恒等映射。机器可读配置位于 `data/campus-guide-georectification.json`。

生成器在 `7500×4710` 原分辨率上调节可读性，再补 944 像素浅色背景、三次插值仿射、裁回 `7500×4710`，最后锐化并输出无损 RGB PNG。应用仍将它映射到 `2038×1279` 逻辑画布，因此现有归一化标注无需按像素尺寸缩放；高清像素只提高缩放时的清晰度。补边避免 FFmpeg 把画幅边缘道路向外拉丝，无损输出避免中文标签再次受到 JPEG 色度抽样损失。

```bash
pnpm basemap:guide
```

固定可读性滤镜为：

```text
eq=contrast=0.94:brightness=0.035:saturation=0.78,
unsharp=5:5:0.45:5:5:0
```

历史 `public/campus-guide-refined.jpg` 只做过调色和锐化，保留用于旧数据识别与迁移，不再是默认底图。

### 标注迁移

旧 `map.jpg`、历史精修 JPEG、上一版 `campus-guide-georectified.png` 和其他具有有效校准的底图统一执行：

```text
旧归一化坐标 → 旧底图校准 → WGS-84 → 新固定网格
```

节点、曲线、区域、障碍物、ID 和图拓扑一起迁移；若节点已保存显式 WGS-84，则以该坐标为准。上一版纠偏图与高清纠偏图共享同一固定网格，迁移后归一化坐标不漂移。未知且没有至少三个分散控制点的底图会拒绝迁移，避免静默错位。

## 精度边界

这次修改纠正的是图像坐标系的整体旋转、错切、横纵比例和固定地理范围，不是新的现场测量。12 个源控制点来自 OpenStreetMap `way/1314812014` 的影像描绘校界，用户给出的百度卫星页只用于人工布局核对。模型比较后选择全局仿射，因为它的留一验证优于无平滑 TPS、投影和二次模型。

| 指标                 |                    结果 |
| -------------------- | ----------------------: |
| 未纠偏控制点像素 RMS |                47.08 px |
| 纠偏后控制点像素 RMS |                16.09 px |
| 系统像素错位下降     |                   65.8% |
| 控制点数             |                      12 |
| 控制点覆盖率         |                  61.89% |
| 拟合 RMS             |                 11.38 m |
| 留一 RMS             |                 15.85 m |
| 最大控制点残差       |                 18.82 m |
| 当前质量声明         | `needs-review` / 参考级 |

高清源图与旧校准图另做了画幅一致性检查：40/40 个高梯度特征块匹配，归一化拟合残差 RMS 为 `0.0193 px`、最大值为 `0.0652 px`（均按旧 `2038×1279` 图尺度计）。因此本次更换只提升像素清晰度，不改变现有地理控制点或精度等级。

固定网格的四角往返误差接近零，只能证明投影可逆；它不能证明图内道路、入口或建筑达到零误差。底图适合路线绘制、地点检索和方向表达，不适合测绘、施工放样、产权边界、应急入口或米级无障碍路径判定。

若要把实际定位精度提高到约 `3–5 m`，需要校方测绘资料或现场 GNSS：至少补充南门、西门、稳定建筑角、桥头和内部路口，并保留五个不参与拟合的独立检查点。东侧宿舍、教师公寓和施工区域变化较大，在实测前不应仅凭旧导览图自动生成通行路线。

## 可选 WGS-84 校核层

`public/campus-precise.svg` 是固定范围、北向上的离线地理参考图，可用来检查原导览图的整体朝向、校园边界和建筑相对位置。它不是默认路线标注底图，也不包含足够可靠的校内道路、入口或实时施工信息。

| 字段   |              固定值 |
| ------ | ------------------: |
| CRS    | `EPSG:4326` / WGS84 |
| west   |         `120.14590` |
| east   |         `120.16115` |
| north  |          `31.90918` |
| south  |          `31.90105` |
| width  |              `2038` |
| height |              `1279` |

经纬度按范围线性映射到 SVG 像素，北方始终朝上：

```text
x = (longitude - west) / (east - west) * 2038
y = (north - latitude) / (north - south) * 1279

longitude = west + x / 2038 * (east - west)
latitude  = north - y / 1279 * (north - south)
```

该映射可以确定性往返，但“投影可逆”不表示其中的地物达到测绘精度。OSM 校界是基于影像描绘，Overture 建筑来自开放建筑数据；它们只能辅助发现明显的整体错位。特别是，叠加建筑轮廓不会自动修正原导览图中的示意道路。

### 校核层数据

- `data/campus-boundary.geojson`：OpenStreetMap `way/1314812014` 校界 Polygon。
- `data/campus-buildings.geojson`：校界内过滤后的 85 个 Overture Maps 建筑 Polygon。
- `data/campus-schematic-context.json`：从旧导览图提取的低置信度示意上下文及历史仿射系数。

重新生成和检查可选 SVG：

```bash
pnpm basemap:vector
xmllint --noout public/campus-precise.svg
```

生成器完全离线，不会下载地图瓦片。SVG 根元素保留 CRS 和范围属性，开放建筑路径保留 Overture ID；图中的旧导览示意要素带有低置信度、非测量来源声明。

## 来源与许可

- 默认纠偏底图：用户提供的校园导览图，仅在本项目中作为路线标注和视觉参考。
- 校界：© OpenStreetMap contributors，ODbL 1.0。
- 建筑主题：© Overture Maps Foundation，ODbL 1.0。
- 建筑上游：East Asian Buildings，CC BY 4.0，`doi:10.5281/zenodo.8174931`。

用户提供的百度页面只作为人工视觉核对入口。项目不下载、缓存、描摹或打包百度瓦片和截图；需要在线卫星图时应使用百度官方 API 和有效 AK。导出或分发 `campus-precise.svg` 时，应保留其 OpenStreetMap、Overture 和 East Asian Buildings 署名。

参考：[OpenStreetMap way 1314812014](https://www.openstreetmap.org/way/1314812014)、[OpenStreetMap copyright](https://www.openstreetmap.org/copyright)、[Overture Buildings](https://docs.overturemaps.org/guides/buildings/)、[Overture attribution](https://docs.overturemaps.org/attribution/)、[百度地图开放平台服务条款](https://lbsyun.baidu.com/docs/pcsa?title=law%2Fopen%2Flaw)。
