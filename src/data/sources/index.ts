import type { Source } from "../schema";

const doi = (d: string) => `https://doi.org/${d}`;

/**
 * 数据来源登记表。期刊论文的 DOI 均已通过 Crossref 核对标题、期刊、卷页（2026-10-17）。
 */
export const SOURCES: Record<string, Source> = {
  "natural-earth-110m-land": {
    id: "natural-earth-110m-land",
    title: "Natural Earth — 1:110m Physical Vectors, Land",
    publisher: "Natural Earth (naturalearthdata.com)",
    url: "https://www.naturalearthdata.com/downloads/110m-physical-vectors/110m-land/",
    license: "Public domain",
    accessed: "2026-10-16",
    note: "GeoJSON 取自 github.com/nvkelso/natural-earth-vector，坐标四舍五入到 0.01°。",
  },
  "ics-chart-2024-12": {
    id: "ics-chart-2024-12",
    title: "International Chronostratigraphic Chart v2024/12",
    publisher: "International Commission on Stratigraphy",
    url: "https://stratigraphy.org/ICSchart/ChronostratChart2024-12.pdf",
    accessed: "2026-10-17",
    note: "Cohen, K.M., Finney, S.C., Gibbard, P.L. & Fan, J.-X. (2013; updated). Episodes 36: 199–204。年代表边界数值来源。",
  },
  "dalrymple-2001": {
    id: "dalrymple-2001",
    title: "Dalrymple, G.B. (2001). The age of the Earth in the twentieth century: a problem (mostly) solved. Geological Society, London, Special Publications 190: 205–221.",
    url: doi("10.1144/GSL.SP.2001.190.01.14"),
  },
  "djokic-2017": {
    id: "djokic-2017",
    title: "Djokic, T. et al. (2017). Earliest signs of life on land preserved in ca. 3.5 Ga hot spring deposits. Nature Communications 8: 15263.",
    url: doi("10.1038/ncomms15263"),
  },
  "poulton-2021": {
    id: "poulton-2021",
    title: "Poulton, S.W. et al. (2021). A 200-million-year delay in permanent atmospheric oxygenation. Nature 592: 232–236.",
    url: doi("10.1038/s41586-021-03393-7"),
  },
  "wellman-2003": {
    id: "wellman-2003",
    title: "Wellman, C.H., Osterloff, P.L. & Mohiuddin, U. (2003). Fragments of the earliest land plants. Nature 425: 282–285.",
    url: doi("10.1038/nature01884"),
  },
  "daeschler-2006": {
    id: "daeschler-2006",
    title: "Daeschler, E.B., Shubin, N.H. & Jenkins, F.A. (2006). A Devonian tetrapod-like fish and the evolution of the tetrapod body plan. Nature 440: 757–763.",
    url: doi("10.1038/nature04639"),
  },
  "burgess-2014": {
    id: "burgess-2014",
    title: "Burgess, S.D., Bowring, S. & Shen, S. (2014). High-precision timeline for Earth's most severe extinction. PNAS 111: 3316–3321.",
    url: doi("10.1073/pnas.1317692111"),
  },
  "martinez-2011": {
    id: "martinez-2011",
    title: "Martinez, R.N. et al. (2011). A basal dinosaur from the dawn of the dinosaur era in southwestern Pangaea. Science 331: 206–210.",
    url: doi("10.1126/science.1198467"),
  },
  "renne-2013": {
    id: "renne-2013",
    title: "Renne, P.R. et al. (2013). Time scales of critical events around the Cretaceous-Paleogene boundary. Science 339: 684–687.",
    url: doi("10.1126/science.1230492"),
  },
  "luo-2011": {
    id: "luo-2011",
    title: "Luo, Z.-X. et al. (2011). A Jurassic eutherian mammal and divergence of marsupials and placentals. Nature 476: 442–445.",
    url: doi("10.1038/nature10291"),
  },
  "hublin-2017": {
    id: "hublin-2017",
    title: "Hublin, J.-J. et al. (2017). New fossils from Jebel Irhoud, Morocco and the pan-African origin of Homo sapiens. Nature 546: 289–292.",
    url: doi("10.1038/nature22336"),
  },
  "richter-2017": {
    id: "richter-2017",
    title: "Richter, D. et al. (2017). The age of the hominin fossils from Jebel Irhoud, Morocco, and the origins of the Middle Stone Age. Nature 546: 293–296.",
    url: doi("10.1038/nature22335"),
  },
  "walker-2009": {
    id: "walker-2009",
    title: "Walker, M. et al. (2009). Formal definition and dating of the GSSP for the base of the Holocene using the Greenland NGRIP ice core, and selected auxiliary records. Journal of Quaternary Science 24: 3–17.",
    url: doi("10.1002/jqs.1227"),
  },
  "zeder-2011": {
    id: "zeder-2011",
    title: "Zeder, M.A. (2011). The origins of agriculture in the Near East. Current Anthropology 52(S4): S221–S235.",
    url: doi("10.1086/659307"),
  },
  "woods-2010": {
    id: "woods-2010",
    title: "Woods, C. (ed.) (2010). Visible Language: Inventions of Writing in the Ancient Middle East and Beyond. Oriental Institute Museum Publications 32. Chicago: The Oriental Institute of the University of Chicago.",
    note: "图书，无 DOI。",
  },
  "allen-2009": {
    id: "allen-2009",
    title: "Allen, R.C. (2009). The British Industrial Revolution in Global Perspective. Cambridge University Press.",
    note: "图书。",
  },
  "project-baseline": {
    id: "project-baseline",
    title: "本项目时间约定：yearsAgo = 0 对应公元 2000 年初（b2k）",
    note: "见 TASKS.md §1.4 与风险 R6。",
  },
};

export function getSource(id: string): Source | undefined {
  return SOURCES[id];
}
