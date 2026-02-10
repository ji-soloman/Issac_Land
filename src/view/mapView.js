import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';

export class MapView {
  constructor(scene, mapConfig, saveData) {
    this.scene = scene;
    this.mapConfig = mapConfig; // MAPS 中的配置
    this.saveData = saveData; // 存档中的地图数据

    // --- 地图尺寸配置 ---
    this.MAP_WIDTH = 3280;
    this.MAP_HEIGHT = 3280 * 3 / 4; // 2460px

    // --- 六边形尺寸配置 ---
    // 原始中心到边的距离
    this.HEX_APOTHEM = 60;
    // 原始外接圆半径
    this.HEX_RADIUS = this.HEX_APOTHEM / 0.866025;

    // --- 3D 倾斜配置 ---
    // 决定倾斜程度，数值越小，看起来倾斜角度越大。
    this.TILT_FACTOR = 0.65;

    // --- 缩放配置 ---
    this.minZoom = 0.5;
    this.maxZoom = 4.0;
    this.currentZoom = 1.0;
    this.zoomStep = 0.1;

    // --- 拖拽状态 ---
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;

    // --- 回调 ---
    this.onGridClick = null;
    this.interactionEnabled = true;

    this.create();
  }

  create() {
    // 1. 创建地图容器
    this.container = this.scene.add.container(0, 0);

    // 2. 加载地图背景
    this.mapBg = this.scene.add.image(0, 0, 'map_bg').setOrigin(0);
    this.mapBg.setDisplaySize(this.MAP_WIDTH, this.MAP_HEIGHT);
    this.container.add(this.mapBg);

    // 3. 创建格子容器
    this.gridsContainer = this.scene.add.container(0, 0);
    this.container.add(this.gridsContainer);

    // 4. 绘制格子
    this.gridObjects = {};
    this.drawGrids();

    // 5. 初始居中
    this.centerMap();

    // 6. 绑定事件
    this.setupInteraction();
  }

  drawGrids() {
    const grids = this.mapConfig.grids || {};
    // console.log('开始绘制，格子数据:', grids);

    Object.entries(grids).forEach(([gridId, gridTemplate]) => {
      if (gridTemplate.coord) {
        const saveGridData = this.saveData.grids?.[gridId] || {};
        const gridData = {
          ...gridTemplate,
          ...saveGridData
        };
        const hex = this.createHexagon(gridId, gridData);
        this.gridObjects[gridId] = hex;
      }
    });
  }

  createHexagon(gridId, gridData) {
    const { coord, type, region = null, locked = false } = gridData || {};

    const x = coord[0] * this.MAP_WIDTH;
    const y = coord[1] * this.MAP_HEIGHT;

    const graphics = this.scene.add.graphics();
    const hexPoints = this.getHexagonPoints(this.HEX_RADIUS);

    // 判断格子状态
    const isMain = region === 'main';
    const isUnlocked = locked; // 鉴定为将错就错，locked为true才是解锁了hhh

    // 配置颜色和样式
    let fillColor, fillAlpha, strokeColor, strokeAlpha, strokeWidth, interactive;

    if (isMain) {
      // 主城格子：红色
      fillColor = 0xff0000;
      fillAlpha = 0.8;
      strokeColor = 0xffff00;
      strokeAlpha = 0.8;
      strokeWidth = 3;
      interactive = true;
    } else if (isUnlocked) {
      // 已解锁格子：根据地形类型
      fillColor = 0x90EE90;
      fillAlpha = 0.6;
      strokeColor = 0xffff00;
      strokeAlpha = 0.8;
      strokeWidth = 3;
      interactive = true;
    } else {
      // 未解锁格子：灰色、无交互
      fillColor = 0x808080;
      fillAlpha = 0.5;
      strokeColor = 0x606060;
      strokeAlpha = 0.5;
      strokeWidth = 2;
      interactive = false;
    }

    // 绘制填充和边框
    graphics.fillStyle(fillColor, fillAlpha);
    graphics.fillPoints(hexPoints, true);
    graphics.lineStyle(strokeWidth, strokeColor, strokeAlpha);
    graphics.strokePoints(hexPoints, true);

    // 设置交互
    if (interactive) {
      const hitArea = new Phaser.Geom.Polygon(hexPoints);
      graphics.setInteractive(hitArea, Phaser.Geom.Polygon.Contains);

      // 悬停高亮
      graphics.on('pointerover', () => {
        graphics.clear();
        graphics.fillStyle(fillColor, 0.9);
        graphics.fillPoints(hexPoints, true);
        graphics.lineStyle(4, 0xffffff, 1);
        graphics.strokePoints(hexPoints, true);
        this.scene.input.setDefaultCursor('pointer');
      });

      // 恢复原样
      graphics.on('pointerout', () => {
        graphics.clear();
        graphics.fillStyle(fillColor, fillAlpha);
        graphics.fillPoints(hexPoints, true);
        graphics.lineStyle(strokeWidth, strokeColor, strokeAlpha);
        graphics.strokePoints(hexPoints, true);
        this.scene.input.setDefaultCursor('default');
      });

      // 点击事件
      graphics.on('pointerdown', () => {
        if (!this.isDragging && this.onGridClick) {
          this.onGridClick(gridId);
        }
      });
    }

    // 设置位置
    graphics.x = x;
    graphics.y = y;

    this.gridsContainer.add(graphics);
    return graphics;
  }

  // --- 计算带有立体倾斜效果的六边形顶点 ---
  getHexagonPoints(radius) {
    const points = [];
    for (let i = 0; i < 6; i++) {
      // 1. 使用标准的尖顶角度: -30, 30, 90...
      const angleDeg = 60 * i - 30;
      const angleRad = Phaser.Math.DegToRad(angleDeg);

      // 2. 计算原始坐标
      let px = radius * Math.cos(angleRad);
      let py = radius * Math.sin(angleRad);

      // --- 应用 3D 倾斜 ---
      // 通过乘以 tiltFactor 压扁 Y 轴，创造向后倒的透视感。
      py = py * this.TILT_FACTOR;

      points.push({ x: px, y: py });
    }
    return points;
  }

  setupInteraction() {
    // 滚轮缩放
    this.scene.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
      if (!this.interactionEnabled) return;
      const oldZoom = this.currentZoom;
      if (deltaY < 0) this.currentZoom += this.zoomStep;
      else this.currentZoom -= this.zoomStep;

      this.currentZoom = Phaser.Math.Clamp(this.currentZoom, this.minZoom, this.maxZoom);

      if (oldZoom !== this.currentZoom) {
        const worldX = (pointer.x - this.container.x) / oldZoom;
        const worldY = (pointer.y - this.container.y) / oldZoom;

        this.container.setScale(this.currentZoom);

        this.container.x = pointer.x - worldX * this.currentZoom;
        this.container.y = pointer.y - worldY * this.currentZoom;

        this.constrainMapPosition();
      }
    });

    // 拖拽逻辑
    this.scene.input.on('pointerdown', (pointer) => {
      if (!this.interactionEnabled) return;
      if (pointer.leftButtonDown()) {
        this.isDragging = false;
        this.dragStartX = pointer.x;
        this.dragStartY = pointer.y;
        this.containerStartX = this.container.x;
        this.containerStartY = this.container.y;
      }
    });

    this.scene.input.on('pointermove', (pointer) => {
      if (!this.interactionEnabled) return;
      if (pointer.leftButtonDown()) {
        const dx = pointer.x - this.dragStartX;
        const dy = pointer.y - this.dragStartY;

        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          this.isDragging = true;
          this.container.x = this.containerStartX + dx;
          this.container.y = this.containerStartY + dy;
          this.constrainMapPosition();
        }
      }
    });
  }

  centerMap() {
    const { width, height } = this.scene.scale;
    this.container.x = (width - this.MAP_WIDTH * this.currentZoom) / 2;
    this.container.y = (height - this.MAP_HEIGHT * this.currentZoom) / 2;
    this.container.setScale(this.currentZoom);
  }

  constrainMapPosition() {
    const { width, height } = this.scene.scale;
    const mapW = this.MAP_WIDTH * this.currentZoom;
    const mapH = this.MAP_HEIGHT * this.currentZoom;

    const minX = width - mapW;
    const maxX = 0;
    const minY = height - mapH;
    const maxY = 0;

    if (mapW < width) this.container.x = (width - mapW) / 2;
    else this.container.x = Phaser.Math.Clamp(this.container.x, minX, maxX);

    if (mapH < height) this.container.y = (height - mapH) / 2;
    else this.container.y = Phaser.Math.Clamp(this.container.y, minY, maxY);
  }

  enableInteraction() {
    this.interactionEnabled = true;
  }

  // 禁用地图交互
  disableInteraction() {
    this.interactionEnabled = false;
    this.isDragging = false; // 重置拖拽状态
  }
}