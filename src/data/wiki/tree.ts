import type { WikiNode } from "./schema";

/** 百科左侧的分类树。每个物种恰好出现在一个叶节点中（species 测试中校验）；叶节点内按年代排序。 */
export const WIKI_TREE: WikiNode[] = [
  {
    id: "plants-fungi",
    label: "植物与真菌",
    children: [
      { id: "early-land", label: "早期陆地生物", speciesIds: ["cooksonia", "rhynia", "prototaxites"] },
      { id: "spore-trees", label: "石松、木贼与前裸子植物", speciesIds: ["archaeopteris", "lepidodendron", "calamites"] },
      { id: "gymnosperms", label: "种子蕨与裸子植物", speciesIds: ["glossopteris", "dicroidium", "ginkgo", "pinus", "sequoia", "metasequoia"] },
      { id: "angiosperms", label: "被子植物", speciesIds: ["archaefructus", "nelumbo", "quercus", "poaceae"] },
    ],
  },
  {
    id: "invertebrates",
    label: "无脊椎动物",
    children: [
      { id: "ediacaran", label: "埃迪卡拉生物", speciesIds: ["charnia", "dickinsonia"] },
      { id: "sponges-cnidarians", label: "古杯与珊瑚", speciesIds: ["archaeocyatha", "acropora"] },
      { id: "cambrian-oddities", label: "寒武纪奇特动物", speciesIds: ["anomalocaris", "hallucigenia"] },
      { id: "arthropods", label: "节肢动物", speciesIds: ["trilobita", "marrella", "eurypterus", "meganeura", "arthropleura"] },
      { id: "mollusks", label: "头足类", speciesIds: ["endoceras", "ammonoidea", "nautilus-pompilius"] },
      { id: "echinoderms", label: "棘皮动物", speciesIds: ["crinoidea"] },
    ],
  },
  {
    id: "fishes",
    label: "鱼类",
    children: [
      { id: "jawless", label: "无颌类", speciesIds: ["haikouichthys", "arandaspis"] },
      { id: "placoderms-sharks", label: "盾皮鱼与软骨鱼", speciesIds: ["dunkleosteus", "cladoselache", "helicoprion", "otodus-megalodon", "carcharodon-carcharias"] },
      { id: "lobe-finned", label: "肉鳍鱼", speciesIds: ["tiktaalik"] },
    ],
  },
  { id: "amphibians", label: "早期四足动物与两栖类", speciesIds: ["ichthyostega", "eryops"] },
  {
    id: "reptiles",
    label: "爬行类",
    children: [
      { id: "early-reptiles", label: "早期爬行类", speciesIds: ["hylonomus"] },
      {
        id: "dinosaurs",
        label: "恐龙",
        children: [
          { id: "theropods", label: "兽脚类", speciesIds: ["coelophysis", "allosaurus", "spinosaurus", "velociraptor", "tyrannosaurus-rex"] },
          { id: "sauropodomorphs", label: "蜥脚形类", speciesIds: ["plateosaurus", "brachiosaurus"] },
          { id: "ornithischians", label: "鸟臀类", speciesIds: ["stegosaurus", "triceratops"] },
        ],
      },
      { id: "pterosaurs", label: "翼龙", speciesIds: ["pterodactylus", "pteranodon"] },
      { id: "marine-reptiles", label: "海生爬行类", speciesIds: ["nothosaurus", "ichthyosaurus", "plesiosaurus", "mosasaurus"] },
      { id: "crocs-turtles", label: "鳄类与龟鳖类", speciesIds: ["crocodylus-niloticus", "chelonia-mydas"] },
    ],
  },
  { id: "birds", label: "鸟类", speciesIds: ["archaeopteryx", "gastornis", "aquila-chrysaetos", "columba-livia"] },
  {
    id: "synapsids",
    label: "合弓类与哺乳类",
    children: [
      { id: "early-synapsids", label: "早期合弓类与哺乳形类", speciesIds: ["dimetrodon", "lystrosaurus", "morganucodon"] },
      { id: "proboscideans", label: "长鼻类", speciesIds: ["deinotherium", "mammut-americanum", "mammuthus-primigenius", "loxodonta-africana"] },
      { id: "perissodactyls", label: "奇蹄类", speciesIds: ["hyracotherium", "megacerops", "mesohippus", "paraceratherium", "hipparion", "coelodonta-antiquitatis", "equus"] },
      { id: "artiodactyls", label: "偶蹄类", speciesIds: ["megaloceros-giganteus", "giraffa-camelopardalis", "bison-bison", "hippopotamus-amphibius", "rangifer-tarandus"] },
      { id: "cetaceans", label: "鲸类", speciesIds: ["pakicetus", "basilosaurus", "balaenoptera-musculus", "orcinus-orca"] },
      {
        id: "carnivorans",
        label: "食肉类",
        speciesIds: ["smilodon", "canis-dirus", "arctodus-simus", "canis-lupus", "ursus-arctos", "panthera-leo", "panthera-tigris", "ailuropoda-melanoleuca", "vulpes-vulpes"],
      },
      { id: "marsupials", label: "有袋类", speciesIds: ["diprotodon", "thylacoleo"] },
      { id: "xenarthrans", label: "异关节类", speciesIds: ["megatherium", "glyptodon"] },
      { id: "hominins", label: "人族", speciesIds: ["australopithecus-afarensis", "paranthropus", "homo-habilis", "homo-erectus", "homo-neanderthalensis", "homo-sapiens"] },
    ],
  },
];
