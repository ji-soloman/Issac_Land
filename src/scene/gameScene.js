import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';

import { MapView } from '../view/mapView.js';
import { BottomBar } from '../scene/bottomBar.js';
import { saveSystem } from '../system/saveSystem.js';
import { MAPS } from '../data/map.js';
import { InfoSystem } from '../view/system/infoView.js';


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
  }

  create() {
    this.saveData = saveSystem.currentSaveData;

    this.initWorld();
    this.createMap();
    this.createBottomBar();
    this.bindEvents();

    this.currentSystem = null;
  }

  initWorld() {
    // 确保 map 存在
    if (!this.saveData.map) {
      this.saveData.map = {};
    }

    // 检查是否需要初始化格子（不存在或为空）
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
          area: i === 1 ? ['main'] : [],  // g1 包含 'main'
          terrain: [],
          building: [],
          product: []
        };
      }

      console.log('地图格子初始化完成:', this.saveData.map.grids);

      // 立即保存，不标记为脏
      saveSystem.save().then(() => {
        console.log('初始化数据已保存');
      });
    }
  }

  createMap() {
    // 获取当前地图类型的配置
    const mapType = this.saveData.map_type;
    const mapConfig = MAPS[mapType];

    // 三个参数：scene, mapConfig (从 MAPS), saveData.map
    this.mapView = new MapView(this, mapConfig, this.saveData.map);
  }

  createBottomBar() {
    this.bottomBar = new BottomBar(this);
  }

  bindEvents() {
    // 地图格子点击事件
    this.mapView.onGridClick = (gridId) => {
      console.log('clicked grid:', gridId);
      const gridData = this.saveData.map.grids[gridId];
      console.log('grid data:', gridData);

      // TODO: 处理格子点击逻辑
    };

    // 底部栏按钮事件
    this.bottomBar.onPersonalClick = () => {
      this.openSystem('personal');
    };

    this.bottomBar.onPackageClick = () => {
      this.openSystem('package');
    };
  }

  /**
   * 打开系统面板
   * @param {string} systemType - 系统类型：'personal' 或 'package'
   */
  openSystem(systemType) {
    console.log('打开系统:', systemType);

    // 如果已有打开的系统，先关闭
    if (this.currentSystem) {
      this.closeCurrentSystem();
    }

    // 根据类型创建对应的系统
    switch (systemType) {
      case 'personal':
        // TODO: 创建个人信息面板
        this.currentSystem = new InfoSystem(this, this.saveData);
        console.log('TODO: 创建个人信息面板');
        break;

      case 'package':
        // TODO: 创建背包面板
        // this.currentSystem = new PackageSystem(this, this.saveData);
        console.log('TODO: 创建背包面板');
        break;

      default:
        console.warn('未知的系统类型:', systemType);
    }
  }

  /**
   * 关闭当前打开的系统
   */
  closeCurrentSystem() {
    if (this.currentSystem && this.currentSystem.destroy) {
      this.currentSystem.destroy();
      this.currentSystem = null;
    }
  }
}