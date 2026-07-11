import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';

import { MapView } from '../view/mapView.js';
import { BottomBar } from '../scene/bottomBar.js';
import { TopInfoBar } from '../scene/topInfoBar.js';

import { saveSystem } from '../system/saveSystem.js';
import { TurnSystem } from '../system/turnSystem.js';
import { game } from '../system/function.js';

import { MAPS } from '../data/map/EWland/map.js';
import { InfoSystem } from '../view/system/infoView.js';
import { InitGame } from '../view/system/initGame.js';
import { GridPanel } from '../view/system/gridPanel.js';
import { CreateWonder } from '../view/system/createWonder.js';
import { CreateRegion } from '../view/system/createRegion.js';
import { CreateBuilding } from '../view/system/createBuilding.js';

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
import { ERA } from '../data/era.js';
import { WONDER } from '../data/wonder.js';
import { GREAT_PEOPLE } from '../data/great_people.js';

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
    });
    Object.entries(WONDER).forEach(([key, value]) => {
      if (value.image) {
        this.load.image(`wonder_${key}`, value.image);
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
                    // turnSystem 已经在结算时将 hasMain/region/buildings/products 写入 grids，
                    // 这里只补充 terrain 字段，不能整体覆盖，否则 hasMain 等字段会丢失
                    if (!data.map.grids[gridId]) data.map.grids[gridId] = {};
                    data.map.grids[gridId].terrain = terrain;
                  }
                  break;
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
              else if (actionCivil.startsWith('get_resource_')) {
                if (data.military[param.soldier]) {
                  delete data.military[param.soldier].currentStatus;
                }
                if (param.resource && !isNaN(total[param.resource])) {
                  data.resource[param.resource] += param.resultNum;
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

      // ToDo:
      // 4.计算目前收益给下回合加
      // *注：每个地块依次结算，增加和减少，然后全部挂进回合收入里，然后给下回合去结算（包括人头税）
      const grids = data.map.grids;

      for (const grid of Object.values(grids)) {
        const region = grid.region;
        if (!region) continue;

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

      data.resource ??= {};

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
      // 8.回合增加
      data.process.turn++;

      // 9.【Trigger 类事件结算】
      // 在 turn++ 之后执行，保证效果在新回合数据环境下生效
      // 顺序：先所有区域 onComplete，再所有建筑 onComplete
      for (const trigger of completedRegionTriggers) {
        this._handleTriggerComplete('region', trigger.regionKey, data);
      }
      for (const trigger of completedBuildingTriggers) {
        this._handleTriggerComplete('building', trigger.buildingKey, data);
      }
      // 9.保存数据
      saveSystem.save();
      // 10.刷新地图
      this.mapView.refreshMap(data.map);
      if (this.topInfoBar) {
        this.topInfoBar.refresh();
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
      // 立即保存
      saveSystem.save().then(() => {
        console.log('初始化行动列表已保存');
      });
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
      this.saveData.military = {
        s1: {
          name: scout,
          stats: MILITARY_UNIT[scout].basic_stats,
          equipments: MILITARY_UNIT[scout].equipments,
          ability: MILITARY_UNIT[scout].special_ability,
        },
        s2: {
          name: scout,
          stats: MILITARY_UNIT[scout].basic_stats,
          equipments: MILITARY_UNIT[scout].equipments,
          ability: MILITARY_UNIT[scout].special_ability,
        },
      }
      saveSystem.save().then(() => {
        console.log('初始化军队列表已保存');
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

      game.addAction('civil', 'build_region_' + result.gridId, result, {
        onFail: (info) => {
          if (info.reason === 'limit') {
            game.showTips(this, '行动数量超过上限');
          }
        }
      });
    });

    this.events.on('build_building', (result) => {
      console.log('建造建筑信息：', result);

      game.addAction('civil', 'build_building_' + result.gridId + '_' + result.buildingKey, result, {
        onSuccess: () => {
          // 行动写入成功后刷新 GridPanel，让 pending 状态的建筑条目立即显示
          this.events.emit('refresh_grid_panel', result.gridId);
        },
        onFail: (info) => {
          if (info.reason === 'limit') {
            game.showTips(this, '行动数量超过上限');
          }
        }
      });
    });

    // CreateRegion 确认建造后通知 GridPanel 刷新，避免面板信息残留旧数据
    this.events.on('refresh_grid_panel', (gridId) => {
      if (this.currentGridPanel && this.currentGridPanel.gridId === gridId) {
        // switchTab 会清空并重建当前 tab 的内容，以最新 saveData 为准
        this.currentGridPanel.switchTab(this.currentGridPanel.currentTab);
      }
    });

    this.events.on('create_building_btn', (gridId) => {
      console.log('准备在以下地块创建建筑:', gridId);
      const data = this.saveData;
      this.currentBuildingPanel = new CreateBuilding(this, gridId, data);
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