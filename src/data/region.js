export const REGION = {
  main: {
    name: '主城区',
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
    category: {
      farm: true,
    },
    round: 2,
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
      return ['hill', 'mountain'].includes(grid.terrain) && tech.construction_3;
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
      return ['coastal', 'neritic'].includes(grid.terrain);
    },
    category: {
      harbor: true,
    },
    round: 3,
    color: 'harbor',
  },
  pasture: {
    name: '牧场',
    terrainInfo: '山脉，丘陵',
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
      const terrainOK = ['land', 'hills'].includes(grid.terrain);
      const techOK = tech?.unlocked?.farming_2 === true;
      return terrainOK && techOK;
    },
    category: {
      pasture: true,
    },
    round: 2,
    color: 'pasture',
  },
  military: {
    name: '军事区',
    effect_info: '军事改革+1（最大+3），步兵人口+2，住房+2，畜牧槽位+1',
    requireInfo: '解锁科技【军事化】',
    special_info: '军事改革',
    effect: {
      infantry: 2,
      housing: 2,
      livestock: 1,
    },
    canBuild: function ({ tech }) {
      return tech?.unlocked?.leadership_2;
    },
    category: {
      military: true,
    },
    round: 5,
    color: 'military',
  },
  academy: {
    name: '学院特区',
    effect_info: '每回合文化+3；加工品槽位+1；开启学派',
    requireInfo: '解锁科技【著作】',
    effect: {
      normal: {
        processedItem_slot: 1,
      },
      turn: {
        culture: 3,
      }
    },
    canBuild({ tech }) {
      return false;
    },
    category: {
      academy: true,
    },
    round: 2,
    color: 'academy',
  },
  holy: {
    name: '圣地特区',
    effect_info: '提前进入【奴隶时代】；每回合文化+3；住房+2，奇观槽位+1',
    requireInfo: '解锁科技【原始祈祷】',
    special_info: '时代进步的象征',
    effect: {
      normal: {
        housing: 2,
        wonder_slot: 1,
      },
      turn: {
        culture: 3,
      }
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
    round: 5,
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
    effect_info: '每回合食物+1，文化+2，若在森林文化额外+1；住房+2，奇物槽位+2',
    special_info: '精灵专属的学院特区',
    effect: {
      normal: {
        magicalItem_slot: 2,
      },
      turn: {
        food: 1,
        culture({ grid }) {
          return 2 + grid.terrain == 'forest' ? 1 : 0;
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
    special_info: '矮人专属的矿场特区',
    effect: {
      normal: {
        housing: 2,
        mineItem_slot: 2,
      },
      turn: {
        mine({ grid }) {
          return 2 + grid.terrain == 'mountain' ? 1 : 0;
        },
        magic: 1,
        culture: 1,
      }
    },
    canBuild({ grid }) {
      return ['hills', 'mountain'].includes(grid.terrain);
    },
    special({ race }) {
      return race == 'elf';
    },
    category: {
      mine: true,
    },
    round: 5,
    color: 'special',
  },
}