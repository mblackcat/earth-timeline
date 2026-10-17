# Earth Through Time — 开发任务清单 (TASKS.md)

> 依据：`PLAN.md` v1.0（产品需求与实施规范，核心目标不变）。
> 状态标记：`[ ]` 未开始 · `[~]` 进行中 / 部分完成 · `[x]` 已完成并通过测试 · `[!]` 阻塞 / 需决策
> 规则：未经实际运行与测试的条目不得标为 `[x]`。

---

## 0. 环境检查记录（2026-10-16）

| 项 | 结果 |
|---|---|
| 工作目录 | 仅有 `PLAN.md`，无现有代码，非 git 仓库 |
| Node / npm | v22.22.0 / 10.9.4 |
| npm 源 | 可访问（three 0.186、@react-three/fiber 9.x、drei 10.x、zustand 5.x、vite 8.x、vitest 5.x、playwright 1.64） |
| 浏览器 | 本机 Google Chrome，可供 Playwright `channel: "chrome"` 做 WebGL 实测 |
| 后端 | 不需要（PLAN §8.1：第一阶段纯前端 + 本地静态数据） |

---

## 1. 第一阶段技术架构

### 1.1 技术选型（遵循 PLAN §8.1，无变更）

TypeScript · React 19 · Vite · Three.js · React Three Fiber + drei · Zustand · 自定义 CSS · Vitest + Testing Library · Playwright（真实 Chrome，验证 WebGL 渲染与交互）。

### 1.2 分层与依赖方向

```text
             ┌──────────────── UI 层 (React DOM) ────────────────┐
             │ TopBar · Timeline · PlaybackControls · Settings   │
             │ EventDetails · ObjectDetails                      │
             └───────▲───────────────────────────┬───────────────┘
        订阅(selector)│                           │ 调用 action / 命令
             ┌───────┴───────────── state/ (Zustand) ────────────┐
             │ timeStore(只读镜像) settingsStore viewStore        │
             │ selectionStore  cameraCommand                     │
             └───▲──────────────▲───────────────────┬────────────┘
      写入时间快照│     写入视图信息│                   │ getState() (useFrame 内读取，不触发 React 重渲染)
   ┌─────────────┴──┐   ┌─────────┴───────────────────▼────────────┐
   │ timeline/       │   │ scene/ (R3F)                            │
   │ TimeEngine      │   │ EarthScene · CameraController · Terrain │
   │ PlaybackCtrl    │   │ Wireframe · LivingObjects · Effects     │
   │ CalendarAdapter │   └─────────▲───────────────────────────────┘
   │ TimeScale       │             │ 可见对象列表
   └───────┬─────────┘   ┌─────────┴───────────────────────────────┐
           │ 当前时间     │ simulation/                             │
           └────────────►│ VisibilityResolver · SceneResolver      │
                         │ AnimationController · BehaviorSystem    │
                         └─────────▲───────────────────────────────┘
                                   │ 纯数据（不含渲染信息）
                         ┌─────────┴───────────────────────────────┐
                         │ data/ schema · events · species ·        │
                         │ geology(古地理切片 Provider) · sources    │
                         └─────────────────────────────────────────┘
```

依赖规则：`data/` 不依赖任何渲染代码；`timeline/` 是纯 TS，不依赖 React/Three；`simulation/` 只依赖 `data/` 与时间；`scene/` 只读状态，不修改模拟时间。

### 1.3 模块职责

| 模块 | 职责 | 引入阶段 |
|---|---|---|
| `src/timeline/TimeEngine.ts` | 唯一权威模拟时间；播放/暂停/方向/倍率/边界/单步/跳转；用 `performance.now()` 按真实经过时间推进；与 React 渲染无关 | Phase 2（Phase 0 只定义类型） |
| `src/timeline/PlaybackController.ts` | 拥有 rAF 循环，驱动 `TimeEngine.tick()`；处理页面失焦（`visibilitychange`）；把快照写入 `timeStore` | Phase 2 |
| `src/timeline/CalendarAdapter.ts` | 距今年数 ↔ 地质年代文本 / 公元前后（无公元 0 年）互转 | Phase 2/3 |
| `src/timeline/TimeScale.ts` | 时间轴分段/压缩映射：真实年代 ↔ 时间轴像素 | Phase 3 |
| `src/state/` | Zustand store：`settingsStore`（集中设置）、`viewStore`（相机距离/LOD 层级，场景写入）、`cameraCommand`（重置/全球视角命令）、后续 `timeStore`、`selectionStore` | Phase 0 起 |
| `src/scene/EarthScene` | R3F Canvas、灯光、地球球体、经纬网、轮廓线层 | Phase 1 |
| `src/scene/CameraController` | 球面相机模型 `GlobeCameraModel`（纯 TS）+ R3F 绑定：缩放上下限、按高度自适应旋转/平移速度、倾斜约束、视角命令执行、平滑过渡；向 `viewStore` 发布高度/LOD（见 §5 调整记录） | Phase 1 |
| `src/scene/Terrain` | 古地理切片的几何化（经纬线 → 球面线段），随切片变化更新 | Phase 1（接口）/ Phase 7（数据） |
| `src/data/schema` | `HistoricalEvent` / `Species` / `VisualizationAsset` / `Source` / `SpatialExtent` / `EvidenceLevel` / `PaleoGeographySlice` 等类型 | Phase 0 |
| `src/data/geology` | `PaleoGeographyProvider`：按时间返回古地理切片，缺失时返回降级结果与原因 | Phase 1（接口 + 示例） |
| `src/simulation/` | 时间/视野/图层 → 可见对象集合；动画与行为（与模拟时间解耦） | Phase 5/6 |
| `src/utils/geo.ts` | 经纬度 ↔ 球面坐标、相机高度 → 空间层级 L0–L4 | Phase 1 |

### 1.4 关键数据结构与约定

**时间（权威单位）**
- 内部统一使用 `yearsAgo: number`（距今年数）。`0` = 现代基准（定义为公元 2000 年，与 "BP/ka 体系" 区分，见风险 R6），正数 = 过去，负数 = 未来。
- 时间范围 `TimeRange = { fromYearsAgo, toYearsAgo }`，**约定 `fromYearsAgo >= toYearsAgo`（起点更古老）**，两端均为闭区间。对象在 `t` 时刻可见当且仅当 `toYearsAgo <= t <= fromYearsAgo`。
- 数据文件可用 `Ma`（百万年前）书写，载入时经 `maToYearsAgo()` 统一转换；时间引擎与解析器只处理 `yearsAgo`。
- 不确定年代用 `uncertaintyYears?: { older: number; younger: number }` 表达范围，不强行写精确值。
- 精度：`Number` 可精确表示 4.54e9 以内整数；在 4.54e9 附近 ULP ≈ 9.5e-7 年，按帧增量（≥1/60 年/帧）无可见损失。

**空间**
- `SpatialExtent = { kind: "point" | "region" | "global" | "fossil-sites" | "inferred-range"; coordinates?: [lon, lat]; polygon?: [lon, lat][][]; regionId?: string; coordinateFrame: "modern" | "paleo"; note?: string }`（区分 PLAN §5.4 五类空间数据，并标明坐标是现代坐标还是古地理坐标）。
- 渲染坐标：地球半径 = 1 场景单位，Y 轴 = 地理北极，经度 0° 指向 +Z。

**古地理切片**
- `PaleoGeographySlice = { id; label; timeRange; kind: "reconstruction" | "modern-schematic"; isSchematic: boolean; outlines: [lon, lat][][]; sourceIds; evidenceLevel; note }`
- `PaleoGeographyProvider.resolve(yearsAgo) → { slice | null; status: "exact" | "fallback" | "missing"; message }`，上层必须展示 status/message，避免把现代轮廓当作古地理事实（PLAN §3.3.3）。

**科学数据与视觉表现分离**：`HistoricalEvent` / `Species` 只引用 `visualizationIds`；`VisualizationAsset` 单独存放模型、LOD、动画集。

**空间层级 L0–L4**：由相机到地表高度（以地球半径为单位）决定，连续计算、带阈值，供场景解析器使用；不是独立页面。

| 层级 | 相机高度 h（地球半径） | 第一阶段内容 |
|---|---|---|
| L0 全球 | h ≥ 1.2 | 球体、经纬网、轮廓 |
| L1 大陆与海洋 | 0.4 ≤ h < 1.2 | 同上（后续：植被/气候带） |
| L2 区域生态 | 0.08 ≤ h < 0.4 | 后续：主要动植物 |
| L3 局部场景 | 0.015 ≤ h < 0.08 | 后续：局部场景（需局部坐标系，见 R1） |
| L4 近距离 | h < 0.015 | 后续：近距离模型 |

---

## 2. 时间引擎 / 3D 场景 / 时间轴 状态关系

```text
 用户输入 ─┬─ 播放/暂停/倍率/方向/单步 (PlaybackControls, Settings) ──┐
           ├─ 拖动/点击事件 (Timeline) ── seek(t) ─────────────────────┤
           └─ 事件导航 (EventDetails) ── seek(t) + cameraCommand(flyTo)┤
                                                                       ▼
                                                     ┌─────────────────────────┐
             performance.now() ── rAF ──► tick(dt) ─►│ TimeEngine (唯一真相源)   │
                                                     │ currentTimeYearsAgo     │
                                                     │ isPlaying / direction   │
                                                     │ rate / mode / bounds    │
                                                     └──────────┬──────────────┘
                                                                │ snapshot（每帧）
                                                     ┌──────────▼──────────────┐
                                                     │ timeStore (只读镜像)      │
                                                     └───┬─────────────────┬───┘
                    selector 订阅（UI 文本可节流）       │                 │ getState()（useFrame 中读取）
                 ┌───────────────────────────────────────▼─┐   ┌──────────▼──────────────────────┐
                 │ Timeline 指示器 / TopBar 年代文本 / 控件   │   │ SceneResolver(t, 视野, 图层, LOD) │
                 └─────────────────────────────────────────┘   │  → 可见对象集合（仅在集合变化时  │
                                                                │    触发 React 更新）            │
                                                                │ PaleoGeographyProvider(t)       │
                                                                └──────────┬──────────────────────┘
                                                                           ▼
                                                                ┌───────────────────────┐
  渲染时钟 (R3F clock，真实时间) ─► AnimationController ───────► │ 3D 场景（模型/地形/动画）│
  （与模拟时间独立，PLAN §4.7）                                   └───────────┬───────────┘
                                                                            │ 相机高度 / LOD（节流）
                                                                  viewStore ◄┘ （只读信息，不回写时间）
```

不变式（均需测试覆盖）：
1. 只有 `TimeEngine` 能修改模拟时间；Timeline、按钮、场景都不持有自己的时间副本。
2. 相机移动 / 缩放只写 `viewStore`，永不修改模拟时间。
3. 图层、视觉风格、动画开关只写 `settingsStore`，不修改时间、不重置相机。
4. 播放模式切换（fine / deep）不改变当前时间、不重置相机、不清除选中事件。
5. 动画使用渲染时钟；模拟时间倍率不影响动画速度；暂停模拟时间时 Idle 是否继续由设置决定。
6. 选择关系：选中事件 → 可触发 seek + 相机定位；选中对象独立于事件，时间变化导致对象不可见时清除对象选择。

---

## 3. 技术风险

| # | 风险 | 影响 | 应对 |
|---|---|---|---|
| R1 | **GPU float32 精度**：地球半径 = 1 单位时，1 m ≈ 1.6e-7 单位，L3/L4 近景会出现顶点抖动 | 无法在同一坐标系下近距离观察人物/生物 | L3/L4 采用"锚点局部坐标系"（以某经纬点为原点、米为单位的子场景，相机相对渲染/浮动原点），与球体连续过渡。**这是对 PLAN 的实现细化，不改变产品目标**；Phase 1 先限制最小高度到 L3 上沿附近，Phase 6 引入局部坐标系 |
| R2 | 时间每帧变化若进入 React state，会导致整个场景 60Hz 重渲染 | 卡顿 | 场景在 `useFrame` 中 `getState()` 读取；SceneResolver 只在可见集合变化时触发更新；UI 文本订阅可节流 |
| R3 | 45.4 亿年 vs 年级别历史，线性时间轴不可用 | 现代史无法操作 | `TimeScale` 分段/对数映射 + 多尺度刻度，始终显示真实年代（Phase 3） |
| R4 | 古地理数据（PALEOMAP / GPlates 等）许可、格式、体积 | 无法直接打包 | 先用明确标注的示例切片；Provider 接口按时间索引、支持异步加载与降级；接入前逐一核对许可 |
| R5 | 物种/事件坐标是现代坐标，深时需要随板块旋转到古坐标 | 化石点位置错误 | `SpatialExtent.coordinateFrame` 字段；后续接入板块旋转模型（Phase 7+），在此之前深时对象只做区域/概念性表达 |
| R6 | "距今 0 年"的定义（BP 以 1950 为基准、现代 2025）与公元年换算、无公元 0 年 | 年代显示错一年或数十年 | `CalendarAdapter` 集中处理，现代基准常量化（暂定 2000 CE，可配置），专门测试 1 BCE ↔ 1 CE |
| R7 | WebGL 线宽在多数平台固定 1px；远景线稿噪点 | 风格不可控 | 远景用有限的线条（经纬网间隔、简化轮廓）；需要粗线时用 `Line2`/`LineMaterial`；按距离控制线条密度 |
| R8 | 无头浏览器 WebGL（SwiftShader）性能与真机差异大 | 性能测试失真 | 自动化测试只验证功能与正确性；性能指标需在明确的参考设备上手动测并记录 |
| R9 | OrbitControls 平移在球体上会使旋转中心偏离球心 | 相机行为混乱 | **已处理**：改用以"注视经纬度"为状态的球面相机模型，平移即沿球面移动注视点 |
| R10 | 依赖版本较新（React 19 / R3F 9 / Vite 8），生态兼容性未知 | 构建失败 | 锁定版本（package-lock），Phase 0 即验证 dev/build/test 全链路 |
| R11 | 科学数据来源真实性 | 违反 PLAN §14.1-7 | 示例数据统一标注 `isSample: true` 与说明；只引用真实存在且可查的来源 |

---

## 4. 第一阶段实施顺序（Phase 0–8）

依赖顺序：Phase 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8。Phase 2（时间引擎）先于任何时间相关 UI。

### Phase 0：工程初始化 — `[x]` 已完成（2026-10-16）
- [x] 0.1 创建 Vite + React + TS 工程（手动搭建，保留 PLAN.md）
- [x] 0.2 安装依赖：three / @react-three/fiber / drei / zustand
- [x] 0.3 TypeScript 严格模式；`npm run typecheck`
- [x] 0.4 ESLint（flat config + typescript-eslint + react-hooks）
- [x] 0.5 Vitest + Testing Library（jsdom）；Playwright（Chrome）
- [x] 0.6 模块目录（PLAN §8.2）
- [x] 0.7 数据契约类型 `src/data/schema`
- [x] 0.8 基础布局：顶部栏 / 中央场景 / 右侧可折叠面板 / 底部时间轴区域
- [x] 0.9 README
- [x] 0.10 开发服务器可启动、页面无阻塞错误

验收：依赖可安装；`npm run dev` 正常；页面无报错；`typecheck` 通过；最小测试集通过。

### Phase 1：3D 地球与相机 — `[x]` 已完成（2026-10-16）
- [x] 1.1 R3F 场景、灯光、低多边形地球球体（深色底 + 线稿风格）
- [x] 1.2 经纬网（15° 间隔，赤道/本初子午线强调；L1+ 加 5°、L3+ 加 1° 细网格）
- [x] 1.3 旋转 / 缩放 / 平移（阻尼；按高度自适应速度）
- [x] 1.4 缩放上下限（不穿地表、不缩放到不可用）
- [x] 1.5 "返回全球视角"与"重置默认视角"（平滑过渡，按钮真实可用）
- [x] 1.6 相机高度 → 空间层级 L0–L4，顶部栏显示当前视图层级
- [x] 1.7 古地理数据接口 `PaleoGeographyProvider` + 示例轮廓切片（明确标注），缺失时降级提示
- [x] 1.8 设置面板中的"经纬网显示 / 大陆轮廓显示"（真实控制场景）
- [x] 1.9 面板折叠 / 窗口变化后渲染尺寸正确

验收：能看到完整地球；拖拽旋转、滚轮缩放、平移稳定；缩放无明显跳变；面板展开/折叠与窗口缩放后画面尺寸正确；相机移动不改变模拟时间。

### Phase 2：时间引擎 — `[x]` 已完成（2026-10-17）
- [x] 2.1 `TimeEngine`：唯一模拟时间；锚点 + 已播放秒数计算（无累积漂移）
- [x] 2.2 播放 / 暂停 / 继续；正向 / 反向；中途换向
- [x] 2.3 精细模式 1/2/4/8 年/秒；深时模式 1千/1万/100万 年/秒 + 自定义（校验 0.001–1e10）
- [x] 2.4 深时"整段历史播完用时"→ 倍率（1 s – 24 h）
- [x] 2.5 单步前进 / 后退（1/10/100/1000 年），单步先暂停
- [x] 2.6 边界：到达现代 / 地球形成时停止并提示；不溢出；单个超长帧被夹取
- [x] 2.7 模式切换不改变时间、播放状态与方向（各模式记住自己的倍率）
- [x] 2.8 `PlaybackController`：rAF 驱动；`visibilitychange` 恢复时重同步时钟（失焦不跳变）
- [x] 2.9 命令执行前先结算到"此刻"（主线程卡顿时暂停 / 变速不丢时间）
- [x] 2.10 `CalendarAdapter`：距今年数 ↔ 公元纪年（无公元 0 年，基准 2000 CE）、ka/Ma/Ga 文本
- [x] 2.11 `timeStore` 改为引擎快照的只读镜像；底部播放控制栏（仅时间读数随帧重渲染）

### Phase 3：时间轴 UI — `[~]` 功能完成，浏览器 e2e 待运行（2026-10-17）
- [x] 3.1 ICS v2024/12 年代表 `data/geology/timescale.ts`（宙 4 / 代 10 / 纪 22 / 世 34，边界逐项对照官方 PDF；"~" 边界标注 approximate）
- [x] 3.2 地质年代色带：按缩放级别显示层级（宙、代始终显示；纪、世在单位宽度足够时出现）；点击单位缩放到该时期
- [x] 3.3 `TimeScale`：分段压缩 / 线性两种刻度；视窗缩放（以光标或当前时间为不动点，最小 20 年）、平移、fit
- [x] 3.4 多尺度刻度：每段独立选 1-2-5 步长、间距 ≥ 90px；≤ 1 万年用公元纪年（无公元 0 年），更早用 ka / Ma / Ga；段边界虚线标出并注明"视觉长度不代表真实时间间隔"
- [x] 3.5 拖动刻度 / 事件行 = 定位时间；拖动色带 / Shift+滚轮 = 平移；滚轮 = 缩放；键盘 ← → 单步、+ − 缩放
- [x] 3.6 当前时间指示器（独立组件，仅它随帧重渲染）；超出视窗时显示边缘箭头；"跟随当前时间"自动平移
- [x] 3.7 PLAN §5.2 的 17 个关键事件 `data/events`（13 篇期刊论文 DOI 经 Crossref 核对 + 2 本图书 + ICS 年代表），按 6 类着色；点击跳转并选中（`selectionStore`）
- [x] 3.8 顶部栏显示当前地质时期（宙 · 代 · 纪 · 世）
- [ ] 3.9 `e2e/timeline.spec.ts`（拖动 → 场景地理图层更新、事件跳转 + 缩放对齐、公元前后无 0 年）已编写，**尚未运行**

### Phase 4：设置面板 — `[ ]`
播放设置、图层开关（7 类）、视觉风格（线稿/实体/混合）、动画开关、低性能模式；全部接入 settingsStore 并有实际效果。

### Phase 5：历史数据与场景联动 — `[ ]`
PLAN §5.2 的 17 个关键事件（核对来源）、物种数据、来源与可信度结构、时间筛选、事件/对象详情浮层。

### Phase 6：生物模型与动画 — `[ ]`
少量低多边形模型、线稿+实体混合、LOD、Idle/移动/进食动画、简单行为、按距离降频；L3/L4 局部坐标系（R1）。

### Phase 7：古地理与环境 — `[ ]`
按年代索引的古地理数据、至少两个差异明显的时期、随时间更新、缺失降级、地形/植被/气候图层。

### Phase 8：优化与发布准备 — `[ ]`
性能、数据加载、异常处理、补充测试、文档、生产构建验证。

---

## 5. 技术方案调整记录

| 日期 | 调整 | 原因 | 影响 |
|---|---|---|---|
| 2026-10-16 | L3/L4 近景将使用锚点局部坐标系（见 R1） | float32 精度不足以在半径=1 的球体坐标中表示米级细节 | 不改变产品目标；Phase 1 最小相机高度暂限制在 L3 范围内，L4 在 Phase 6 实现 |
| 2026-10-16 | 相机不使用 drei `OrbitControls`，改为自写球面相机模型 `GlobeCameraModel`（注视经纬度 + 高度 + 朝向 + 倾斜） | OrbitControls 按"到目标点距离"比例缩放，近地表一次滚轮即跳到下限（违反"缩放无明显跳变"）；其平移会使旋转中心偏离球心（R9） | 仍满足 PLAN §3.3.1 的旋转/缩放/平移；模型为纯 TS 并有单元测试；Phase 5 事件定位可直接复用（设置目标经纬度/高度） |
| 2026-10-16 | 古地理切片拆成"元数据 + 按需加载的轮廓文件"（`dataUrl`） | 轮廓数据体积大，不应打包进主 bundle；需要加载状态与错误处理 | `PaleoGeographySlice` 不再内联 `outlines`，改由 `PaleoGeographyProvider.load()` 加载并缓存 |
| 2026-10-16 | 增加 `SpatialExtent.coordinateFrame` 与古地理 `status` 字段 | PLAN §3.3.3、§5.4 要求区分现代/古坐标与降级表现 | 数据契约比 PLAN 示例多字段，属于兼容性扩展 |

| 2026-10-17 | `TimeEngine` 用"锚点 + 已播放秒数"而非逐帧累加；命令前先按注入时钟结算 | 逐帧累加在深时倍率下有累积误差；rAF 在繁忙主线程下变慢时，暂停/变速会丢掉最后一帧到点击之间的时间（e2e 中实测偏差约 1.5 年） | 引擎构造参数新增 `clock`（默认 `performance.now()`），测试可注入虚拟时钟 |
| 2026-10-17 | 地质年代边界采用 ICS v2024/12 实际数值（如白垩纪底界 143.1 Ma、新近纪底界 23.04 Ma、奥陶纪底界 486.85 Ma），不沿用旧版常见的 145 / 23.03 / 485.4 | 与 TASKS 指定版本一致；数值逐项对照官方 PDF | 冥古宙按 ICS 从 4567 Ma 起，时间轴只显示到引擎上限 4540 Ma（地球形成） |
| 2026-10-17 | 关键事件数据（原定 Phase 5）提前到 Phase 3 建立 | 时间轴的事件标记与跳转需要真实事件；PLAN 禁止无来源数据 | Phase 5 只需补充场景/图层联动（`visualizationIds`）、事件详情浮层与相机定位 |
| 2026-10-17 | 新增 `calBpToYearsAgo`（BP 1950 → b2k，+50 年）与 `ceToYearsAgo` | 文献年代体系不同（cal BP、BCE、b2k），统一入口避免差 50 年或差 1 年 | 现代基准常量移至 `data/schema`，`CalendarAdapter` 复用 |
| 2026-10-17 | 界面整理（用户反馈）：底部只保留时间轴 + 播放/暂停 + 倍速；方向、单步、自定义倍率、全史时长、跳转移到设置面板"播放"分组；面板分为 播放 / 时间轴 / 图层 三个可折叠分组；操作说明与图例移入顶部"帮助"弹层；底部固定 164px、无滚动 | 底部控件过多；说明文字占位 | 倍速下拉合并精细/深时预设并新增"全史 60 秒 / 10 分钟"，默认"全史 60 秒"；在终点点播放从另一端重新开始（`TimeEngine.playOrRestart`） |
| 2026-10-17 | `TopBar` / 播放栏统一使用 `CalendarAdapter.formatTime`：距今 ≤ 1 万年显示公元纪年，更早显示 ka/Ma/Ga | 删除 Phase 1 的临时 `format.ts` | 地质年代名称（宙/代/纪/世）在 Phase 3 接入 |

---

## 6. 阶段完成记录

### Phase 0 + Phase 1 — 2026-10-16

**完成内容**
- 工程：Vite 8 + React 19 + TypeScript 6（strict + `noUncheckedIndexedAccess`）+ R3F 9 + drei 10 + Zustand 5；ESLint 10（含 react-hooks / React Compiler 规则）；Vitest 5 + Testing Library；Playwright 1.64（本机 Chrome）。
- 数据契约 `src/data/schema`：`TimeRange`（from ≥ to，闭区间）、`SpatialExtent`（5 类空间数据 + 坐标系）、`HistoricalEvent`、`Species`、`VisualizationAsset`、`Source`、`PaleoGeographySlice`、`maToYearsAgo`、`isWithinTimeRange`。
- 布局：顶部栏 / 中央 3D 场景 / 右侧可折叠设置面板 / 底部时间轴区域（Phase 1 为说明性占位，**不含任何未实现的控件**）。
- 3D：低多边形地球（icosahedron detail 5）、大气边缘光、星空、LOD 经纬网、Natural Earth 1:110m 海岸线（标注"示意数据"及来源）。
- 相机：抓取式旋转/平移、对数缩放（127 km – 38,000 km）、近地表倾斜（倾斜不会使高度低于下限）、双击飞向地表点、返回全球视角、重置视角、动态近裁剪面；高度 → L0–L4 层级显示于顶部栏。
- 古地理接口：`PaleoGeographyProvider.resolve()`（exact / fallback / missing，默认不借用其他时期数据）+ `load()`（缓存、格式校验、失败可重试）；`startGeographySync` 订阅模拟时间，仅在切片变化时加载，忽略过期加载结果。
- 设置面板：经纬网、大陆轮廓开关（真实控制场景），面板折叠。

**测试命令与结果**
| 命令 | 结果 |
|---|---|
| `npm install` | 成功 |
| `npm run typecheck` | 通过 |
| `npm run lint` | 通过（0 error / 0 warning） |
| `npm test` | 5 个文件，30 个测试全部通过（坐标换算、层级划分、相机模型、古地理 Provider、地理同步、TopBar / SettingsPanel 组件） |
| `npm run test:e2e` | 9 个测试全部通过（连续运行 3 轮稳定）：WebGL 实际渲染与海岸线像素检测、拖动旋转且不改变模拟时间、滚轮缩放连续/有界/层级单调、全球视角与重置视角、面板折叠后画布宽度 +300px 且相机不重置、窗口缩放后渲染尺寸正确、图层开关、双击聚焦、双击球外无反应 |
| `npm run build` + `vite preview` | 构建成功；生产版本页面与数据文件（HTTP 200）加载正常，无控制台错误 |

**剩余问题 / 已知限制**
1. 相机最小高度约 127 km（L3）；L4 近距离需 Phase 6 的局部坐标系（R1）。在最小高度时倾斜上限为 0，需拉高一些才能倾斜。
2. 生产 bundle 单文件约 1.15 MB（gzip 318 KB），Phase 8 做代码分割。
3. 控制台有一条来自 R3F 内部的 `THREE.Clock` 弃用警告（非本项目代码，等待上游更新）。
4. 性能（FPS）尚未在参考设备上测量；无头测试使用 SwiftShader，只验证功能（R8）。
5. 触控捏合缩放已实现但未做自动化测试（Playwright 桌面模式不便模拟多点触控）。
6. 地球底色较暗，海陆仅以轮廓线区分；陆地填充、地形在 Phase 7 处理。
7. 顶部栏尚无"当前历史时期"与搜索入口（依赖 Phase 3 地质年代表和 Phase 5 数据），目前不显示，避免提供无功能的控件。

**下一步**：Phase 2 时间引擎（TimeEngine + PlaybackController + CalendarAdapter 及 PLAN §11.1 的全部测试）。

### Phase 2 — 2026-10-17

**完成内容**：见 §4 Phase 2 清单。新增 `src/timeline/{TimeEngine,PlaybackController,CalendarAdapter,runtime}.ts`、`src/components/Timeline/PlaybackControls.tsx`；`timeStore` 由 `bindTimeStore` 单向镜像引擎快照；开发模式下 `window.__timeEngine` 暴露引擎供 e2e 读取。

**PLAN §11.1 覆盖**（`src/timeline/TimeEngine.test.ts`）：地球形成→现代、现代→过去、暂停与继续、1/2/4/8 年/秒、深时倍率与目标时长、单步前进后退、500 次随机跳转、上下边界（含单个超长帧）、模式切换保持时间、失焦恢复（引擎与 PlaybackController 两层）、长时间运行数值稳定性（约 1 小时 60fps 抖动帧，误差 < 1 年）。

**测试命令与结果**
| 命令 | 结果 |
|---|---|
| `npm run typecheck` | 通过 |
| `npm run lint` | 通过 |
| `npm test` | 8 个文件，69 个测试全部通过 |
| `npx playwright test e2e/time.spec.ts` | 4 个测试全部通过：1 年/秒与真实经过时间一致、暂停冻结、继续连续；正向播放到现代边界停止并提示；深时 4 秒播完全史且模式切换保持时间；相机缩放与图层开关不影响时间 |

**剩余问题 / 已知限制**
1. 底部栏高度由 88px 调整为 96px 后，`e2e/globe.spec.ts` 尚未重新运行（Phase 1 的 9 个 e2e 需复测）。
2. 软件渲染（SwiftShader）下 Playwright 每条命令耗时数秒，时间相关 e2e 在页面内用 `performance.now()` 完成断言。
3. 本机 shell 默认 Node 为 v16，需切到 nvm 的 v22.22.0 才能运行 Vite 8 / Vitest 5。
4. 窄屏下播放栏横向滚动，Phase 3 时间轴布局时一并整理。

**下一步**：Phase 3 时间轴 UI。

### Phase 3 — 2026-10-17（功能完成，e2e 待运行）

**完成内容**：见 §4 Phase 3 清单。新增 `src/data/geology/timescale.ts`、`src/data/events/index.ts`、`src/timeline/TimeScale.ts`、`src/components/Timeline/{Timeline,categories}.tsx`、`src/state/selectionStore.ts`；`data/sources` 增加 16 个来源。

**测试命令与结果**
| 命令 | 结果 |
|---|---|
| `npm run typecheck` / `npm run lint` | 通过 |
| `npm test` | 12 个文件，117 个测试全部通过（新增：年代表连续性/嵌套/ICS 数值、17 个事件的格式与来源、TimeScale 映射单调性与往返、缩放不动点与上下限、各缩放级别刻度不重叠、无公元 0 年、Timeline 组件的事件跳转/缩放对齐/拖动定位/色带平移/点击缩放/跟随/键盘） |
| 截图核查（本机 Chrome，dev server） | 全景、放大到二叠纪末、放大到公元前 3400 年三种视图渲染正常，标签无重叠；发现并修复最左端刻度显示为 "4540000 ka" 的问题 |
| `npx playwright test e2e/timeline.spec.ts` | **未运行** |

**剩余问题 / 已知限制**
1. `e2e/timeline.spec.ts` 与 `e2e/globe.spec.ts`（底部栏增高到 232px 后）均需在真实浏览器中运行一次；SwiftShader 下整套约 10 分钟。
2. 事件密集处只显示部分标签（悬停 `<title>` 可看全部），Phase 5 加入事件列表 / 详情浮层。
3. 前寒武纪"纪"一级在全景下很窄，需放大才能看清；"世"只收录显生宙（ICS 前寒武纪无正式的世）。
4. CGMW 颜色为常用近似十六进制值，Paleozoic 部分"世"的颜色为按所属纪调和的近似色。

**下一步**：Phase 4 设置面板。
