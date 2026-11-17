export const REGION = {
  main: {
    name: '主城区',
    effect_info: '住房+2',
    // 主城默认提供 2 点住房（与新建主城时的初始人口 2 对应），参与繁衍人口的住房上限计算
    effect: {
      normal: {
        housing: 2,
      },
    },
    canBuild() {
      return false;
    },
    category: {
      main: true,
    },
    color: 'living',
  },
  living: {
    name: '住宅区',
    terrainInfo: '丘陵，平原，沙漠，森林（矮人可山脉）',
    effect_info: '住房+6，加工品槽位+1，奇观槽位+1',
    effect: {
      normal: {
        housing: 6,
        wonder_slot: 1,
        processedItem_slot: 1,
      }
    },
    canBuild({ grid, race }) {
      const baseTerrains = ['hills', 'land', 'forest', 'desert'];
      if (race === 'dwarf') {
        baseTerrains.push('mountain');
      }
      return baseTerrains.includes(grid.terrain);
    },
    category: {
      living: true,
    },
    round: 3,
    color: 'living',
  },
  farm: {
    name: '农田',
    terrainInfo: '平原，森林',
    effect_info: '每回合食物+5；农作物槽位+1',
    effect: {
      normal: {
        crop_slot: 1,
      },
      turn: {
        food: 5,
      }
    },
    canBuild({ grid }) {
      return ['land', 'forest'].includes(grid.terrain);
    },
    special({ race }) {
      return race != 'ancient';
    },
    category: {
      farm: true,
    },
    round: 2,
    color: 'farm',
  },
  spirit_field: {
    name: '灵田',
    terrainInfo: '平原，森林，海岸',
    effect_info: '每回合食物+3，魔石+1；农作物槽位+1',
    special_info: '复苏古人的专属农田',
    effect: {
      normal: {
        crop_slot: 1,
      },
      turn: {
        food: 3,
        magic: 1,
      }
    },
    canBuild({ grid }) {
      return ['land', 'forest', 'coastal'].includes(grid.terrain);
    },
    special({ race }) {
      return race == 'ancient';
    },
    category: {
      farm: true,
    },
    round: 3,
    color: 'farm',
  },
  mine: {
    name: '矿场',
    terrainInfo: '丘陵，山脉',
    effect_info: '每回合矿石+2，魔石+1',
    requireInfo: '解锁科技【石器】',
    effect: {
      turn: {
        mine: 2,
        magic: 1,
      }
    },
    canBuild({ grid, tech }) {
      return ['hills', 'mountain'].includes(grid.terrain) && tech.construction_3;
    },
    special({ race }) {
      return race != 'ancient' && race != 'voidwalker';
    },
    category: {
      mine: true,
    },
    round: 3,
    color: 'mine',
  },
  spirit_vein: {
    name: '灵脉',
    terrainInfo: '丘陵，山脉',
    effect_info: '每回合矿石+2，魔石+2',
    requireInfo: '解锁科技【石器】',
    special_info: '复苏古人的专属矿场',
    effect: {
      turn: {
        mine: 2,
        magic: 2,
      }
    },
    canBuild({ grid, tech }) {
      return ['hill', 'mountain'].includes(grid.terrain) && tech.construction_3;
    },
    special({ race }) {
      return race == 'ancient';
    },
    category: {
      mine: true,
    },
    round: 3,
    color: 'mine',
  },
  corpse_foundry: {
    name: '养尸地',
    terrainInfo: '丘陵，山脉',
    effect_info: '每回合矿石+3，魔石+1',
    requireInfo: '解锁科技【石器】',
    special_info: '虚海渡人的专属矿场',
    effect: {
      turn: {
        mine: 2,
        magic: 1,
      }
    },
    canBuild({ grid, tech }) {
      return ['hill', 'mountain'].includes(grid.terrain) && tech.construction_3;
    },
    special({ race }) {
      return race == 'voidwalker';
    },
    category: {
      mine: true,
    },
    round: 3,
    color: 'mine',
  },
  harbor: {
    name: '港口',
    terrainInfo: '海岸 浅海 河流',
    effect_info: '住房+2，商路+1，船只+2，水产槽位+1',
    requireInfo: '解锁科技【造船术】',
    effect: {
      normal: {
        housing: 2,
        trade_route: 1,
        boat: 2,
        aquatic_slot: 1,
      }
    },
    canBuild({ grid, tech }) {
      return ['coastal', 'neritic'].includes(grid.terrain) && tech.boating_1;
    },
    category: {
      harbor: true,
    },
    round: 3,
    color: 'harbor',
  },
  pasture: {
    name: '牧场',
    terrainInfo: '平原，山脉，丘陵',
    effect_info: '每回合食物+4，骑兵人口+1，野兽人口+1；畜牧槽位+1',
    requireInfo: '解锁科技【驯化】',
    effect: {
      normal: {
        cavalry: 1,
        beast: 1,
        livestock_slot: 1,
      },
      turn: {
        food: 4,
      }
    },
    canBuild({ grid, tech }) {
      const terrainOK = ['land', 'hills', 'mountain'].includes(grid.terrain);
      const techOK = tech.farming_2 === true;
      return terrainOK && techOK;
    },
    category: {
      pasture: true,
    },
    round: 2,
    color: 'pasture',
  },
  blood_pool: {
    name: '血池',
    terrainInfo: '山脉，丘陵',
    effect_info: '每回合食物+3，野兽人口+5；畜牧槽位+2',
    requireInfo: '解锁科技【驯化】',
    special_info: '虚海渡人的专属牧场',
    effect: {
      normal: {
        cavalry: 1,
        beast: 5,
        livestock_slot: 1,
      },
      turn: {
        food: 3,
      }
    },
    canBuild({ grid, tech }) {
      const terrainOK = ['land', 'hills'].includes(grid.terrain);
      const techOK = tech.farming_2 === true;
      return terrainOK && techOK;
    },
    special({ race }) {
      return race == 'voidwalker';
    },
    category: {
      pasture: true,
    },
    round: 3,
    color: 'pasture',
  },
  military: {
    name: '军事区',
    effect_info: '军事改革+1（最大+3），步兵人口+2，住房+2，畜牧槽位+1',
    requireInfo: '解锁科技【军事化】',
    special_info: '军事改革',
    effect: {
      normal: {
        infantry: 2,
        housing: 2,
        livestock_slot: 1,
      },
    },
    canBuild: function ({ tech }) {
      return tech.leadership_2;
    },
    category: {
      military: true,
    },
    round: 5,
    color: 'military',
  },
  academy: {
    name: '学院特区',
    effect_info: '每回合文化+4；加工品槽位+1；开启学派',
    requireInfo: '解锁科技【教育】',
    effect: {
      normal: {
        processedItem_slot: 1,
      },
      turn: {
        culture: 4,
      }
    },
    canBuild({ tech }) {
      return tech.literature_1;
    },
    category: {
      academy: true,
    },
    round: 3,
    color: 'academy',
  },
  holy: {
    name: '圣地',
    effect_info: '进入【奴隶时代】；每回合文化+3；住房+2，奇观槽位+1',
    requireInfo: '解锁科技【原始祈祷】',
    special_info: '时代进步的象征',
    effect: {
      normal: {
        housing: 2,
        wonder_slot: 1,
      },
      turn: {
        culture: 3,
      },
    },
    canBuild({ tech }) {
      return tech.religion_2;
    },
    category: {
      holy: true,
    },
    round: 5,
    color: 'holy',
  },
  trade: {
    name: '贸易区',
    category: {
      trade: true,
    },
    round: 3,
    color: 'trade',
  },
  entertainment: {
    name: '娱乐区',
    category: {
      entertainment: true,
    },
    round: 3,
    color: 'entertainment',
  },
  industry: {
    name: '工业区',
    category: {
      industry: true,
    },
    round: 4,
    color: 'industry',
  },
  primitive_tribe: {
    name: '原始部落',
    terrainInfo: '平原，森林',
    effect_info: '每回合食物+3，矿石+1，文化+2；住房+2，农作物槽位+2',
    special_info: '人类专属的农田特区',
    effect: {
      normal: {
        housing: 2,
        crop_slot: 2,
      },
      turn: {
        food: 3,
        mine: 1,
        culture: 2,
      },
    },
    canBuild({ grid }) {
      return ['land', 'forest'].includes(grid.terrain);
    },
    special({ race }) {
      return race == 'human';
    },
    category: {
      farm: true,
    },
    round: 4,
    color: 'special',
  },
  pillage_altar: {
    name: '掠夺祭坛',
    terrainInfo: '平原，森林，山脉',
    effect_info: '军事改革+1（最大+3）；每回合食物+2；住房+1，野兽人口+2，畜牧槽位+1',
    special_info: '兽人专属的军事特区',
    effect: {
      normal: {
        beast: 2,
        livestock_slot: 1,
        housing: 1,
      },
      turn: {
        food: 3,
      }
    },
    canBuild({ grid }) {
      return ['land', 'forest', 'mountain'].includes(grid.terrain);
    },
    special({ race }) {
      return race == 'orc';
    },
    category: {
      military: true,
    },
    round: 5,
    color: 'special',
  },
  star_grove: {
    name: '星语林地',
    terrainInfo: '丘陵，森林',
    effect_info: '每回合食物+1，文化+3，若在森林文化额外+2；住房+2，奇物槽位+2',
    special_info: '精灵专属的学院特区',
    effect: {
      normal: {
        housing: 2,
        magicalItem_slot: 2,
      },
      turn: {
        food: 1,
        culture({ grid }) {
          return 3 + (grid.terrain == 'forest' ? 2 : 0);
        }
      }
    },
    canBuild({ grid }) {
      return ['hills', 'forest'].includes(grid.terrain);
    },
    special({ race }) {
      return race == 'elf';
    },
    category: {
      academy: true,
    },
    round: 5,
    color: 'special',
  },
  cliff_hold: {
    name: '山壁营地',
    terrainInfo: '山脉，丘陵',
    effect_info: '每回合矿石+2，魔石+1，若在山脉矿石额外+1；住房+2，矿物槽位+2',
    special_info: '矮人专属的矿场',
    effect: {
      normal: {
        housing: 2,
        mineItem_slot: 2,
      },
      turn: {
        mine({ grid }) {
          return 2 + (grid.terrain == 'mountain' ? 1 : 0);
        },
        magic: 1,
        culture: 1,
      }
    },
    canBuild({ grid }) {
      return ['hills', 'mountain'].includes(grid.terrain);
    },
    special({ race }) {
      return race == 'dwarf';
    },
    category: {
      mine: true,
    },
    round: 5,
    color: 'special',
  },
  tide_barbor: {
    name: '潮汐圣湾',
    terrainInfo: '海岸，浅海',
    effect_info: '每回合矿石+2，魔石+1，文化+1；住房+2，水产槽位+2',
    special_info: '人鱼的专属海港',
    effect: {
      normal: {
        housing: 2,
        aquatic_slot: 2,
      },
      turn: {
        mine: 2,
        magic: 1,
        culture: 1,
      }
    },
    canBuild({ grid }) {
      return ['coastal', 'neritic'].includes(grid.terrain);
    },
    special({ race }) {
      return race == 'merfolk';
    },
    category: {
      harbor: true,
    },
    round: 5,
    color: 'special',
  },
  necropolis_academy: {
    name: '亡灵塔',
    terrainInfo: '任意非水体',
    effect_info: '每回合食物+2，文化+4；住房+2，通用槽位+1',
    special_info: '亡灵专属的学院特区',
    effect: {
      normal: {
        housing: 2,
        general_slot: 1,
      },
      turn: {
        food: 2,
        culture: 3,
      }
    },
    canBuild({ grid }) {
      return !['coastal', 'neritic'].includes(grid.terrain);
    },
    special({ race }) {
      return race == 'undead';
    },
    category: {
      academy: true,
    },
    round: 5,
    color: 'special',
  },
  elemental_nexus: {
    name: '元素晶核',
    terrainInfo: '任意',
    effect_info: '进入【奴隶时代】；每回合食物+2，文化+2；住房+1，通用槽位+1',
    special_info: '元灵的专属圣地',
    effect: {
      normal: {
        housing: 1,
        general_slot: 1,
      },
      turn: {
        food: 2,
        culture: 2,
      },
    },
    canBuild({ grid }) {
      return true;
    },
    special({ race }) {
      return race == 'primordial';
    },
    category: {
      holy: true,
    },
    round: 6,
    color: 'special',
  },
  dao_academy: {
    name: '悟道台',
    terrainInfo: '任意非水体',
    effect_info: '每回合矿石+1，文化+3；住房+2，通用槽位+1，科技槽位+1',
    special_info: '复苏古人专属的学院特区',
    effect: {
      normal: {
        housing: 2,
        general_slot: 1,
        tech_research_slot: 1,
      },
      turn: {
        mine: 1,
        culture: 3,
      }
    },
    canBuild({ grid }) {
      return !['coastal', 'neritic'].includes(grid.terrain);
    },
    special({ race }) {
      return race == 'ancient';
    },
    category: {
      academy: true,
    },
    round: 5,
    color: 'special',
  },
  aorpse_ascension_altar: {
    name: '尸解飞升坛',
    terrainInfo: '任意地上地形',
    effect_info: '每回合食物+1，文化+3；住房+2，通用槽位+1，科技槽位+1',
    special_info: '虚海渡人专属的学院特区',
    effect: {
      normal: {
        housing: 2,
        general_slot: 1,
        technology_slot: 1,
      },
      turn: {
        food: 1,
        culture: 3,
      }
    },
    canBuild({ grid }) {
      return true;
    },
    special({ race }) {
      return race == 'voidwalker';
    },
    category: {
      harbor: true,
    },
    round: 5,
    color: 'special',
  },
  imperial_capital: {
    name: '荣耀之都',
    terrainInfo: '升级的主城区',
    effect_info: '每回合财富+1，食物+1，文化+1，矿石+1；住房+5；所在的主城每有5人口，额外增加1财富税收；驻扎4人口',
    effect: {
      normal: {
        housing: 5,
      },
      turn: {
        // 基础财富+1；所在的主城每有 5 人口，额外 +1 财富税收（向下取整，按该主城格点的人口算）
        wealth: ({ grid }) => 1 + Math.floor((grid?.population ?? 0) / 5),
        food: 1,
        culture: 1,
        mine: 1,
      },
    },
    category: {
      main: true,
      capital: true,       // 王城标记（市政厅等建筑用 category.capital 限定只能建在首都王城）
    },
    round: 6,
    color: 'living',
    // 驻扎人口：升级时空闲人口须多于 4，确认后锁定 4 人口（不能训练士兵、不产生人头税），
    // 每回合消耗 4×种族繁育单价（garrison_cost 额外消耗暂无）；资源不足时本回合增益失效，详见 function.js 的 settleGarrison
    garrison: 4,
    garrison_cost: {},
    update: 1,
    // 王城：属于 capital 组（受 REGION_UPGRADE_GROUP.capital 约束：需科技、永久限1次），只能从主城区升级
    upgrade_group: 'capital',
    upgrade_from: ['main'],
    // 地图上显示的都城立绘：assets/region/map/<区域key>.png（见 gameScene 预加载、mapView.createHexagon）
    map_image: { scale: 1, x: 0, y: 2 },
  },
  academy_capital: {
    name: '奥术之城',
    terrainInfo: '主城区和学院区融合的特区',
    effect_info: '每回合财富+1，文化+2，魔石+1；住房+3；额外可选择1个学派；学院可选择数量+1；科技研究回合数-1（至少为1）；驻扎4人口',
    effect: {
      normal: {
        housing: 3,
        // 学院可选择数量+1：奥术之城 category.academy = true，已按“学院区/特区”计入 academyView.countAcademyDistricts，无需额外字段
        // 额外可选择1个学派：学派数量上限 +1（academyView.schoolSlotTotal）。分支名额仍由所有学派共用、受学院数量限制
        school_slot: 1,
        research_round: -1,      // 科技研究回合数-1（至少为1，techTree.getTechResearchRounds 结算）
      },
      turn: {
        wealth: 1,
        culture: 2,
        magic: 1,
      },
    },
    category: {
      main: true,
      academy: true,
      capital: true,       // 王城标记（市政厅等建筑用 category.capital 限定只能建在首都王城）
    },
    round: 6,
    color: 'academy',
    // 驻扎人口：升级时空闲人口须多于 4，确认后锁定 4 人口（不能训练士兵、不产生人头税），
    // 每回合消耗 4×种族繁育单价（garrison_cost 额外消耗暂无）；资源不足时本回合增益失效，详见 function.js 的 settleGarrison
    garrison: 4,
    garrison_cost: {},
    update: 1,
    // 王城：属于 capital 组（受 REGION_UPGRADE_GROUP.capital 约束：需科技、永久限1次），只能从主城区升级
    upgrade_group: 'capital',
    upgrade_from: ['main'],
    // 地图上显示的都城立绘：assets/region/map/<区域key>.png（见 gameScene 预加载、mapView.createHexagon）
    map_image: { scale: 1.05, x: 0.8, y: 5.8 },
  },
  military_capital: {
    name: '铁血要塞',
    terrainInfo: '主城区和军事区融合的特区',
    effect_info: '每回合食物+2，矿石+2，魔石+1；住房+3；军事改革额外+1；所有兵组人口+2，训练兵组回合数-1；驻扎4人口',
    effect: {
      normal: {
        housing: 3,
        // 军事改革额外+1：这里的 military_action 直接叠加军事行动上限，不受军事区“最多叠加3个”的限制
        // （铁血要塞 category.military = true，本身还会作为一个军事区计入那 3 个名额，见 i18n.js actionNum）
        military_action: 1,
        // 所有兵组人口+2（各兵种类别的人口上限；兵种人口系统接入后读取这些字段，写法同军事区的 infantry）
        scout: 2,
        fighting: 2,
        ranged: 2,
        boat: 2,
        cavalry: 2,
        infantry: 2,
        beast: 2,
        special_type: 2,
        train_round: -1,         // 训练兵组回合数-1（至少为1，militaryUnitView 训练页结算）
      },
      turn: {
        food: 2,
        mine: 2,
        magic: 1,
      },
    },
    category: {
      main: true,
      military: true,
      capital: true,       // 王城标记（市政厅等建筑用 category.capital 限定只能建在首都王城）
    },
    round: 6,
    color: 'military',
    // 驻扎人口：升级时空闲人口须多于 4，确认后锁定 4 人口（不能训练士兵、不产生人头税），
    // 每回合消耗 4×种族繁育单价（garrison_cost 额外消耗暂无）；资源不足时本回合增益失效，详见 function.js 的 settleGarrison
    garrison: 4,
    garrison_cost: {},
    update: 1,
    // 王城：属于 capital 组（受 REGION_UPGRADE_GROUP.capital 约束：需科技、永久限1次），只能从主城区升级
    upgrade_group: 'capital',
    upgrade_from: ['main'],
    // 地图上显示的都城立绘：assets/region/map/<区域key>.png（见 gameScene 预加载、mapView.createHexagon）
    map_image: { scale: 1.03, x: 1.5, y: 4 },
  },
  holy_capital: {
    name: '天启之城',
    terrainInfo: '主城区和圣地融合的特区',
    effect_info: '每回合财富+2，魔石+2；住房+5；科技研究消耗的文化-5（至少为1）；宗教信仰条目+1；驻扎4人口',
    effect: {
      normal: {
        housing: 5,
        research_culture: -5,    // 科技研究消耗的文化-5（至少为1，techTree.getTechCostInfo 结算）
        religion_entry: 1,       // 宗教信仰条目+1（宗教系统接入后读取该字段）
      },
      turn: {
        wealth: 2,
        magic: 2,
      },
    },
    category: {
      main: true,
      holy: true,
      capital: true,       // 王城标记（市政厅等建筑用 category.capital 限定只能建在首都王城）
    },
    round: 6,
    color: 'holy',
    // 驻扎人口：升级时空闲人口须多于 4，确认后锁定 4 人口（不能训练士兵、不产生人头税），
    // 每回合消耗 4×种族繁育单价（garrison_cost 额外消耗暂无）；资源不足时本回合增益失效，详见 function.js 的 settleGarrison
    garrison: 4,
    garrison_cost: {},
    update: 1,
    // 王城：属于 capital 组（受 REGION_UPGRADE_GROUP.capital 约束：需科技、永久限1次），只能从主城区升级
    upgrade_group: 'capital',
    upgrade_from: ['main'],
    // 地图上显示的都城立绘：assets/region/map/<区域key>.png（见 gameScene 预加载、mapView.createHexagon）
    map_image: { scale: 1, x: 0.2, y: 7.4 },
  },
}

// ═══════════════════════════════════════════════════
// 区域升级（主城【其他功能】→【升级区域】使用）
// ═══════════════════════════════════════════════════
//
// REGION 条目上的相关字段：
//   update            区域等级，缺省为 0（主城区/普通区域都是 0）；升级必须 目标.update > 原区域.update
//   upgrade_group     所属升级组（见 REGION_UPGRADE_GROUP）；缺省 = 无组，无科技要求、无次数限制
//   map_image         地图上用 assets/region/map/<区域key>.png 作为该区域的立绘（缺省没有）。
//                     可写 true，或 { scale, x, y } 微调参数：scale 在“宽度刚好等于六边形宽度”的基础上再乘的倍数，
//                     x / y 是相对默认位置（底边中心对齐六边形下顶点）的偏移，单位是地图坐标。
//                     参数用 GM 面板里的【调整都城图片】拖出来，点【复制参数】粘贴到这里。
//   upgrade_from      白名单：只允许从这些区域 key 升级（王城只能从 main 升级）；缺省 = 不限
//   garrison          驻扎人口数：建造 / 升级前所在城池【空闲人口】须多于该数；确认后锁定（不能训练士兵、不能给别的驻扎用、
//                     不产生人头税，但仍占总人口）；每回合消耗 驻扎数×（种族繁育单价+garrison_cost）的资源，
//                     付不起则本回合 effect.turn 和非永久 effect.normal（行动条、研究/训练回合、文化减免…）失效，
//                     住房 / 各类槽位 / 兵种人口上限这类永久效果不受影响（规则见 function.js 顶部注释，建筑也可以写）
//   garrison_cost     每个驻扎人口每回合的额外资源消耗，如 { magic: 1 }；缺省 = 无
//
// 升级判定规则（canUpgradeRegion）：
//   1. 目标必须有 update 且 > 原区域 update
//   2. 目标的类别（含 inherit_category）必须包含原区域的全部类别
//   3. 若目标声明了 upgrade_from，则原区域必须在白名单内
//   4. 目标所属组需解锁对应科技，且未用尽次数
//   5. 目标的 special({race}) 若返回 false 则不可选
export const REGION_UPGRADE_GROUP = {
  capital: {
    name: '王城',
    tech: 'gov_2',   // 中央集权
    limit: 1,        // 永久限 1 次（记录在 saveData.region_upgrade_used[group]）
  },
};

/** 区域等级，缺省为 0 */
export function getRegionLevel(key) {
  return REGION[key]?.update ?? 0;
}

/** 区域参与升级判定的类别 key 集合 */
export function getRegionUpgradeCategories(key) {
  const r = REGION[key];
  return new Set(Object.keys(r?.category ?? {}).filter(k => r.category[k]));
}

/**
 * 某升级组是否已被占用：
 *   - 永久记录 saveData.region_upgrade_used[group]（回合结算开始建造时写入）
 *   - 或行动列表里有尚未结算的同组升级行动（取消行动前可撤回，不算用掉）
 */
export function isUpgradeGroupUsed(saveData, group) {
  const cfg = REGION_UPGRADE_GROUP[group];
  if (!cfg?.limit) return false;
  let used = saveData?.region_upgrade_used?.[group] ? 1 : 0;
  for (const [k, v] of Object.entries(saveData?.actionList?.civil ?? {})) {
    if (k.startsWith('upgrade_region') && v?.group === group) used++;
  }
  return used >= cfg.limit;
}

/** 升级组所需科技是否已解锁 */
export function isUpgradeGroupUnlocked(saveData, group) {
  const tech = REGION_UPGRADE_GROUP[group]?.tech;
  if (!tech) return true;
  return !!saveData?.tech_tree?.unlocked?.[tech];
}

/**
 * 判断 oldKey → newKey 能否升级（只看区域本身的规则 + 组规则，不看格点是否空闲）
 * @returns {string|null} null = 可以；否则返回不可升级的原因
 */
export function getRegionUpgradeBlockReason(oldKey, newKey, saveData) {
  const oldR = REGION[oldKey];
  const newR = REGION[newKey];
  if (!oldR || !newR) return '区域不存在';
  if (newR.update == null) return '该区域不是升级目标';
  if (getRegionLevel(newKey) <= getRegionLevel(oldKey)) return '目标区域等级不高于原区域';

  const oldCats = getRegionUpgradeCategories(oldKey);
  const newCats = getRegionUpgradeCategories(newKey);
  for (const c of oldCats) {
    if (!newCats.has(c)) return '目标区域的类别未包含原区域的全部类别';
  }

  if (Array.isArray(newR.upgrade_from) && !newR.upgrade_from.includes(oldKey)) {
    return '该区域不能从此区域升级';
  }

  const group = newR.upgrade_group;
  if (group) {
    if (!isUpgradeGroupUnlocked(saveData, group)) return '尚未解锁所需科技';
    if (isUpgradeGroupUsed(saveData, group)) return `${REGION_UPGRADE_GROUP[group]?.name ?? group}升级次数已用尽`;
  }

  if (typeof newR.special === 'function' && !newR.special({ race: saveData?.race })) {
    return '当前种族无法使用该区域';
  }
  return null;
}

/**
 * 某个主城（含其附属格点）当前所有可用的区域升级方案
 * 排除：建造中 / 已有待结算升级 / 待移除的格点
 * @returns {{gridId:string, fromKey:string, toKey:string}[]}
 */
export function getRegionUpgradeOptions(saveData, mainGridId) {
  const grids = saveData?.map?.grids ?? {};
  const civil = saveData?.actionList?.civil ?? {};
  const cityGridIds = [mainGridId, ...Object.keys(grids).filter(g => grids[g]?.hasMain === mainGridId)];
  const options = [];
  for (const gid of cityGridIds) {
    const g = grids[gid];
    if (!g?.region || g.createRegion) continue;
    if (civil['upgrade_region_' + gid] || civil['remove_region_' + gid] || civil['build_region_' + gid]) continue;
    for (const toKey of Object.keys(REGION)) {
      if (getRegionUpgradeBlockReason(g.region, toKey, saveData) === null) {
        options.push({ gridId: gid, fromKey: g.region, toKey });
      }
    }
  }
  return options;
}