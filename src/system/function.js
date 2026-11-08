import { get } from '../system/i18n.js';
import { saveSystem } from '../system/saveSystem.js';

export const game = {
  addAction(type, name, config, callbacks = {}) {
    const saveData = saveSystem.currentSaveData;

    if (!saveData.actionList) saveData.actionList = {};
    if (!saveData.actionList[type]) saveData.actionList[type] = {};

    const actionNum = get.actionNum(saveData)[type];
    const currentNum = Object.keys(saveData.actionList[type]).length;

    if (actionNum <= currentNum) {
      callbacks.onFail?.({
        type,
        name,
        config,
        reason: 'limit'
      });
      callbacks.onComplete?.(false);
      return false;
    }

    saveData.actionList[type][name] = config;

    saveSystem.save().then(() => {
      callbacks.onSuccess?.({
        type,
        name,
        config
      });
    });

    callbacks.onComplete?.(true);
    return true;
  },
  //   game.addAction('civil', 'build_region_1', data, {
  //   onSuccess() {
  //     console.log('添加成功');
  //   },
  //   onFail(info) {
  //     console.log('失败原因:', info.reason);
  //   },
  //   onComplete(ok) {
  //     console.log('结束:', ok);
  //   }
  // });
  /**
   * 检测某种行动类型是否还有可用行动条（剩余数量 > 0）
   * @param {'military'|'civil'|'others'} type
   * @returns {boolean}
   *
   * 用法示例：
   *   game.hasAvailableAction('military')  // 是否还有军事行动条
   */
  hasAvailableAction(type) {
    return this.remainingActions(type) > 0;
  },

  /**
   * 返回某种行动类型的剩余可用行动条数量
   * @param {'military'|'civil'|'others'} type
   * @returns {number}  剩余数量（上限 - 已使用；others 无上限返回 Infinity）
   *
   * 用法示例：
   *   game.remainingActions('military')  // 军事行动剩余条数
   */
  remainingActions(type) {
    const saveData = saveSystem.currentSaveData;
    if (!saveData) return 0;
    const limit = get.actionNum(saveData)[type];
    if (limit === Infinity) return Infinity;
    const current = Object.keys(saveData.actionList?.[type] ?? {}).length;
    return Math.max(0, limit - current);
  },

  /**
   * 返回某个格点所属城市的主城格点 id：
   *   主城自己 → 自己的 gridId；分城格点 → hasMain（所属主城）；野地/未知格点 → null
   */
  getCityId(grids, gridId) {
    const g = grids?.[gridId];
    if (!g) return null;
    if (g.isMain) return gridId;
    return g.hasMain ?? null;
  },

  /**
   * 【城市唯一】建筑查重：在 gridId 所属城市（主城 + 其全部分城格点）里，
   * 查找建筑 buildingKey 是否已建成 / 正在建造 / 已在本回合民生行动里排队。
   * 不同城市互不影响，各自最多一座。
   * @returns {{ gridId: string, status: 'built'|'building' } | null}  找到则返回所在格点和状态
   */
  findUniqueBuildingInCity(saveData, gridId, buildingKey) {
    const grids = saveData?.map?.grids ?? {};
    const cityId = this.getCityId(grids, gridId);
    if (!cityId) return null;

    const civil = saveData?.actionList?.civil ?? {};
    let building = null;
    for (const [gid, g] of Object.entries(grids)) {
      if (this.getCityId(grids, gid) !== cityId) continue;
      if (g.buildings?.[buildingKey]) return { gridId: gid, status: 'built' };
      if (!building && (g.createBuilding?.[buildingKey] || civil[`build_building_${gid}_${buildingKey}`])) {
        building = { gridId: gid, status: 'building' };
      }
    }
    return building;
  },

  showTips(scene, tip) {
    const { width, height } = scene.scale;
    const x = width / 2;
    const y = height * 0.18;

    const text = scene.add.text(x, y, tip, {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.7)',
      padding: { x: 12, y: 6 },
      align: 'center'
    })
      .setOrigin(0.5)
      .setDepth(99999); // 保证在最上层

    scene.time.delayedCall(1200, () => {
      scene.tweens.add({
        targets: text,
        y: y - 50,      // 向上移动
        alpha: 0,       // 淡出
        duration: 1200,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          text.destroy();
        }
      });
    });
  },
};