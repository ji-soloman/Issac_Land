// import { CivilLogic } from './logic/CivilLogic.js';
// import { MilitaryLogic } from './logic/MilitaryLogic.js';
// import { OthersLogic } from './logic/OthersLogic.js';
import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import { MAPS } from '../data/map.js';

export class TurnSystem {
  /**
   * @param {Phaser.Scene} scene - 场景引用
   * @param {Object} saveData - 存档数据
   */
  constructor(scene, saveData) {
    this.scene = scene;
    this.saveData = saveData;
  }

  executeTurn() {
    const list = this.saveData.actionList;

    console.log(`--- 开始结算第 ${this.saveData.process.turn} 回合 ---`);

    let result = {
      military: {},
      civil: {},
      others: {},
    };

    // 1. 处理Military
    this.processCategory('military', list.military, (actionType, params) => {
      // 这里调用你的军事逻辑处理类
      // MilitaryLogic.handle(actionType, params, this.saveData);
      console.log(`执行军事行动: [${actionType}]`, params);

      // 示例逻辑
      if (actionType === 'explore_terrain') {
        const soldierId = params.soldier;
        console.log('正在结算', soldierId, '的行为', actionType);

        const currentGrids = this.saveData.map.grids;
        const allGrids = MAPS[this.saveData.map_type].grids;

        // 确定本次要解锁的数量 (随机 1~3 个)
        const numToUnlock = Phaser.Math.Between(1, 3);

        // 获取所有的 Key
        const allKeys = Object.keys(allGrids);

        // 筛选出所有符合条件（即尚未解锁）的格点 Key
        const eligibleKeys = allKeys.filter(key => {
          const currentData = currentGrids[key];
          /**
           * 判断条件：
           * 1. current 中不存在该格子 (undefined)
           * 2. 或者该格子存在但 locked 不为 true
           */
          return !currentData || currentData.locked !== true;
        });

        // 打乱
        Phaser.Utils.Array.Shuffle(eligibleKeys);

        // 截取出我们本次实际要解锁的格子（处理剩余格子不足 numToUnlock 的情况）
        const keysToProcess = eligibleKeys.slice(0, numToUnlock);

        // 用于记录返回结果，格式为: { gridKey1: terrain, gridKey2: terrain }
        const exploreResult = {};

        // 遍历选出的随机格点执行解锁逻辑
        for (const key of keysToProcess) {
          const config = allGrids[key];

          // 确保对象存在
          if (!currentGrids[key]) currentGrids[key] = {};

          // 解锁状态设为 true
          currentGrids[key].locked = true;

          // --- 处理地形赋值 ---
          let selectedTerrain = '';
          const terrainSource = config.type;

          if (typeof terrainSource === 'string') {
            selectedTerrain = terrainSource;
          } else if (Array.isArray(terrainSource)) {
            // 从列表中随机抽取一个
            selectedTerrain = Phaser.Utils.Array.GetRandom(terrainSource);
          }

          currentGrids[key].terrain = selectedTerrain;

          // --- 记录到结果集 ---
          exploreResult[key] = selectedTerrain;
        }

        // 赋值给 result 对象
        result.military.explore_terrain = {
          soldier: soldierId,
          result: exploreResult,
        };
      }
    });

    // 2. 处理Civil
    this.processCategory('civil', list.civil, (actionType, params) => {
      // CivilLogic.handle(actionType, params, this.saveData);
      console.log(`执行民事行动: [${actionType}]`, params);
    });

    // 3. 处理Others
    this.processCategory('others', list.others, (actionType, params) => {
      // OthersLogic.handle(actionType, params, this.saveData);
      console.log(`执行其他行动: [${actionType}]`, params);
    });

    // 4. 回合结束后的数据更新
    this.finalizeTurn(result);
  }

  /**
   * 通用分类处理器
   * @param {string} categoryName - 分类名称
   * @param {Object} actionMap - 该分类下的动作对象
   * @param {Function} handler - 处理回调函数
   */
  processCategory(categoryName, actionMap, handler) {
    if (!actionMap) return;

    // 使用 Object.entries 遍历 { key: value } 结构
    for (const [actionType, params] of Object.entries(actionMap)) {
      try {
        handler(actionType, params);
      } catch (err) {
        console.error(`处理 ${categoryName} -> ${actionType} 时发生错误:`, err);
      }
    }
  }

  finalizeTurn(results) {
    this.scene.events.emit('TURN_FINALISED', results)
  }
}