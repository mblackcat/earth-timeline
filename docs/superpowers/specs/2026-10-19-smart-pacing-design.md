# 智能倍速（子项目 1/5）设计

> 2026-10-19 · 细节打磨系列：1 智能倍速 → 2 板块漂移插值 → 3 物种库扩充 + 比例 → 4 远景/洲视图 → 5 近地视图

## 问题

恒定倍率下（默认"全史 60 秒" ≈ 7600 万年/秒），前寒武纪 40 亿年占 53 秒的空白，全新世一万多年在一帧内闪过。

## 目标

- 新增"智能"倍速：内容密集处放慢、稀疏处加快，全程时长可预期（约 3 分钟 / 约 10 分钟两档）。
- 默认倍速改为"智能 · 约 3 分钟"。
- 不破坏既有不变式：只有 `TimeEngine` 改时间；速度与帧率无关、无累积漂移；跳转 / 换向 / 暂停语义不变。

## 方案：时间扭曲坐标

在归一化时间轴位置 u（`TimeScale` 分段压缩刻度，0 = 最古老，1 = 现代）上定义注意力密度 ρ(u) ≥ 1，积分并归一化得到扭曲坐标

```
W(u) = ∫₀ᵘ ρ(s) ds / ∫₀¹ ρ(s) ds ∈ [0, 1]，单调递增
```

智能模式下引擎在 w 上匀速播放：`w = w锚 ± elapsed / T`（T = 目标总秒数），再换算 `u = W⁻¹(w)`、`yearsAgo = scale.fromU(u)`。
ρ 大的地方放慢。

### 密度 ρ(u) = 基础节奏 B(u) × 内容峰值 K(u)

```
B(u) = (1 − λ) + λ · |d ln(t+c)/du| / 平均值        λ = 0.65
K(u) = 1 + (S − 1) · tanh( Σᵢ aᵢ · exp(−½ · ((ln(t(u)+c) − ln(tᵢ+c)) / σ)²) )
```

- 基础节奏混合"时间轴匀速"与"对数时间匀速"（每个数量级耗时相同）。调参发现只用时间轴匀速时前寒武纪仍占 1/5、近 240 年不到 1 秒（时间轴每段内部是线性的），因此混入对数时间。

- t(u) 为 u 处的 yearsAgo；c = 100 年（让"现在"附近对数有限）；σ 为对数时间里的峰宽。
- 峰值来源与权重 aᵢ：事件（取锚点年代）1.0；物种出现 / 灭绝 0.6；显生宙纪的边界 0.4。不计入元古宙以前的纪（多为整数年龄的年代地层划分）与古地理切片（只是采样年代），否则前寒武纪整体放慢。
- σ = 0.12，S = 6：局部最多放慢到基础节奏的 1/6；tanh 让密集簇饱和，不会无限放慢。
- 常量（σ、权重、S）集中在 `pacing.ts` 顶部，实现时打印分段耗时表调参，记录在 TASKS。

### 查找表

- u 均匀采样 N = 8192 点，梯形积分得 W；W 与 W⁻¹ 都用二分 + 线性插值。
- u ↔ yearsAgo 始终用 `TimeScale` 精确换算（不跨段插值年份）。
- 瞬时倍率（年/秒）= `scale.yearsPerU(u) / (dW/du) / T`，供界面显示。

### 调参结果（全程 180 秒）

前寒武纪 30 s · 古生代–中生代 54 s · 新生代至第四纪 23 s · 第四纪（全新世前）35 s · 全新世 38 s（其中近 240 年 6 s）。

## 模块与接口

- `src/timeline/pacing.ts`（纯 TS，不依赖数据）：
  - `buildPacing({ scale, anchors: { yearsAgo, weight }[] }) → Pacing`
  - `Pacing.toW(yearsAgo)`、`Pacing.fromW(w)`、`Pacing.rateAt(yearsAgo, seconds)`
- `src/simulation/pacingAnchors.ts`：从 events / species / timescale 收集峰值锚点（数据依赖只在这里，timeline 层保持不依赖数据）。
- `TimeEngine`：
  - `PlaybackMode` 新增 `"smart"`；新增 `setPacing(p)`（runtime 注入）与 `setSmartDuration(seconds)`。
  - 智能模式位置 = `fromW(clamp01(w锚 ± elapsed/T))`；边界判定、重新锚定逻辑与其他模式一致。
  - 快照新增 `smartSeconds`；`rate` 在智能模式下为瞬时倍率。
  - 没有注入 pacing 时 `setMode("smart")` 无效（返回 false），引擎测试不依赖数据。
- `speeds.ts`：预设 `smart-180`、`smart-600`（mode `"smart"`，`smartSeconds`）；`DEFAULT_SPEED_ID = "smart-180"`；`matchSpeedPreset` 识别智能预设。
- 界面：倍速下拉加两项；设置面板"当前倍率"在智能模式下显示"≈ X/秒 · 智能模式"。精细 / 深时 / 自定义操作切出智能模式，行为同现在。

## 测试

- `pacing.test.ts`：W 单调、W(0)=0、W(1)=1；`fromW(toW(t)) ≈ t`；无锚点时等价于时间轴匀速；锚点附近瞬时倍率低于空白段；放慢上限 ≤ S。
- `TimeEngine.test.ts`：智能模式全程耗时 = T（±1 帧）；播放中暂停 / 换向 / 跳转时间连续；到达边界停止；未注入 pacing 时拒绝切换。
- `speeds` / `PlaybackBar` 测试：预设匹配、默认档。
- 既有"不改相机"测试覆盖新预设。
- e2e：`time.spec.ts` / `timeline.spec.ts` 里依赖默认倍速的断言按新默认更新。

## 不做

- 不根据相机视野中的内容动态调速（当前视野无关全局节奏）。
- 不在事件处自动暂停。
