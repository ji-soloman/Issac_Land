export const BUILDING = {
  festooned_column: {
    name: '花环石柱',
    effect_info: '文化+3 食物+5',
    tech_info: '无',
    region_info: '主城区 住宅区',
    require_region(category) {
      return category.main || category.living;
    },
    require_tech(tech) {
      return true;
    },
    require_race(race) {
      return race == 'human';
    },
    cost: {
      magic: 1,
      mine: 2,
    },
    effect: {},
    round: 2,
  },

  blood_totem: {
    name: '鲜血图腾柱',
    effect_info: '文化+3 骑兵人口+2',
    tech_info: '无',
    region_info: '主城区 住宅区',
    require_region(category) {
      return category.main || category.living;
    },
    require_tech(tech) {
      return true;
    },
    require_race(race) {
      return race == 'orc';
    },
    cost: {
      magic: 1,
      mine: 2,
    },
    effect: {},
    round: 2,
  },

  rune_column: {
    name: '秘纹石柱',
    effect_info: '文化+8',
    tech_info: '无',
    region_info: '主城区 住宅区',
    require_region(category) {
      return category.main || category.living;
    },
    require_tech(tech) {
      return true;
    },
    require_race(race) {
      return race == 'elf';
    },
    cost: {
      magic: 1,
      mine: 2,
    },
    effect: {},
    round: 2,
  },

  ancestor_column: {
    name: '先祖石柱',
    effect_info: '文化+4 矿石+4',
    tech_info: '无',
    region_info: '主城区 住宅区',
    require_region(category) {
      return category.main || category.living;
    },
    require_tech(tech) {
      return true;
    },
    require_race(race) {
      return race == 'dwarf';
    },
    cost: {
      magic: 1,
      mine: 2,
    },
    effect: {},
    round: 2,
  },

  junk_heap: {
    name: '垃圾堆',
    effect_info: '文化+5 随机材料+1',
    tech_info: '无',
    region_info: '主城区 住宅区',
    require_region(category) {
      return category.main || category.living;
    },
    require_tech(tech) {
      return true;
    },
    require_race(race) {
      return race == 'goblin';
    },
    cost: {
      magic: 1,
      mine: 2,
    },
    effect: {},
    round: 2,
  },

  contract_column: {
    name: '契约石柱',
    effect_info: '文化+3 施法人口+2',
    tech_info: '无',
    region_info: '主城区 住宅区',
    require_region(category) {
      return category.main || category.living;
    },
    require_tech(tech) {
      return true;
    },
    require_race(race) {
      return race == 'beastfolk';
    },
    cost: {
      magic: 1,
      mine: 2,
    },
    effect: {},
    round: 2,
  },

  banner_pillar: {
    name: '大纛旗帜',
    effect_info: '文化+3 畜牧槽位+1',
    tech_info: '无',
    region_info: '主城区 住宅区',
    require_region(category) {
      return category.main || category.living;
    },
    require_tech(tech) {
      return true;
    },
    require_race(race) {
      return race == 'centaur';
    },
    cost: {
      magic: 1,
      mine: 2,
    },
    effect: {},
    round: 2,
  },

  ancient_serpent_column: {
    name: '古蛇石柱',
    effect_info: '文化+3 施法人口+2',
    tech_info: '无',
    region_info: '主城区 住宅区',
    require_region(category) {
      return category.main || category.living;
    },
    require_tech(tech) {
      return true;
    },
    require_race(race) {
      return race == 'lizard';
    },
    cost: {
      magic: 1,
      mine: 2,
    },
    effect: {},
    round: 2,
  },

  coral_column: {
    name: '碧海珊瑚柱',
    effect_info: '文化+3 魔石+1',
    tech_info: '无',
    region_info: '主城区 住宅区',
    require_region(category) {
      return category.main || category.living;
    },
    require_tech(tech) {
      return true;
    },
    require_race(race) {
      return race == 'merfolk';
    },
    cost: {
      magic: 1,
      mine: 2,
    },
    effect: {},
    round: 2,
  },

  giant_egg: {
    name: '初生巨蛋',
    effect_info: '文化+5 住房+5',
    tech_info: '无',
    region_info: '主城区 住宅区',
    require_region(category) {
      return category.main || category.living;
    },
    require_tech(tech) {
      return true;
    },
    require_race(race) {
      return race == 'crowfolk';
    },
    cost: {
      magic: 1,
      food: 2,
    },
    effect: {},
    round: 2,
  },

  bug_watchtower: {
    name: '虫眼哨塔',
    effect_info: '城防+10 远程人口+2',
    tech_info: '无',
    region_info: '主城区 住宅区',
    require_region(category) {
      return category.main || category.living;
    },
    require_tech(tech) {
      return true;
    },
    require_race(race) {
      return race == 'insect';
    },
    cost: {
      magic: 1,
      mine: 2,
    },
    effect: {},
    round: 2,
  },

  garden_pillar: {
    name: '园艺立柱',
    effect_info: '文化+2 住房+10',
    tech_info: '无',
    region_info: '主城区 住宅区',
    require_region(category) {
      return category.main || category.living;
    },
    require_tech(tech) {
      return true;
    },
    require_race(race) {
      return race == 'plant';
    },
    cost: {
      magic: 1,
      culture: 2,
    },
    effect: {},
    round: 2,
  },

  spirit_tower: {
    name: '通灵塔',
    effect_info: '文化+2 步兵人口+5',
    tech_info: '无',
    region_info: '主城区 住宅区',
    require_region(category) {
      return category.main || category.living;
    },
    require_tech(tech) {
      return true;
    },
    require_race(race) {
      return race == 'undead';
    },
    cost: {
      magic: 1,
      mine: 2,
    },
    effect: {},
    round: 2,
  },

  element_pillar: {
    name: '元素母柱',
    effect_info: '文化+4 矿石+4',
    tech_info: '无',
    region_info: '主城区 住宅区',
    require_region(category) {
      return category.main || category.living;
    },
    require_tech(tech) {
      return true;
    },
    require_race(race) {
      return race == 'elemental';
    },
    cost: {
      magic: 1,
      mine: 2,
    },
    effect: {},
    round: 2,
  },

  sky_pillar: {
    name: '通天巨柱',
    effect_info: '文化+3 魔石+1',
    tech_info: '无',
    region_info: '主城区 住宅区',
    require_region(category) {
      return category.main || category.living;
    },
    require_tech(tech) {
      return true;
    },
    require_race(race) {
      return race == 'giant';
    },
    cost: {
      magic: 1,
      mine: 2,
    },
    effect: {},
    round: 2,
  },

  fengshui_cauldron: {
    name: '风水宝鼎',
    effect_info: '魔石+2',
    tech_info: '无',
    region_info: '主城区 住宅区',
    require_region(category) {
      return category.main || category.living;
    },
    require_tech(tech) {
      return true;
    },
    require_race(race) {
      return race == 'ancient';
    },
    cost: {
      magic: 1,
      mine: 2,
    },
    effect: {},
    round: 2,
  },

  skin_screen: {
    name: '人皮屏风',
    effect_info: '魔石+1 全能产槽位+1',
    tech_info: '无',
    region_info: '主城区 住宅区',
    require_region(category) {
      return category.main || category.living;
    },
    require_tech(tech) {
      return true;
    },
    require_race(race) {
      return race == 'voidfolk';
    },
    cost: {
      magic: 1,
      mine: 2,
    },
    effect: {},
    round: 2,
  },

  fence: {
    name: '栅栏',
    effect_info: '城防+5',
    tech_info: '初始',
    region_info: '主城区 军事区',
    require_region(category) {
      return category.main || category.military;
    },
    require_tech(tech) {
      return true;
    },
    cost: {
      mine: 2,
    },
    effect: {},
    round: 1,
  },

  barracks: {
    name: '兵营',
    effect_info: '步兵人口+4',
    tech_info: '军事化',
    region_info: '军事区',
    require_region(category) {
      return category.military;
    },
    require_tech(tech) {
      return true;
    },
    cost: {
      mine: 4,
    },
    effect: {},
    round: 2,
  },

  library: {
    name: '图书馆',
    effect_info: '文化+3 可以抄录卷轴 施法人口+1',
    tech_info: '著作',
    region_info: '学院区',
    require_region(category) {
      return category.academy;
    },
    require_tech(tech) {
      return tech.leadership_2;
    },
    cost: {
      mine: 5,
    },
    effect: {},
    round: 2,
  },
  toilet: {
    name: '厕所',
    effect_info: '食物+3；住房+2',
    tech_info: '肥料',
    region_info: '住宅区',
    require_region(category) {
      return category.living;
    },
    require_tech(tech) {
      return true;
    },
    cost: {
      mine: 3,
    },
    effect: {
      normal: {
        housing: 2,
      },
      turn: {
        food: 3,
      }
    },
    round: 2,
  },

  irrigation_canal: {
    name: '灌溉渠',
    effect_info: '食物+3；住房+4',
    tech_info: '灌溉',
    region_info: '农田',
    require_region(category) {
      return category.farm;
    },
    require_tech(tech) {
      return tech.fishing_2;
    },
    cost: {
      mine: 5,
    },
    effect: {
      normal: {
        housing: 4,
      },
      turn: {
        food: 3,
      }
    },
    round: 3,
  },

  aqueduct: {
    name: '引水渠',
    effect_info: '住房+6；每回合食物+2',
    tech_info: '灌溉',
    region_info: '住宅区 主城区',
    require_region(category) {
      return category.living || category.main;
    },
    require_tech(tech) {
      return tech.fishing_2;
    },
    cost: {
      mine: 5,
    },
    effect: {
      normal: {
        housing: 6,
      },
      turn: {
        food: 2,
      }
    },
    round: 3,
  },

  furnace: {
    name: '熔炉',
    effect_info: '矿石+2 魔石+1 加工品槽位+1',
    tech_info: '铸造',
    region_info: '矿场',
    require_region(category) {
      return category.mine;
    },
    require_tech(tech) {
      return true;
    },
    cost: {
      mine: 4,
    },
    effect: {},
    round: 3,
  },

  granary: {
    name: '粮仓',
    effect_info: '食物+4 繁育人口消耗食物-1',
    tech_info: '制陶',
    region_info: '住宅区 农田',
    require_region(category) {
      return category.living || category.farm;
    },
    require_tech(tech) {
      return true;
    },
    cost: {
      mine: 4,
    },
    effect: {},
    round: 2,
  },

  mill: {
    name: '磨坊',
    effect_info: '食物+5',
    tech_info: '石磨',
    region_info: '农田',
    require_region(category) {
      return category.farm;
    },
    require_tech(tech) {
      return true;
    },
    cost: {
      mine: 4,
    },
    effect: {},
    round: 3,
  },

  elevated_aqueduct: {
    name: '高架水渠',
    effect_info: '住房+4 文化+3',
    tech_info: '古代水泥',
    region_info: '住宅区 娱乐区',
    require_region(category) {
      return category.living || category.entertainment;
    },
    require_tech(tech) {
      return true;
    },
    cost: {
      mine: 5,
    },
    effect: {},
    round: 3,
  },

  ancient_wall: {
    name: '远古城墙',
    effect_info: '城防+20',
    tech_info: '夯土',
    region_info: '军事区 主城区',
    require_region(category) {
      return category.military || category.main;
    },
    require_tech(tech) {
      return true;
    },
    cost: {
      mine: 5,
    },
    effect: {},
    round: 3,
  },

  plaza: {
    name: '广场',
    effect_info: '财富+3 文化+4',
    tech_info: '早期帝国',
    region_info: '主城区 住宅区',
    require_region(category) {
      return category.main || category.living;
    },
    require_tech(tech) {
      return true;
    },
    cost: {
      mine: 3,
    },
    effect: {},
    round: 2,
  },

  underworld_gate: {
    name: '地下迷宫入口',
    effect_info: '矿石+3 商路+1 通往地下世界的入口（城市唯一）',
    tech_info: '任务解锁',
    region_info: '矿场',
    require_region(category) {
      return category.mine;
    },
    require_tech(tech) {
      return true;
    },
    cost: {
      mine: 4,
    },
    effect: {},
    round: 2,
  },

  surface_gate: {
    name: '地上世界关隘',
    effect_info: '财富+3 商路+1 通往地上世界的关隘（城市唯一）',
    tech_info: '任务解锁',
    region_info: '矿场',
    require_region(category) {
      return category.mine;
    },
    require_tech(tech) {
      return true;
    },
    cost: {
      mine: 4,
    },
    effect: {},
    round: 2,
  },

  temple: {
    name: '神殿',
    effect_info: '住房+4 施法人口+4 进入古典时代',
    tech_info: '宗教',
    region_info: '圣地',
    require_region(category) {
      return category.holy;
    },
    require_tech(tech) {
      return true;
    },
    cost: {
      mine: 10,
      magic: 1,
    },
    effect: {},
    round: 4,
  },

  hunter_hut: {
    name: '猎人小屋',
    effect_info: '食物+3 远程人口+1',
    tech_info: '弓弦',
    region_info: '牧场 住宅区',
    require_region(category) {
      return category.pasture || category.living;
    },
    require_tech(tech) {
      return true;
    },
    cost: {
      mine: 3,
    },
    effect: {},
    round: 2,
  },

  archery_range: {
    name: '靶场',
    effect_info: '远程人口+4',
    tech_info: '弓弦',
    region_info: '军事区',
    require_region(category) {
      return category.military;
    },
    require_tech(tech) {
      return true;
    },
    cost: {
      mine: 4,
    },
    effect: {},
    round: 2,
  },

  altar: {
    name: '祭坛',
    effect_info: '文化+4 施法人口+3',
    tech_info: '宗教',
    region_info: '圣地',
    require_region(category) {
      return category.holy;
    },
    require_tech(tech) {
      return true;
    },
    cost: {
      mine: 8,
    },
    effect: {},
    round: 3,
  },

  fountain: {
    name: '喷泉',
    effect_info: '施法人口+3 文化+5',
    tech_info: '哲学',
    region_info: '学院区',
    require_region(category) {
      return category.academy;
    },
    require_tech(tech) {
      return true;
    },
    cost: {
      mine: 8,
    },
    effect: {},
    round: 3,
  },

  sacrifice_hall: {
    name: '献祭大厅',
    effect_info: '施法人口+5 住房+3',
    tech_info: '教会类型',
    region_info: '圣地',
    require_region(category) {
      return category.holy;
    },
    require_tech(tech) {
      return true;
    },
    cost: {
      mine: 10,
    },
    effect: {},
    round: 4,
  },

  blessing_temple: {
    name: '祈福神殿',
    effect_info: '施法人口+5 住房+3',
    tech_info: '教会类型',
    region_info: '圣地',
    require_region(category) {
      return category.holy;
    },
    require_tech(tech) {
      return true;
    },
    cost: {
      mine: 10,
    },
    effect: {},
    round: 4,
  },

  alchemist_tower: {
    name: '炼金师高塔',
    effect_info: '施法人口+6 住房+4',
    tech_info: '教会类型',
    region_info: '圣地',
    require_region(category) {
      return category.holy;
    },
    require_tech(tech) {
      return true;
    },
    cost: {
      mine: 15,
    },
    effect: {},
    round: 4,
  },

  underground_chamber: {
    name: '地下密室',
    effect_info: '步兵人口+8 住房+3',
    tech_info: '教会类型',
    region_info: '圣地',
    require_region(category) {
      return category.holy;
    },
    require_tech(tech) {
      return true;
    },
    cost: {
      mine: 10,
    },
    effect: {},
    round: 4,
  },

  tax_office: {
    name: '税务所',
    effect_info: '财富+7',
    tech_info: '初级政府',
    region_info: '主城区',
    require_region(category) {
      return category.main;
    },
    require_tech(tech) {
      return true;
    },
    cost: {
      mine: 8,
    },
    effect: {},
    round: 3,
  },

  pier: {
    name: '栈桥',
    effect_info: '财富+2 贸易路线+1 船只人口+2',
    tech_info: '天文导航',
    region_info: '港口',
    require_region(category) {
      return category.port;
    },
    require_tech(tech) {
      return true;
    },
    cost: {
      mine: 6,
    },
    effect: {},
    round: 3,
  },

  lighthouse: {
    name: '灯塔',
    effect_info: '贸易路线+2 船只人口+2',
    tech_info: '天文导航',
    region_info: '港口',
    require_region(category) {
      return category.port;
    },
    require_tech(tech) {
      return true;
    },
    cost: {
      mine: 8,
    },
    effect: {},
    round: 3,
  },

  stable: {
    name: '马厩',
    effect_info: '骑兵人口+4 野兽人口+4 住房+4',
    tech_info: '骑术',
    region_info: '军事区',
    require_region(category) {
      return category.military;
    },
    require_tech(tech) {
      return true;
    },
    cost: {
      mine: 5,
    },
    effect: {},
    round: 2,
  },

  paddock: {
    name: '圈棚',
    effect_info: '食物+4 文化+2 骑兵人口+2 野兽人口+2',
    tech_info: '饲料',
    region_info: '牧场',
    require_region(category) {
      return category.pasture;
    },
    require_tech(tech) {
      return true;
    },
    cost: {
      mine: 8,
    },
    effect: {},
    round: 3,
  },

  trough: {
    name: '食槽',
    effect_info: '食物+4 骑兵人口+2 野兽人口+2',
    tech_info: '饲料',
    region_info: '牧场',
    require_region(category) {
      return category.pasture;
    },
    require_tech(tech) {
      return true;
    },
    cost: {
      mine: 5,
    },
    effect: {},
    round: 3,
  },

  watchtower: {
    name: '哨塔',
    effect_info: '城防+10 维护费-2 远程人口+1',
    tech_info: '砖石',
    region_info: '军事区 主城区',
    require_region(category) {
      return category.military || category.main;
    },
    require_tech(tech) {
      return true;
    },
    cost: {
      mine: 5,
    },
    effect: {},
    round: 2,
  },

  city_hall: {
    name: '市政厅',
    effect_info: '财富+6 文化+2 住房+10 民生条目+1 步兵人口+2 城市唯一',
    tech_info: '雕刻',
    region_info: '主城区',
    require_region(category) {
      return category.main;
    },
    require_tech(tech) {
      return true;
    },
    cost: {
      mine: 20,
    },
    effect: {},
    round: 5,
  },

  curved_plow_workshop: {
    name: '曲犁匠所',
    effect_info: '食物+3 文化+3',
    tech_info: '弓曲',
    region_info: '农田',
    require_region(category) {
      return category.farm;
    },
    require_tech(tech) {
      return true;
    },
    cost: {
      mine: 8,
    },
    effect: {},
    round: 3,
  },

  archer_barracks: {
    name: '弓兵营',
    effect_info: '远程人口+4 军队维护费-2',
    tech_info: '弓曲',
    region_info: '军事区',
    require_region(category) {
      return category.military;
    },
    require_tech(tech) {
      return true;
    },
    cost: {
      mine: 8,
    },
    effect: {},
    round: 3,
  },

  forest_hut: {
    name: '林中小屋',
    effect_info: '食物+2 住房+4',
    tech_info: '伐木',
    region_info: '牧场 农田',
    require_region(category) {
      return category.pasture || category.farm;
    },
    require_tech(tech) {
      return true;
    },
    cost: {
      mine: 4,
    },
    effect: {},
    round: 2,
  },

  miner_hut: {
    name: '矿工棚屋',
    effect_info: '矿石+3 住房+3 矿物槽位+1',
    tech_info: '伐木',
    region_info: '矿场',
    require_region(category) {
      return category.mine;
    },
    require_tech(tech) {
      return true;
    },
    cost: {
      mine: 8,
    },
    effect: {},
    round: 3,
  },

  farmhouse: {
    name: '农舍',
    effect_info: '食物+3 住房+3 农作物槽位+1',
    tech_info: '栽培',
    region_info: '农田',
    require_region(category) {
      return category.farm;
    },
    require_tech(tech) {
      return true;
    },
    cost: {
      mine: 5,
    },
    effect: {},
    round: 3,
  },

  siege_camp: {
    name: '工程营',
    effect_info: '攻城人口+5 住房+2',
    tech_info: '工程学',
    region_info: '军事区',
    require_region(category) {
      return category.military;
    },
    require_tech(tech) {
      return true;
    },
    cost: {
      mine: 10,
    },
    effect: {},
    round: 3,
  },

  crossbow_barracks: {
    name: '弩兵营',
    effect_info: '远程人口+4 单位维护费-2',
    tech_info: '扳机',
    region_info: '军事区',
    require_region(category) {
      return category.military;
    },
    require_tech(tech) {
      return true;
    },
    cost: {
      mine: 8,
    },
    effect: {},
    round: 3,
  },

  tower_crane: {
    name: '吊塔',
    effect_info: '城防+30 步兵人口+3 单位维护费-2',
    tech_info: '扳机',
    region_info: '军事区 主城区',
    require_region(category) {
      return category.military || category.main;
    },
    require_tech(tech) {
      return true;
    },
    cost: {
      mine: 10,
    },
    effect: {},
    round: 3,
  },

  arena: {
    name: '角斗场',
    effect_info: '文化+7 步兵人口+4 开启角斗士',
    tech_info: '乐器',
    region_info: '娱乐区',
    require_region(category) {
      return category.entertainment;
    },
    require_tech(tech) {
      return true;
    },
    cost: {
      mine: 12,
    },
    effect: {},
    round: 3,
  },
}