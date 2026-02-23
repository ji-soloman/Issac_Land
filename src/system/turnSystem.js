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

    // 实例化后立即执行回合结算，或者你可以手动调用
    this.executeTurn();
  }

  executeTurn() {
    const list = this.saveData.actionList;

    console.log(`--- 开始结算第 ${this.saveData.process.turn} 回合 ---`);

    // 1. 处理Military
    this.processCategory('military', list.military, (actionType, params) => {
      // 这里调用你的军事逻辑处理类
      // MilitaryLogic.handle(actionType, params, this.saveData);
      console.log(`执行军事行动: [${actionType}]`, params);

      // 示例逻辑
      if (actionType === 'explore_terrain') {
        const soldierId = params.soldier;
        console.log('正在结算', soldierId, '的行为', actionType);
        // 假设这是在一个方法内
        const currentGrids = this.saveData.map.grids;
        const allGrids = MAPS[this.saveData.map_type].grids;

        // 1. 确定本次要解锁的数量 (随机 2~4 个)
        const numToUnlock = Phaser.Math.Between(2, 4);
        let unlockedCount = 0;

        // 2. 用于统计每种地形解锁的数量
        const stats = {};

        // 3. 按顺序遍历 allGrids 的 Key (g1, g2, g3...)
        const allKeys = Object.keys(allGrids);

        for (const key of allKeys) {
          // 如果已经解锁够了，跳出循环
          if (unlockedCount >= numToUnlock) break;

          const currentData = currentGrids[key];

          /**
           * 判断条件：
           * 1. current 中不存在该格子 (undefined)
           * 2. 或者该格子存在但 locked 为 true
           */
          if (!currentData || currentData.locked !== true) {

            // --- 执行解锁逻辑 ---
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

            // --- 统计数据 ---
            if (selectedTerrain) {
              stats[selectedTerrain] = (stats[selectedTerrain] || 0) + 1;
            }

            unlockedCount++;
          }
        }

        // 4. 将结果返回或打印
        console.log(`本次共解锁了 ${unlockedCount} 个格子`, stats);

        // 如果这是在 TurnSystem 里，你可以把 stats 返回给结果列表
        // return stats;
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
    this.finalizeTurn();
  }

  /**
   * 通用分类处理器
   * @param {string} categoryName - 分类名称 (用于日志)
   * @param {Object} actionMap - 该分类下的动作对象 (例如 list.military)
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

    // 1. 更新回合数 (兼容 process.turn 结构)
    // if (!this.saveData.process) {
    //   this.saveData.process = { turn: 1, era: '原始时代' };
    // }
    // this.saveData.process.turn++;

    // // 2. 重置行动列表 (保持结构，清空内容)
    // // 注意：不能赋值为 []，因为上一层 ActionListSystem 依赖对象结构
    // this.saveData.actionList = {
    //   civil: {},
    //   military: {},
    //   others: {}
    // };

    // console.log(`--- 回合结束，进入第 ${this.saveData.process.turn} 回合 ---`);

    // 3. (可选) 通知场景刷新 UI
    // this.scene.events.emit('TURN_CHANGED', this.saveData.process.turn);
  }
}