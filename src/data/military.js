export const MILITARY = {
  explore_terrain: {
    name: '探索地形',
    intro: '你的XX开始探索附近地形',
    filter: function ({ saveGrids, mapGrids }) {
      const mapKeys = Object.keys(mapGrids);
      return mapKeys.some(key => {
        const savedItem = saveGrids[key];
        if (!savedItem) return true;
        if (savedItem.locked === false) return true;
        return false;
      });
    }
  },
  explore_resource: {
    name: '探索资源',
    intro: '你的XX开始搜索附近资源',
  },
  soldier_check: {
    name: '查看兵力',
  },
  invasion: {
    name: '派遣军队',
    filter: () => false,
  },
  perform_mission: {
    name: '执行任务',
  },
}