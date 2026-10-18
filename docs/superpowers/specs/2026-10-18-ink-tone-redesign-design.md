# 墨线 + 网点改版设计（Ink & Tone Redesign）

- 日期：2026-10-18
- 状态：已获用户确认
- 参考：隔壁项目 ai-score（`../ai-score/apps/web/src/index.css` 的纸面 / 墨线设计变量）；示例站点「随处勘景」（three.js 渲染的漫画背景线稿 + 网点）
- 样稿：`.superpowers/brainstorm/`（不提交）

## 1. 目标与决策

把现在"深色底 + 青色线框"的界面改成**纸面墨线 + 漫画网点**风格。

| 决策 | 选择 |
|---|---|
| 范围 | A 界面外壳 → B 地球 → C 生物模型，三块都做，按此顺序实施，每块完成后截图确认 |
| 地球画法 | 样稿 B「网点海洋」：海洋铺网点，背光侧网点加粗、边缘涂黑（ベタ），陆地留白，墨色海岸线 |
| 时间轴配色 | 保留 ICS 标准色，与纸色按 55% 混合成淡彩；整页唯一的彩色区域 |
| 物种颜色 | 只保留在化石点上（降饱和 + 墨色描边）；模型一律墨线 + 网点，纸白底 |
| 渲染技术 | 方案 1：材质内实现屏幕空间网点 + 几何描线（`EdgesGeometry` 折边线 + 背面外扩外轮廓）；不引入后处理管线 |
| 视觉风格三档 | 线稿 `line` / 线稿+网点 `tone`（默认）/ 白模 `plain` |

不在本次范围：Phase 8 的代码分割与性能测量（改版完成后继续）、"固有色"滑块、后处理描线（以后可只替换描线部分升级）。

## 2. 共享模块 `src/scene/Ink/`

### 2.1 `inkPalette.ts`
替换 `scene/Wireframe/palette.ts`。取值与 ai-score 一致：

```
paper  #f2f3f0   纸（画布背景）
sheet  #f7f8f5   白纸（陆地、模型底色、卡片）
ink    #171917   墨
ink2   #5c615c
ink3   #8e938d
rule   #c5c8c2   浅线（线稿档经纬网、地面等高线）
mark   #9c1c1c   红笔（选中、当前、重大事件）
```

### 2.2 `toneMaterial.ts` 网点材质
- 在 `MeshLambertMaterial` 上通过 `onBeforeCompile` 注入片元着色器。
- 明暗值 `d = 1 − 漫反射亮度`。屏幕空间 45° 网格，单元约 4 CSS 像素（乘以 dpr），点半径 ∝ √d；`d` 超过涂黑阈值时输出墨色。
- 统一入口：`createToneMaterial({ base, mode, landMask? })`，`mode` 取值：
  - `line`：只输出底色，不画网点
  - `tone`：网点 + 涂黑
  - `plain`：平滑灰阶，不画网点
- 支持 uniform 热切换 `mode`，切换风格时不重建材质。
- **光源跟随相机**：方向光固定在视角左上方（视空间方向），不使用真实太阳方向。保证任何视角下都是"左上亮、右下网点渐密、边缘涂黑"。

### 2.3 `landMask.ts` 陆地遮罩
- 纯函数 `unwrapRing(ring)`：把经度展开为连续值，即相邻点差超过 180° 时加减 360°。
- `drawLandMask(ctx, outlines, width, height)`：在等距圆柱 canvas（默认 4096×2048）上填充陆地多边形，每个环在 0、±360° 偏移处各画一次，以处理跨 ±180° 和极地环（南极洲）。
- `useLandMaskTexture(outlines)`：切片轮廓变化时重建 `CanvasTexture` 并释放旧纹理。
- 着色器按片元的经纬度采样遮罩：陆地取 `sheet`，并只在背光侧叠很淡的网点；海洋走网点逻辑。
- 遮罩不可用（未加载、无数据）时退化为全部海洋网点，不报错。

## 3. 地球（B）

- `Globe`：海洋材质改用网点材质（带陆地遮罩）。
- `GeographyOutlines`：海岸线改为墨色；现代海岸线参考层改为 `ink3`、虚弱化。
- `Graticule`：`tone` 档用纸色细线（叠在网点上），`line` / `plain` 档用 `rule` 浅线。
- 删除 `Atmosphere` 和 `Stars`。新增 `GlobeRim`：背面外扩球体（半径 ×1.006，`BackSide`，墨色），作为球体轮廓线。
- 画布背景为 `paper`。
- 场景结构、加载状态、"示意数据"说明保持不变。

## 4. 生物模型、观察窗与标记（C）

### 4.1 风格枚举
- `settingsStore.VisualStyle`：`"wireframe" | "solid" | "hybrid"` 改为 `"line" | "tone" | "plain"`，默认 `"tone"`。设置未做持久化，不需要迁移。
- `rig.ts` 的 `Style` 与 schema 中 `VisualizationAsset.style` 同步修改；13 个视觉资产全部设为 `"tone"`。

### 4.2 `applyStyle`（`scene/Models/rig.ts`）
- 填充：网点材质，底色 `sheet`，不再使用物种色。
- 折边线：`EdgesGeometry`，LOD0 阈值 28°，LOD1 阈值 50°，墨色。
- 外轮廓：每个部件附加一个背面外扩网格（沿法线外扩，`BackSide`，墨色）。
- 各档组成：

| 档位 | 填充 | 折边线 | 外轮廓 |
|---|---|---|---|
| `tone` | 网点 | 有 | 有 |
| `line` | 白底 | 有 | 有 |
| `plain` | 灰阶 | 无 | 无 |

- LOD1（地球上图标尺寸的小模型）：在 `tone` 档下也不画网点（只有外轮廓 + 白底），避免网点在小尺寸下成噪声。
- 新增的网格和材质纳入 `Rig.dispose()`。

### 4.3 近距离观察窗
- 背景 `paper`；地面使用网点材质；等高线改用 `rule`。
- 风格切换按钮改为三档（线稿 / 线稿+网点 / 白模）。

### 4.4 标记
- 化石点：物种色与纸色混合降饱和 + 墨色描边；选中物种用 `mark` 并加粗。
- 事件标记（`Html`）：白纸底、1px 墨框、直角；重大事件（大灭绝类）用 `mark`。
- 物种色仍由 `speciesColors.ts` 提供，并在详情卡片中使用降饱和后的颜色。

## 5. 界面外壳（A）

- `styles.css` 改用 ai-score 设计变量（`--desk --paper --sheet --ink --ink-2 --ink-3 --rule --mark`），替换深色变量。
- 全局：1px 线、直角、无阴影；`body::before` 叠一层 SVG `feTurbulence` 噪点纸纹（`opacity .14`，`multiply`，`pointer-events: none`）。
- 字体使用系统字体，不下载 web font：
  - 标题：`"Noto Serif SC", "Songti SC", serif`
  - 正文：`"IBM Plex Sans", "PingFang SC", "Noto Sans SC", sans-serif`
  - 数字：`font-variant-numeric: tabular-nums`
- 外框：灰色桌面边框 + 1px 墨色外框。
- 顶部：墨色方块 logo、衬线标题与 `EARTH THROUGH TIME` 小字、大号当前时间、年代路径（当前的世用 `mark`）。
- 按钮：普通按钮是透明底 + `rule` 边框，悬停时边框变墨色；选中态墨底白字；播放按钮是墨色胶囊。
- 卡片（此时期、地理说明、详情卡、观察窗、帮助弹层）：`sheet` 底 + `rule` 边框，直角。
- 时间轴：ICS 色与纸色按 55% 混合；当前所在的宙 / 代 / 纪加 `mark` 下划线；当前时间指示线用 `mark`；事件类别颜色降饱和。
- **不变**：布局尺寸（顶部 52px、底部 164px）、组件结构、全部 `data-testid`。

## 6. 测试与验证

- **单元测试**
  - `unwrapRing`：跨 ±180°、极地环、普通环。
  - 颜色混合函数。
  - 三档风格下模型的子对象组成（折边线 / 外轮廓 / 材质 mode）。
  - 风格切换不改时间、不重置相机（沿用已有断言）。
- **e2e**
  - 必须用 `arch -arm64` 启动（本机 shell 在 Rosetta 下，否则冷启动慢约 200 倍）。
  - `globe.spec` 中统计青色像素的断言改为统计墨色像素。
  - 修复已知过时断言（底部栏高度 88 → 164 等）。
  - 完整一轮在后台运行。
- **每个阶段收尾**：typecheck + lint + 单测 + 截图核查，并在 TASKS.md 记录。

## 7. 风险

- 屏幕空间网点在相机运动时会"贴在屏幕上"（漫画网点纸本来就是这种效果），可以接受；如果闪烁明显，再加点半径的平滑过渡。
- 背面外扩轮廓在极薄部件上可能穿插。外扩量按部件尺寸比例设定，在观察窗中逐个原型检查。
- 4096×2048 遮罩约 32 MB 显存（RGBA）。改用单通道 `RedFormat` 可降到约 8 MB；低性能模式用 2048×1024。
