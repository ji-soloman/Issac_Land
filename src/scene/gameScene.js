import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';

import { MapView } from '../view/mapView.js';
import { BottomBar } from '../scene/bottomBar.js';
import { TopInfoBar } from '../scene/topInfoBar.js';

import { saveSystem } from '../system/saveSystem.js';
import { TurnSystem } from '../system/turnSystem.js';
import { game } from '../system/function.js';
import { get } from '../system/i18n.js';

import { MAPS } from '../data/map/EWland/map.js';
import { InfoSystem } from '../view/system/infoView.js';
import { InitGame } from '../view/system/initGame.js';
import { GridPanel } from '../view/system/gridPanel.js';
import { CreateWonder } from '../view/system/createWonder.js';
import { CreateRegion } from '../view/system/createRegion.js';
import { CreateBuilding } from '../view/system/createBuilding.js';
import { GridMainOtherFunctions } from '../view/system/gridMainOtherFunctions.js';

import { terrain } from '../data/terrain.js';
import { LeftSideBar } from '../scene/leftSideBar.js';
import { TECH_TREE } from '../data/tech_tree.js';
import { TechTreeSystem } from '../view/system/techTree.js';
import { MilitarySystem } from '../view/system/military_ui.js';
import { ActionListSystem } from '../view/system/actionList.js';
import { GreatPeopleSystem } from '../view/system/greatPeople.js';
import { MILITARY_UNIT } from '../data/military_unit.js';
import { REGION } from '../data/region.js';
import { BUILDING } from '../data/building.js';
import { applyRaceCostMods } from '../data/race.js';
import { ERA, getNextEraMissions } from '../data/era.js';
import { WONDER } from '../data/wonder.js';
import { GREAT_PEOPLE } from '../data/great_people.js';
import { military } from '../system/military.js';
import { GRID_BTN_ASSETS } from '../data/gridButtonImages.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  preload() {
    // 加载地图背景
    const mapType = saveSystem.currentSaveData.map_type;
    const mapConfig = MAPS;
    this.load.image('map_bg', mapConfig.image);
    this.load.image('btm_ui', '/assets/ui/btm_ui.png');
    this.load.image('info_page', 'assets/ui/info_page.png');
    Object.entries(terrain).forEach(([key, terrain]) => {
      this.load.image(`terrain_${key}`, terrain.image);
    });

    for (var i of ['culture', 'wealth', 'food', 'mine', 'magic', 'population']) {
      this.load.image(`icon_${i}`, 'assets/ui_icon/' + i + '.png');
    }

    // 学派界面背景图（浅色主题：背景图 + 20% 白色遮罩，见 view/system/academyView.js）
    this.load.image('academy_bg', 'assets/background/academy.jpg');
    // 学派界面专用 UI 素材：左上角标题牌、右上角退出按钮、分支卡片的已解锁/未解锁底板
    this.load.image('academy_header', 'assets/ui_academy/header.png');
    this.load.image('academy_close', 'assets/ui_academy/close.png');
    this.load.image('academy_unlocked_panel', 'assets/ui_academy/unlocked_panel.png');
    this.load.image('academy_locked_panel', 'assets/ui_academy/locked_panel.png');
    // 通用"确认/未确认"按钮底板（升级/选择类按钮用），当前学派界面在用，其它界面也可以复用
    this.load.image('btn_confirm', 'assets/ui/confirm.png');
    this.load.image('btn_unconfirmed', 'assets/ui/unconfirm.png');

    // 左侧边栏
    this.load.image('tech_tree_btn', 'assets/ui_button/tech_tree.png');
    this.load.image('military_btn', 'assets/ui_button/military.png');
    this.load.image('action_btn', 'assets/ui_button/action_list.png');
    this.load.image('great_people_btn', 'assets/ui_button/great_people.png');
    this.load.image('common_btn', 'assets/ui/common_btn.png');
    this.load.image('common_btn_green', 'assets/ui/common_btn_green.png');
    this.load.image('common_btn_blue', 'assets/ui/common_btn_blue.png');
    this.load.image('common_btn_red', 'assets/ui/common_btn_red.png');
    this.load.image('common_btn_purple', 'assets/ui/common_btn_purple.png');
    this.load.image('common_btn_light', 'assets/ui/common_btn_light.png');
    this.load.image('common_btn_dark', 'assets/ui/common_btn_dark.png');

    // GridPanel 功能按钮图片（从配置表批量加载）
    for (const [key, path] of GRID_BTN_ASSETS) {
      this.load.image(key, path);
    }

    this.load.image('settings_btn', 'assets/ui/settings_btn.png');

    // 加载科技图标
    this.load.image('tech_icon_default', 'assets/tech_tree/icon/default.png');
    // 沙漏图标
    this.load.image('hourglass_icon', 'assets/ui_icon/hourglass.png');

    Object.entries(TECH_TREE).forEach(([techId, tech]) => {
      if (tech.icon) {
        this.load.image(`tech_icon_${techId}`, tech.icon);
      }
    });
    Object.entries(MILITARY_UNIT).forEach(([key, value]) => {
      if (value.image && value.image.length > 0) {
        this.load.image(`soldier_${key}`, value.image);
      }
      // 兵组职业 type 图标
      if (value.type) {
        const typeKey = `soldier_type_${value.type}`;
        if (!this.textures.exists(typeKey)) {
          this.load.image(typeKey, `assets/military/soldier_type/${value.type}.png`);
        }
      }
    });

    // 兵组详情页 tab 按钮图标（选中/未选中两套）
    for (const tab of ['info', 'equip', 'train']) {
      this.load.image(`tab_${tab}_select`, `assets/military/ui/${tab}_select.png`);
      this.load.image(`tab_${tab}_unselect`, `assets/military/ui/${tab}_unselect.png`);
    }

    // 兵组品质边框
    for (const q of ['normal', 'good', 'rare', 'epic', 'legend']) {
      this.load.image(`quality_${q}`, `assets/military/ui/quality_${q}.png`);
    }

    // 六项基础属性图标
    for (const stat of ['physical_attack', 'spell_attack', 'hp', 'armor', 'mana', 'military_order']) {
      this.load.image(`stat_${stat}`, `assets/military/ui/${stat}.png`);
    }
    Object.entries(WONDER).forEach(([key, value]) => {
      if (value.image) {
        this.load.image(`wonder_${key}`, value.image);
      }
    });
    // 地图上的区域立绘（都城）：REGION 里标了 map_image 的区域，素材 assets/region/map/<区域key>.png，
    // 纹理 key 为 region_map_<区域key>（mapView.createHexagon 里按这个 key 取图）
    Object.entries(REGION).forEach(([key, value]) => {
      if (value.map_image) {
        this.load.image(`region_map_${key}`, `assets/region/map/${key}.png`);
      }
    });
    Object.entries(GREAT_PEOPLE).forEach(([key, value]) => {
      if (value.image) {
        this.load.image(`great_people_${key}`, value.image);
      }
    });
  }

  create() {
    this.saveData = saveSystem.currentSaveData;
    // 挂载到 scene 实例，供配置表的 trigger 回调及 UI 通过 scene.ERA / scene.BUILDING 访问
    this.ERA = ERA;
    this.BUILDING = BUILDING;

    this.initWorld();
    this.createMap();
    this.createBottomBar();
    this.createLeftSideBar();
    this.createTopInfoBar();
    this.createGmPanel();
    this.bindEvents();

    this.currentSystem = null;
    this.systemOpen = false;
    this.overlay = null;
    this.overlayWheelHandler = null;
    this.currentGridPanel = null;

    this.turnSystem = new TurnSystem(this, this.saveData, this.mapView);

    // 新存档首次进入游戏：触发初始化流程（选择起始主城）
    if (this.saveData.status == 0) {
      this.initGame = new InitGame(this, this.saveData);
    }

    this.events.on('END_TURN', () => {
      this.turnSystem.executeTurn(); // 感觉没必要拆成两个，后面看情况全都丢到turnSystem里面
      //this.refreshAll()
    });
    this.events.on('TURN_FINALISED', (result) => {
      console.log('开始回合结算：', result);
      var data = this.saveData;

      // ToDo:
      // 1.先结算上回合的资源收益
      // 1.1：[上回合的回合资源收入]：resource里增加的资源
      for (const i of ['culture', 'food', 'magic', 'mine', 'wealth']) {
        const base = data.resource[i] ?? 0;
        const income = data.resource[i + '_income'] ?? 0;
        data.resource[i] = base + income;
      }
      // 1.2：[其他资源]：当前回合因为各种原因增减的资源（政策buff，科技buff，兵力维护费，等，不包括人头税）。
      // *注：地块里的资源扣除不在这里扣，地块结算在后面[4.下回合资源]那里。
      // *注2：人头税属于每个城池各自的收入，所以也放后面的地块里。逻辑上也说得通，第一回合的回合资源收入是0，但是人口是1，所以这个会进这个回合结束后的回合收入，然后在第二回合结算的时候增加
      // *注3：当前资源+上回合的回合收入+其他资源=最终资源，这回合的回合资源收入留给下回合结算

      // *注4：【这里结算完后要把回合资源收入清空！！！】

      // ↓ 这里重新初始化新的回合收入
      const keys = ['culture', 'food', 'magic', 'mine', 'wealth'];
      const total = Object.fromEntries(keys.map(k => [k, 0]));

      // 1.5【移除区域】在第2步行动结算之前优先处理
      // 顺序：先依次触发每栋建筑的 onDestroy，再摧毁建筑，最后触发区域 onDestroy 并移除区域
      const civilActions = data.actionList?.civil ?? {};
      for (const [actionKey, param] of Object.entries(civilActions)) {
        if (!actionKey.startsWith('remove_region_')) continue;

        const gn = data.map.grids[param.gridId];
        if (!gn) continue;

        // 1) 依次摧毁建筑（先触发 onDestroy trigger）
        const buildings = gn.buildings ?? {};
        for (const buildingKey of Object.keys(buildings)) {
          this._handleTriggerComplete('building_destroy', buildingKey, data);
          delete gn.buildings[buildingKey];
        }
        // 清理建造中的建筑
        if (gn.createBuilding) {
          for (const buildingKey of Object.keys(gn.createBuilding)) {
            this._handleTriggerComplete('building_destroy', buildingKey, data);
          }
          delete gn.createBuilding;
        }

        // 2) 触发区域 onDestroy，再移除区域
        const regionKey = gn.region;
        if (regionKey) {
          this._handleTriggerComplete('region_destroy', regionKey, data);
          delete gn.region;
        }

        // 3) 从 actionList 中移除该条目
        delete data.actionList.civil[actionKey];
      }

      //2.结算当前回合行动事件
      for (const [actionType, params] of Object.entries(result)) {
        switch (actionType) {
          case 'military':
            for (const [actionMilitary, param] of Object.entries(params)) {
              switch (actionMilitary) {
                // 【探索地块】：确认地形
                case 'explore_terrain':
                  if (data.military[param.soldier]) {
                    delete data.military[param.soldier].currentStatus;
                  }
                  for (const [gridId, terrain] of Object.entries(param.result)) {
                    if (!data.map.grids[gridId]) data.map.grids[gridId] = {};
                    data.map.grids[gridId].terrain = terrain;
                  }
                  break;
              }
              // 【征集物产】：写入资源并清除士兵状态
              if (actionMilitary.startsWith('get_resource_')) {
                if (data.military[param.soldier]) {
                  delete data.military[param.soldier].currentStatus;
                }
                if (param.resource && !isNaN(total[param.resource])) {
                  data.resource[param.resource] = (data.resource[param.resource] || 0) + param.resultNum;
                }
              }
              // 【训练兵组】：写入训练队列倒计时（资源已在 onSuccess 时扣除）
              if (actionMilitary.startsWith('train_soldier_')) {
                if (!data.military_training) data.military_training = {};
                // 只有尚未写入（首次结算）才初始化，避免覆盖已有倒计时
                if (!data.military_training[actionMilitary]) {
                  data.military_training[actionMilitary] = {
                    unitKey: param.unitKey,
                    round: param.round ?? 1,
                  };
                }
              }
            }
            break;
          case 'civil':
            for (const [actionCivil, param] of Object.entries(params)) {
              // 【建造区域】
              if (actionCivil.startsWith('build_region')) {
                data.map.grids[param.gridId].createRegion = {
                  targetRegion: param.regionKey,
                  num: REGION[param.regionKey].round,
                }
              }
              // 【升级区域】：沿用 createRegion 倒计时，完工时 grid.region 直接替换为新区域；
              // 倒计时期间原区域继续生效。有升级次数限制的组（如王城）在这里永久记录已使用。
              else if (actionCivil.startsWith('upgrade_region')) {
                const upGrid = data.map.grids[param.gridId];
                upGrid.createRegion = {
                  targetRegion: param.regionKey,
                  num: REGION[param.regionKey].round,
                  upgrade: true,
                  from: upGrid.region,
                };
                const upGroup = REGION[param.regionKey]?.upgrade_group;
                if (upGroup) {
                  if (!data.region_upgrade_used) data.region_upgrade_used = {};
                  data.region_upgrade_used[upGroup] = true;
                }
              }
              // 【建造建筑】
              else if (actionCivil.startsWith('build_building')) {
                const gn = data.map.grids[param.gridId];
                if (!gn.createBuilding) gn.createBuilding = {};
                gn.createBuilding[param.buildingKey] = {
                  num: BUILDING[param.buildingKey].round,
                };
              }
              // 【研究科技】：techTree.startResearch 已在 onSuccess 里写入 researching，
              // 这里作为兜底确保数据一致（极少触发），实际倒计时结算在第5步
              else if (actionCivil.startsWith('research_tech_')) {
                if (!data.tech_tree.researching) data.tech_tree.researching = {};
                if (param.techId && !(param.techId in data.tech_tree.researching)) {
                  data.tech_tree.researching[param.techId] = param.round ?? 1;
                }
              }
              // 【科技】直接在科技系统里单独挂载事件
            }
            break;
        }
      }

      // 3.结算每个【地块相关】的倒计时
      // completedRegionTriggers / completedBuildingTriggers 分开收集，
      // 统一在第9项（turn++ 之后）按顺序触发：先所有区域，再所有建筑
      const completedRegionTriggers = [];
      const completedBuildingTriggers = [];

      for (const [gridsId, gridsInfo] of Object.entries(data.map.grids)) {
        // 【建造区域】倒计时
        if (gridsInfo.createRegion) {
          gridsInfo.createRegion.num = (gridsInfo.createRegion.num || 0) - 1;
          if (gridsInfo.createRegion.num <= 0) {
            const completedRegionKey = gridsInfo.createRegion.targetRegion;
            data.map.grids[gridsId].region = completedRegionKey;
            delete gridsInfo.createRegion;

            const trigger = REGION[completedRegionKey]?.effect?.trigger?.onComplete;
            if (typeof trigger === 'function') {
              completedRegionTriggers.push({ regionKey: completedRegionKey, gridId: gridsId });
            }
          }
        }

        // 【建造建筑】倒计时（一个格子可能同时建造多栋建筑）
        if (gridsInfo.createBuilding) {
          for (const [buildingKey, buildingInfo] of Object.entries(gridsInfo.createBuilding)) {
            buildingInfo.num = (buildingInfo.num || 0) - 1;
            if (buildingInfo.num <= 0) {
              if (!gridsInfo.buildings) gridsInfo.buildings = {};
              gridsInfo.buildings[buildingKey] = true;
              delete gridsInfo.createBuilding[buildingKey];

              const trigger = BUILDING[buildingKey]?.effect?.trigger?.onComplete;
              if (typeof trigger === 'function') {
                completedBuildingTriggers.push({ buildingKey, gridId: gridsId });
              }
            }
          }
          // 清理空的 createBuilding 对象
          if (Object.keys(gridsInfo.createBuilding).length === 0) {
            delete gridsInfo.createBuilding;
          }
        }
      }

      // 3.5【训练倒计时】每回合减少1，完成后调用 military.addSoldier 获得兵组
      const trainingQueue = data.military_training ?? {};
      const completedTraining = [];
      for (const [key, entry] of Object.entries(trainingQueue)) {
        entry.round = (entry.round ?? 1) - 1;
        if (entry.round <= 0) {
          completedTraining.push({ key, unitKey: entry.unitKey });
          delete trainingQueue[key];
        }
      }
      for (const { unitKey } of completedTraining) {
        military.addSoldier(unitKey, data, this);
      }

      // 3.8【驻扎结算】每个已建成的驻扎区域 / 建筑支付 驻扎人数×（种族繁育单价+额外消耗）的资源；
      // 付不起的整体失效，本回合不提供回合资源 / 额外行动条等增益（住房、槽位这类永久效果不受影响）。
      // 放在区域 / 建筑倒计时（第 3 步）之后，新建成的当回合就开始计；放在第 4 步之前，第 4 步按结果汇总收益。
      const garrisonReport = game.settleGarrison(data);
      const garrisonFailed = garrisonReport.filter(r => !r.ok);

      // ToDo:
      // 4.计算目前收益给下回合加
      // *注：每个地块依次结算，增加和减少，然后全部挂进回合收入里，然后给下回合去结算（包括人头税）
      const grids = data.map.grids;

      for (const [gridKey, grid] of Object.entries(grids)) {
        const region = grid.region;
        if (!region) continue;

        // 驻扎消耗付不起：该区域本回合的回合资源全部失效
        if (!game.isGarrisonActive(data, gridKey, 'region')) continue;

        const effect = REGION?.[region]?.effect?.turn;
        if (!effect) continue;

        for (const [res, value] of Object.entries(effect)) {
          if (!(res in total)) continue;

          const result =
            typeof value === 'function'
              ? value({ grid })
              : value;

          if (typeof result !== 'number' || Number.isNaN(result)) continue;

          total[res] += result;
        }
      }

      // 建筑收入：已建成的建筑（grid.buildings = { [key]: true }）的 effect.turn 同区域一样汇总
      // 支持数值，或 ({ grid }) => 数值 的函数写法；建造中的建筑（createBuilding）不产出
      for (const [gridKey, grid] of Object.entries(grids)) {
        const buildings = grid.buildings;
        if (!buildings) continue;

        for (const [buildingKey, built] of Object.entries(buildings)) {
          if (!built) continue;
          if (!game.isGarrisonActive(data, gridKey, 'building', buildingKey)) continue;

          const effect = BUILDING?.[buildingKey]?.effect?.turn;
          if (!effect) continue;

          for (const [res, value] of Object.entries(effect)) {
            if (!(res in total)) continue;

            let result;
            try {
              result = typeof value === 'function' ? value({ grid }) : value;
            } catch (err) {
              console.error(`building.effect.turn [${buildingKey}.${res}] 执行出错:`, err);
              continue;
            }

            if (typeof result !== 'number' || Number.isNaN(result)) continue;

            total[res] += result;
          }
        }
      }

      data.resource ??= {};

      // 人口收入：每个【空闲】人口（总人口 − 被驻扎锁定的人口）产生 1 财富，汇总后计入本回合收益。
      // 驻扎人口依旧算城池总人口（住房、繁衍、荣耀之都按总人口加税等不受影响），只是自己不产生人头税。
      // pending:false —— 此时本回合的行动已经落到 createRegion / createBuilding，不能再算一遍行动列表。
      for (const [gridKey, grid] of Object.entries(grids)) {
        if (grid.population) {
          const locked = grid.isMain ? game.getGarrisonLocked(data, gridKey, { pending: false }).total : 0;
          total.wealth += Math.max(0, grid.population - locked);
        }
      }

      for (const k of keys) {
        data.resource[`${k}_income`] = total[k];
      }

      // *注：↓【BUFF类】的倒计时放在最后，避免太早有buff影响当前回合资源计算（比如：消耗文化换取额外行动的政策，这回合解锁的话应该下回合才开始扣资源，因为这回合拿不到额外的行动）

      // 5.【科技结算】
      if (data.tech_tree) {
        const techFinished = [];

        for (const [techId, turns] of Object.entries(data.tech_tree.researching)) {
          const newTurns = turns - 1;

          if (newTurns <= 0) {
            techFinished.push(techId);
          } else {
            data.tech_tree.researching[techId] = newTurns;
          }
        }
        // 结束研究的统一最后删
        techFinished.forEach(techId => {
          delete data.tech_tree.researching[techId];
          data.tech_tree.unlocked[techId] = true;
        });
      }

      // ToDo:
      // 6.政策结算（暂时没做这个系统，以后再说，但是结算顺序是这个）

      // 7.结算完成后清空当前回合事件
      data.actionList = {
        civil: {},
        military: {},
        others: {},
      }
      // 8.回合增加（GM【进入下个回合（不计入回合）】会跳过这一步：上面的结算照常做，只是回合数不+1）
      if (this._gmSkipTurnIncrement) {
        this._gmSkipTurnIncrement = false;
      } else {
        data.process.turn++;
      }

      // 9.【Trigger 类事件结算】
      // 在 turn++ 之后执行，保证效果在新回合数据环境下生效
      // 顺序：先所有区域 onComplete，再所有建筑 onComplete
      for (const trigger of completedRegionTriggers) {
        this._handleTriggerComplete('region', trigger.regionKey, data);
      }
      for (const trigger of completedBuildingTriggers) {
        this._handleTriggerComplete('building', trigger.buildingKey, data);
      }

      // 10.【人口增加】繁衍行动在人口税收结算（第4步）之后写入，避免新增人口当回合就产生税收
      if (this.pendingBreed && this.pendingBreed.length > 0) {
        for (const { gridId, count } of this.pendingBreed) {
          const gn = data.map.grids[gridId];
          if (gn) gn.population = (gn.population ?? 0) + count;
        }
        this.pendingBreed = [];
      }

      // 10.5【时代晋升】所有结算（行动、倒计时、trigger、人口增加）都完成之后统一判断：
      // 下一个时代的所有要求都完成了就晋升。放在保存之前，保证晋升结果一起存档。
      // 顺序：先刷新右上角的时代任务面板（让玩家看到本回合的完成情况），再结算晋升；
      // 晋升之后再刷新一次，面板切换成新时代的任务。
      this.topInfoBar?.refreshMissionPanel();
      if (this.checkEraPromotion(data)) {
        this.topInfoBar?.refreshMissionPanel();
      }

      // 11.保存数据
      saveSystem.save();
      // 12.刷新地图
      this.mapView.refreshMap(data.map);
      if (this.topInfoBar) {
        this.topInfoBar.refresh();
      }
      // 13.驻扎消耗付不起的提示
      if (garrisonFailed.length > 0) {
        const names = [...new Set(garrisonFailed.map(r => r.source))].join('、');
        game.showTips(this, `${names}的驻扎消耗不足，本回合增益失效`);
      }
    });

  }

  initWorld() {
    // 确保 map 存在
    if (!this.saveData.map) {
      this.saveData.map = {};
    }

    var saveData = this.saveData;

    //初始化行动
    if (!this.saveData.actionList || Object.keys(this.saveData.actionList).length === 0) {
      console.log('初始化行动列表...');
      this.saveData.actionList = {
        military: {},
        civil: {},
        others: {},
      }
      saveSystem.save().then(() => {
        console.log('初始化行动列表已保存');
      });
    }

    // 初始化训练队列
    if (!this.saveData.military_training) {
      this.saveData.military_training = {};
    }

    //初始化军事
    if (!this.saveData.military || Object.keys(this.saveData.military).length === 0) {
      var scout = 'scout';
      switch (this.saveData.race) {
        case 'centaur':
          scout = 'centaur_scout';
          break;
        case 'voidwalker':
          scout = 'devil_scout';
          break;
      }
      // 顺序 await 确保两个兵组时间戳不同（military.addSoldier 内部已保证唯一性）
      military.addSoldier(scout, this.saveData, this, () => {
        military.addSoldier(scout, this.saveData, this, () => {
          console.log('初始化军队列表已保存');
        });
      });
    }

    // 测试：自动补充矿石
    if (!this.saveData.resource.mine || this.saveData.resource.mine < 3) {
      this.saveData.resource.mine = 3;
      saveSystem.save();
    }

    //// 临时测试模板

    /// 测试结束
  }

  createMap() {
    const mapType = this.saveData.map_type;
    const mapConfig = MAPS;
    this.mapView = new MapView(this, mapConfig, this.saveData.map);
    //this.mapView.editMode.choosePanel();
  }

  createBottomBar() {
    this.bottomBar = new BottomBar(this);
  }

  createLeftSideBar() {
    this.leftSideBar = new LeftSideBar(this);
  }

  createTopInfoBar() {
    this.topInfoBar = new TopInfoBar(this);
  }

  // ── GM 面板（调试用）────────────────────────────────
  // 屏幕左下角的常驻小面板，两个按钮都可以【空行动】直接进入下个回合：
  //   · 进入下个回合（计入回合）    完整结算，回合数 +1（等同玩家点“下一回合”，只是不要求有行动）
  //   · 进入下个回合（不计入回合）  完整结算（收入、各种倒计时、时代判定都照常），但回合数不 +1
  // 位置想调整只改 GM_PANEL_MARGIN；面板在各系统全屏界面（深度 1000+）之下，打开那些界面时点不到。
  createGmPanel() {
    const W = 220, BTN_H = 30, GAP = 8, PAD = 10, TITLE_H = 22, GM_PANEL_MARGIN = 12;
    const H = PAD + TITLE_H + 3 * BTN_H + 2 * GAP + PAD;

    const panel = this.add.container(0, 0).setDepth(900).setScrollFactor(0);
    const bg = this.add.rectangle(0, 0, W, H, 0x000000, 0.6)
      .setOrigin(0, 0).setStrokeStyle(1, 0x888888, 0.8).setInteractive();
    // 悬停在面板上时锁住地图的拖动/滚轮，避免误操作地图
    bg.on('pointerover', () => {
      const mv = this.mapView;
      if (mv && mv.interactionEnabled) { mv.disableInteraction(); this._gmMapLocked = true; }
    });
    bg.on('pointerout', () => {
      if (this._gmMapLocked) { this._gmMapLocked = false; this.mapView?.enableInteraction(); }
    });
    panel.add(bg);
    panel.add(this.add.text(W / 2, PAD + TITLE_H / 2, 'GM', {
      fontSize: '14px', color: '#ffcc00', fontStyle: 'bold', padding: { top: 3 },
    }).setOrigin(0.5));

    const addBtn = (idx, label, color, onClick) => {
      const y = PAD + TITLE_H + idx * (BTN_H + GAP);
      const btn = this.add.rectangle(PAD, y, W - PAD * 2, BTN_H, color, 1)
        .setOrigin(0, 0).setStrokeStyle(1, 0xffffff, 0.5).setInteractive({ useHandCursor: true });
      const txt = this.add.text(W / 2, y + BTN_H / 2, label, {
        fontSize: '13px', color: '#ffffff', fontStyle: 'bold', padding: { top: 3 },
      }).setOrigin(0.5);
      btn.on('pointerover', () => btn.setAlpha(0.8));
      btn.on('pointerout', () => btn.setAlpha(1));
      btn.on('pointerdown', () => btn.setAlpha(0.6));
      btn.on('pointerup', () => { btn.setAlpha(1); onClick(); });
      panel.add([btn, txt]);
    };
    addBtn(0, '进入下个回合（计入回合）', 0x27ae60, () => this.gmNextTurn(true));
    addBtn(1, '进入下个回合（不计入回合）', 0x2980b9, () => this.gmNextTurn(false));
    addBtn(2, '调整都城图片（大小 / 偏移）', 0xd35400, () => this.toggleRegionImageAdjust());

    const place = (w, h) => panel.setPosition(GM_PANEL_MARGIN, h - H - GM_PANEL_MARGIN);
    place(this.scale.width, this.scale.height);
    this.scale.on('resize', (size) => place(size.width, size.height));
    this.gmPanel = panel;
  }

  /**
   * GM：调整都城图片（地图上区域立绘的大小和位置偏移）。
   * 打开后：拖动地图上的都城图片 = 改偏移；鼠标悬浮在图片上滚轮 = 改缩放（也可以点面板里的按钮微调）；
   * 品红色六边形是目标范围，黄 / 青框是图片边界。调好后点【复制参数】，粘贴到 region.js 对应区域的 map_image 里。
   */
  toggleRegionImageAdjust() {
    if (this._regionAdjustPanel) { this._closeRegionImageAdjust(); return; }
    const mv = this.mapView;
    if (!mv) return;
    if (!mv.regionImages.length) {
      game.showTips(this, '地图上没有都城图片可调整');
      return;
    }

    const W = 300, H = 294, PAD = 10, MARGIN = 12;
    const panel = this.add.container(0, 0).setDepth(901).setScrollFactor(0);
    const bg = this.add.rectangle(0, 0, W, H, 0x000000, 0.7)
      .setOrigin(0, 0).setStrokeStyle(1, 0xd35400, 0.9).setInteractive();
    // 悬停在面板上时锁住地图的拖动/滚轮
    bg.on('pointerover', () => { if (mv.interactionEnabled) { mv.disableInteraction(); this._regionPanelLocked = true; } });
    bg.on('pointerout', () => { if (this._regionPanelLocked) { this._regionPanelLocked = false; mv.enableInteraction(); } });
    panel.add(bg);

    const txt = (x, y, s, size = '13px', color = '#ffffff', bold = false) => {
      const t = this.add.text(x, y, s, {
        fontSize: size, color, fontStyle: bold ? 'bold' : 'normal', padding: { top: 3 },
        wordWrap: { width: W - PAD * 2 },
      });
      panel.add(t);
      return t;
    };
    txt(PAD, PAD, '调整都城图片', '14px', '#ffcc00', true);
    const nameLine = txt(PAD, PAD + 22, '', '13px', '#aaddff');
    const valueLine = txt(PAD, PAD + 42, '', '14px', '#ffffff', true);
    txt(PAD, PAD + 66, '拖动图片 = 移动　滚轮（悬浮在图片上）= 缩放\n品红六边形 = 目标范围，点图片可切换选中的图片', '12px', '#bbbbbb');

    const refresh = (key, adj) => {
      if (!key || !adj) { nameLine.setText('（没有选中的都城图片）'); valueLine.setText(''); return; }
      nameLine.setText(`当前：${key}`);
      valueLine.setText(`缩放 ${adj.scale}　X ${adj.x}　Y ${adj.y}`);
    };

    const cur = () => mv.selectedRegionImageKey;
    const adjBy = (patch) => {
      const k = cur(); if (!k) return;
      const a = mv.getRegionImageAdjust(k);
      mv.adjustRegionImage(k, {
        ...(patch.scale != null ? { scale: a.scale + patch.scale } : {}),
        ...(patch.x != null ? { x: a.x + patch.x } : {}),
        ...(patch.y != null ? { y: a.y + patch.y } : {}),
      });
    };

    const addBtn = (x, y, w, label, color, onClick) => {
      const h = 26;
      const b = this.add.rectangle(x, y, w, h, color, 1).setOrigin(0, 0)
        .setStrokeStyle(1, 0xffffff, 0.5).setInteractive({ useHandCursor: true });
      const t = this.add.text(x + w / 2, y + h / 2, label, {
        fontSize: '12px', color: '#ffffff', fontStyle: 'bold', padding: { top: 3 },
      }).setOrigin(0.5);
      b.on('pointerover', () => b.setAlpha(0.8));
      b.on('pointerout', () => b.setAlpha(1));
      b.on('pointerdown', () => b.setAlpha(0.6));
      b.on('pointerup', () => { b.setAlpha(1); onClick(); });
      panel.add([b, t]);
    };
    const bw = 64, gap = 6;
    let by = 118;
    // 手动在四个都城立绘之间轮流切换显示（只是预览，不改存档；关闭面板后还原）
    addBtn(PAD, by, bw * 2 + gap, '◀ 上一张立绘', 0x2c7a7b, () => mv.cycleRegionImagePreview(-1));
    addBtn(PAD + 2 * (bw + gap), by, bw * 2 - 10 + gap, '下一张立绘 ▶', 0x2c7a7b, () => mv.cycleRegionImagePreview(1));
    by += 32;
    // 缩放 / X / Y 微调（按住不连发，点一下一步）
    addBtn(PAD, by, bw, '缩放 −', 0x555555, () => adjBy({ scale: -0.01 }));
    addBtn(PAD + (bw + gap), by, bw, '缩放 +', 0x555555, () => adjBy({ scale: 0.01 }));
    addBtn(PAD + 2 * (bw + gap), by, bw, 'X −', 0x555555, () => adjBy({ x: -1 }));
    addBtn(PAD + 3 * (bw + gap), by, bw - 10, 'X +', 0x555555, () => adjBy({ x: 1 }));
    by += 32;
    addBtn(PAD, by, bw, 'Y −（上）', 0x555555, () => adjBy({ y: -1 }));
    addBtn(PAD + (bw + gap), by, bw, 'Y +（下）', 0x555555, () => adjBy({ y: 1 }));
    addBtn(PAD + 2 * (bw + gap), by, bw * 2 - 10 + gap, '应用到全部都城', 0x7d3c98, () => { const k = cur(); if (k) mv.applyRegionImageAdjustToAll(k); });
    by += 32;
    addBtn(PAD, by, bw, '重置', 0x8e3b3b, () => { const k = cur(); if (k) mv.resetRegionImageAdjust(k); });
    addBtn(PAD + (bw + gap), by, bw * 2 + gap, '复制参数', 0x27ae60, () => this._copyRegionImageParams());
    addBtn(PAD + 3 * (bw + gap) - 0, by, bw - 10, '关闭', 0x2980b9, () => this._closeRegionImageAdjust());
    by += 32;
    this._regionParamsLine = txt(PAD, by, '', '11px', '#9fe29f');

    const place = (w, h) => panel.setPosition(MARGIN + 220 + MARGIN, h - H - MARGIN);
    place(this.scale.width, this.scale.height);
    this._regionAdjustResize = (size) => place(size.width, size.height);
    this.scale.on('resize', this._regionAdjustResize);

    mv.setRegionImageEditMode(true, refresh);
    this._regionAdjustPanel = panel;
  }

  _closeRegionImageAdjust() {
    this.mapView?.setRegionImageEditMode(false);
    if (this._regionPanelLocked) { this._regionPanelLocked = false; this.mapView?.enableInteraction(); }
    if (this._regionAdjustResize) { this.scale.off('resize', this._regionAdjustResize); this._regionAdjustResize = null; }
    this._regionAdjustPanel?.destroy(true);
    this._regionAdjustPanel = null;
    this._regionParamsLine = null;
  }

  /** 复制调整好的参数（优先写系统剪贴板，失败时退回 execCommand；同时在面板里和控制台显示，方便手动复制） */
  async _copyRegionImageParams() {
    const text = this.mapView?.getRegionImageParamsText() ?? '';
    if (!text) { game.showTips(this, '没有可复制的参数'); return; }
    console.log('都城图片参数：\n' + text);
    if (this._regionParamsLine) this._regionParamsLine.setText(text.replace(/\n/g, ' '));

    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch (e) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand('copy');
        ta.remove();
      } catch (e2) { ok = false; }
    }
    game.showTips(this, ok ? '参数已复制到剪贴板' : '复制失败，参数已显示在面板里，可以手动复制');
  }

  /**
   * GM：空行动直接进入下个回合。
   * @param {boolean} countTurn true = 回合数 +1；false = 完整结算但回合数不变
   */
  gmNextTurn(countTurn) {
    const data = this.saveData;
    data.actionList ??= {};
    for (const k of ['civil', 'military', 'others']) data.actionList[k] ??= {};

    this._gmSkipTurnIncrement = !countTurn;
    try {
      this.events.emit('END_TURN');
    } finally {
      // 即使结算中途抛错也不能把“跳过回合+1”的标记带到下一次
      this._gmSkipTurnIncrement = false;
    }
  }

  bindEvents() {
    // 地图格子点击事件
    this.mapView.onGridClick = (gridId) => {
      console.log('clicked grid:', gridId);
      const gridData = this.saveData.map.grids[gridId];
      const data = this.saveData;
      console.log('grid data:', gridData);

      if (this.currentSystem) {
        this.closeCurrentSystem();
      }

      // 再次点击当前已高亮选中的格子 -> 取消选中并关闭面板，不再重新打开
      if (this.currentGridPanel && this.mapView.selectedGridId === gridId) {
        this.currentGridPanel.playExitAnimation(() => {
          this.currentGridPanel.destroy();
          this.currentGridPanel = null;
        });
        this.mapView.clearSelectedGrid();
        return;
      }

      // 选中新的格子（若之前有别的格子高亮，会自动取消它的高亮）
      this.mapView.setSelectedGrid(gridId);

      if (this.currentGridPanel) {
        // 播放退出动画后再创建新面板
        this.currentGridPanel.playExitAnimation(() => {
          this.currentGridPanel.destroy();
          this.currentGridPanel = null;

          // 创建新的网格面板
          this.currentGridPanel = new GridPanel(this, gridId, data);
        });
      } else {
        // 直接创建新的网格面板
        this.currentGridPanel = new GridPanel(this, gridId, data);
      }
    };

    // 底部栏按钮事件
    this.bottomBar.onPersonalClick = () => {
      // 如果有打开的格子面板，先关闭（同时取消地图上的选中高亮）
      if (this.currentGridPanel) {
        this.currentGridPanel.destroy();
        this.currentGridPanel = null;
        this.mapView.clearSelectedGrid();
      }

      this.openSystem('info');
    };

    this.bottomBar.onPackageClick = () => {
      // 如果有打开的格子面板，先关闭（同时取消地图上的选中高亮）
      if (this.currentGridPanel) {
        this.currentGridPanel.destroy();
        this.currentGridPanel = null;
        this.mapView.clearSelectedGrid();
      }

      this.openSystem('package');
    };

    // 侧边栏功能
    // 科技树
    this.leftSideBar.onTechTreeClick = () => {
      if (this.currentGridPanel) {
        this.currentGridPanel.playExitAnimation(() => {
          this.currentGridPanel.destroy();
          this.currentGridPanel = null;
          this.mapView.clearSelectedGrid();
          this.openSystem('tech_tree');
        });
      } else {
        this.openSystem('tech_tree');
      }
    };
    // 军事行动
    this.leftSideBar.onMilitaryClick = () => {
      if (this.currentGridPanel) {
        this.currentGridPanel.playExitAnimation(() => {
          this.currentGridPanel.destroy();
          this.currentGridPanel = null;
          this.mapView.clearSelectedGrid();
          this.openSystem('military');
        });
      } else {
        this.openSystem('military');
      }
    };
    // 行动列表
    this.leftSideBar.onActionListClick = () => {
      if (this.currentGridPanel) {
        this.currentGridPanel.playExitAnimation(() => {
          this.currentGridPanel.destroy();
          this.currentGridPanel = null;
          this.mapView.clearSelectedGrid();
          this.openSystem('action_list');
        });
      } else {
        this.openSystem('action_list');
      }
    };
    // 名人系统
    this.leftSideBar.onGreatPeopleClick = () => {
      if (this.currentGridPanel) {
        this.currentGridPanel.playExitAnimation(() => {
          this.currentGridPanel.destroy();
          this.currentGridPanel = null;
          this.mapView.clearSelectedGrid();
          this.openSystem('great_people');
        });
      } else {
        this.openSystem('great_people');
      }
    };

    this.events.on('create_region_btn', (gridId) => {
      console.log('准备在以下地块创建地形:', gridId);
      const data = this.saveData;
      this.currentRegionPanel = new CreateRegion(this, gridId, data);
    });

    this.events.on('build_region', (result) => {
      console.log('建造特区信息：', result);

      // 驻扎人口：空闲人口必须多于驻扎数
      const garrisonBlock = game.getGarrisonBlockReason(this.saveData, result.gridId, REGION[result.regionKey]);
      if (garrisonBlock) {
        game.showTips(this, garrisonBlock);
        return;
      }

      game.addAction('civil', 'build_region_' + result.gridId, result, {
        onFail: (info) => {
          if (info.reason === 'limit') {
            game.showTips(this, '民生行动数量超过上限');
          }
        }
      });
    });

    // 建造建筑：区域建造不消耗资源，建筑建造的资源在【确认建造】时立即扣除。
    // 只有扣除成功，才会把行动计入行动列表（开始建造）；任何一步失败都不扣资源、不计入行动。
    this.events.on('build_building', (result) => {
      console.log('建造建筑信息：', result);

      const data = this.saveData;
      const actionName = 'build_building_' + result.gridId + '_' + result.buildingKey;
      // 种族修正后的建筑成本（钩子 build_building，必须和 createBuilding.js 的显示/判足一致）
      const cost = applyRaceCostMods(
        'build_building', BUILDING[result.buildingKey]?.cost ?? {}, data.race, data.subRace,
        { data, gridId: result.gridId, buildingKey: result.buildingKey, isWonder: false }
      );
      data.resource ??= {};
      const res = data.resource;

      // 1) 已在建造队列中，避免重复扣费
      if (data.actionList?.civil?.[actionName]) {
        game.showTips(this, '该建筑已在建造中');
        return;
      }

      // 1.5) 【城市唯一】本城（主城+分城）任意格点已有 / 正在建造，则不可再建
      if (BUILDING[result.buildingKey]?.unique) {
        const hit = game.findUniqueBuildingInCity(data, result.gridId, result.buildingKey);
        if (hit) {
          game.showTips(this, `每座城市只能建造一座【${BUILDING[result.buildingKey].name}】`);
          return;
        }
      }

      // 1.6) 驻扎人口：空闲人口必须多于驻扎数（确认后这部分人口锁定）
      const garrisonBlock = game.getGarrisonBlockReason(data, result.gridId, BUILDING[result.buildingKey]);
      if (garrisonBlock) {
        game.showTips(this, garrisonBlock);
        return;
      }

      // 2) 行动条是否还有空位
      if (!game.hasAvailableAction('civil')) {
        game.showTips(this, '民生行动数量超过上限');
        return;
      }

      // 3) 资源是否足够
      const lacks = Object.entries(cost).filter(([k, v]) => (res[k] ?? 0) < v);
      if (lacks.length > 0) {
        game.showTips(this, '资源不足：' + lacks.map(([k]) => get.translation(k)).join('、'));
        return;
      }

      // 4) 立即扣除资源
      for (const [k, v] of Object.entries(cost)) {
        res[k] = (res[k] ?? 0) - v;
      }

      // 5) 扣除成功后才计入行动（开始建造）；若写入失败则退回已扣资源
      const ok = game.addAction('civil', actionName, result, {
        onSuccess: () => {
          this.topInfoBar?.refresh();
          // 行动写入成功后刷新 GridPanel，让 pending 状态的建筑条目立即显示
          this.events.emit('refresh_grid_panel', result.gridId);
        },
        onFail: (info) => {
          if (info.reason === 'limit') {
            game.showTips(this, '民生行动数量超过上限');
          }
        }
      });
      if (!ok) {
        for (const [k, v] of Object.entries(cost)) {
          res[k] = (res[k] ?? 0) + v;
        }
      }
    });

    // CreateRegion 确认建造后通知 GridPanel 刷新，避免面板信息残留旧数据
    this.events.on('refresh_grid_panel', (gridId) => {
      if (this.currentGridPanel && this.currentGridPanel.gridId === gridId) {
        // switchTab 会清空并重建当前 tab 的内容，以最新 saveData 为准
        this.currentGridPanel.switchTab(this.currentGridPanel.currentTab);
      }
    });

    // 繁衍人口：立即扣资源（在 gridPanel 里完成），人口增加记录到 pendingBreed，
    // 在回合结算的人口税收完成后（trigger 结算之后）统一写入
    this.events.on('breed_population', ({ gridId, count }) => {
      if (!this.pendingBreed) this.pendingBreed = [];
      this.pendingBreed.push({ gridId, count });
    });

    this.events.on('train_soldier', ({ unitKey, cost, round, unitName, selectedMainGn }) => {
      // 训练消耗的人口只能用【空闲人口】，被驻扎锁定的人口不能再被消耗
      if (cost?.population && selectedMainGn
        && game.getCityFreePopulation(this.saveData, selectedMainGn) < cost.population) {
        game.showTips(this, '空闲人口不足（部分人口已驻扎锁定）');
        return;
      }
      const actionKey = 'train_soldier_' + unitKey + '_' + Date.now();
      game.addAction('military', actionKey, { unitKey, cost, round, unitName, selectedMainGn }, {
        onSuccess: () => {
          const res = this.saveData.resource ?? {};
          const grids = this.saveData.map?.grids ?? {};
          // 立即扣除资源：population 从选定主城格点扣，其他从 resource 扣
          for (const [k, v] of Object.entries(cost)) {
            if (k === 'population' && selectedMainGn && grids[selectedMainGn]) {
              grids[selectedMainGn].population = (grids[selectedMainGn].population ?? 0) - v;
            } else {
              res[k] = (res[k] ?? 0) - v;
            }
          }
          this.topInfoBar?.refresh();

          if (!this.saveData.military_training) this.saveData.military_training = {};
          this.saveData.military_training[actionKey] = { unitKey, round };

          saveSystem.save();
        },
        onFail: (info) => {
          if (info.reason === 'limit') game.showTips(this, '军事行动数量超过上限');
        },
      });
    });

    this.events.on('create_building_btn', (gridId) => {
      console.log('准备在以下地块创建建筑:', gridId);
      const data = this.saveData;
      this.currentBuildingPanel = new CreateBuilding(this, gridId, data);
    });

    this.events.on('main_other_func_btn', (gridId) => {
      new GridMainOtherFunctions(this, this.saveData, gridId);
    });

    this.events.on('create_wonder_btn', (gridId) => {
      console.log('准备在以下地块创建奇迹:', gridId);
      const data = this.saveData;
      this.currentWonderPanel = new CreateWonder(this, gridId, data);
    });

    this.events.on('build_wonder', (info) => {
      console.log('在', info.gridId, '区域创建', info.wonderKey);
      this.saveData.map.grids[info.gridId].wonder = info.wonderKey;
      saveSystem.save().then(() => {
        console.log('奇迹创建成功！');
        this.saveData = saveSystem.currentSaveData;
        this.mapView.refreshMap(this.saveData.map);
        if (this.currentGridPanel) {
          this.currentGridPanel.playExitAnimation(() => {
            this.currentGridPanel.destroy();
            this.currentGridPanel = null;
            this.mapView.clearSelectedGrid();
          });
        }
      });
    });
  }

  createOverlay() {
    if (this.overlay) return; // 已存在则不重复创建

    const { width, height } = this.scale;
    const centerX = width / 2;
    const centerY = height / 2;
    if (this.mapView) {
      this.mapView.disableInteraction();
    }
    if (this.leftSideBar) {
      this.leftSideBar.isDisabled = true;
    }

    // 创建半透明黑色遮罩
    this.overlay = this.add.rectangle(centerX, centerY, width, height, 0x000000, 0.5);
    this.overlay.setDepth(999);
    this.overlay.setInteractive();
    this.overlay.setAlpha(0);

    // 阻止所有鼠标事件穿透
    this.overlay.on('pointerdown', (pointer) => {
      pointer.event.stopPropagation();
    });
    this.overlay.on('pointermove', (pointer) => {
      pointer.event.stopPropagation();
    });
    this.overlay.on('pointerup', (pointer) => {
      pointer.event.stopPropagation();
    });

    // 阻止鼠标滚轮事件
    this.overlayWheelHandler = (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
      if (this.systemOpen) {
        pointer.event.preventDefault();
        pointer.event.stopPropagation();
      }
    };
    this.input.on('wheel', this.overlayWheelHandler);

    // 淡入动画
    this.tweens.add({
      targets: this.overlay,
      alpha: 0.5,
      duration: 300,
      ease: 'Linear'
    });
  }

  // 移除遮罩层
  removeOverlay() {
    if (!this.overlay) return;
    if (this.mapView) {
      this.mapView.enableInteraction();
    }
    if (this.leftSideBar) {
      this.leftSideBar.isDisabled = false;
    }

    // 淡出动画
    this.tweens.add({
      targets: this.overlay,
      alpha: 0,
      duration: 200,
      ease: 'Linear',
      onComplete: () => {
        if (this.overlay) {
          this.overlay.destroy();
          this.overlay = null;
        }
      }
    });

    // 移除滚轮事件监听
    if (this.overlayWheelHandler) {
      this.input.off('wheel', this.overlayWheelHandler);
      this.overlayWheelHandler = null;
    }
  }

  /**
   * 打开系统面板
   * @param {string} systemType - 系统类型
   */
  openSystem(systemType) {
    console.log('打开系统:', systemType);

    // 如果已有打开的系统，先关闭
    if (this.currentSystem) {
      this.closeCurrentSystem();
    }

    // 标记系统已打开并创建遮罩
    this.systemOpen = true;
    this.createOverlay();

    // 根据类型创建对应的系统
    switch (systemType) {
      case 'info':
        this.currentSystem = new InfoSystem(this, this.saveData);
        break;

      case 'package':
        // TODO: 创建仓库面板
        // this.currentSystem = new PackageSystem(this, this.saveData);
        console.log('TODO: 创建仓库面板');
        this.systemOpen = false;
        this.removeOverlay();
        break;

      case 'tech_tree':
        this.currentSystem = new TechTreeSystem(this, this.saveData);
        break;
      case 'military':
        this.currentSystem = new MilitarySystem(this, this.saveData);
        break;
      case 'action_list':
        this.currentSystem = new ActionListSystem(this, this.saveData);
        break;
      case 'great_people':
        this.currentSystem = new GreatPeopleSystem(this, this.saveData);
        break;

      default:
        console.warn('未知的系统类型:', systemType);
        // 如果系统类型无效，关闭遮罩
        this.systemOpen = false;
        this.removeOverlay();
    }
  }

  // 关闭当前打开的系统
  closeCurrentSystem() {
    if (this.currentSystem && this.currentSystem.destroy) {
      this.currentSystem.destroy();
      this.currentSystem = null;
    }

    // 标记系统已关闭并移除遮罩
    this.systemOpen = false;
    this.removeOverlay();
  }
  /**
   * 统一执行区域/建筑的 trigger 回调。
   * type 取值：
   *   'region'          → REGION[key].effect.trigger.onComplete
   *   'building'        → BUILDING[key].effect.trigger.onComplete
   *   'region_destroy'  → REGION[key].effect.trigger.onDestroy
   *   'building_destroy'→ BUILDING[key].effect.trigger.onDestroy
   */
  _handleTriggerComplete(type, key, data) {
    let config, triggerFn;
    if (type === 'region') {
      config = REGION[key];
      triggerFn = config?.effect?.trigger?.onComplete;
    } else if (type === 'building') {
      config = BUILDING[key];
      triggerFn = config?.effect?.trigger?.onComplete;
    } else if (type === 'region_destroy') {
      config = REGION[key];
      triggerFn = config?.effect?.trigger?.onDestroy;
    } else if (type === 'building_destroy') {
      config = BUILDING[key];
      triggerFn = config?.effect?.trigger?.onDestroy;
    }
    if (typeof triggerFn !== 'function') return;
    try {
      triggerFn({ savedata: data, scene: this });
    } catch (err) {
      console.error(`trigger.${type} [${key}] 执行出错:`, err);
    }
  }

  /**
   * 时代晋升判断：在每个回合所有结算完成之后调用（见 TURN_FINALISED 的 10.5 步）。
   * 规则：取当前时代的下一个时代（order+1），它的 mission（见 era.js）里所有要求的
   * filter 都返回 true 才晋升；每回合最多晋升一个时代。
   * 下一个时代没有配置 mission、或者某条要求没有 filter 函数时，视为条件不满足，不会晋升。
   * @returns {boolean} 本次是否发生了晋升
   */
  checkEraPromotion(data) {
    data.process ??= {};
    const info = getNextEraMissions(data, this);
    if (!info || info.missions.length === 0) return false;
    if (!info.missions.every(m => m.done)) return false;

    data.process.era = info.nextKey;
    this.showEraAnnouncement(info.nextEra.name);
    return true;
  }

  /**
   * 在屏幕中央播报时代升级信息。
   * 大标题淡入保持 2 秒后淡出销毁。
   * @param {string} eraName - 新时代名称
   */
  showEraAnnouncement(eraName) {
    const { width, height } = this.scale;

    // 半透明黑色遮罩，衬托文字，不拦截点击
    const overlay = this.add.rectangle(width / 2, height / 2, width, height * 0.28, 0x000000, 0.55)
      .setDepth(2000)
      .setAlpha(0);

    const label = this.add.text(width / 2, height / 2 - 18, '进入新时代', {
      fontFamily: 'serif',
      fontSize: '22px',
      color: '#d4af6a',
    }).setOrigin(0.5).setDepth(2001).setAlpha(0);

    const title = this.add.text(width / 2, height / 2 + 22, eraName, {
      fontFamily: 'serif',
      fontSize: '48px',
      color: '#fff8e7',
      stroke: '#3a2000',
      strokeThickness: 6,
      shadow: { offsetX: 2, offsetY: 4, color: '#000', blur: 10, fill: true },
    }).setOrigin(0.5).setDepth(2001).setAlpha(0);

    // 淡入
    this.tweens.add({
      targets: [overlay, label, title],
      alpha: 1,
      duration: 600,
      ease: 'Power2',
      onComplete: () => {
        // 停留 2 秒后淡出销毁
        this.time.delayedCall(2000, () => {
          this.tweens.add({
            targets: [overlay, label, title],
            alpha: 0,
            duration: 600,
            ease: 'Power2',
            onComplete: () => {
              overlay.destroy();
              label.destroy();
              title.destroy();
            },
          });
        });
      },
    });
  }

  closeGridPanel() {
    if (this.currentGridPanel) {
      this.currentGridPanel.destroy();
      this.currentGridPanel = null;
    }
    if (this.mapView) {
      this.mapView.clearSelectedGrid();
    }
  }
}