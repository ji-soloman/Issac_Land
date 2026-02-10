import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';

import { MapView } from '../view/mapView.js';
import { BottomBar } from '../scene/bottomBar.js';
import { saveSystem } from '../system/saveSystem.js';
import { MAPS } from '../data/map.js';
import { InfoSystem } from '../view/system/infoView.js';
import { GridPanel } from '../view/system/gridPanel.js';
import { terrain } from '../data/terrain.js';
import { LeftSideBar } from '../scene/leftSideBar.js';
import { TECH_TREE } from '../data/tech_tree.js';
import { TechTreeSystem } from '../view/system/techTree.js';

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
    this.load.image('tech_tree_btn', 'assets/ui_button/tech_tree.png');
    this.load.image('common_btn', 'assets/ui/common_btn.png');
    this.load.image('common_btn_green', 'assets/ui/common_btn_green.png');
    this.load.image('common_btn_blue', 'assets/ui/common_btn_blue.png');

    // 加载科技图标
    this.load.image('tech_icon_default', 'assets/tech_tree/icon/default.png');

    Object.entries(TECH_TREE).forEach(([techId, tech]) => {
      if (tech.icon) {
        this.load.image(`tech_icon_${techId}`, tech.icon);
      }
    });
  }

  create() {
    this.saveData = saveSystem.currentSaveData;

    this.initWorld();
    this.createMap();
    this.createBottomBar();
    this.createLeftSideBar();
    this.bindEvents();

    this.currentSystem = null;
    this.systemOpen = false;
    this.overlay = null;
    this.overlayWheelHandler = null;
    this.currentGridPanel = null;
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

      // 初始化 g1 到 g9
      for (let i = 1; i <= 9; i++) {
        const gridId = `g${i}`;

        this.saveData.map.grids[gridId] = {
          locked: true,
          region: i === 1 ? 'main' : null,
          terrain: null,
          buildings: [],
          products: []
        };
      }

      console.log('地图格子初始化完成:', this.saveData.map.grids);

      // 立即保存
      saveSystem.save().then(() => {
        console.log('初始化数据已保存');
      });
    }
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
    this.leftSideBar.onTechTreeClick = () => {
      // 如果有打开的格子面板，先关闭
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