// src/view/system/GridPanel.js
import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import { get } from '../../system/i18n.js';

export class GridPanel {
  constructor(scene, gridId, gridData) {
    this.scene = scene;
    this.gridId = gridId;
    this.gridData = gridData;
    this.isAnimating = false; // 动画进行中标志

    this.create();
  }

  create() {
    const { width, height } = this.scene.scale;

    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(1000);

    // ====== 梯形参数 ======
    const topWidth = width * 0.4;     // 上宽
    const bottomWidth = width * 0.6;  // 下宽
    const panelHeight = height;
    const rightX = width;             // 屏幕右侧对齐

    // ====== 背景矩形 ======
    const bg = this.scene.add.rectangle(rightX - bottomWidth, 0, bottomWidth, panelHeight, 0xffffff, 0.8);
    bg.setOrigin(0, 0);
    this.container.add(bg);

    // ====== 梯形遮罩 ======
    const shape = this.scene.make.graphics();
    shape.fillStyle(0xffffff);
    shape.beginPath();
    shape.moveTo(rightX - topWidth, 0);           // 上左
    shape.lineTo(rightX, 0);                     // 上右
    shape.lineTo(rightX, panelHeight);           // 下右
    shape.lineTo(rightX - bottomWidth, panelHeight); // 下左
    shape.closePath();
    shape.fillPath();

    const mask = shape.createGeometryMask();
    bg.setMask(mask);

    // ====== 标题 ======
    const titleX = rightX - topWidth / 2; // 顶部中心
    const titleY = 20;                     // 顶部距离
    const titleText = this.scene.add.text(titleX, titleY, this.getGridName(this.gridId), {
      fontSize: '28px',
      color: '#000000',
      fontStyle: 'bold',
      padding: { top: 10 },
    }).setOrigin(0.5, 0);
    this.container.add(titleText);

    // ====== 内容区域 ======
    const contentStartY = 80;
    const lineHeight = 35;
    let currentY = contentStartY;

    const fields = [
      { key: 'area', value: this.gridData.area || [] },
      { key: 'terrain', value: this.gridData.terrain || [] },
      { key: 'building', value: this.gridData.building || [] },
      { key: 'product', value: this.gridData.product || [] }
    ];

    fields.forEach(field => {
      // 当前行梯形宽度插值
      const progress = currentY / panelHeight; // 0~1
      const currentWidth = topWidth + (bottomWidth - topWidth) * progress;
      const leftX = rightX - currentWidth + 20;   // 左边距 20
      const maxTextWidth = currentWidth - 40;     // 两侧边距各20

      const label = get.translation(field.key);
      const labelText = this.scene.add.text(leftX, currentY, `${label}:`, {
        fontSize: '20px',
        color: '#333333',
        fontStyle: 'bold',
        padding: { top: 10 },
      }).setOrigin(0, 0.5);
      this.container.add(labelText);

      let valueStr = '';
      if (Array.isArray(field.value) && field.value.length > 0) {
        valueStr = field.value.map(v => get.translation(v)).join(', ');
      } else {
        valueStr = get.translation('none');
      }

      const valueText = this.scene.add.text(leftX + 120, currentY, valueStr, {
        fontSize: '18px',
        color: '#000000',
        wordWrap: { width: maxTextWidth - 120 }, // 自适应梯形宽度
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
      if (this.isAnimating) return; // 动画中禁止点击
      this.close();
    });

    // ====== 进入动画 ======
    this.playEnterAnimation(bottomWidth);
  }

  /**
   * 播放进入动画
   */
  playEnterAnimation(bottomWidth) {
    const { width } = this.scene.scale;

    // 初始位置：在屏幕右侧外
    this.container.x = bottomWidth;
    this.isAnimating = true;

    // 平移进入
    this.scene.tweens.add({
      targets: this.container,
      x: 0,
      duration: 500, // 0.5秒
      ease: 'Power2', // 缓动效果
      onComplete: () => {
        this.isAnimating = false;
      }
    });
  }

  /**
   * 播放退出动画
   */
  playExitAnimation(onComplete) {
    const { width } = this.scene.scale;
    const bottomWidth = width * 0.6;

    this.isAnimating = true;

    // 平移退出到右侧
    this.scene.tweens.add({
      targets: this.container,
      x: bottomWidth,
      duration: 500, // 0.5秒
      ease: 'Power2',
      onComplete: () => {
        this.isAnimating = false;
        if (onComplete) {
          onComplete();
        }
      }
    });
  }

  /**
   * 关闭面板
   */
  close() {
    this.playExitAnimation(() => {
      // 动画完成后通知场景关闭
      if (this.scene.closeGridPanel) {
        this.scene.closeGridPanel();
      }
    });
  }

  /**
   * 获取格子显示名称
   * @param {string} gridId - 格子ID
   * @returns {string} 显示名称
   */
  getGridName(gridId) {
    if (gridId === 'g1') {
      return '主城';
    }

    const num = parseInt(gridId.replace('g', ''));
    const areaNum = num - 1;

    return `${areaNum}区`;
  }

  /**
   * 销毁面板
   */
  destroy() {
    if (this.container) {
      this.container.destroy();
      this.container = null;
    }
  }
}