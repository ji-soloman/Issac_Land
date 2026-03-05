// src/view/system/GridPanel.js
import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import { get } from '../../system/i18n.js';
import { terrain } from '../../data/terrain.js';
import { REGION } from '../../data/region.js';
import { MAPS } from '../../data/map.js';

export class GridPanel {
  constructor(scene, gridId, data) {
    this.scene = scene;
    this.gridId = gridId;
    this.gridData = data.map.grids[gridId];
    this.data = data;
    this.isAnimating = false;
    this.terrainInfo = MAPS[data.map_type].grids[gridId];

    this.create();
  }

  create() {
    const { width, height } = this.scene.scale;

    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(1000);

    // ====== 梯形参数 ======
    const topWidth = width * 0.4;
    const bottomWidth = width * 0.6;
    const panelHeight = height;
    const rightX = width;

    // ====== 地形背景图片 ======
    const terrainType = this.terrainInfo.type || 'land'; // 默认平原
    const terrainConfig = terrain[terrainType];
    const terrainImageKey = `terrain_${terrainType}`;

    // 创建地形背景
    const terrainBg = this.scene.add.image(rightX - bottomWidth / 2, panelHeight / 2, terrainImageKey);
    terrainBg.setOrigin(0.5);

    const coverScale = Math.max(
      bottomWidth / terrainBg.width,
      panelHeight / terrainBg.height
    );
    terrainBg.setScale(coverScale);
    terrainBg.setPosition(rightX - bottomWidth / 2, panelHeight / 2);

    this.container.add(terrainBg);

    // ====== 白色半透明背景矩形 ======
    const bg = this.scene.add.rectangle(rightX - bottomWidth, 0, bottomWidth, panelHeight, 0xffffff, 0.8);
    bg.setOrigin(0, 0);
    this.container.add(bg);

    // ====== 梯形遮罩  ======
    const shape = this.scene.make.graphics();
    shape.fillStyle(0xffffff);
    shape.beginPath();
    shape.moveTo(rightX - topWidth, 0);
    shape.lineTo(rightX, 0);
    shape.lineTo(rightX, panelHeight);
    shape.lineTo(rightX - bottomWidth, panelHeight);
    shape.closePath();
    shape.fillPath();

    const mask = shape.createGeometryMask();
    terrainBg.setMask(mask);
    bg.setMask(mask);

    // ====== 标题 ======
    const titleX = rightX - topWidth / 2;
    const titleY = 20;
    const titleText = this.scene.add.text(titleX, titleY, this.getGridName(this.gridId, this.data), {
      fontSize: '28px',
      color: '#000000',
      fontStyle: 'bold',
      padding: { top: 10 },
    }).setOrigin(0.5, 0);
    this.container.add(titleText);

    // ====== 地形类型显示 ======
    // const terrainTypeY = 55; // 标题下方
    // const terrainTypeName = terrainConfig.name || '未知地形';
    // const terrainTypeText = this.scene.add.text(titleX, terrainTypeY, terrainTypeName, {
    //   fontSize: '20px',
    //   color: '#666666',
    //   padding: { top: 5 },
    // }).setOrigin(0.5, 0);
    // this.container.add(terrainTypeText);

    // ====== 内容区域 ======
    const contentStartY = 90; // 调整起始位置，为地形类型预留空间
    const lineHeight = 35;
    let currentY = contentStartY;

    const fields = [
      { key: 'terrain', value: this.gridData.terrain },
      { key: 'region', value: this.gridData },
      { key: 'building', value: this.gridData.buildings || [] },
      { key: 'product', value: this.gridData.products || [] }
    ];

    fields.forEach(field => {
      // --- 布局计算保持不变 ---
      const progress = currentY / panelHeight;
      const currentWidth = topWidth + (bottomWidth - topWidth) * progress;
      const leftX = rightX - currentWidth + 20;
      const maxTextWidth = currentWidth - 40;

      // --- 渲染标签 ---
      const label = get.translation(field.key);
      const labelText = this.scene.add.text(leftX, currentY, `${label}:`, {
        fontSize: '20px',
        color: '#333333',
        fontStyle: 'bold',
        padding: { top: 10 },
      }).setOrigin(0, 0.5);
      this.container.add(labelText);

      let valueStr = '';

      if (field.key === 'terrain') {
        // 地形
        if (field.value && terrain[field.value]) {
          valueStr = terrain[field.value].name;
        } else {
          valueStr = get.translation('none');
        }
      }
      else if (field.key === 'region') {
        // 特区
        const gridInfo = field.value;
        if (gridInfo.region) {
          valueStr = REGION[gridInfo.region].name;
        }
        else if (gridInfo.createRegion) {
          valueStr = REGION[gridInfo.createRegion.targetRegion].name + "（剩余" + gridInfo.createRegion.num + '回合）';
        } else {
          valueStr = get.translation('none');
        }
      }
      else if (Array.isArray(field.value)) {
        // TODO：建筑和物产
        if (field.value.length > 0) {
          valueStr = field.value.map(v => get.translation(v)).join(', ');
        } else {
          valueStr = get.translation('none');
        }
      }
      else {
        // 其他
        valueStr = field.value ? field.value : get.translation('none');
      }

      // --- 渲染数值 ---
      const valueText = this.scene.add.text(leftX + 120, currentY, valueStr, {
        fontSize: '18px',
        color: '#000000',
        wordWrap: { width: maxTextWidth - 120 },
        padding: { top: 10 },
      }).setOrigin(0, 0.5);
      this.container.add(valueText);

      currentY += lineHeight;
    });

    // ====== 关闭按钮 ======
    const closeBtnX = rightX - 20;
    const closeBtnY = 20;

    const closeBg = this.scene.add.circle(closeBtnX, closeBtnY, 20, 0xff0000, 0.8);
    closeBg.setInteractive({ useHandCursor: true });
    const closeText = this.scene.add.text(closeBtnX, closeBtnY, '×', {
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: 'bold',
      padding: { top: 10 },
    }).setOrigin(0.5);

    this.container.add([closeBg, closeText]);

    closeBg.on('pointerover', () => {
      closeBg.setFillStyle(0xff3333, 1);
      this.scene.input.setDefaultCursor('pointer');
    });
    closeBg.on('pointerout', () => {
      closeBg.setFillStyle(0xff0000, 0.8);
      this.scene.input.setDefaultCursor('default');
    });
    closeBg.on('pointerdown', () => {
      if (this.isAnimating) return;
      this.close();
    });

    // ====== 按钮布局配置 ======
    const btnWidth = 140;
    const btnHeight = 45;
    const btnGap = 10; // 两按钮之间的间距
    const centerX = rightX - bottomWidth / 2;

    // 两排的Y坐标
    const row1Y = panelHeight - 120; // 第一排
    const row2Y = panelHeight - 65;  // 第二排

    // 两列的X坐标（以中心为基准，向左右各偏移）
    const col1X = centerX - btnWidth / 2 - btnGap / 2;
    const col2X = centerX + btnWidth / 2 + btnGap / 2;

    // ====== 创建地区按钮（第一排左） ======
    const regionBg = this.scene.add.rectangle(col1X, row1Y, btnWidth, btnHeight, 0x4caf50, 1);
    regionBg.setInteractive({ useHandCursor: true });
    regionBg.setStrokeStyle(2, 0xffffff);

    const regionText = this.scene.add.text(col1X, row1Y, '创建地区', {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold',
      padding: { top: 4 },
      shadow: { offsetX: 1, offsetY: 1, color: '#000', fill: true }
    }).setOrigin(0.5);

    this.container.add([regionBg, regionText]);

    regionBg.on('pointerover', () => regionBg.setFillStyle(0x388e3c, 1));
    regionBg.on('pointerout', () => regionBg.setFillStyle(0x4caf50, 1));
    regionBg.on('pointerdown', () => {
      if (this.isAnimating) return;
      this.scene.tweens.add({
        targets: [regionBg, regionText],
        scaleX: 0.95,
        scaleY: 0.95,
        duration: 50,
        yoyo: true,
        onComplete: () => {
          this.scene.events.emit('create_region_btn', this.gridId);
        }
      });
    });

    // ====== 升级地区按钮（第一排右） ======
    const upgradeBg = this.scene.add.rectangle(col2X, row1Y, btnWidth, btnHeight, 0x2196f3, 1);
    upgradeBg.setInteractive({ useHandCursor: true });
    upgradeBg.setStrokeStyle(2, 0xffffff);

    const upgradeText = this.scene.add.text(col2X, row1Y, '升级地区', {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold',
      padding: { top: 4 },
      shadow: { offsetX: 1, offsetY: 1, color: '#000', fill: true }
    }).setOrigin(0.5);

    this.container.add([upgradeBg, upgradeText]);

    upgradeBg.on('pointerover', () => upgradeBg.setFillStyle(0x1565c0, 1));
    upgradeBg.on('pointerout', () => upgradeBg.setFillStyle(0x2196f3, 1));
    upgradeBg.on('pointerdown', () => {
      if (this.isAnimating) return;
      this.scene.tweens.add({
        targets: [upgradeBg, upgradeText],
        scaleX: 0.95,
        scaleY: 0.95,
        duration: 50,
        yoyo: true,
        onComplete: () => {
          this.scene.events.emit('upgrade_region_btn', this.gridId);
        }
      });
    });

    // ====== 创建建筑按钮（第二排左） ======
    const buildingBg = this.scene.add.rectangle(col1X, row2Y, btnWidth, btnHeight, 0x9c27b0, 1);
    buildingBg.setInteractive({ useHandCursor: true });
    buildingBg.setStrokeStyle(2, 0xffffff);

    const buildingText = this.scene.add.text(col1X, row2Y, '创建建筑', {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold',
      padding: { top: 4 },
      shadow: { offsetX: 1, offsetY: 1, color: '#000', fill: true }
    }).setOrigin(0.5);

    this.container.add([buildingBg, buildingText]);

    buildingBg.on('pointerover', () => buildingBg.setFillStyle(0x6a1b9a, 1));
    buildingBg.on('pointerout', () => buildingBg.setFillStyle(0x9c27b0, 1));
    buildingBg.on('pointerdown', () => {
      if (this.isAnimating) return;
      this.scene.tweens.add({
        targets: [buildingBg, buildingText],
        scaleX: 0.95,
        scaleY: 0.95,
        duration: 50,
        yoyo: true,
        onComplete: () => {
          this.scene.events.emit('create_building_btn', this.gridId);
        }
      });
    });

    // ====== 创建奇迹按钮（第二排右） ======
    const miracleBg = this.scene.add.rectangle(col2X, row2Y, btnWidth, btnHeight, 0xffa500, 1);
    miracleBg.setInteractive({ useHandCursor: true });
    miracleBg.setStrokeStyle(2, 0xffffff);

    const miracleText = this.scene.add.text(col2X, row2Y, '创建奇迹', {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold',
      padding: { top: 4 },
      shadow: { offsetX: 1, offsetY: 1, color: '#000', fill: true }
    }).setOrigin(0.5);

    this.container.add([miracleBg, miracleText]);

    miracleBg.on('pointerover', () => miracleBg.setFillStyle(0xff8c00, 1));
    miracleBg.on('pointerout', () => miracleBg.setFillStyle(0xffa500, 1));
    miracleBg.on('pointerdown', () => {
      if (this.isAnimating) return;
      this.scene.tweens.add({
        targets: [miracleBg, miracleText],
        scaleX: 0.95,
        scaleY: 0.95,
        duration: 50,
        yoyo: true,
        onComplete: () => {
          this.scene.events.emit('create_wonder_btn', this.gridId);
        }
      });
    });

    // ====== 进入动画 ======
    this.playEnterAnimation(bottomWidth);
  }

  playEnterAnimation(bottomWidth) {
    this.container.x = bottomWidth;
    this.isAnimating = true;

    this.scene.tweens.add({
      targets: this.container,
      x: 0,
      duration: 500,
      ease: 'Power2',
      onComplete: () => {
        this.isAnimating = false;
      }
    });
  }

  playExitAnimation(onComplete) {
    const { width } = this.scene.scale;
    const bottomWidth = width * 0.6;

    this.isAnimating = true;

    this.scene.tweens.add({
      targets: this.container,
      x: bottomWidth,
      duration: 500,
      ease: 'Power2',
      onComplete: () => {
        this.isAnimating = false;
        if (onComplete) {
          onComplete();
        }
      }
    });
  }

  close() {
    this.playExitAnimation(() => {
      if (this.scene.closeGridPanel) {
        this.scene.closeGridPanel();
      }
    });
  }

  getGridName(gridId, data) {
    if (gridId === 'g1') {
      return data.capital;
    }

    const num = parseInt(gridId.replace('g', ''));
    const areaNum = num - 1;

    return `${areaNum}区`;
  }

  destroy() {
    if (this.container) {
      this.container.destroy();
      this.container = null;
    }
  }
}