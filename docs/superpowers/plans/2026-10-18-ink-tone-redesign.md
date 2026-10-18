# 墨线 + 网点改版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把"深色底 + 青色线框"改成纸面墨线 + 漫画网点风格（界面外壳 → 地球 → 生物模型）。

**Architecture:** 共享模块 `src/scene/Ink/`：色板 + 颜色混合、网点材质（`MeshLambertMaterial.onBeforeCompile` 注入，光源固定在视空间左上）、陆地遮罩（等距圆柱 canvas 纹理）、外轮廓材质（背面外扩，屏幕恒定像素宽）。CSS 改用 ai-score 设计变量。风格枚举 `line | tone | plain` 同时驱动地球和模型。

**Tech Stack:** React 19 · R3F 9 · three 0.186 · Zustand · Vitest(jsdom) · Playwright

**Spec:** `docs/superpowers/specs/2026-10-18-ink-tone-redesign-design.md`

**环境：** 每条命令前 `export PATH=/Users/joeyzhao/.nvm/versions/node/v22.22.0/bin:$PATH`。e2e 浏览器须 `arch -arm64` 启动、放后台跑，跑完整套前先问用户。提交前需用户授权——每个 Task 末尾的 commit 步骤在获得授权后执行（或攒到阶段末一起提交）。

---

## 文件结构

| 文件 | 动作 | 职责 |
|---|---|---|
| `src/scene/Ink/inkPalette.ts` | 新建 | 色板 `INK` + `mixHex` |
| `src/scene/Ink/inkPalette.test.ts` | 新建 | |
| `src/scene/Ink/landMask.ts` | 新建 | `unwrapRing` / `drawLandMask` / `useLandMaskTexture` |
| `src/scene/Ink/landMask.test.ts` | 新建 | |
| `src/scene/Ink/toneMaterial.ts` | 新建 | `createToneMaterial` / `setToneMode` / `createOutlineMaterial` / 共享 uniform |
| `src/scene/Ink/toneMaterial.test.ts` | 新建 | |
| `src/scene/Ink/ToneSync.tsx` | 新建 | 每个 Canvas 内同步 dpr / 视口高度到共享 uniform |
| `src/scene/Wireframe/palette.ts` | 删除 | 被 `inkPalette` 取代 |
| `src/styles.css` | 改 | 设计变量、纸纹、直角、时间轴配色 |
| `src/components/TopBar/TopBar.tsx` | 改 | logo、衬线标题、年代路径 span |
| `src/components/Timeline/Timeline.tsx` | 改 | ICS 淡彩、当前单位下划线 |
| `src/components/Timeline/categories.ts` | 改 | 事件类别降饱和 |
| `src/scene/Living/speciesColors.ts` | 改 | 新增 `SPECIES_COLORS_MUTED` |
| `src/state/settingsStore.ts`、`src/data/schema/index.ts`、`src/data/visuals/index.ts`、`src/scene/Models/rig.ts` | 改 | 风格枚举 |
| `src/components/SettingsPanel/VisualSettings.tsx`、`src/components/Specimen/SpecimenViewer.tsx` | 改 | 三档文案 |
| `src/scene/EarthScene/{EarthScene,Globe,Graticule}.tsx`、`src/scene/Terrain/GeographyOutlines.tsx` | 改 | 地球 |
| `src/scene/Specimen/SpecimenScene.tsx` | 改 | 观察窗 |
| `src/scene/Living/{FossilSites,EventMarkers}.tsx` | 改 | 标记 |
| `e2e/globe.spec.ts` | 改 | 墨色像素、尺寸断言 |

---

# A. 界面外壳

### Task 1: 色板与颜色混合

**Files:**
- Create: `src/scene/Ink/inkPalette.ts`
- Test: `src/scene/Ink/inkPalette.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// src/scene/Ink/inkPalette.test.ts
import { INK, mixHex } from "./inkPalette";

describe("mixHex", () => {
  it("t = 0 returns a, t = 1 returns b", () => {
    expect(mixHex("#ff0000", "#0000ff", 0)).toBe("#ff0000");
    expect(mixHex("#ff0000", "#0000ff", 1)).toBe("#0000ff");
  });
  it("mixes per channel in sRGB and rounds", () => {
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mixHex("#f9a01b", INK.paper, 0.45)).toBe("#f6c57b");
  });
  it("accepts 3-digit hex", () => {
    expect(mixHex("#fff", "#000", 0)).toBe("#ffffff");
  });
});

describe("INK", () => {
  it("matches the ai-score sheet tokens", () => {
    expect(INK).toMatchObject({ paper: "#f2f3f0", sheet: "#f7f8f5", ink: "#171917", rule: "#c5c8c2", mark: "#9c1c1c" });
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/scene/Ink/inkPalette.test.ts`
Expected: FAIL（找不到模块 `./inkPalette`）

- [ ] **Step 3: 实现**

```ts
// src/scene/Ink/inkPalette.ts
/** 纸面墨线色板（与 ai-score 的设计变量一致）。场景与界面统一从这里取色。 */
export const INK = {
  desk: "#c5c7c3",
  paper: "#f2f3f0",
  sheet: "#f7f8f5",
  ink: "#171917",
  ink2: "#5c615c",
  ink3: "#8e938d",
  rule: "#c5c8c2",
  mark: "#9c1c1c",
} as const;

function parse(hex: string): [number, number, number] {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** sRGB 逐通道线性混合：t = 0 → a，t = 1 → b。用于"淡彩"（与纸色混合）。 */
export function mixHex(a: string, b: string, t: number): string {
  const pa = parse(a);
  const pb = parse(b);
  return `#${pa.map((v, i) => Math.round(v + (pb[i]! - v) * t).toString(16).padStart(2, "0")).join("")}`;
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/scene/Ink/inkPalette.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/scene/Ink/inkPalette.ts src/scene/Ink/inkPalette.test.ts
git commit -m "feat(ink): paper/ink palette and mixHex"
```

---

### Task 2: 降饱和的物种色与事件类别色

**Files:**
- Modify: `src/scene/Living/speciesColors.ts`
- Modify: `src/components/Timeline/categories.ts`
- Modify: `src/components/Scene/DetailsCard.tsx:103`、`src/components/Scene/NowPanel.tsx:32`
- Test: `src/scene/Ink/inkPalette.test.ts`（追加）

- [ ] **Step 1: 追加失败测试**

```ts
// 追加到 src/scene/Ink/inkPalette.test.ts
import { SPECIES_COLORS, SPECIES_COLORS_MUTED } from "../Living/speciesColors";
import { CATEGORY_STYLE } from "../../components/Timeline/categories";

describe("muted colors", () => {
  it("every species has a muted color mixed toward paper", () => {
    for (const [id, c] of Object.entries(SPECIES_COLORS)) expect(SPECIES_COLORS_MUTED[id]).toBe(mixHex(c, INK.paper, 0.3));
  });
  it("extinction events use the red pen", () => {
    expect(CATEGORY_STYLE.extinction.color).toBe(INK.mark);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/scene/Ink/inkPalette.test.ts`
Expected: FAIL（`SPECIES_COLORS_MUTED` 未导出）

- [ ] **Step 3: 实现**

`src/scene/Living/speciesColors.ts`：把 PALETTE 换成在纸面上可读的中等饱和度色，并追加 muted 导出：

```ts
import { SPECIES } from "../../data/species";
import { INK, mixHex } from "../Ink/inkPalette";

/** 每个代表性物种的识别色（纸面上可读的中等饱和度）。 */
const PALETTE = [
  "#c0782a", "#3f8f4f", "#2f6fa8", "#b8483f", "#7a5aa6", "#b04f7f", "#2a8a86",
  "#a68a1f", "#4f86b0", "#b0802f", "#5c9a5c", "#a85c5c", "#8a6fb0",
];

export const SPECIES_COLORS: Record<string, string> = Object.fromEntries(
  SPECIES.map((s, i) => [s.id, PALETTE[i % PALETTE.length]!]),
);

/** 降饱和版本：化石点、此时期列表、详情卡片使用（PLAN 改版 §4.4）。 */
export const SPECIES_COLORS_MUTED: Record<string, string> = Object.fromEntries(
  Object.entries(SPECIES_COLORS).map(([id, c]) => [id, mixHex(c, INK.paper, 0.3)]),
);
```

`src/components/Timeline/categories.ts`：

```ts
import type { EventCategory } from "../../data/schema";
import { INK } from "../../scene/Ink/inkPalette";

/** 时间轴事件分类的颜色与名称。纸面上降饱和；灾变 / 灭绝用红笔。 */
export const CATEGORY_STYLE: Record<EventCategory, { label: string; color: string }> = {
  geology: { label: "地质", color: "#8a6f3e" },
  life: { label: "生命演化", color: "#3f7a4a" },
  extinction: { label: "灾变 / 灭绝", color: INK.mark },
  climate: { label: "气候环境", color: "#3a6a8f" },
  human: { label: "人类演化", color: "#a0622a" },
  civilization: { label: "文明历史", color: "#7a6a2a" },
};
```

`DetailsCard.tsx` 与 `NowPanel.tsx`：把 import 改为 `SPECIES_COLORS_MUTED`，用法 `SPECIES_COLORS_MUTED[id]` / `SPECIES_COLORS_MUTED[s.id]`。

- [ ] **Step 4: 运行**

Run: `npx vitest run`
Expected: 全部 PASS

- [ ] **Step 5: Commit**

```bash
git add src/scene/Living/speciesColors.ts src/components/Timeline/categories.ts src/components/Scene src/scene/Ink/inkPalette.test.ts
git commit -m "feat(ink): muted species and category colors"
```

---

### Task 3: CSS 设计变量与全局外观

**Files:**
- Modify: `src/styles.css`

纯样式，无单测；用截图核查。

- [ ] **Step 1: 替换 `:root` 块（第 1–16 行）**

```css
:root {
  --desk: #c5c7c3;
  --paper: #f2f3f0;
  --sheet: #f7f8f5;
  --ink: #171917;
  --ink-2: #5c615c;
  --ink-3: #8e938d;
  --rule: #c5c8c2;
  --mark: #9c1c1c;
  --desk-pad: 8px;
  --top-h: 52px;
  --bottom-h: 164px;
  --panel-w: 300px;
  --serif: "Noto Serif SC", "Songti SC", serif;
  font-family: "IBM Plex Sans", "PingFang SC", "Noto Sans SC", -apple-system, sans-serif;
  color: var(--ink);
  background: var(--desk);
  -webkit-font-smoothing: antialiased;
}

/* 纸纹：叠在界面之上，不拦截点击 */
body::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: 70;
  pointer-events: none;
  opacity: 0.14;
  mix-blend-mode: multiply;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
}
```

- [ ] **Step 2: 机械替换旧变量**

```bash
sed -i '' -E \
  -e 's/var\(--panel-border\)/var(--rule)/g' \
  -e 's/var\(--panel\)/var(--sheet)/g' \
  -e 's/var\(--bg\)/var(--paper)/g' \
  -e 's/var\(--text\)/var(--ink)/g' \
  -e 's/var\(--muted\)/var(--ink-3)/g' \
  -e 's/var\(--accent-2\)/var(--mark)/g' \
  -e 's/var\(--accent\)/var(--ink)/g' \
  -e 's/var\(--gold\)/var(--mark)/g' \
  -e 's/border-radius: [0-9]+px( [0-9]+px)*( [0-9]+px)*;/border-radius: 0;/g' \
  -e '/box-shadow:/d' \
  src/styles.css
grep -nE "#[0-9a-fA-F]{3,6}\b|rgba\(" src/styles.css
```

Expected: 只剩下面 Step 3 列出的硬编码颜色。`border-radius: 50%`（圆点）保留。

- [ ] **Step 3: 逐个替换剩余硬编码颜色**

| 原值（所在规则） | 新值 |
|---|---|
| `button` 的 `background: #12203a` | `background: transparent;` 并把 `border: 1px solid var(--rule)`、`color: var(--ink-2)` |
| `#12203a` 其他处 | `var(--sheet)` |
| `#0e1828`（`.tl-axis-bg` 等） | `var(--paper)` |
| `#05070d`（`.tl-unit rect` stroke） | `var(--paper)` |
| `#46607d`（`.tl-tick line`） | `var(--rule)` |
| `#7b8ca0`（`.tl-tick.boundary line`） | `var(--ink-3)` |
| `#1a1a1a`（`.tl-unit-label`） | `var(--ink)` |
| `#fc8181`（错误文字） | `var(--mark)` |
| `#f6ad55` / `#ecc94b` / `#68d391` / `#4fd1c5` | `var(--mark)` / `var(--mark)` / `var(--ink-2)` / `var(--ink)` |
| `rgba(8,14,24,0.82)`、`rgba(11,17,28,0.94)`、`rgba(8,12,20,0.97)`、`rgba(30,40,60,0.95)`（卡片/弹层底） | `var(--sheet)` |
| `rgba(5,7,13,0.7)` | `rgba(242, 243, 240, 0.85)` |

- [ ] **Step 4: 追加外框、按钮、卡片规则（文件末尾、`@media` 之前）**

```css
/* 灰色桌面 + 1px 墨色外框 */
#root {
  padding: var(--desk-pad);
}
.app-shell {
  background: var(--paper);
  border: 1px solid var(--ink);
}
button:hover {
  border-color: var(--ink);
  color: var(--ink);
}
button[aria-pressed="true"],
.seg button[aria-pressed="true"] {
  background: var(--ink);
  border-color: var(--ink);
  color: var(--sheet);
}
.play-btn {
  border-radius: 999px;
  background: var(--ink);
  border-color: var(--ink);
  color: var(--sheet);
}
.play-btn:hover {
  background: #2a2c28;
  color: var(--sheet);
}
.play-btn[aria-pressed="true"] {
  border-color: var(--ink);
  color: var(--sheet);
}
button:focus-visible,
input:focus-visible,
select:focus-visible {
  outline: 1px solid var(--ink);
  outline-offset: 2px;
}
select,
input[type="number"] {
  background: var(--sheet);
  color: var(--ink);
  border: 1px solid var(--rule);
  border-radius: 0;
}
.now-panel,
.geo-caption,
.details-card,
.specimen,
.help-popover {
  background: var(--sheet);
  border: 1px solid var(--rule);
}
.top-bar,
.settings-panel,
.timeline-region {
  background: var(--paper);
}
.top-bar {
  border-bottom: 1px solid var(--ink);
}
.timeline-region {
  border-top: 1px solid var(--ink);
}
.top-time,
.playback-now,
.tl-window,
.view-level {
  font-variant-numeric: tabular-nums;
}
.panel-body h2,
.panel-body h3,
.detail-title,
.help-popover h3 {
  font-family: var(--serif);
}
```

注意 `#root` 已在 `html, body, #root { height: 100% }` 中；`box-sizing: border-box` 全局生效，所以 padding 不会溢出。

- [ ] **Step 5: 验证**

Run: `npm run lint && npm run typecheck && npx vitest run`
Expected: 通过（样式不影响单测）

- [ ] **Step 6: Commit**

```bash
git add src/styles.css
git commit -m "style: paper/ink design tokens, grain, square frame"
```

---

### Task 4: 顶栏（logo、衬线标题、年代路径）

**Files:**
- Modify: `src/components/TopBar/TopBar.tsx`
- Modify: `src/styles.css`
- Test: `src/components/components.test.tsx`（追加）

- [ ] **Step 1: 追加失败测试**

```tsx
// 追加到 src/components/components.test.tsx（文件已 import render/screen/TopBar/useTimeStore）
describe("TopBar period path", () => {
  it("renders each rank as a span, marks the finest one, keeps the joined text", () => {
    useTimeStore.setState({ currentTimeYearsAgo: 66_500_000 });
    render(<TopBar />);
    const period = screen.getByTestId("current-period");
    expect(period.textContent).toBe("显生宙 · 中生代 · 白垩纪 · 晚白垩世");
    const spans = period.querySelectorAll("[data-rank]");
    expect(spans.length).toBe(4);
    expect(spans[spans.length - 1]).toHaveClass("current");
  });
});
```

（timeStore 只是引擎镜像，组件测试里直接 `setState({ currentTimeYearsAgo })` 即可。期望字符串以 `describeGeoPeriod(66_500_000)` 的实际输出为准——先在测试里 `console.log` 一次核对，再写死。）

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/components/components.test.tsx`
Expected: FAIL（没有 `[data-rank]` 元素）

- [ ] **Step 3: 实现**

`TopBar.tsx` 中替换 brand 与 `GeoPeriod`：

```tsx
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        <span className="brand-title">地球时空演化图谱</span>
        <span className="brand-sub">EARTH THROUGH TIME</span>
      </div>
```

```tsx
import { GEO_RANKS, geoPathAt } from "../../data/geology/timescale";

/** 当前历史时期（ICS 宙/代/纪/世）。最细一级用红笔标出。 */
function GeoPeriod() {
  const text = useTimeStore((s) => describeGeoPeriod(s.currentTimeYearsAgo));
  const yearsAgo = useTimeStore.getState().currentTimeYearsAgo;
  const path = geoPathAt(yearsAgo);
  const units = GEO_RANKS.flatMap((r) => (path[r] ? [{ rank: r, name: path[r]!.name }] : []));
  return (
    <div className="top-period" data-testid="current-period" data-text={text} title="当前地质年代（ICS v2024/12）">
      {units.map((u, i) => (
        <span key={u.rank}>
          {i > 0 && " · "}
          <span data-rank={u.rank} className={i === units.length - 1 ? "current" : undefined}>
            {u.name}
          </span>
        </span>
      ))}
    </div>
  );
}
```

（`text` 选择器保证只在路径变化时重渲染；`GEO_RANKS` 已从 `timescale.ts:26` 导出。）

`styles.css` 追加：

```css
.brand {
  align-items: center;
}
.brand-mark {
  width: 22px;
  height: 22px;
  background: var(--ink);
  flex-shrink: 0;
}
.brand-title {
  font-family: var(--serif);
  font-size: 19px;
  font-weight: 600;
  letter-spacing: -0.02em;
}
.brand-sub {
  font-size: 10px;
  letter-spacing: 0.18em;
  color: var(--ink-3);
}
.top-time {
  font-size: 20px;
  font-weight: 600;
  color: var(--ink);
}
.top-period {
  color: var(--ink-2);
}
.top-period .current {
  color: var(--mark);
}
```

- [ ] **Step 4: 运行**

Run: `npx vitest run && npm run lint && npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/TopBar/TopBar.tsx src/components/components.test.tsx src/styles.css
git commit -m "feat(ui): ink masthead with marked period path"
```

---

### Task 5: 时间轴淡彩与当前单位标记

**Files:**
- Modify: `src/components/Timeline/Timeline.tsx:148-170, 313-333, 56-77`
- Modify: `src/styles.css`
- Test: `src/components/Timeline/Timeline.test.tsx`（追加）

- [ ] **Step 1: 追加失败测试**

```tsx
// 追加到 Timeline.test.tsx 的 describe("Timeline") 内（beforeEach 已绑定 timeEngine → timeStore）
// 文件顶部 import：
import { INK, mixHex } from "../../scene/Ink/inkPalette";
import { geoPathAt } from "../../data/geology/timescale";

it("geo bands are ICS colors mixed toward paper, and the current units are marked", () => {
  act(() => timeEngine.seek(66_500_000));
  render(<Timeline leading={null} />);
  const path = geoPathAt(66_500_000);
  const period = path.period!;
  const g = document.querySelector(`[data-unit-id="${period.id}"]`)!;
  expect(g.querySelector("rect")!.getAttribute("fill")).toBe(mixHex(period.color, INK.paper, 0.45));
  expect(g).toHaveClass("current");
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/components/Timeline/Timeline.test.tsx`
Expected: FAIL（fill 仍为原色）

- [ ] **Step 3: 实现**

在 `Timeline.tsx` 顶部 import `INK, mixHex` 与 `geoPathAt`。组件体内：

```tsx
  // 当前所在的各级单位（只在单位变化时更新）
  const currentIds = useTimeStore((s) => Object.values(geoPathAt(s.currentTimeYearsAgo)).map((u) => u!.id).join("|"));
```

色带渲染改为：

```tsx
                <g key={unit.id} data-unit-id={unit.id} className={`tl-unit${currentIds.split("|").includes(unit.id) ? " current" : ""}`}>
                  <rect x={GUTTER + x0} y={0} width={x1 - x0} height={ROW_H - 1} fill={mixHex(unit.color, INK.paper, 0.45)}>
```

在 `<rect>` 之后、label 之前追加下划线：

```tsx
                  {currentIds.split("|").includes(unit.id) && (
                    <line className="tl-unit-current" x1={GUTTER + x0} x2={GUTTER + x1} y1={ROW_H - 1.5} y2={ROW_H - 1.5} />
                  )}
```

事件菱形选中描边 `stroke={isSel ? "#fff" : "none"}` 改为 `stroke={isSel ? INK.ink : "none"}`。

`styles.css` 替换/追加：

```css
.tl-unit rect {
  stroke: var(--paper);
  stroke-width: 0.5;
}
.tl-unit-current {
  stroke: var(--mark);
  stroke-width: 2;
  pointer-events: none;
}
.tl-indicator line {
  stroke: var(--mark);
  stroke-width: 1.5;
}
.tl-indicator path {
  fill: var(--mark);
}
```

- [ ] **Step 4: 运行**

Run: `npx vitest run && npm run lint`
Expected: PASS

- [ ] **Step 5: 截图核查 A 阶段**

启动 `npm run dev`（后台），用一次性脚本截全页（注入 `canvas{visibility:hidden}` 加速）：

```bash
cat > /tmp/shot.mjs <<'EOF'
import { chromium } from "playwright";
const [url, out, hide] = process.argv.slice(2);
const b = await chromium.launch({ channel: "chrome", args: ["--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto(url);
if (hide) await p.addStyleTag({ content: "canvas{visibility:hidden}" });
await p.waitForTimeout(hide ? 1500 : 20000);
await p.screenshot({ path: out });
await b.close();
EOF
arch -arm64 node /tmp/shot.mjs http://localhost:5173 /tmp/shell.png 1
```

用 Read 查看 `/tmp/shell.png`，交给用户确认后再进入 B。

- [ ] **Step 6: Commit**

```bash
git add src/components/Timeline src/styles.css
git commit -m "feat(ui): ICS pastel bands and red-pen current markers on the timeline"
```

---
# B. 地球

### Task 6: 风格枚举改为 `line | tone | plain`

先改枚举，因为地球和模型都读 `visualStyle`。

**Files:**
- Modify: `src/state/settingsStore.ts:4,57`
- Modify: `src/data/schema/index.ts:141`
- Modify: `src/data/visuals/index.ts`（13 处 `style: "hybrid"`）
- Modify: `src/scene/Models/rig.ts:24,112-116,119-144`
- Modify: `src/components/SettingsPanel/VisualSettings.tsx:23-27,46`
- Modify: `src/components/Specimen/SpecimenViewer.tsx:14`
- Modify: `src/scene/Models/models.test.ts`、`src/components/components.test.tsx:62,69`

- [ ] **Step 1: 改测试为新枚举（先让它们失败）**

```bash
sed -i '' -E 's/"hybrid"/"tone"/g; s/"wireframe"/"line"/g; s/"solid"/"plain"/g' src/scene/Models/models.test.ts src/components/components.test.tsx
```

并在 `components.test.tsx` 追加：

```tsx
it("visual style defaults to tone", () => {
  expect(useSettingsStore.getInitialState().visualStyle).toBe("tone");
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/scene/Models src/components/components.test.tsx`
Expected: FAIL（typecheck 级错误或默认值仍为 hybrid）

- [ ] **Step 3: 实现**

```bash
sed -i '' -E 's/style: "hybrid"/style: "tone"/g' src/data/visuals/index.ts
```

- `settingsStore.ts`：`export type VisualStyle = "line" | "tone" | "plain";`，默认 `visualStyle: "tone",`。
- `schema/index.ts:141`：`style: "line" | "tone" | "plain";`
- `rig.ts:24`：`export type Style = "line" | "tone" | "plain";`；`EDGE_THRESHOLD_DEG` 暂改为 `{ line: {0:28,1:50}, tone: {0:28,1:50}, plain: {0:90,1:90} }`，`applyStyle` 内 `"wireframe"` → `"line"`、`"solid"` → `"plain"`（Task 10 会整体重写）。
- `VisualSettings.tsx`：

```tsx
              <option value="tone">线稿 + 网点</option>
              <option value="line">线稿</option>
              <option value="plain">白模</option>
```

  第 46 行提示文字改为 `"降低分辨率与动画更新频率，减少模型数量"`。
- `SpecimenViewer.tsx:14`：`const STYLE_LABELS: Record<VisualStyle, string> = { line: "线稿", tone: "线稿+网点", plain: "白模" };`

- [ ] **Step 4: 运行**

Run: `npm run typecheck && npx vitest run`
Expected: PASS（`grep -rn "hybrid\|wireframe" src` 只剩 `meshBasicMaterial wireframe` 属性）

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "refactor: visual style enum line | tone | plain (default tone)"
```

---

### Task 7: 陆地遮罩

**Files:**
- Create: `src/scene/Ink/landMask.ts`
- Test: `src/scene/Ink/landMask.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// src/scene/Ink/landMask.test.ts
import type { LonLat } from "../../data/schema";
import { drawLandMask, unwrapRing } from "./landMask";

describe("unwrapRing", () => {
  it("leaves an ordinary ring untouched", () => {
    const r: LonLat[] = [[10, 0], [20, 0], [20, 10], [10, 0]];
    expect(unwrapRing(r)).toEqual(r);
  });
  it("makes a ring crossing ±180° continuous", () => {
    const r: LonLat[] = [[170, 0], [-170, 0], [-170, 10], [170, 10], [170, 0]];
    expect(unwrapRing(r).map((p) => p[0])).toEqual([170, 190, 190, 170, 170]);
  });
  it("a polar ring unwraps to a 360° span", () => {
    const r: LonLat[] = [[-180, -70], [-90, -70], [0, -70], [90, -70], [179, -70], [-180, -70]];
    const lons = unwrapRing(r).map((p) => p[0]);
    expect(Math.max(...lons) - Math.min(...lons)).toBeCloseTo(360, 6);
  });
});

/** 记录调用的假 2D 上下文。 */
function fakeCtx() {
  const calls: { op: string; args: number[] }[] = [];
  const ctx = {
    fillStyle: "",
    fillRect: (...a: number[]) => calls.push({ op: "fillRect", args: a }),
    beginPath: () => calls.push({ op: "beginPath", args: [] }),
    moveTo: (...a: number[]) => calls.push({ op: "moveTo", args: a }),
    lineTo: (...a: number[]) => calls.push({ op: "lineTo", args: a }),
    closePath: () => calls.push({ op: "closePath", args: [] }),
    fill: () => calls.push({ op: "fill", args: [] }),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

describe("drawLandMask", () => {
  it("clears to black, then draws every ring at offsets 0 and ±360", () => {
    const { ctx, calls } = fakeCtx();
    drawLandMask(ctx, [[[0, 0], [10, 0], [10, 10], [0, 0]]], 360, 180);
    expect(calls[0]).toEqual({ op: "fillRect", args: [0, 0, 360, 180] });
    const moves = calls.filter((c) => c.op === "moveTo").map((c) => c.args);
    // x = (lon + 180) / 360 * w；y = (90 - lat) / 180 * h
    expect(moves).toEqual([[180, 90], [-180, 90], [540, 90]]);
    expect(calls.filter((c) => c.op === "fill")).toHaveLength(3);
  });
  it("closes polar rings down to the pole so Antarctica fills", () => {
    const { ctx, calls } = fakeCtx();
    drawLandMask(ctx, [[[-180, -70], [0, -70], [180, -70]]], 360, 180);
    const ys = calls.filter((c) => c.op === "lineTo").map((c) => c.args[1]);
    expect(ys).toContain(180); // 补到南极
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/scene/Ink/landMask.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现**

```ts
// src/scene/Ink/landMask.ts
import { useEffect, useMemo } from "react";
import { CanvasTexture, LinearFilter, type Texture } from "three";
import type { LonLat } from "../../data/schema";

/** 经度展开为连续值：相邻点差超过 180° 时加减 360°（跨日界线的环不再横穿地图）。 */
export function unwrapRing(ring: LonLat[]): LonLat[] {
  if (!ring.length) return [];
  const out: LonLat[] = [[ring[0]![0], ring[0]![1]]];
  let offset = 0;
  for (let i = 1; i < ring.length; i++) {
    const d = ring[i]![0] - ring[i - 1]![0];
    if (d > 180) offset -= 360;
    else if (d < -180) offset += 360;
    out.push([ring[i]![0] + offset, ring[i]![1]]);
  }
  return out;
}

/**
 * 在等距圆柱 canvas 上填充陆地（白 = 陆地，黑 = 海洋）。每个环在 0、±360° 偏移各画一次，
 * 处理跨 ±180° 的环；展开后跨度达 360° 的环（极地环）补到极点闭合。
 */
export function drawLandMask(ctx: CanvasRenderingContext2D, outlines: LonLat[][], width: number, height: number) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#fff";
  const x = (lon: number) => ((lon + 180) / 360) * width;
  const y = (lat: number) => ((90 - lat) / 180) * height;
  for (const raw of outlines) {
    const ring = unwrapRing(raw);
    if (ring.length < 3) continue;
    const first = ring[0]!;
    const last = ring[ring.length - 1]!;
    const polar = Math.abs(last[0] - first[0]) >= 359;
    const poleY = y(first[1] < 0 ? -90 : 90);
    for (const off of [0, -360, 360]) {
      ctx.beginPath();
      ctx.moveTo(x(first[0] + off), y(first[1]));
      for (let i = 1; i < ring.length; i++) ctx.lineTo(x(ring[i]![0] + off), y(ring[i]![1]));
      if (polar) {
        ctx.lineTo(x(last[0] + off), poleY);
        ctx.lineTo(x(first[0] + off), poleY);
      }
      ctx.closePath();
      ctx.fill();
    }
  }
}

/** 轮廓 → 陆地遮罩纹理。轮廓变化时重建并释放旧纹理；没有轮廓时返回 null（着色器退化为全海洋）。 */
export function useLandMaskTexture(outlines: LonLat[][] | null, width = 4096): Texture | null {
  const texture = useMemo(() => {
    if (!outlines || typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = width / 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    drawLandMask(ctx, outlines, canvas.width, canvas.height);
    const t = new CanvasTexture(canvas);
    // 经度 ±180° 处 UV 跳变：不用 mipmap，避免接缝处出现一条采样错误的线
    t.generateMipmaps = false;
    t.minFilter = LinearFilter;
    t.magFilter = LinearFilter;
    return t;
  }, [outlines, width]);
  useEffect(() => () => texture?.dispose(), [texture]);
  return texture;
}
```

（遮罩用 RGBA canvas；显存优化（RedFormat）留作后续，见 spec §7。）

- [ ] **Step 4: 运行**

Run: `npx vitest run src/scene/Ink/landMask.test.ts`
Expected: PASS。若"polar"用例里 `[-180..180]` 展开跨度不足 359（原始数据极地环可能以 -180/180 首尾），按实际数据调整阈值或用例，不放宽到误判普通环。

- [ ] **Step 5: Commit**

```bash
git add src/scene/Ink/landMask.ts src/scene/Ink/landMask.test.ts
git commit -m "feat(ink): equirectangular land mask from outlines"
```

---
### Task 8: 网点材质与外轮廓材质

**Files:**
- Create: `src/scene/Ink/toneMaterial.ts`
- Test: `src/scene/Ink/toneMaterial.test.ts`

设计要点：
- 自己算光照：`lit = dot(normal, uLightDir)`，`normal` 是视空间法线（`normal_fragment_begin` 提供，flatShading 时由导数求得），`uLightDir` 是固定的视空间方向（左上前）。场景里的灯光对网点材质无效——这正是"光源跟随相机"。
- 屏幕空间 45° 网格，单元 `uCell = 4 × dpr` 像素，点半径 ∝ √d，`fwidth` 抗锯齿。
- `uCell`、`uViewportH`、`uInk` 为所有材质共享的 uniform 对象（`TONE_SHARED`），由 `ToneSync` 每帧写入。
- 外轮廓：`MeshBasicMaterial`（`BackSide`，墨色），顶点沿物体空间 `normalize(position)` 方向在视空间外扩固定像素（所有部件都是以原点为中心的基本体，用位置方向而非法线可避免盒子角上的裂缝）。

- [ ] **Step 1: 写失败测试**

```ts
// src/scene/Ink/toneMaterial.test.ts
import { BackSide, Color, MeshBasicMaterial, MeshLambertMaterial, ShaderLib, Texture, type WebGLProgramParametersWithUniforms } from "three";
import { INK } from "./inkPalette";
import { createOutlineMaterial, createToneMaterial, setToneMode, TONE_SHARED } from "./toneMaterial";

/** 用 three 自带的着色器源码模拟一次编译，检查注入点都命中。 */
function compile(mat: MeshLambertMaterial | MeshBasicMaterial, lib: "lambert" | "basic") {
  const shader = {
    vertexShader: ShaderLib[lib].vertexShader,
    fragmentShader: ShaderLib[lib].fragmentShader,
    uniforms: {},
  } as unknown as WebGLProgramParametersWithUniforms;
  mat.onBeforeCompile(shader, undefined as never);
  return shader;
}

describe("createToneMaterial", () => {
  it("is a Lambert material with the base color and the mode uniform", () => {
    const m = createToneMaterial({ base: INK.sheet, mode: "tone" });
    expect(m).toBeInstanceOf(MeshLambertMaterial);
    expect(m.color.getHexString()).toBe(new Color(INK.sheet).getHexString());
    expect(m.userData.tone.uToneMode.value).toBe(1);
  });

  it("setToneMode switches the uniform without a new material or program key", () => {
    const m = createToneMaterial({ base: INK.sheet, mode: "tone" });
    const key = m.customProgramCacheKey();
    setToneMode(m, "plain");
    expect(m.userData.tone.uToneMode.value).toBe(2);
    setToneMode(m, "line");
    expect(m.userData.tone.uToneMode.value).toBe(0);
    expect(m.customProgramCacheKey()).toBe(key);
  });

  it("injects the halftone code into the real Lambert shader", () => {
    const m = createToneMaterial({ base: INK.sheet, mode: "tone" });
    const s = compile(m, "lambert");
    expect(s.fragmentShader).toContain("uniform int uToneMode;");
    expect(s.fragmentShader).toContain("inkHalftone(");
    expect(s.fragmentShader).toMatch(/outgoingLight = inkShade\(/);
    expect(s.vertexShader).toContain("vInkObjPos = position;");
    expect(s.uniforms.uCell).toBe(TONE_SHARED.uCell); // 共享对象，不是副本
    expect(s.uniforms.uToneMode).toBe(m.userData.tone.uToneMode);
  });

  it("land mask: texture enables the mask uniform; null disables it", () => {
    const m = createToneMaterial({ base: INK.paper, mode: "tone", landMask: new Texture() });
    expect(m.userData.tone.uHasMask.value).toBe(1);
    m.userData.tone.uLandMask.value = null;
    m.userData.tone.uHasMask.value = 0;
    expect(createToneMaterial({ base: INK.paper, mode: "tone" }).userData.tone.uHasMask.value).toBe(0);
  });

  it("dots: false keeps tone mode but disables the screen dots (LOD1)", () => {
    const m = createToneMaterial({ base: INK.sheet, mode: "tone", dots: false });
    expect(m.userData.tone.uDots.value).toBe(0);
  });
});

describe("createOutlineMaterial", () => {
  it("is an ink back-face material that extrudes in screen pixels", () => {
    const m = createOutlineMaterial(2);
    expect(m.side).toBe(BackSide);
    expect(m.color.getHexString()).toBe(new Color(INK.ink).getHexString());
    const s = compile(m, "basic");
    expect(s.vertexShader).toContain("uOutlinePx");
    expect(s.uniforms.uViewportH).toBe(TONE_SHARED.uViewportH);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/scene/Ink/toneMaterial.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现**

```ts
// src/scene/Ink/toneMaterial.ts
import { BackSide, Color, MeshBasicMaterial, MeshLambertMaterial, Vector3, type Texture } from "three";
import { INK } from "./inkPalette";

/**
 * 漫画网点材质：在 Lambert 材质上注入屏幕空间网点。
 *   line：只输出底色；tone：网点 + 涂黑；plain：平滑灰阶。
 * 光源固定在视空间左上方，任何视角下都是"左上亮、右下网点渐密、边缘涂黑"。
 */
export type ToneMode = "line" | "tone" | "plain";
const MODE_INDEX: Record<ToneMode, number> = { line: 0, tone: 1, plain: 2 };

/** 所有网点 / 轮廓材质共享的 uniform（由 ToneSync 每帧写入 dpr 与视口高度）。 */
export const TONE_SHARED = {
  uCell: { value: 4 },
  uViewportH: { value: 800 },
  uInk: { value: new Color(INK.ink) },
  uLightDir: { value: new Vector3(-0.55, 0.6, 0.58).normalize() },
};

export interface ToneOptions {
  base: string;
  mode: ToneMode;
  /** 陆地遮罩（等距圆柱，白 = 陆地）。只有地球使用。 */
  landMask?: Texture | null;
  /** 陆地底色（默认 sheet）。 */
  land?: string;
  /** false：tone 档也不画网点（LOD1 小模型，避免噪点）。 */
  dots?: boolean;
}

const VERT_PARS = /* glsl */ `
varying vec3 vInkObjPos;
`;

const FRAG_PARS = /* glsl */ `
uniform int uToneMode;
uniform float uCell;
uniform float uDots;
uniform vec3 uInk;
uniform vec3 uLightDir;
uniform vec3 uLand;
uniform float uHasMask;
uniform sampler2D uLandMask;
varying vec3 vInkObjPos;

// 屏幕空间 45° 网点：返回该片元的墨量（0 = 纸，1 = 墨）
float inkHalftone(float d) {
  vec2 p = gl_FragCoord.xy / uCell;
  p = mat2(0.7071, -0.7071, 0.7071, 0.7071) * p;
  vec2 f = fract(p) - 0.5;
  float r = sqrt(clamp(d, 0.0, 1.0)) * 0.72;
  float dist = length(f);
  float aa = max(fwidth(dist), 1e-3);
  return 1.0 - smoothstep(r - aa, r + aa, dist);
}

vec3 inkShade(vec3 base, vec3 n) {
  float lit = clamp(dot(n, uLightDir), 0.0, 1.0);
  float d = 1.0 - (0.2 + 0.8 * lit);
  float land = 0.0;
  if (uHasMask > 0.5) {
    vec3 q = normalize(vInkObjPos);
    vec2 uv = vec2(atan(q.x, q.z) / (2.0 * PI) + 0.5, asin(clamp(q.y, -1.0, 1.0)) / PI + 0.5);
    land = step(0.5, texture2D(uLandMask, uv).r);
    base = mix(base, uLand, land);
  }
  if (uToneMode == 0) return base;
  if (uToneMode == 2) return mix(base, uInk, d * mix(0.55, 0.25, land));
  // tone：陆地只在背光侧叠很淡的网点；海洋网点 + 边缘涂黑
  float dl = land > 0.5 ? max(0.0, d - 0.55) * 0.5 : d;
  if (land < 0.5 && d > 0.86) return uInk;
  float ink = uDots > 0.5 ? inkHalftone(dl) : 0.0;
  return mix(base, uInk, ink);
}
`;

export function createToneMaterial({ base, mode, landMask = null, land = INK.sheet, dots = true }: ToneOptions): MeshLambertMaterial {
  const mat = new MeshLambertMaterial({ color: base, flatShading: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const own = {
    uToneMode: { value: MODE_INDEX[mode] },
    uDots: { value: dots ? 1 : 0 },
    uLand: { value: new Color(land) },
    uHasMask: { value: landMask ? 1 : 0 },
    uLandMask: { value: landMask as Texture | null },
  };
  mat.userData.tone = own;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, TONE_SHARED, own);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${VERT_PARS}`)
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvInkObjPos = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${FRAG_PARS}`)
      .replace("#include <opaque_fragment>", "outgoingLight = inkShade(diffuseColor.rgb, normal);\n#include <opaque_fragment>");
  };
  mat.customProgramCacheKey = () => "ink-tone";
  return mat;
}

/** 热切换风格：只改 uniform，不重建材质 / 程序。 */
export function setToneMode(mat: MeshLambertMaterial, mode: ToneMode) {
  (mat.userData.tone as { uToneMode: { value: number } }).uToneMode.value = MODE_INDEX[mode];
}

/** 外轮廓：背面外扩固定像素宽（与距离无关），墨色。 */
export function createOutlineMaterial(px = 1.5): MeshBasicMaterial {
  const mat = new MeshBasicMaterial({ color: INK.ink, side: BackSide });
  const own = { uOutlinePx: { value: px } };
  mat.userData.outline = own;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { uViewportH: TONE_SHARED.uViewportH }, own);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uOutlinePx;\nuniform float uViewportH;")
      .replace(
        "#include <project_vertex>",
        /* glsl */ `#include <project_vertex>
        vec3 inkDir = normalize(normalMatrix * normalize(position));
        float inkW = uOutlinePx * 2.0 * (-mvPosition.z) / (projectionMatrix[1][1] * uViewportH);
        mvPosition.xyz += inkDir * inkW;
        gl_Position = projectionMatrix * mvPosition;`,
      );
  };
  mat.customProgramCacheKey = () => "ink-outline";
  return mat;
}
```

注意：
- `normalMatrix * normalize(position)` 对非等比缩放的部件不是严格的法线变换，但方向只需"大致向外"，可接受。
- `ShaderLib.lambert.fragmentShader` 中 `normal` 变量在 `normal_fragment_begin` 中声明，`opaque_fragment` 之前可用；`PI` 来自 `<common>`。

- [ ] **Step 4: 运行**

Run: `npx vitest run src/scene/Ink/toneMaterial.test.ts && npm run typecheck`
Expected: PASS。若 `ShaderLib.basic.vertexShader` 不含 `#include <project_vertex>`（three 0.186 应含），测试会提示，改用 `#include <worldpos_vertex>` 前插入。

- [ ] **Step 5: Commit**

```bash
git add src/scene/Ink/toneMaterial.ts src/scene/Ink/toneMaterial.test.ts
git commit -m "feat(ink): screen-space halftone material and pixel outline material"
```

---
### Task 9: 地球换装（网点海洋、墨色海岸线、球体轮廓）

**Files:**
- Create: `src/scene/Ink/ToneSync.tsx`
- Modify: `src/scene/EarthScene/Globe.tsx`（整体重写）
- Modify: `src/scene/EarthScene/EarthScene.tsx`
- Modify: `src/scene/EarthScene/Graticule.tsx`
- Modify: `src/scene/Terrain/GeographyOutlines.tsx`
- Modify: `src/scene/Specimen/SpecimenScene.tsx:21,66,159`（只改 import 与背景，免得删 palette 后编译失败；完整改造在 Task 11）
- Delete: `src/scene/Wireframe/palette.ts`
- Test: `src/scene/Ink/inkPalette.test.ts`（追加经纬网配色）

- [ ] **Step 1: 追加失败测试（经纬网配色是纯函数）**

```ts
// 追加到 src/scene/Ink/inkPalette.test.ts
import { graticuleStyle } from "./inkPalette";

describe("graticuleStyle", () => {
  it("tone: paper lines over the dots; line / plain: light rule lines", () => {
    expect(graticuleStyle("tone")).toEqual({ minor: INK.paper, major: INK.sheet });
    expect(graticuleStyle("line")).toEqual({ minor: INK.rule, major: INK.ink3 });
    expect(graticuleStyle("plain")).toEqual({ minor: INK.rule, major: INK.ink3 });
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/scene/Ink/inkPalette.test.ts`
Expected: FAIL（`graticuleStyle` 未导出）

- [ ] **Step 3: 实现 `graticuleStyle`（追加到 `inkPalette.ts`）**

```ts
/** 经纬网配色：网点档用纸色细线叠在网点上，其余用浅线。 */
export function graticuleStyle(style: "line" | "tone" | "plain"): { minor: string; major: string } {
  return style === "tone" ? { minor: INK.paper, major: INK.sheet } : { minor: INK.rule, major: INK.ink3 };
}
```

- [ ] **Step 4: `ToneSync.tsx`**

```tsx
// src/scene/Ink/ToneSync.tsx
import { useFrame } from "@react-three/fiber";
import { TONE_SHARED } from "./toneMaterial";

/** 每个 Canvas 内挂一个：把设备像素比与视口高度写入共享 uniform（网点单元约 4 CSS 像素）。 */
export function ToneSync() {
  useFrame(({ gl, size }) => {
    const dpr = gl.getPixelRatio();
    TONE_SHARED.uCell.value = 4 * dpr;
    TONE_SHARED.uViewportH.value = size.height * dpr;
  });
  return null;
}
```

（两个 Canvas 的 dpr 设置相同，共享同一份 uniform 没有冲突。）

- [ ] **Step 5: 重写 `Globe.tsx`**

```tsx
import { useEffect, useMemo } from "react";
import { BackSide, IcosahedronGeometry } from "three";
import { useGeographyStore } from "../../state/geographyStore";
import { useSettingsStore } from "../../state/settingsStore";
import { EARTH_RADIUS } from "../../utils/geo";
import { INK } from "../Ink/inkPalette";
import { useLandMaskTexture } from "../Ink/landMask";
import { createToneMaterial, setToneMode } from "../Ink/toneMaterial";

/** 地球球体：海洋铺网点（背光侧加粗、边缘涂黑），陆地按当前切片的遮罩留白。 */
export function Globe() {
  // detail 5：边长约 0.034，弦高误差约 1.5e-4，远小于线稿层的抬升高度。
  const geometry = useMemo(() => new IcosahedronGeometry(EARTH_RADIUS, 5), []);
  const style = useSettingsStore((s) => s.visualStyle);
  const lowPerformance = useSettingsStore((s) => s.lowPerformance);
  const outlines = useGeographyStore((s) => s.outlines);
  const mask = useLandMaskTexture(outlines, lowPerformance ? 2048 : 4096);
  const material = useMemo(() => createToneMaterial({ base: INK.paper, mode: "tone", land: INK.sheet }), []);
  useEffect(() => setToneMode(material, style), [material, style]);
  useEffect(() => {
    material.userData.tone.uLandMask.value = mask;
    material.userData.tone.uHasMask.value = mask ? 1 : 0;
  }, [material, mask]);
  // 球面法线平滑：地球不用 flatShading，否则二十面体的面会在网点上显形
  useEffect(() => {
    material.flatShading = false;
    material.needsUpdate = true;
  }, [material]);
  useEffect(() => () => material.dispose(), [material]);
  return <mesh geometry={geometry} material={material} name="globe" />;
}

/** 球体轮廓线：略大的背面球，墨色。 */
export function GlobeRim() {
  return (
    <mesh scale={1.006} name="globe-rim">
      <sphereGeometry args={[EARTH_RADIUS, 96, 48]} />
      <meshBasicMaterial color={INK.ink} side={BackSide} />
    </mesh>
  );
}
```

- [ ] **Step 6: `EarthScene.tsx`**

删除 `Stars` import 与那一行、删除 `Atmosphere`、`ambientLight`、`directionalLight`（网点材质自带光照，其他材质都是 Basic），引入：

```tsx
import { INK } from "../Ink/inkPalette";
import { ToneSync } from "../Ink/ToneSync";
import { Globe, GlobeRim } from "./Globe";
```

```tsx
      <color attach="background" args={[INK.paper]} />
      <ToneSync />
      <Globe />
      <GlobeRim />
```

注意：`GlobeCreatures` 的模型在 Task 10 改成网点材质后不再依赖场景灯光；Task 9 到 Task 10 之间模型暂时偏暗属正常。

- [ ] **Step 7: `Graticule.tsx` 与 `GeographyOutlines.tsx`**

`Graticule.tsx`：删 `PALETTE` import，改为

```tsx
import { useSettingsStore } from "../../state/settingsStore";
import { graticuleStyle } from "../Ink/inkPalette";
// 组件内：
  const colors = graticuleStyle(useSettingsStore((s) => s.visualStyle));
```

三处 `PALETTE.graticuleMinor` → `colors.minor`，`PALETTE.graticuleMajor` → `colors.major`。

`GeographyOutlines.tsx`：

```tsx
import { INK } from "../Ink/inkPalette";
// …
  if (outlines) return <SphereLines lines={outlines} radius={1.002} color={INK.ink} name="outlines" />;
  if (showReference && reference) {
    return <SphereLines lines={reference} radius={1.002} color={INK.ink3} opacity={0.5} name="reference-coastline" />;
  }
```

- [ ] **Step 8: 观察窗的临时适配，删除旧色板**

`SpecimenScene.tsx`：`import { PALETTE } from "../Wireframe/palette";` → `import { INK } from "../Ink/inkPalette";`；`PALETTE.graticuleMinor` → `INK.rule`；`PALETTE.background` → `INK.paper`。然后：

```bash
git rm src/scene/Wireframe/palette.ts
grep -rn "Wireframe/palette" src   # 应无输出
```

- [ ] **Step 9: 验证**

Run: `npm run typecheck && npm run lint && npx vitest run`
Expected: PASS

截图（不隐藏 canvas，约 1–2 分钟）：

```bash
arch -arm64 node /tmp/shot.mjs http://localhost:5173 /tmp/globe.png
```

用 Read 检查：纸色背景、海洋网点左上稀右下密、右下边缘涂黑、陆地留白、墨色海岸线与球体轮廓。再拖时间轴到 250 Ma 截一张，确认盘古大陆遮罩与海岸线吻合（跨 ±180° 的陆块、南极洲没有缺块或横条）。请用户确认 B 的效果。

- [ ] **Step 10: Commit**

```bash
git add src/scene
git commit -m "feat(globe): halftone ocean with land mask, ink coastlines and rim"
```

---
# C. 生物模型、观察窗与标记

### Task 10: 模型风格 `applyStyle` 重写

**Files:**
- Modify: `src/scene/Models/rig.ts:1-16,111-144`
- Test: `src/scene/Models/models.test.ts:44-60`（替换风格用例）

- [ ] **Step 1: 替换风格测试**

把 `models.test.ts` 中 "styles: …" 用例（Task 6 sed 后为 plain/tone 版本）整体替换为：

```ts
  const outlines = (root: Object3D) => {
    let n = 0;
    root.traverse((o) => o instanceof Mesh && o.name === "outline" && n++);
    return n;
  };
  const fills = (root: Object3D) => {
    const out: MeshLambertMaterial[] = [];
    root.traverse((o) => o instanceof Mesh && o.name !== "outline" && out.push(o.material as MeshLambertMaterial));
    return out;
  };

  it("styles: tone / line have edges + outline on every part; plain has neither", () => {
    const v = VISUAL_BY_ID["viz-tyrannosaurus"]!;
    const tone = buildRig(v, 0, "tone");
    const line = buildRig(v, 0, "line");
    const plain = buildRig(v, 0, "plain");
    const parts = fills(tone.root).length;
    expect(count(tone.root, LineSegments)).toBe(parts);
    expect(outlines(tone.root)).toBe(parts);
    expect(outlines(line.root)).toBe(parts);
    expect(count(plain.root, LineSegments)).toBe(0);
    expect(outlines(plain.root)).toBe(0);
  });

  it("fills are paper-white tone materials in the matching mode; LOD1 tone has no dots", () => {
    const v = VISUAL_BY_ID["viz-mammoth"]!;
    const mode = (r: ReturnType<typeof buildRig>) => fills(r.root).map((m) => m.userData.tone.uToneMode.value);
    expect(new Set(mode(buildRig(v, 0, "line")))).toEqual(new Set([0]));
    expect(new Set(mode(buildRig(v, 0, "tone")))).toEqual(new Set([1]));
    expect(new Set(mode(buildRig(v, 0, "plain")))).toEqual(new Set([2]));
    for (const m of fills(buildRig(v, 0, "tone").root)) {
      expect(m.color.getHexString()).toBe(new Color(INK.sheet).getHexString());
      expect(m.userData.tone.uDots.value).toBe(1);
    }
    for (const m of fills(buildRig(v, 1, "tone").root)) expect(m.userData.tone.uDots.value).toBe(0);
  });

  it("dispose releases outline and edge resources", () => {
    const rig = buildRig(VISUAL_BY_ID["viz-trilobite"]!, 0, "tone");
    const disposed: string[] = [];
    rig.root.traverse((o) => {
      if (o instanceof Mesh || o instanceof LineSegments) {
        (o.material as Material).addEventListener("dispose", () => disposed.push(o.name || o.type));
      }
    });
    rig.dispose();
    expect(disposed.filter((n) => n === "outline").length).toBeGreaterThan(0);
    expect(disposed.filter((n) => n === "edges").length).toBeGreaterThan(0);
  });
```

文件顶部 import 改为：

```ts
import { Color, LineSegments, Mesh, MeshLambertMaterial, type Material, type Object3D } from "three";
import { INK } from "../Ink/inkPalette";
```

"edge lines are … sparser at LOD1" 用例保留（Task 6 已改为 `"line"`）。

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/scene/Models/models.test.ts`
Expected: FAIL（没有 outline 子网格，材质不是 Lambert）

- [ ] **Step 3: 实现**

`rig.ts` import 去掉 `Color`、`MeshStandardMaterial`，加：

```ts
import { INK } from "../Ink/inkPalette";
import { createOutlineMaterial, createToneMaterial } from "../Ink/toneMaterial";
```

替换第 111–144 行：

```ts
/** 折边阈值：LOD0 显示适度的内部边线，LOD1 只保留明显轮廓（PLAN §6.3）。 */
const EDGE_THRESHOLD_DEG: Record<Lod, number> = { 0: 28, 1: 50 };

/**
 * 墨线 + 网点：填充一律白纸底（不用物种色），tone 档叠网点，plain 档平滑灰阶；
 * line / tone 档加折边线与背面外扩外轮廓。LOD1 在地球上只有图标大小，不画网点。
 */
function applyStyle(parts: { mesh: Mesh; tone: PartSpec["tone"] }[], style: Style, lod: Lod) {
  for (const { mesh } of parts) {
    mesh.material = createToneMaterial({ base: INK.sheet, mode: style, dots: lod === 0 });
    if (style === "plain") continue;
    const edges = new LineSegments(new EdgesGeometry(mesh.geometry, EDGE_THRESHOLD_DEG[lod]), new LineBasicMaterial({ color: INK.ink }));
    edges.name = "edges";
    edges.raycast = () => {};
    mesh.add(edges);
    // 外轮廓与部件共用几何体（dispose 重复调用无害）
    const outline = new Mesh(mesh.geometry, createOutlineMaterial(lod === 0 ? 1.5 : 1));
    outline.name = "outline";
    outline.raycast = () => {};
    mesh.add(outline);
  }
}
```

`finish` 中调用改为 `applyStyle(this.parts, style, this.lod);`。`color` / `accent` 参数保留在签名里（数据仍提供，化石点等别处可能用），但加注释 `// 墨线风格下模型不使用物种色`；若 lint 报未使用参数，改名为 `_color` / `_accent`。

注意 `outline` 作为 `mesh` 的子节点会继承部件的位置与缩放——正是需要的。`traverse` 的 dispose 会遍历到它。

- [ ] **Step 4: 运行**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/scene/Models
git commit -m "feat(models): ink edges, pixel outlines and halftone fills"
```

---

### Task 11: 近距离观察窗

**Files:**
- Modify: `src/scene/Specimen/SpecimenScene.tsx:38-79,157-162`

- [ ] **Step 1: 改 `Terrain`**

```tsx
function Terrain({ half, asset }: { half: number; asset: VisualizationAsset }) {
  const style = useSettingsStore((s) => s.visualStyle);
  const water = asset.locomotion === "swim";
  // …（height / ground / contours 计算不变）
  const groundMat = useMemo(() => createToneMaterial({ base: INK.paper, mode: "tone" }), []);
  useEffect(() => setToneMode(groundMat, style), [groundMat, style]);
  useEffect(() => () => groundMat.dispose(), [groundMat]);
  return (
    <group name="terrain">
      <mesh geometry={ground} material={groundMat} />
      <lineSegments geometry={contours}>
        <lineBasicMaterial color={INK.rule} />
      </lineSegments>
      {water && (
        <mesh position={[0, asset.sizeM * 1.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[half * 2, half * 2, 12, 12]} />
          <meshBasicMaterial color={INK.ink3} wireframe transparent opacity={0.25} />
        </mesh>
      )}
    </group>
  );
}
```

（删除原来的地面线框网格；import `createToneMaterial, setToneMode` 与 `ToneSync`。）

- [ ] **Step 2: 改 `SpecimenScene` 的返回**

```tsx
      <color attach="background" args={[INK.paper]} />
      <ToneSync />
      <Terrain half={half} asset={asset} />
```

删除 `ambientLight` 与 `directionalLight`。

- [ ] **Step 3: 验证**

Run: `npm run typecheck && npm run lint && npx vitest run`
Expected: PASS

截图：打开霸王龙观察窗（Task 13 的 e2e 辅助或手工：dev 模式下 `window.__timeEngine` 跳到 68 Ma，点详情卡"近距离观察"），对三档风格各截一张；逐个原型（三叶虫、鱼、植物、四足、兽脚类、翼龙、人族）检查外轮廓是否穿插。穿插明显的部件把 `createOutlineMaterial` 像素宽降到 1。请用户确认 C 的效果。

- [ ] **Step 4: Commit**

```bash
git add src/scene/Specimen
git commit -m "feat(specimen): paper ground with halftone, rule contours"
```

---

### Task 12: 化石点与事件标记

**Files:**
- Modify: `src/scene/Living/FossilSites.tsx:10,28,87-96`
- Modify: `src/styles.css`（`.event-marker*` 规则）
- Modify: `src/scene/Living/EventMarkers.tsx:24,38,47`

- [ ] **Step 1: 化石点**

`FossilSites.tsx`：`SPECIES_COLORS` → `SPECIES_COLORS_MUTED`；渲染改为墨色底点 + 彩色点（`PointsMaterial` 不能描边，用下层稍大的墨点代替）：

```tsx
import { INK } from "../Ink/inkPalette";
// …
    <group name="fossil-sites">
      <points geometry={all.geometry} raycast={() => null} renderOrder={1}>
        <pointsMaterial color={INK.ink} size={7} sizeAttenuation={false} depthWrite={false} />
      </points>
      <points geometry={all.geometry} onClick={onClick} renderOrder={2}>
        <pointsMaterial vertexColors size={5} sizeAttenuation={false} depthWrite={false} />
      </points>
      {selected.owners.length > 0 && (
        <>
          <points geometry={selected.geometry} raycast={() => null} renderOrder={3}>
            <pointsMaterial color={INK.ink} size={13} sizeAttenuation={false} depthWrite={false} />
          </points>
          <points geometry={selected.geometry} raycast={() => null} renderOrder={4}>
            <pointsMaterial color={INK.mark} size={9} sizeAttenuation={false} depthWrite={false} />
          </points>
        </>
      )}
    </group>
```

- [ ] **Step 2: 事件标记**

`EventMarkers.tsx`：`EventEmphasis` 只有 `"active" | "near"`（表示时间远近，不是重要性），所以"重大事件"按类别判断：

```tsx
import { INK } from "../Ink/inkPalette";
// Marker 内，替换第 24 行
  const color = event.category === "extinction" ? INK.mark : INK.ink;
```

点的 `style={{ background: color }}` 与外层 `style={{ color }}` 保留。`CATEGORY_STYLE` import 若不再使用则删除。

`styles.css` 中 `.event-marker-btn` 等改为：

```css
.event-marker-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 1px 6px 1px 3px;
  font-size: 11px;
  color: inherit;
  background: var(--sheet);
  border: 1px solid currentColor;
  border-radius: 0;
  pointer-events: auto;
}
.event-marker.selected .event-marker-btn {
  background: var(--sheet);
  border-width: 2px;
  font-weight: 700;
}
.event-marker-dot {
  width: 7px;
  height: 7px;
  transform: rotate(45deg);
}
```

（`.event-marker` 与 `.event-marker.near` 不变。注意 Task 3 的 sed 已把这里的 `border-radius` 改为 0、把 `rgba(...)` 按表替换，本步直接整段覆盖这三条规则即可。）

- [ ] **Step 3: 验证**

Run: `npm run typecheck && npm run lint && npx vitest run`
Expected: PASS；截图寒武纪（500 Ma）全球视角：化石点在网点海洋上清晰可辨。

- [ ] **Step 4: Commit**

```bash
git add src/scene/Living src/styles.css
git commit -m "feat(markers): ink-ringed muted fossil sites, paper event tags"
```

---

### Task 13: e2e 更新、整轮验证、文档

**Files:**
- Modify: `e2e/globe.spec.ts:30-41,79-90,188-211`
- Modify: `TASKS.md`、`HANDOFF.md`、`README.md`（操作说明中如有"星空""青色"等字样）

- [ ] **Step 1: `canvasStats` 改统计墨色像素**

```ts
    let lit = 0;
    let ink = 0;
    let hash = 0;
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b] = [data[i]!, data[i + 1]!, data[i + 2]!];
      if (r + g + b > 40) lit++;
      if (r < 60 && g < 60 && b < 60) ink++;
      if (i % 388 === 0) hash = (hash * 31 + r + g * 7 + b * 13) >>> 0;
    }
    const canvas = document.querySelector("canvas")!;
    return { width: canvas.clientWidth, height: canvas.clientHeight, litRatio: lit / (data.length / 4), ink, hash };
```

- [ ] **Step 2: 更新断言**

- "renders a real WebGL globe…"：`litRatio` 改为 `expect(stats.litRatio).toBeGreaterThan(0.5)`（纸色背景几乎全亮），`expect(stats.ink).toBeGreaterThan(2000)`（海岸线 + 网点 + 涂黑）。
- "window resize…"：外框占 `2 × (8 + 1)` 像素：

```ts
  expect(small.width).toBe(900 - 18 - 300);
  expect(small.height).toBe(600 - 18 - 52 - 164);
```

- "layer toggles…"：关闭海岸线后墨色像素下降（网点仍在，不再是 1/5）：

```ts
  const withLines = (await canvasStats(page)).ink;
  await page.getByTestId("toggle-outlines").click();
  await page.waitForTimeout(300);
  expect((await canvasStats(page)).ink).toBeLessThan(withLines * 0.9);
  await expect(page.getByTestId("geo-caption")).toHaveCount(0);
  await page.getByTestId("toggle-outlines").click();
  await page.waitForTimeout(300);
  expect((await canvasStats(page)).ink).toBeGreaterThan(withLines * 0.95);
```

（关闭海岸线后陆地遮罩也随 `outlines` 一起……注意：遮罩取自 `geographyStore.outlines`，与开关无关，所以只少了海岸线。若下降幅度不足 10%，先打印两次的数值，按实测设阈值并在注释写明。）

- [ ] **Step 3: 运行 globe e2e（后台）**

先问用户是否现在跑完整 e2e。获准后：

```bash
arch -arm64 npx playwright test e2e/globe.spec.ts
```

（`run_in_background: true`）。失败时先看是否是旧断言过时（如 `current-time` 文本格式），按实际界面修正；真回归则回到对应 Task 修复。随后同样跑 `e2e/timeline.spec.ts`、`e2e/time.spec.ts`。

- [ ] **Step 4: 全量本地验证**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: 全部通过，记录测试文件数 / 用例数。

- [ ] **Step 5: 文档**

`TASKS.md` 追加"墨线 + 网点改版 — 2026-10-xx"小节：完成内容、测试命令与结果表、剩余问题（屏幕空间网点在相机运动时贴屏、外轮廓在薄部件上的穿插情况、遮罩显存）。`HANDOFF.md`：§1 状态、§4 架构加 `scene/Ink/`、§5 决策加"墨线 + 网点（方案 1：材质内网点 + 几何描线）"、§6 下一步回到 Phase 8。`diag5.tmp.mjs` 询问用户后删除或加入 `.gitignore`。

- [ ] **Step 6: Commit**

```bash
git add e2e TASKS.md HANDOFF.md README.md .gitignore docs/superpowers
git commit -m "test(e2e): ink pixel stats and frame sizes; docs for ink redesign"
```
