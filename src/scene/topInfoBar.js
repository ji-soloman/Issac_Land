import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import { get } from '../system/i18n.js';
import { ERA } from '../data/era.js';

export class TopInfoBar {
  constructor(scene) {
    this.scene = scene;
    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(1000);
    this.container.setScrollFactor(0);

    this.resources = ['wealth', 'culture', 'food', 'mine', 'magic', 'population'];
    this.resourceTexts = {};

    this.initTooltip();
    this.initUI();
    this.refresh();
  }

  // 初始化悬浮窗
  initTooltip() {
    this.tooltip = this.scene.add.container(0, 0);
    this.tooltip.setDepth(1001);
    this.tooltip.setScrollFactor(0);
    this.tooltip.setVisible(false);

    // 悬浮窗背景
    this.tooltipBg = this.scene.add.rectangle(0, 0, 180, 60, 0x222222, 0.9).setOrigin(0, 0.5);
    this.tooltipBg.setStrokeStyle(2, 0x555555);

    // 左侧图标
    this.tooltipIcon = this.scene.add.image(30, 0, 'icon_culture');

    // 右上方名字
    this.tooltipTitle = this.scene.add.text(60, -18, '名称', {
      fontSize: '16px', color: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold'
    }).setOrigin(0, 0);

    // 右下方实际数量
    this.tooltipValue = this.scene.add.text(60, 4, '当前数量：0', {
      fontSize: '14px', color: '#aaaaaa', fontFamily: 'Arial'
    }).setOrigin(0, 0);

    this.tooltip.add([this.tooltipBg, this.tooltipIcon, this.tooltipTitle, this.tooltipValue]);
  }

  initUI() {
    const startY = 20;
    const startX = 25;   // 第一个图标的中心点 X 坐标
    const spacing = 110; // 每个资源板块占用的总宽度

    // 获取屏幕宽度
    const screenWidth = this.scene.scale.width;

    // 半透明黑色背景条
    const bg = this.scene.add.rectangle(
      0,
      startY,
      screenWidth,
      40,
      0x000000,
      0.5
    ).setOrigin(0, 0.5);
    this.container.add(bg);

    // ================== 左侧资源 ==================
    this.resources.forEach((res, index) => {
      const currentX = startX + (index * spacing);

      // 添加图标
      const icon = this.scene.add.image(currentX, startY, `icon_${res}`);
      icon.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      const maxDim = Math.max(icon.width, icon.height) || 1;
      icon.setScale(26 / maxDim);

      // 给图标绑定交互事件
      icon.setInteractive({ useHandCursor: true });
      icon.on('pointerover', (pointer) => this.showTooltip(res, pointer));
      icon.on('pointermove', (pointer) => this.moveTooltip(pointer));
      icon.on('pointerout', () => this.hideTooltip());

      this.container.add(icon);

      // 添加文本
      const textCenterX = currentX + (spacing / 2) - 5;

      const text = this.scene.add.text(textCenterX, startY, '0', {
        fontSize: '18px',
        color: '#ffffff',
        fontFamily: 'Arial',
        fontStyle: 'bold'
      }).setOrigin(0.5, 0.5);

      this.container.add(text);
      this.resourceTexts[res] = text;
    });

    // ================== 右侧 ==================

    // 时代文本
    this.eraText = this.scene.add.text(0, startY, '', {
      fontSize: '18px',
      color: '#ffd700',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(1, 0.5);

    // 轮次数值
    this.turnValueText = this.scene.add.text(0, startY, '1', {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      fixedWidth: 45,
      align: 'center'
    }).setOrigin(0.5, 0.5);

    // 回合标签文本
    this.turnLabelText = this.scene.add.text(0, startY, '回合', {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(1, 0.5);

    this.container.add([this.eraText, this.turnValueText, this.turnLabelText]);
  }

  formatDisplayValue(val) {
    return val > 999 ? '999+' : val.toString();
  }

  getResourceValue(key) {
    if (!this.scene.saveData || !this.scene.saveData.resource) {
      return 0;
    }
    return this.scene.saveData.resource[key] || 0;
  }

  getProcessData() {
    if (!this.scene.saveData || !this.scene.saveData.process) {
      return { era: 'primitive', turn: 1 };
    }
    return this.scene.saveData.process;
  }

  refresh() {
    // 刷新左侧资源数值
    this.resources.forEach(res => {
      if (this.resourceTexts[res]) {
        const actualValue = this.getResourceValue(res);
        this.resourceTexts[res].setText(this.formatDisplayValue(actualValue));

        if (this.tooltip.visible && this.currentHoverRes === res) {
          this.updateTooltipContent(res, actualValue);
        }
      }
    });

    // 刷新右侧时代和回合
    const processData = this.getProcessData();
    const currentEraStr = ERA[processData.era].name;
    const currentTurn = processData.turn || 1;

    // 设置文字
    this.eraText.setText(currentEraStr);
    this.turnValueText.setText(currentTurn.toString());

    const screenWidth = this.scene.scale.width;

    // 时代文本贴住右侧留白
    this.eraText.setX(screenWidth - 20);

    // 时代文本的左边缘坐标
    const eraLeftEdge = this.eraText.x - this.eraText.width;

    // 回合
    const turnValueCenter = eraLeftEdge - 15 - (45 / 2);
    this.turnValueText.setX(turnValueCenter);

    const turnLabelRightEdge = turnValueCenter - (45 / 2) - 5;
    this.turnLabelText.setX(turnLabelRightEdge);
  }

  updateTooltipContent(resKey, actualValue) {
    this.tooltipIcon.setTexture(`icon_${resKey}`);
    const maxDim = Math.max(this.tooltipIcon.width, this.tooltipIcon.height) || 1;
    this.tooltipIcon.setScale(32 / maxDim);

    this.tooltipTitle.setText(get.translation(resKey));
    this.tooltipValue.setText(`当前数量：${actualValue}`);

    // 动态计算悬浮窗宽度
    const maxTextWidth = Math.max(this.tooltipTitle.width, this.tooltipValue.width);
    const calculatedWidth = 60 + maxTextWidth + 20;
    const finalWidth = Math.max(180, calculatedWidth);

    // 让边框跟随新长度
    this.tooltipBg.width = finalWidth;
    if (this.tooltipBg.geom) {
      this.tooltipBg.geom.width = finalWidth;
      this.tooltipBg.updateData();
    }
  }

  showTooltip(resKey, pointer) {
    this.currentHoverRes = resKey;
    const actualValue = this.getResourceValue(resKey);

    this.updateTooltipContent(resKey, actualValue);

    this.tooltip.setVisible(true);
    this.moveTooltip(pointer);
  }

  moveTooltip(pointer) {
    this.tooltip.setPosition(pointer.x + 20, pointer.y + 20);
  }

  hideTooltip() {
    this.currentHoverRes = null;
    this.tooltip.setVisible(false);
  }

  destroy() {
    this.container.destroy();
    this.tooltip.destroy();
  }
}