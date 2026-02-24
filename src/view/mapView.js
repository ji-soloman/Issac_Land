import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import { WONDER } from '../data/wonder.js';

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
    // this.mapBg.setDisplaySize(this.MAP_WIDTH, this.MAP_HEIGHT);
    this.mapBg.setPipeline('TextureTintPipeline');
    this.mapBg.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
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
    const { coord, region = null, locked = false, wonder } = gridData || {};
    const x = coord[0] * this.MAP_WIDTH;
    const y = coord[1] * this.MAP_HEIGHT;

    // 创建一个独立的单元容器，用来承载当前格子的所有组件
    const cellContainer = this.scene.add.container(x, y);
    this.gridsContainer.add(cellContainer);

    // 绘制基础六边形
    const graphics = this.scene.add.graphics();
    const hexPoints = this.getHexagonPoints(this.HEX_RADIUS);

    const isMain = region === 'main';
    const isUnlocked = locked;
    let fillColor = isMain ? 0xff0000 : (isUnlocked ? 0x90EE90 : 0x808080);
    let fillAlpha = isMain ? 0.8 : (isUnlocked ? 0.6 : 0.5);
    let strokeColor = (isMain || isUnlocked) ? 0xffff00 : 0x606060;
    let strokeWidth = (isMain || isUnlocked) ? 3 : 2;

    const drawBase = (isHover = false) => {
      graphics.clear();
      graphics.fillStyle(fillColor, isHover ? 0.9 : fillAlpha);
      graphics.fillPoints(hexPoints, true);
      graphics.lineStyle(isHover ? 4 : strokeWidth, isHover ? 0xffffff : strokeColor, 1);
      graphics.strokePoints(hexPoints, true);

      // 如果处于高光状态且有奇观，绘制一个包含图片范围的组合框
      if (isHover && wonderImage) {
        const bounds = wonderImage.getBounds();
        // 转换全局坐标为容器本地坐标
        const localX = bounds.x - cellContainer.x;
        const localY = bounds.y - cellContainer.y;
        graphics.lineStyle(2, 0xffffff, 0.8);
        graphics.strokeRect(localX, localY, bounds.width, bounds.height);
      }
    };

    cellContainer.add(graphics);

    // 处理奇观图片
    let wonderImage = null;
    if (wonder && WONDER[wonder] && WONDER[wonder].image) {
      const imageKey = 'wonder_' + wonder;
      wonderImage = this.scene.add.image(0, 0, imageKey); // 相对容器 0,0

      const targetDisplayWidth = this.HEX_RADIUS * 2;
      let scaleFactor = Math.min(1, targetDisplayWidth / wonderImage.width);
      wonderImage.setScale(scaleFactor);
      wonderImage.setOrigin(0.5, 1.0);

      // 调整位置使其站立在六边形底部
      const verticalOffset = (this.HEX_APOTHEM * this.TILT_FACTOR) * 1.2;
      wonderImage.y = verticalOffset;

      cellContainer.add(wonderImage);
      wonderImage.setInteractive({
        pixelPerfect: true,
        alphaTolerance: 1,
        useHandCursor: true
      });;
    }

    drawBase(false);

    if (isMain || isUnlocked) {
      const hitArea = new Phaser.Geom.Polygon(hexPoints);
      graphics.setInteractive(hitArea, Phaser.Geom.Polygon.Contains);

      // 如果有图片，让图片也能触发 graphics 的 hover
      if (wonderImage) {
        wonderImage.setInteractive();
      }

      const onOver = () => {
        drawBase(true);
        if (wonderImage) {
          //wonderImage.setTint(0xffffff);
          wonderImage.setAlpha(0.85);
        }
        this.scene.input.setDefaultCursor('pointer');
      };

      const onOut = () => {
        drawBase(false);
        if (wonderImage) {
          //wonderImage.clearTint();
          wonderImage.setAlpha(1.0);
        }
        this.scene.input.setDefaultCursor('default');
      };

      const onClick = () => {
        if (!this.isDragging && this.onGridClick) {
          this.onGridClick(gridId);
        }
      };

      // 绑定事件
      [graphics, wonderImage].forEach(obj => {
        if (!obj) return;
        obj.on('pointerover', onOver);
        obj.on('pointerout', onOut);
        obj.on('pointerdown', onClick);
      });
    }
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