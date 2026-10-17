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
  "paterson-2019": {
    id: "paterson-2019",
    title: "Paterson, J.R., Edgecombe, G.D. & Lee, M.S.Y. (2019). Trilobite evolutionary rates constrain the duration of the Cambrian explosion. PNAS 116: 4394–4399.",
    url: doi("10.1073/pnas.1819366116"),
  },
  "shu-2003": {
    id: "shu-2003",
    title: "Shu, D.-G. et al. (2003). Head and backbone of the Early Cambrian vertebrate Haikouichthys. Nature 421: 526–529.",
    url: doi("10.1038/nature01264"),
  },
  "libertin-2018": {
    id: "libertin-2018",
    title: "Libertín, M. et al. (2018). Sporophytes of polysporangiate land plants from the early Silurian period may have been photosynthetically autonomous. Nature Plants 4: 269–271.",
    url: doi("10.1038/s41477-018-0140-y"),
  },
  "ahlberg-2005": {
    id: "ahlberg-2005",
    title: "Ahlberg, P.E., Clack, J.A. & Blom, H. (2005). The axial skeleton of the Devonian tetrapod Ichthyostega. Nature 437: 137–140.",
    url: doi("10.1038/nature03893"),
  },
  "vartanyan-1993": {
    id: "vartanyan-1993",
    title: "Vartanyan, S.L., Garutt, V.E. & Sher, A.V. (1993). Holocene dwarf mammoths from Wrangel Island in the Siberian Arctic. Nature 362: 337–340.",
    url: doi("10.1038/362337a0"),
  },
  "lister-sher-2015": {
    id: "lister-sher-2015",
    title: "Lister, A.M. & Sher, A.V. (2015). Evolution and dispersal of mammoths across the Northern Hemisphere. Science 350: 805–809.",
    url: doi("10.1126/science.aac5660"),
  },
  "kimbel-delezene-2009": {
    id: "kimbel-delezene-2009",
    title: "Kimbel, W.H. & Delezene, L.K. (2009). \"Lucy\" redux: a review of research on Australopithecus afarensis. American Journal of Physical Anthropology 140 (S49): 2–48.",
    url: doi("10.1002/ajpa.21183"),
  },
  "herries-2020": {
    id: "herries-2020",
    title: "Herries, A.I.R. et al. (2020). Contemporaneity of Australopithecus, Paranthropus, and early Homo erectus in South Africa. Science 368: eaaw7293.",
    url: doi("10.1126/science.aaw7293"),
  },
  "rizal-2020": {
    id: "rizal-2020",
    title: "Rizal, Y. et al. (2020). Last appearance of Homo erectus at Ngandong, Java, 117,000–108,000 years ago. Nature 577: 381–385.",
    url: doi("10.1038/s41586-019-1863-2"),
  },
  pbdb: {
    id: "pbdb",
    title: "The Paleobiology Database（PBDB），化石记录（occurrences）",
    publisher: "paleobiodb.org",
    url: "https://paleobiodb.org/",
    license: "CC BY 4.0",
    accessed: "2026-10-17",
    note: "通过 data1.2 API（occs/list）获取，由 scripts/fetch-pbdb-sites.mjs 生成 public/data/species/pbdb-sites.json。坐标为化石点的现代经纬度。",
  },
  "cao-2024": {
    id: "cao-2024",
    title: "Cao, X. et al. (2024). Earth's tectonic and plate boundary evolution over 1.8 billion years. Geoscience Frontiers 15: 101922.",
    url: doi("10.1016/j.gsf.2024.101922"),
    license: "模型数据 CC BY 4.0（Zenodo 10.5281/zenodo.11536686）",
    note: "0–1800 Ma 板块重建模型；10 亿年以内沿用 Merdith et al. (2021) 的重建。",
  },
  "gplates-web-service": {
    id: "gplates-web-service",
    title: "GPlates Web Service（EarthByte / The University of Sydney）",
    url: "https://gwsdoc.gplates.org/",
    accessed: "2026-10-17",
    note: "通过 reconstruct/coastlines 与 reconstruct/reconstruct_points 接口获取 CAO2024 模型的重建结果，由 scripts/fetch-paleogeography.mjs 生成静态文件。",
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
