export const REGION = {
  main: {
    name: '主城区',
  },
  farm: {
    name: '农田区',
    terrainInfo:'平原，森林',
    canBuild({ grid }) {
      return ['land', 'forest'].includes(grid.terrain);
    },
    round:2,
  },
  trade: {
    name: '贸易区',
  },
  mine: {
    name: '矿场区',
    terrainInfo:'丘陵，山脉',
    canBuild({ grid }) {
      return ['hill', 'mountain'].includes(grid.terrain);
    },
  },
  harbor: {
    name: '港口特区',
  },
  academy: {
    name: '学院特区',
  },
  holy: {
    name: '圣地特区',
  },
  entertainment: {
    name: '娱乐特区',
  },
  pasture: {
    name: '牧场区',
    terrainInfo:'山脉，丘陵',
    requireInfo:'解锁科技【驯化】',
    canBuild({ grid, tech }) {
      const terrainOK = ['land', 'hills'].includes(grid.terrain);
      const techOK = tech?.unlocked?.farming_2 === true;
      return terrainOK && techOK;
    },
    round:2,
  },
  living: {
    name: '居住区',
    terrainInfo:'丘陵，平原，沙漠，森林（矮人可山脉）',
    canBuild({ grid, player }) {
      const baseTerrains = ['hills', 'land', 'forest', 'desert'];
      if (player.race === 'dwarf') {
        baseTerrains.push('mountain');
      }
      return baseTerrains.includes(grid.terrain);
    },
    round:3,
  },
  military: {
    name: '军事区',
    requireInfo:'解锁科技【军事化】',
    canBuild: function ({tech}) {
      return tech?.unlocked?.leadership_2;
    },
    round:5,
  },
  industry: {
    name: '特殊工业区',
  },
}