# Earth Through Time · 地球时空演化图谱

Web 端交互式 3D 地球历史探索应用。产品需求与实施规范见 [`PLAN.md`](PLAN.md)，任务进度、架构说明与已知问题见 [`TASKS.md`](TASKS.md)。

> 当前进度：**Phase 0（工程初始化）与 Phase 1（3D 地球与相机）已完成**。时间引擎、时间轴、历史数据、生物模型等尚未实现（见 TASKS.md）。

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

## 操作方式

| 操作 | 效果 |
|---|---|
| 左键拖动 | 旋转地球 / 在近景中平移区域（速度随高度自适应） |
| 右键拖动 或 Shift + 左键拖动 | 调整朝向与倾斜（仅近地表可倾斜） |
| 滚轮 / 触控板捏合 | 按高度比例缩放，范围约 127 km – 38,000 km |
| 双击地表 | 飞向该点并拉近 |
| 顶部「返回全球视角」 | 保持当前经纬度，拉远到全球视角 |
| 顶部「重置视角」 | 回到默认视角 |
| 右侧面板 | 经纬网 / 大陆轮廓显示开关；面板可折叠 |

## 目录结构

```text
src/
├── app/            App 布局、错误边界
├── components/     DOM UI：TopBar、SettingsPanel、Timeline（占位）等
├── scene/          R3F 3D 场景
│   ├── EarthScene/       Canvas、地球、大气、经纬网、地理数据说明浮层
│   ├── CameraController/ 球面相机模型（纯 TS）与 R3F 绑定
│   ├── Terrain/          古地理 / 现代示意轮廓渲染
│   └── Wireframe/        线稿通用组件与统一色板
├── timeline/       时间相关（Phase 2 起：TimeEngine 等）
├── data/
│   ├── schema/     数据契约（事件 / 物种 / 视觉资产 / 来源 / 古地理切片）
│   ├── geology/    古地理切片索引与 PaleoGeographyProvider
│   └── sources/    数据来源登记
├── simulation/     场景解析、动画、行为（Phase 5 起）
├── state/          Zustand stores（时间镜像、设置、视图、地理）
└── utils/          经纬度与球面坐标、空间层级
public/data/        按需加载的静态数据（地理轮廓 JSON）
e2e/                Playwright 浏览器测试
scripts/            调试截图脚本
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

## 测试

见 TASKS.md 的「阶段完成记录」中每阶段的测试命令与结果。
