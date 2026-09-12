# 内容与素材来源

本片只使用当前项目文件和用户提供的本地音效，没有下载外部影像、音乐或字体。

| 内容 | 项目依据 | 画面边界 |
| --- | --- | --- |
| 校园原始导览图 | `../public/campus-guide-georectified-high.png` | 只做缩小、JPEG 编码和轻度降饱和，未改写原图文字 |
| 扁平地图建筑与水体 | `../public/campus-precise.svg` | 复用建筑轮廓和原有低置信度水体示意；为宣传片简化样式，不作为测绘地图 |
| 路网与地点 | `../data/campus-map-default.json` | `scripts/assets.ts` 提取真实标注与道路几何 |
| 步行路线与估时 | `../lib/campus-navigator.ts` | 对固定出发时刻 2026-09-14 08:00 +08:00 实际调用寻路；775 米 / 11 分钟、261 米 / 4 分钟等为该输入的结果，非普遍承诺 |
| 五种方案 | `../lib/campus-model.ts`、`../lib/campus-navigator.ts` | 最快、均衡、少晒、避雨、无障碍；路线条带是功能图解 |
| 天气与日晒 | `../lib/xiaomi-weather.ts`、`../lib/campus-sunlight.ts` | 28° 为示例；晴天、天气可用等条件在画面注明 |
| 建筑阴影、连廊、坡道 | 导航环境和权重规则 | 原创等轴测示意；不声称是某栋真实建筑的精确模型 |
| 持续定位及路线更新 | `../app/app/app-page.tsx`、`../app/app/use-device-heading.ts` | 路线几何来自项目计算；动态位置是演示，不声称完成实机定位或传感器验收 |
| 课表导入 | `../app/app/student/jw-import.tsx`、`../lib/student/import.ts` | 教务导入及 XLS / XLSX；演示账号和虚构课程，不使用个人凭据 |
| 周次、13 小节 | `../lib/student/calendar.ts`、`../app/app/student/student-hub.tsx` | 使用真实小节时间和第 4 周日期；课程仅为示例 |
| 课程到地点、日程 | `../lib/student/places.ts`、`../lib/student/planner.ts` | 以示例课程解释产品能力 |
| 校徽 | `../public/icon-sc-transparent.png` | 原样复用项目已有素材 |
| 字体 | `../fonts/STHeiti.ttc`、`../fonts/Montserrat-Medium.ttf`、系统 SFNS.ttf | 子集放入 `assets/fonts`；使用范围沿用原字体许可 |
| 音效 | `sfx/` 下七个明确列入音效报告的 MP3 | 保留原文件；不使用 BGM、alarm 或 magic；每个来源哈希见音效报告 |

实现参考：项目 `视频风格.md`、`fourier-best-pratice.md`，本地 Fourier SDK 2.5.0 文档，以及既有 Fourier Styles 手绘路径、地图组件的声明式动画结构。地图、路径、手机界面和建筑图解根据本项目重新组合；没有把其他产品片当作视频素材嵌入。当前没有可调用的 Fourier World 搜索连接，采用本地组件与 SDK 示例检索。

San Francisco / 黑体负责界面和中文，Montserrat Medium 仅用于结尾产品名。品牌色以纸白、石墨黑、雾蓝、灰绿为主。原始素材和音效文件没有覆盖。
