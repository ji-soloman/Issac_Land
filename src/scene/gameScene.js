import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';

import { MapView } from '../view/mapView.js';
import { BottomBar } from '../scene/bottomBar.js';
import { TopInfoBar } from '../scene/topInfoBar.js';

import { saveSystem } from '../system/saveSystem.js';
import { TurnSystem } from '../system/turnSystem.js';

import { MAPS } from '../data/map.js';
import { InfoSystem } from '../view/system/infoView.js';
import { GridPanel } from '../view/system/gridPanel.js';
import { CreateWonder } from '../view/system/createWonder.js';
import { CreateRegion } from '../view/system/createRegion.js';
import { CreateBuilding } from '../view/system/createBuilding.js';

import { terrain } from '../data/terrain.js';
import { LeftSideBar } from '../scene/leftSideBar.js';
import { TECH_TREE } from '../data/tech_tree.js';
import { TechTreeSystem } from '../view/system/techTree.js';
import { MilitarySystem } from '../view/system/military.js';
import { ActionListSystem } from '../view/system/actionList.js';
import { MILITARY_UNIT } from '../data/military_unit.js';
import { REGION } from '../data/region.js';
import { WONDER } from '../data/wonder.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  preload() {
    // 加载地图背景
    const mapType = saveSystem.currentSaveData.map_type;
    const mapConfig = MAPS[mapType];
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
    this.load.image('common_btn', 'assets/ui/common_btn.png');
    this.load.image('common_btn_green', 'assets/ui/common_btn_green.png');
    this.load.image('common_btn_blue', 'assets/ui/common_btn_blue.png');

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
  }

  create() {
    this.saveData = saveSystem.currentSaveData;

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

    this.turnSystem = new TurnSystem(this, this.saveData)

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
      // 1.2：[其他资源]：当前回合因为各种原因增减的资源（政策buff，科技buff，兵力维护费，等，不包括人头税）。
      // *注：地块里的资源扣除不在这里扣，地块结算在后面[4.下回合资源]那里。
      // *注2：人头税属于每个城池各自的收入，所以也放后面的地块里。逻辑上也说得通，第一回合的回合资源收入是0，但是人口是1，所以这个会进这个回合结束后的回合收入，然后在第二回合结算的时候增加
      // *注3：当前资源+上回合的回合收入+其他资源=最终资源，这回合的回合资源收入留给下回合结算

      // *注4：【这里结算完后要把回合资源收入清空！！！】

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
                    data.map.grids[gridId] = {
                      terrain: terrain,
                      locked: true,
                    }
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
              // 【科技】直接在科技系统里单独挂载事件
            }
            break;
        }
      }

      // 3.结算每个【地块相关】的倒计时
      for (const [gridsId, gridsInfo] of Object.entries(data.map.grids)) {
        // 【建造区域】
        if (gridsInfo.createRegion) {
          gridsInfo.createRegion.num = (gridsInfo.createRegion.num || 0) - 1;
          if (gridsInfo.createRegion.num <= 0) {
            data.map.grids[gridsId].region = gridsInfo.createRegion.targetRegion;
            delete gridsInfo.createRegion;
          }
        }
      }

      // ToDo:
      // 4.计算目前收益给下回合加
      // *注：每个地块依次结算，增加和减少，然后全部挂进回合收入里，然后给下回合去结算（包括人头税）

      // *注：↓【BUFF类】的倒计时放在最后，避免太早有buff影响当前回合资源计算（比如：消耗文化换取额外行动的政策，这回合解锁的话应该下回合才开始扣资源，因为这回合拿不到额外的行动）

      // 5.【科技结算】
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
      // 9.保存数据
      saveSystem.save();
      // 10.刷新地图
      this.mapView.refreshMap(data.map);
      if (this.topInfoBar) {
        this.topInfoBar.refresh();
      }
    })

  }

  initWorld() {
    // 确保 map 存在
    if (!this.saveData.map) {
      this.saveData.map = {};
    }

    // 检查是否需要初始化格子
    const needsInit = !this.saveData.map.grids ||
      Object.keys(this.saveData.map.grids).length === 0;

    if (needsInit) {
      console.log('初始化地图格子数据...');

      this.saveData.map.grids = {};

      this.saveData.map.grids['g1'] = {
        locked: true,
        region: 'main',
        terrain: null,
        buildings: [],
        products: []
      };

      console.log('地图格子初始化完成:', this.saveData.map.grids);

      // 立即保存
      saveSystem.save().then(() => {
        console.log('初始化数据已保存');
      });
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
    const mapConfig = MAPS[mapType];
    this.mapView = new MapView(this, mapConfig, this.saveData.map);
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
      // 如果有打开的格子面板，先关闭
      if (this.currentGridPanel) {
        this.currentGridPanel.destroy();
        this.currentGridPanel = null;
      }

      this.openSystem('info');
    };

    this.bottomBar.onPackageClick = () => {
      // 如果有打开的格子面板，先关闭
      if (this.currentGridPanel) {
        this.currentGridPanel.destroy();
        this.currentGridPanel = null;
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
          this.openSystem('action_list');
        });
      } else {
        this.openSystem('action_list');
      }
    };

    this.events.on('create_region_btn', (gridId) => {
      console.log('准备在以下地块创建地形:', gridId);
      const data = this.saveData;
      this.currentRegionPanel = new CreateRegion(this, gridId, data);
    });

    this.events.on('build_region', (result) => {
      console.log('建造特区信息：', result);
      // 以下内容后续打包进actionSystem.js
      if (!this.saveData.actionList) this.saveData.actionList = {};
      this.saveData.actionList.civil['build_region_' + result.gridId] = result;
      saveSystem.save();
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
  closeGridPanel() {
    if (this.currentGridPanel) {
      this.currentGridPanel.destroy();
      this.currentGridPanel = null;
    }
  }
}