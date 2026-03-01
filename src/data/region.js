export const REGION = {
  main: {
    name: '主城区',
    canBuild() {
      return false;
    }
  },
  living: {
    name: '住宅区',
    terrainInfo: '丘陵，平原，沙漠，森林（矮人可山脉）',
    effect_info: '住房+6，加工品槽位+1，奇观槽位+1',
    canBuild({ grid, race }) {
      const baseTerrains = ['hills', 'land', 'forest', 'desert'];
      if (race === 'dwarf') {
        baseTerrains.push('mountain');
      }
      return baseTerrains.includes(grid.terrain);
    },
    round: 3,
  },
  farm: {
    name: '农田区',
    terrainInfo: '平原，森林',
    effect_info: '每轮食物+5；农作物槽位+1',
    canBuild({ grid }) {
      return ['land', 'forest'].includes(grid.terrain);
    },
    round: 2,
  },
  mine: {
    name: '矿场区',
    terrainInfo: '丘陵，山脉',
    canBuild({ grid }) {
      return ['hill', 'mountain'].includes(grid.terrain);
    },
  },
  harbor: {
    name: '港口特区',
    terrainInfo: '海岸 浅海 河流',
    effect_info: '住房+2，商路+1，船只+2，水产槽位+1',
    requireInfo: '解锁科技【造船术】',
    canBuild({ grid, tech }) {
      return ['coastal', 'neritic'].includes(grid.terrain);
    },
    round: 3,
  },
  pasture: {
    name: '牧场区',
    terrainInfo: '山脉，丘陵',
    effect_info: '每轮食物+4，骑兵人口+1，野兽人口+1；畜牧槽位+1',
    requireInfo: '解锁科技【驯化】',
    canBuild({ grid, tech }) {
      const terrainOK = ['land', 'hills'].includes(grid.terrain);
      const techOK = tech?.unlocked?.farming_2 === true;
      return terrainOK && techOK;
    },
    round: 2,
  },
  military: {
    name: '军事区',
    effect_info: '军事改革+1（最大+3），步兵人口+2，住房+2，畜牧槽位+1',
    requireInfo: '解锁科技【军事化】',
    canBuild: function ({ tech }) {
      return tech?.unlocked?.leadership_2;
    },
    round: 5,
  },
  academy: {
    name: '学院特区',
    effect_info: '每轮文化+3；加工品槽位+1；开启学派',
    requireInfo: '解锁科技【著作】',
    canBuild({ tech }) {
      return false;
    },
    round: 2,
  },
  holy: {
    name: '圣地特区',
    effect_info: '提前进入【奴隶时代】；每轮住房+2，文化+3；奇观槽位+1',
    requireInfo: '解锁科技【原始祈祷】',
    canBuild({ tech }) {
      return tech.religion_2;
    },
    round: 5,
  },
  trade: {
    name: '贸易区',
  },
  entertainment: {
    name: '娱乐特区',
  },
  industry: {
    name: '特殊工业区',
  },
}