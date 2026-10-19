# Earth Timeline · 地球时空演化图谱

Web 端交互式 3D 地球历史探索应用。在线访问：**https://mblackcat.github.io/earth-timeline/**

产品需求与实施规范见 [`PLAN.md`](PLAN.md)，任务进度、架构说明与已知问题见 [`TASKS.md`](TASKS.md)，**接力开发请先读 [`HANDOFF.md`](HANDOFF.md)**。

> 当前进度：Phase 0–7 主体完成（地球与相机、时间引擎、时间轴、历史事件与代表性生物、生物模型与动画、0–18 亿年古地理），界面为"纸面墨线 + 漫画网点"风格；v0.1.0 已发布到 GitHub Pages。

## 环境要求

- Node.js ≥ 20（开发时使用 22.22）
- npm ≥ 10
- 支持 WebGL 的桌面浏览器（Chrome / Edge / Firefox / Safari）
- 端到端测试需要本机安装 Google Chrome（或改用 Playwright 自带 Chromium，见下文）

## 安装与运行

```bash
npm install
npm run dev          # http://localhost:5173
```

| 命令 | 作用 |
|---|---|
| `npm run dev` | 启动开发服务器（端口 5173） |
| `npm run build` | TypeScript 检查 + 生产构建到 `dist/` |
| `npm run preview` | 本地预览生产构建 |
| `npm run typecheck` | TypeScript 严格模式检查 |
| `npm run lint` | ESLint |
| `npm test` | 单元 / 组件测试（Vitest + jsdom） |
| `npm run test:e2e` | 浏览器端测试（Playwright，自动启动开发服务器，真实 WebGL 渲染） |

使用 Playwright 自带 Chromium 运行端到端测试：

```bash
npx playwright install chromium
E2E_BROWSER_CHANNEL=chromium npm run test:e2e
```

## 发布

在 main 上打 `v*` 标签即自动发布到 GitHub Pages（`.github/workflows/deploy-pages.yml`：typecheck + lint + 单元测试 → 以 `/earth-timeline/` 为 base 构建 → 部署）：

```bash
git tag -a v0.2.0 -m "v0.2.0: 说明"
git push origin v0.2.0
```

- 标签必须指向 main 上的提交，否则工作流拒绝发布。
- 也可在 GitHub Actions 页面手动运行该工作流（从 main）。
- 本地验证子路径构建：`VITE_BASE=/earth-timeline/ npx vite build && VITE_BASE=/earth-timeline/ npx vite preview`，访问 `http://localhost:4173/earth-timeline/`。

## 操作方式

| 操作 | 效果 |
|---|---|
| 左键拖动 | 旋转地球 / 在近景中平移区域（速度随高度自适应） |
| 右键拖动 或 Shift + 左键拖动 | 调整朝向与倾斜（仅近地表可倾斜） |
| 滚轮 / 触控板捏合 | 按高度比例缩放，范围约 127 km – 38,000 km |
| 双击地表 | 飞向该点并拉近 |
| 顶部「返回全球视角」 | 保持当前经纬度，拉远到全球视角 |
| 顶部「重置视角」 | 回到默认视角 |
| 底部 | 时间轴（拖动定位、滚轮缩放、点击事件跳转、点击年代色块缩放）+ 播放 / 暂停 + 倍速 |
| 右侧面板 | 播放参数、时间轴刻度、图层、视觉风格（线稿 + 网点 / 线稿 / 白模）与模型细节、动画与低性能模式；可折叠 |
| 场景左上角「此时期」 | 当前可见的代表性生物与事件，点击查看详情与来源 |
| 详情中「近距离观察」 | 按真实比例观察生物模型与动画 |
| 顶部「帮助」 | 全部操作说明与时间轴图例 |

## 目录结构

```text
src/
├── app/            App 布局、错误边界
├── components/     DOM UI：TopBar、Help、SettingsPanel、Timeline、Scene（此时期 / 详情）、Specimen（观察窗）
├── scene/          R3F 3D 场景
│   ├── EarthScene/       Canvas、地球（网点海洋 + 陆地遮罩）、球体轮廓、经纬网、地理数据说明浮层
│   ├── CameraController/ 球面相机模型（纯 TS）与 R3F 绑定
│   ├── Terrain/          古地理 / 现代轮廓与参考海岸线
│   ├── Living/           化石点、事件标记、地球上的生物模型（LOD1）
│   ├── Models/           程序化低多边形模型、关节动画、动画时钟
│   ├── Specimen/         近距离观察窗的局部场景
│   ├── Ink/              墨线 + 网点：色板、网点材质、外轮廓材质、陆地遮罩
│   └── Wireframe/        球面折线组件
├── timeline/       TimeEngine、PlaybackController、CalendarAdapter、TimeScale
├── data/           schema、events、species、visuals、sources、regions、geology（年代表 / 古地理切片）
├── simulation/     可见性、古坐标参考系、行为系统
├── state/          Zustand stores（时间镜像、设置、视图、选择、场景、地理）
└── utils/          坐标、层级、多边形融合、示意地形
public/data/        按需加载的静态数据（海岸线、重建切片、化石点、古坐标）
e2e/                Playwright 浏览器测试
scripts/            数据生成（PBDB、GPlates）与调试截图
```

## 关键约定

- **时间**：内部统一使用"距今年数" `yearsAgo`（0 = 现代基准，正数 = 过去）。时间范围 `{ fromYearsAgo, toYearsAgo }` 满足 `from >= to`，两端闭区间。数据文件可用 Ma 书写，载入时转换。
- **坐标**：地球半径 = 1 场景单位；Y 轴指向北极，经度 0° 指向 +Z。
- **科学数据与视觉表现分离**：事件 / 物种只引用视觉资产 id。
- **古地理**：`PaleoGeographyProvider.resolve(yearsAgo)` 返回 `exact / fallback / missing`；缺少数据时显示"暂无古地理重建数据"，不会把现代海岸线当作古地理事实。

## 数据来源

| 数据 | 来源 | 许可 | 用途 |
|---|---|---|---|
| 现代陆地轮廓 | [Natural Earth 1:110m Land](https://www.naturalearthdata.com/downloads/110m-physical-vectors/110m-land/) | 公有领域 | 全新世（约 1.17 万年前至今）的**示意**轮廓，界面中标注"示意数据" |
| 板块重建 | [Cao et al. 2024](https://doi.org/10.1016/j.gsf.2024.101922) · CAO2024 模型，经 [GPlates Web Service](https://gwsdoc.gplates.org/) | 模型数据 CC BY 4.0 | 0–1800 Ma 大陆位置与化石点 / 事件古坐标 |
| 化石记录 | [Paleobiology Database](https://paleobiodb.org/) | CC BY 4.0 | 代表性生物的化石点 |
| 地质年代 | [ICS 国际年代地层表 v2024/12](https://stratigraphy.org/ICSchart/ChronostratChart2024-12.pdf) | — | 宙 / 代 / 纪 / 世边界 |
| 事件与物种年代 | 期刊论文与专著（逐条见 `src/data/sources`，DOI 经 Crossref 核对） | — | 年代、不确定范围与证据说明 |

## 测试

见 TASKS.md 的「阶段完成记录」中每阶段的测试命令与结果。
