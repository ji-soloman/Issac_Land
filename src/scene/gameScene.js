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
    // 确保 map.grids 存在
    if (!this.saveData.map) {
      this.saveData.map = {};
    }
    
    if (!this.saveData.map.grids) {
      // 从 MAPS 数据中初始化格子
      const mapType = this.saveData.map_type;
      const mapTemplate = MAPS[mapType];
      
      this.saveData.map.grids = {};
      
      // 复制模板格子并添加额外字段
      Object.entries(mapTemplate.grids).forEach(([gridId, gridData]) => {
        this.saveData.map.grids[gridId] = {
          ...gridData,
          locked: true,  // 初始锁定
          owner: null,   // 所有者
          building: null // 建筑
        };
      });
      
      // 标记存档已修改
      saveSystem.isDirty = true;
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