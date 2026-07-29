// import { CivilLogic } from './logic/CivilLogic.js';
// import { MilitaryLogic } from './logic/MilitaryLogic.js';
// import { OthersLogic } from './logic/OthersLogic.js';
import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import { MAPS } from '../data/map/EWland/map.js';

export class TurnSystem {
  /**
   * @param {Phaser.Scene} scene   - 场景引用
   * @param {Object}       saveData - 存档数据
   * @param {Object}       mapView  - MapView 实例，用于复用 getGridNeighbors 邻格算法
   */
  constructor(scene, saveData, mapView) {
    this.scene = scene;
    this.saveData = saveData;
    this.mapView = mapView;
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
        let soldierId = params.soldier;
        console.log('正在结算', soldierId, '的行为', actionType);

        const currentGrids = this.saveData.map.grids;
        const mapGrids = MAPS.grids;   // 地图配置表，记录每个格点的地形信息
        const exploreResult = {};          // 记录本次实际解锁的格点，格式: { gn: terrainType }

        // ── 找出所有主城格点 ──────────────────────────────────────────────
        // 一局游戏中主城可能大于 1 个（多文明 / 多城），全部纳入处理范围
        const mainGridIds = Object.keys(currentGrids).filter(
          gn => currentGrids[gn]?.isMain === true
        );

        if (mainGridIds.length === 0) {
          console.log('explore_terrain: 存档中暂无主城格点，跳过探索结算');
          result.military.explore_terrain = { soldier: soldierId, result: exploreResult };
          return;
        }

        // ── 汇总所有主城周围6格中尚未解锁的候选格点 ─────────────────────
        // 用 Set 去重，避免两个主城相邻时同一格被重复统计
        const candidateSet = new Set();

        for (const mainGn of mainGridIds) {
          const neighbors = this.mapView.getGridNeighbors(mainGn);

          for (const neighborGn of neighbors) {
            if (!neighborGn) continue;
            if (!mapGrids[neighborGn]) continue;

            const saved = currentGrids[neighborGn];
            // 已属城池（分城或主城）的格点不参与探索
            if (saved?.hasMain) continue;
            if (saved?.isMain) continue;

            // 未发现格点 或 野地（已发现但不属城池），都可作为候选
            candidateSet.add(neighborGn);
          }
        }

        const candidates = Array.from(candidateSet);

        if (candidates.length === 0) {
          console.log('explore_terrain: 所有主城周边格点均已解锁');
          result.military.explore_terrain = { soldier: soldierId, result: exploreResult };
          return;
        }

        // ── Roll 本次解锁数量（2~3），不超过候选数量 ─────────────────────
        const numToUnlock = Math.min(Phaser.Math.Between(2, 3), candidates.length);

        // 随机打乱后取前 numToUnlock 个
        Phaser.Utils.Array.Shuffle(candidates);
        const keysToUnlock = candidates.slice(0, numToUnlock);

        // ── 写入存档并记录结果 ────────────────────────────────────────────
        for (const gn of keysToUnlock) {
          const config = mapGrids[gn];

          let terrainType = '';
          if (typeof config.type === 'string') {
            terrainType = config.type;
          } else if (Array.isArray(config.type)) {
            terrainType = Phaser.Utils.Array.GetRandom(config.type);
          }

          const ownerMain = mainGridIds.find(mainGn => {
            const neighbors = this.mapView.getGridNeighbors(mainGn);
            return neighbors.includes(gn);
          }) || mainGridIds[0];

          // 野地（已存在但不属城池）：销毁其驻扎的移民星舟，再改写为分城格式
          const existing = currentGrids[gn];
          if (existing && !existing.isMain && !existing.hasMain) {
            if (existing.soldier && this.saveData.military?.[existing.soldier]) {
              delete this.saveData.military[existing.soldier];
              console.log(`explore_terrain: 销毁野地 ${gn} 中的移民星舟 ${existing.soldier}`);
            }
          }

          // 写入分城数据（覆盖野地或创建新格点）
          currentGrids[gn] = {
            hasMain: ownerMain,
            region: '',
            buildings: {},
            products: {},
          };

          exploreResult[gn] = terrainType;
        }

        console.log(`explore_terrain: 本次解锁 ${keysToUnlock.length} 个格点`, exploreResult);

        // 赋值给 result 对象
        result.military.explore_terrain = {
          soldier: soldierId,
          result: exploreResult,
        };
      }

      if (actionType.startsWith('get_resource_')) {
        let soldierId = params.soldier;
        console.log('正在结算', soldierId, '的行为 get_resource');

        // magic 每次固定获得 2 个，其他资源随机 3~6 个
        let num = params.resource === 'magic' ? 2 : Phaser.Math.Between(3, 6);

        result.military[actionType] = {
          soldier: params.soldier,
          resultNum: num,
          resource: params.resource,
        };
      }

      if (actionType.startsWith('train_soldier_')) {
        // 训练行动：直接透传到 result，让 gameScene 第2步写入 military_training 倒计时
        result.military[actionType] = params;
      }
    });

    // 2. 处理Civil
    this.processCategory('civil', list.civil, (actionType, params) => {
      // CivilLogic.handle(actionType, params, this.saveData);
      console.log(`执行民事行动: [${actionType}]`, params);
      if (actionType.startsWith('build_region')) {
        result.civil[actionType] = params;
      }
      else if (actionType.startsWith('build_building')) {
        result.civil[actionType] = params;
      }
      else if (actionType.startsWith('remove_region')) {
        result.civil[actionType] = params;
      }
      else if (actionType.startsWith('research_tech_')) {
        result.civil[actionType] = params;
      }
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