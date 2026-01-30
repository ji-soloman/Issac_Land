import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';

import { MapView } from '../view/mapView.js';
import { saveSystem } from '../system/saveSystem.js';
import { MAPS } from '../data/map.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  preload() {
    // 加载地图背景
    const mapType = saveSystem.currentSaveData.map_type;
    const mapConfig = MAPS[mapType];
    this.load.image('map_bg', mapConfig.image);
  }

  create() {
    this.saveData = saveSystem.currentSaveData;

    this.initWorld();
    this.createMap();
    this.bindEvents();
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

  bindEvents() {
    this.mapView.onGridClick = (gridId) => {
      console.log('clicked grid:', gridId);
      const gridData = this.saveData.map.grids[gridId];
      console.log('grid data:', gridData);

      // TODO: 处理格子点击逻辑
    };
  }
}