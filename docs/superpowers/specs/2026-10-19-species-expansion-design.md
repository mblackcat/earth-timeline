# 物种库扩充 + 比例统一（子项目 3/5）设计

> 2026-10-19 · 细节打磨系列：1 智能倍速 ✓ → 2 板块漂移插值 ✓（待迭代）→ **3 物种库扩充 + 比例** → 4 远景/洲视图 → 5 近地视图

## 问题

- 只有 13 个代表性物种（7 个模型原型），多数时期地球上只有一两种生物，内容单一。
- 地球上的模型按"屏幕高度 34 px"归一化：扁宽的三叶虫占地面积巨大，比例失调。
- 子项目 4 需要"按考证数据的数量级"决定散布密度，目前没有对应字段。

## 目标

- 物种扩到 100 种以上，分两批：**第 1 批**补齐显生宙各纪（含植物、海洋生物、埃迪卡拉生物群）至约 55 种，并完成全部基础设施；**第 2 批**新生代与现代动植物约 55 种，并接入 GBIF 现代分布。
- 每条记录的年代都有来源，规则不变：`[文献]`（DOI 经 Crossref 核对）> `[地层]`（ICS v2024/12）> `[PBDB]`（年代中值 2.5%–97.5% 分位）。核实不了的数字不挂到文献名下。
- 地球上的模型比例可读：小生物小、大生物大，但都看得见。
- 每个物种有丰度等级（记录数量级），供子项目 4 使用。

## 1. 数据与核实流程

- 研究工作按地质时期拆给并行子代理：查文献（Crossref API 核对 DOI 的标题 / 期刊 / 卷页）与 PBDB 记录（`occs/list` 的 eag/lag 分位与记录数），产出与 `Species` / `Source` 结构一致的条目草稿和核实记录。主会话逐条审核后合并。
- PBDB 查询名登记到 `PBDB_NAMES`；之后按既有顺序跑 `fetch-pbdb-sites` → `fetch-paleogeography --points-only` → `npm test`。
- 化石点不足 1 个的物种不收录（地球上无处可放）。

## 2. 丰度等级

- `Species.abundanceTier: 1 | 2 | 3 | 4` 不手填，由生成数据计算：`fossil-sites` 文件已有 `occurrences`（年代范围内的 PBDB 记录数）。
- 分档：1 < 30 条；2 = 30–299；3 = 300–2,999；4 ≥ 3,000（log10 分桶）。函数 `abundanceTier(occurrences)` 放在 `simulation/abundance.ts`，有单元测试。
- 详情卡显示"化石记录：约 N 条（数量级 k / 4）"，并注明：记录数受保存条件与采样强度影响，只是丰度的粗略代理。
- 第 2 批的现生物种用 GBIF 观测记录数，同样分档并注明。

## 3. 比例统一

- 地球上的模型尺寸改按**外形最大尺寸**（包围盒长 / 宽 / 高的最大值）归一化，不再按高度。
- 屏幕像素 = `clamp(14, 48, 25 · sizeM^0.21)`（sizeM 为体长 / 株高，米；指数由"6 cm ≈ 14 px、12 m ≈ 42 px"反推）。例：6 cm 三叶虫 14 px，1.7 m 智人 28 px，12 m 霸王龙 42 px，25 m 腕龙 48 px（上限）。函数 `globeModelPx(sizeM)` 放在 `simulation/` 并测试单调与夹取。
- 观察窗仍为真实比例，不变。

## 4. 模型原型

新增 9 个原型（程序化低多边形，与现有 7 个一起覆盖第 1 批）：

| 原型 | 形态参数 | 物种 |
|---|---|---|
| `arthropod` | 体节数、足对数、前附肢、侧鳍片、背刺、尾刺 | 奇虾、马尔拉虫、怪诞虫、板足鲎、节胸蜈蚣 |
| `sessile` | 形态：杯 / 柄+冠 / 叶状 / 盘状 | 古杯动物、海百合、查恩海鳃、狄更逊水母 |
| `cephalopod` | 壳：直锥 / 平旋；触手数 | 内角石、菊石 |
| `tree` | 树干高宽比、冠型：鳞木顶冠 / 木贼轮生 / 舌羊齿 / 针叶 / 扇叶（银杏）/ 无冠（原杉藻） | 古羊齿、鳞木、芦木、舌羊齿、二叉羊齿、银杏、原杉藻 |
| `insect` | 翼展、翅对数、腹长 | 巨脉蜻蜓 |
| `sauropod` | 颈长、尾长、前后肢比 | 板龙、腕龙 |
| `bird` | 翼展、尾羽长 | 始祖鸟 |
| `marineReptile` | 颈长、鳍形、尾鳍有无 | 鱼龙、蛇颈龙、沧龙、幻龙 |
| `herb` | 茎数、花 / 孢子囊、高度 | 古果、莱尼蕨 |

既有原型的参数扩展：`fish`（鲨形：歪尾、背鳍；螺旋齿）、`quadruped`（背帆、背板、颈盾 + 角、獠牙）、`theropod`（体型粗细、背帆、长吻）。每个原型实现 idle / move（固着类只有 idle 摆动），`animationSet` 只写已实现片段（既有测试保证）。

## 5. 第 1 批物种（新增 42 种，合计 55 种）

括号内为原型；年代与来源在核实后写入数据，以下仅为候选范围。

- **埃迪卡拉纪**：狄更逊水母 *Dickinsonia*（sessile·盘）、查恩海鳃 *Charnia*（sessile·叶）
- **寒武纪**：奇虾 *Anomalocaris*（arthropod）、马尔拉虫 *Marrella*（arthropod）、怪诞虫 *Hallucigenia*（arthropod）、古杯动物 Archaeocyatha（sessile·杯）
- **奥陶纪**：内角石 *Endoceras*（cephalopod·直）、阿兰达甲鱼 *Arandaspis*（fish）、海百合 Crinoidea（sessile·柄）
- **志留纪**：板足鲎 *Eurypterus*（arthropod）、原杉藻 *Prototaxites*（tree·无冠）
- **泥盆纪**：古羊齿 *Archaeopteris*（tree）、提塔利克鱼 *Tiktaalik*（fish）、裂口鲨 *Cladoselache*（fish·鲨）、莱尼蕨 *Rhynia*（herb）
- **石炭纪**：鳞木 *Lepidodendron*（tree）、芦木 *Calamites*（tree）、巨脉蜻蜓 *Meganeura*（insect）、节胸蜈蚣 *Arthropleura*（arthropod）、林蜥 *Hylonomus*（quadruped）
- **二叠纪**：异齿龙 *Dimetrodon*（quadruped·背帆）、舌羊齿 *Glossopteris*（tree）、旋齿鲨 *Helicoprion*（fish·鲨）
- **三叠纪**：水龙兽 *Lystrosaurus*（quadruped）、腔骨龙 *Coelophysis*（theropod）、板龙 *Plateosaurus*（sauropod）、幻龙 *Nothosaurus*（marineReptile）、二叉羊齿 *Dicroidium*（tree）
- **侏罗纪**：腕龙 *Brachiosaurus*（sauropod）、剑龙 *Stegosaurus*（quadruped·背板）、异特龙 *Allosaurus*（theropod）、始祖鸟 *Archaeopteryx*（bird）、鱼龙 *Ichthyosaurus*（marineReptile）、蛇颈龙 *Plesiosaurus*（marineReptile）、翼手龙 *Pterodactylus*（pterosaur）、银杏 *Ginkgo*（tree·扇叶）
- **白垩纪**：三角龙 *Triceratops*（quadruped·颈盾）、伶盗龙 *Velociraptor*（theropod）、棘龙 *Spinosaurus*（theropod·背帆）、沧龙 *Mosasaurus*（marineReptile）、菊石 Ammonoidea（cephalopod·平旋）、古果 *Archaefructus*（herb）

核实中若某个候选没有可靠年代或 PBDB 化石点，换成同一时期、同一生态位的类群，并在 TASKS 记录。

## 6. 第 2 批（另行细化）

新生代与现代：哺乳动物辐射（古兽马、雷兽、走鲸、龙王鲸、恐狼、剑齿虎、大地懒、披毛犀等）、现代代表动植物（狼、棕熊、大象、蓝鲸、鸽、橡树、松、竹、禾草等）、更多海洋生物。新增原型 `whale`、`grass`，接入 GBIF 现代分布脚本 `fetch-gbif-ranges.mjs`。第 1 批完成后再写细化设计。

## 测试

- 数据：每个物种格式、来源登记、`evidenceNote` 前缀、PBDB 名与生成数据一致（既有测试自动覆盖新物种）；显生宙每个纪至少 3 个物种（新增覆盖测试）；每个原型至少被一个物种使用。
- `abundanceTier` 分档边界；`globeModelPx` 单调、夹取、示例值。
- 模型：每个新原型在三档风格、两档 LOD 下能构建，包围盒归一化正确，声明的动画片段都能播放（既有 models.test 按原型遍历）。
- 截图核查：各纪各取一个时间点，地球上的模型大小关系与观察窗。

## 不做

- 物种之间的生态关系（捕食、群落组成）——留给子项目 4 的行为。
- 化石点按各自化石年代旋转（仍按切片插值）。
