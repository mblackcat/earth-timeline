# 接力文档（HANDOFF）

> 最后更新：2026-10-19 · 最后提交见 `git log -1`（改版在分支 `ink-tone-redesign`，未合并 main）
> 下次开工：先读本文 → 再按需查 `TASKS.md`（逐阶段清单、调整记录、测试记录）与 `PLAN.md`（产品规范，目标不变）。

---

## 1. 当前状态一句话

Phase 0–7 主体完成：可交互 3D 地球 + 统一时间引擎 + 多尺度时间轴 + 17 个有来源的关键事件 + 13 种代表性生物（化石点、古坐标、程序化模型与动画）+ 0–18 亿年板块重建古地理。2026-10-18/19 完成"纸面墨线 + 漫画网点"改版（见 §5）。**下一步是 Phase 8（优化与发布准备）；用户会另提改版后的细节优化。**

| 阶段 | 状态 | 备注 |
|---|---|---|
| 0 工程 / 1 地球与相机 | 完成 | |
| 2 时间引擎 | 完成 | |
| 3 时间轴 UI | 完成 | e2e 已通过 |
| 4 设置面板 | 主体完成 | PLAN §7.2 的地形气候 / 人类活动 / 文明建筑 / 迁徙图层无内容，未提供开关；视觉风格为 线稿 + 网点 / 线稿 / 白模 |
| 5 历史数据与场景联动 | 主体完成 | 缺"若干现代动植物"；无 e2e |
| 6 生物模型与动画 | 完成 | 近景为独立观察窗（见 §5 决策） |
| 7 古地理与环境 | 古地理完成 | 地形 / 植被 / 气候图层未做；切片间无过渡 |
| 8 优化与发布 | **未开始** | |

验证状态（最后一次，2026-10-19）：`typecheck` ✅ · `lint` ✅ · `npm test` 28 文件 / 283 测试 ✅ · 全部 e2e 16/16 ✅（1.3 分钟）

---

## 2. 环境（务必先看）

1. **Node 版本**：本机 shell 默认 `node` 是 v16（`/usr/local/bin/node`），跑不了 Vite 8 / Vitest 5（报 `styleText` 导出错误）。每条命令前加：
   ```bash
   export PATH=/Users/joeyzhao/.nvm/versions/node/v22.22.0/bin:$PATH
   ```
2. **dev server**：`npm run dev` → http://localhost:5173 。开发模式下 `window.__timeEngine` 暴露时间引擎，e2e 与调试脚本依赖它。
3. **e2e 与截图必须用原生 arm64 启动浏览器**：`arch -arm64 node node_modules/.bin/playwright test …`（单个 spec 约 1 分钟）。Claude 的 shell 有时运行在 Rosetta 下，此时浏览器慢约 200 倍、全部超时。长时间运行放后台；电脑睡眠也会让整轮超时（2026-10-19 遇到过一次 2 小时的假失败）。开发模式下可通过 `window.__timeEngine` 跳时间。
4. **Python 的 HTTPS 证书**在本机不可用（urllib 报 CERTIFICATE_VERIFY_FAILED）；联网脚本一律用 Node 22 的 `fetch`。
5. **用户偏好**：中文沟通；提交 / 推送前会明确授权；希望界面简洁（底部只留时间轴 + 播放/暂停 + 倍速，参数在右侧面板，说明放顶部"帮助"）。

---

## 3. 命令速查

```bash
npm run dev | build | preview | typecheck | lint
npm test                      # Vitest（jsdom）
npm run test:e2e              # Playwright（自动复用 5173 上的 dev server）
npx playwright test e2e/timeline.spec.ts   # 单个 spec

# 数据生成（联网；结果已提交，平时不需要跑）
node scripts/fetch-pbdb-sites.mjs                 # 化石点 → public/data/species/pbdb-sites.json
node scripts/fetch-paleogeography.mjs             # 重建海岸线 + 古坐标 → public/data/geography/cao2024/
node scripts/fetch-paleogeography.mjs --coastlines-only   # 只重算海岸线（用 node_modules/.cache/gws 缓存，秒级）
node scripts/fetch-paleogeography.mjs --points-only       # 只重算古坐标（物种 / 事件 / 化石点变化后必须跑）
```

数据依赖顺序：改物种年代或新增物种 → `fetch-pbdb-sites` → `fetch-paleogeography --points-only` → `npm test`（测试会校验生成文件与 TS 数据一致）。脚本通过 `scripts/load-ts.mjs`（Vite `runnerImport`）直接读取 `src/` 的 TS 数据，不要在脚本里复制数据。

---

## 4. 架构速览

```text
UI（React DOM）  components/  TopBar · Help · SettingsPanel(播放/时间轴/图层/视觉/动画) · Timeline+PlaybackBar
                              Scene(NowPanel 此时期, DetailsCard 详情) · Specimen(近距离观察窗)
状态（Zustand）  state/       timeStore(引擎只读镜像) settingsStore viewStore(相机信息+命令)
                              selectionStore(事件/物种/观察窗) sceneStore(可见集合, 化石点, 古坐标) geographyStore
时间（纯 TS）    timeline/    TimeEngine(唯一时间源) PlaybackController(rAF) CalendarAdapter TimeScale speeds runtime(单例)
模拟（纯 TS）    simulation/  VisibilityResolver paleoPositions BehaviorSystem creatureSites
数据（纯 TS）    data/        schema events species visuals sources regions geology(timescale, slices, reconstruction)
场景（R3F）      scene/       EarthScene(Globe 网点海洋 + GlobeRim) CameraController Terrain Living(FossilSites, EventMarkers, GlobeCreatures)
                              Ink(inkPalette, toneMaterial 网点 / 外轮廓材质, landMask 陆地遮罩, ToneSync)
                              Models(rig, builders, animation, animationClock, useRig) Specimen
```

关键不变式（均有测试）：
- 只有 `TimeEngine` 能改模拟时间；时间单位 `yearsAgo`（0 = 公元 2000 年初，b2k），范围 `{fromYearsAgo ≥ toYearsAgo}` 闭区间。
- 相机、设置、图层操作不改时间；设置不重置相机。
- 动画时钟只跟真实时间（`advanceAnimationClock`），与模拟倍率无关。
- 物种严格按生存范围显示；选中 / 观察中的物种离开范围自动清除。
- 化石点 / 事件与海岸线始终在同一参考系：重建切片下只用古坐标（不可重建的点不显示），全新世与无数据时期用现代坐标。
- 深时绝不把现代海岸线当古地理（可选的灰色"现代海岸线参考"有明确说明）。
- 科学数据与视觉表现分离：物种只存 `visualizationId`。
- 网点材质自己算光照（固定视空间方向），场景里没有灯光；新加的 3D 材质要么用 `createToneMaterial`，要么设 `toneMapped={false}`（Canvas 为 `flat`）。

---

## 5. 已做的重要决策（详见 TASKS.md §5 调整记录）

- **相机**：自写球面相机模型 `GlobeCameraModel`，不用 OrbitControls；最低高度约 127 km。
- **时间轴**：默认分段压缩刻度（断点 538.8 Ma / 66 Ma / 2.58 Ma / 11.7 ka），可切线性。
- **年代表**：ICS v2024/12，数值逐项对照官方 PDF（如白垩纪底界 143.1 Ma）。
- **数据来源规则**：期刊 DOI 一律经 Crossref 核对；物种年代优先文献，其次地层单元，最后 PBDB 分位数，并在 `evidenceNote` 以 `[文献]/[地层]/[PBDB]` 标明。无法核实的数字不挂到文献名下（例：真猛犸象起点改用中更新世底界并标"不确定"）。
- **古地理**：GPlates Web Service · CAO2024（Cao et al. 2024，0–1800 Ma，数据 CC BY 4.0，已核 Zenodo）。40 个切片；生成时 0.25° 栅格融合去除板块内部切割线（`utils/dissolve.ts`）。
- **近景（R1）**：地球坐标无法表示米级生物 → 真实比例近景放在独立的"近距离观察窗"（米制局部坐标、独立 Canvas）；地球上 L1 及更近只显示图标尺寸的 LOD1 模型。
- **模型**：全部程序化低多边形（7 个原型覆盖 13 物种），无外部模型文件。
- **墨线 + 网点改版**（设计稿 `docs/superpowers/specs/2026-10-18-ink-tone-redesign-design.md`，计划 `docs/superpowers/plans/2026-10-18-ink-tone-redesign.md`）：
  - 界面用 ai-score 的纸面变量（`--paper --sheet --ink --ink-2 --ink-3 --rule --mark`），红笔 `--mark` 只用于当前 / 选中 / 灭绝；时间轴是唯一彩色区域（ICS 色与纸色 45% 混合）。
  - 渲染方案 1：材质内屏幕空间网点（`MeshLambertMaterial.onBeforeCompile`）+ 几何描线（`EdgesGeometry` 折边 + 背面外扩外轮廓，屏幕恒定像素宽）；不用后处理。
  - 风格 `line / tone / plain`，地球风格切换只改 uniform 不重建材质；模型按风格重建。
  - 网点档陆地完全留白（实测改动，原设计为背光侧淡网点）。

---

## 6. 下一步（建议顺序）

### 改版收尾
- 分支 `ink-tone-redesign` 待用户决定合并方式；用户会单独提出视觉细节优化（网点粗细、涂黑面积、线宽等，参数集中在 `scene/Ink/toneMaterial.ts` 与 `inkPalette.ts`）。

### Phase 8（优化与发布）
1. ~~跑全部 e2e 并修复~~：2026-10-19 已完成，16/16 通过。
2. **补 e2e**：Phase 5/6/7（事件跳转 + 相机定位 + 标记、化石点随时间变化、古地理切片切换、观察窗打开 / 关闭 / 动画切换）。
3. **生产构建**：`npm run build` + `preview` 验证；代码分割（three / drei / 观察窗按需加载，目前单包约 1.2 MB）；检查 `public/data` 的加载与缓存。
4. **性能**：在参考设备上测 FPS（R8：无头测试不代表真机），记录到 TASKS；必要时化石点改实例化 / 合批、限制 Html 标记数量。
5. **文档**：README 的操作说明随 Phase 8 再核一遍。

### 内容与体验缺口（按价值）
- 古地理切片之间的过渡（当前在切片边界瞬切）。
- 化石点按各自化石年代旋转（当前按切片年代统一旋转）。
- 若干现代动植物（需逐条核实来源）。
- 地形 / 植被 / 气候带、人类活动、文明建筑、迁徙路线图层（PLAN §7.2）。
- 冰期海平面与陆桥。
- 从地球连续缩放进入近景（替代独立观察窗）。
- 事件标签在密集处的避让。

---

## 7. 新增内容时的检查清单

- 新事件：`data/events`，来源登记到 `data/sources`（DOI 先用 Crossref 核对），有位置的事件之后跑 `fetch-paleogeography --points-only`。
- 新物种：`data/species`（年代来源标注）+ `PBDB_NAMES` + `data/visuals` 资产（体型原型、尺寸、`animationSet` 只能写原型已实现的片段）→ 跑两个数据脚本 → `npm test`。
- 新设置项：只放 `settingsStore`，必须有实际效果，并补"不改时间 / 不重置相机"的测试。
- 每阶段收尾：`typecheck` + `lint` + `npm test` + 相关 e2e（后台）+ 截图核查，然后在 TASKS.md 记录完成内容、测试结果与剩余问题。
