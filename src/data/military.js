export const MILITARY = {
  explore_terrain: {
    name: '探索地形',
    intro: '你的XX开始探索附近地形',
    militaryRequired: true,
    filter: function ({ saveGrids, mapGrids, mapView }) {
      // 找出所有主城格点
      const mainGridIds = Object.keys(saveGrids).filter(gn => saveGrids[gn]?.isMain === true);
      if (mainGridIds.length === 0 || !mapView) return false;

      return mainGridIds.some(mainGn => {
        const neighbors = mapView.getGridNeighbors(mainGn);
        return neighbors.some(neighborGn => {
          if (!neighborGn) return false;
          if (!mapGrids[neighborGn]) return false;  // 不在配置表（地图边界外）

          const saved = saveGrids[neighborGn];

          // 条件1：未发现的格点（未在存档中）
          if (!saved) return true;

          // 条件2：野地（已发现，但不属于任何城池：无 isMain 也无 hasMain）
          if (!saved.isMain && !saved.hasMain) return true;

          return false;
        });
      });
    }
  },
  explore_resource: {
    name: '探索资源',
    intro: '你的XX开始搜索附近资源',
    militaryRequired: true,
  },
  soldier_check: {
    name: '查看兵力',
  },
  invasion: {
    name: '派遣军队',
    filter: () => false,
    militaryRequired: true,
  },
  get_resource: {
    name: '征集物产',
    intro: 'XX开始向民众征集XX',
    filter: () => true,
  },
  perform_mission: {
    name: '执行任务',
  },
}