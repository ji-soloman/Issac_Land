export const MILITARY = {
  explore_terrain: {
    name: '探索地形',
    intro: '你的XX开始探索附近地形',
    militaryRequired: true,
    filter: function ({ saveGrids, mapGrids, mapView }) {
      // 找出所有主城格点
      const mainGridIds = Object.keys(saveGrids).filter(gn => saveGrids[gn]?.isMain === true);
      if (mainGridIds.length === 0 || !mapView) return false;

      // 只要任意主城的周边6格中存在至少一个未被发现的配置表格点，则可探索
      return mainGridIds.some(mainGn => {
        const neighbors = mapView.getGridNeighbors(mainGn);
        return neighbors.some(neighborGn => {
          if (!neighborGn) return false;           // 超出地图边界
          if (!mapGrids[neighborGn]) return false; // 不在配置表（水域等）
          return !saveGrids[neighborGn];           // 未在存档中 = 未发现
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