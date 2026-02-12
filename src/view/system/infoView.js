import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import { MAPS } from '../../data/map.js';
import { RACES } from '../../data/race.js';
import { TAROT } from '../../data/tarot.js';
import { ERA } from '../../data/era.js';
import { get } from '../../system/i18n.js';

export class InfoSystem {
  constructor(scene, saveData) {
    this.scene = scene;
    this.saveData = saveData;
    this.create();
  }

  create() {
    const { width, height } = this.scene.scale;
    const centerX = width / 2;
    const centerY = height / 2;

    // ====== 1. 创建主容器 ======
    this.container = this.scene.add.container(centerX, centerY);
    this.container.setScale(0);
    this.container.setDepth(1000);

    // ====== 计算图片缩放 ======
    const bottomMargin = Math.max(120, height / 6) + 5;
    const topMargin = 20;
    const availableHeight = height - topMargin - bottomMargin;

    const infoBg = this.scene.add.image(0, 0, 'info_page');
    const maxWidth = width * 0.8;
    const scale = Math.min(maxWidth / infoBg.width, availableHeight / infoBg.height);
    infoBg.setScale(scale);

    const bgW = infoBg.width * scale;
    const bgH = infoBg.height * scale;

    this.container.add(infoBg);

    // ====== 创建内容容器 ======
    this.contentContainer = this.scene.add.container(0, 0);
    this.container.add(this.contentContainer);

    // ====== 数据准备 ======
    const mapName = MAPS[this.saveData.map_type]?.name || this.saveData.map_type;
    const raceName = RACES[this.saveData.race]?.name || this.saveData.race;
    const tarotName = TAROT[this.saveData.tarot]?.name || this.saveData.tarot;

    const baseInfo = [
      { label: '文明', value: this.saveData.name },
      { label: 'era', value: this.saveData.process.era },
      { label: 'capital', value: this.saveData.capital },
      { label: '大陆', value: mapName },
      { label: 'race', value: raceName },
      { label: '塔罗', value: tarotName },
    ];

    const resources = [
      { label: get.translation('culture'), value: this.saveData.resource.culture },
      { label: get.translation('food'), value: this.saveData.resource.food },
      { label: get.translation('magic'), value: this.saveData.resource.magic },
      { label: get.translation('wealth'), value: this.saveData.resource.wealth }
    ];

    const startY = -bgH / 2 + (bgH * 0.16);
    const lineHeight = 45;
    const leftX = -bgW / 2 + (bgW * 0.12);
    const rightX = 35;

    let currentY = startY;

    // 绘制基础信息
    baseInfo.forEach((info, index) => {
      const isLeft = index % 2 === 0;
      const x = isLeft ? leftX : rightX;

      const infoLabel = get.translation(info.label);

      const label = this.scene.add.text(x, currentY, `${infoLabel}:`, {
        fontSize: '22px',
        color: '#ffcc00',
        fontStyle: 'bold',
        padding: { top: 10 },
        shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 2, stroke: true, fill: true }
      }).setOrigin(0, 0.5);

      var infoValue = info.value;
      if (info.label == 'era') {
        infoValue = ERA[infoValue].name;
      }

      const value = this.scene.add.text(x + 70, currentY, infoValue, {
        fontSize: '22px',
        color: '#ffffff',
        padding: { top: 10 },
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0, 0.5);

      this.contentContainer.add([label, value]);

      if (!isLeft) currentY += lineHeight;
    });

    currentY += 30;

    // 资源标题
    const resTitle = this.scene.add.text(0, currentY, '资源', {
      fontSize: '26px',
      color: '#ffcc00',
      fontStyle: 'bold',
      padding: { top: 10 },
    }).setOrigin(0.5);
    this.contentContainer.add(resTitle);

    currentY += lineHeight + 10;

    // 资源列表
    resources.forEach((res, index) => {
      const isLeft = index % 2 === 0;
      const x = isLeft ? leftX : rightX;

      const label = this.scene.add.text(x, currentY, `${res.label}:`, {
        fontSize: '20px',
        color: '#88ff88',
        fontStyle: 'bold',
        padding: { top: 10 },
      }).setOrigin(0, 0.5);

      const value = this.scene.add.text(x + 70, currentY, res.value, {
        fontSize: '20px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0, 0.5);

      this.contentContainer.add([label, value]);

      if (!isLeft) currentY += lineHeight;
    });

    // 计算内容总高度
    const contentHeight = currentY - startY + 50;
    const maxContentHeight = bgH - (bgH * 0.2);

    // ====== 设置遮罩和滚动 ======
    if (contentHeight > maxContentHeight) {
      // 创建遮罩区域
      const maskShape = this.scene.make.graphics();
      maskShape.fillStyle(0xffffff);
      maskShape.fillRect(
        centerX - bgW / 2 + (bgW * 0.05),
        centerY - bgH / 2 + (bgH * 0.12),
        bgW * 0.9,
        maxContentHeight
      );
      const mask = maskShape.createGeometryMask();
      this.contentContainer.setMask(mask);

      // 设置滚动参数
      this.scrollY = 0;
      this.maxScrollY = contentHeight - maxContentHeight;

      // 绘制滚动条
      this.drawScrollbar(bgW, bgH, contentHeight, maxContentHeight);
    }

    // ====== 关闭按钮 ======
    const closeBtnX = bgW / 2 - 30;
    const closeBtnY = -bgH / 2 + 30;

    const closeBtn = this.scene.add.container(closeBtnX, closeBtnY);
    const closeBg = this.scene.add.circle(0, 0, 20, 0xff0000, 0.8);
    const closeIcon = this.scene.add.text(0, 0, '×', { fontSize: '32px', color: '#fff' }).setOrigin(0.5, 0.5);

    closeBtn.add([closeBg, closeIcon]);
    closeBg.setInteractive({ useHandCursor: true });
    closeBg.on('pointerdown', () => {
      this.close();
    });

    this.container.add(closeBtn);

    // ====== 弹出动画 ======
    this.scene.tweens.add({
      targets: this.container,
      scale: 1,
      duration: 500,
      ease: 'Back.out'
    });
  }

  drawScrollbar(bgW, bgH, contentHeight, maxContentHeight) {
    const scrollbarX = bgW / 2 - 15;
    const scrollbarY = -bgH / 2 + (bgH * 0.12);
    const scrollbarHeight = maxContentHeight;
    const scrollbarWidth = 8;

    // 滚动条轨道
    const track = this.scene.add.rectangle(
      scrollbarX,
      scrollbarY + scrollbarHeight / 2,
      scrollbarWidth,
      scrollbarHeight,
      0x333333,
      0.5
    );
    this.container.add(track);

    // 滚动条滑块
    const thumbHeight = (maxContentHeight / contentHeight) * scrollbarHeight;
    this.scrollThumb = this.scene.add.rectangle(
      scrollbarX,
      scrollbarY + thumbHeight / 2,
      scrollbarWidth,
      thumbHeight,
      0xffcc00,
      0.8
    );
    this.container.add(this.scrollThumb);

    // 保存滚动条参数
    this.scrollbarData = {
      x: scrollbarX,
      startY: scrollbarY,
      height: scrollbarHeight,
      thumbHeight: thumbHeight,
      maxThumbY: scrollbarY + scrollbarHeight - thumbHeight
    };

    // 设置滑块可拖动
    this.scrollThumb.setInteractive({ useHandCursor: true });
    this.scene.input.setDraggable(this.scrollThumb);

    // 拖动事件
    this.scrollThumb.on('drag', (pointer, dragX, dragY) => {
      // 计算滑块在容器坐标系中的Y位置
      const localY = dragY;

      // 限制滑块在轨道范围内
      const minY = this.scrollbarData.startY + this.scrollbarData.thumbHeight / 2;
      const maxY = this.scrollbarData.startY + this.scrollbarData.height - this.scrollbarData.thumbHeight / 2;
      const clampedY = Phaser.Math.Clamp(localY, minY, maxY);

      // 更新滑块位置
      this.scrollThumb.y = clampedY;

      // 计算滚动比例
      const scrollRange = maxY - minY;
      const scrollRatio = (clampedY - minY) / scrollRange;

      // 更新内容位置
      this.scrollY = scrollRatio * this.maxScrollY;
      this.contentContainer.y = -this.scrollY;
    });

    // 鼠标悬停效果
    this.scrollThumb.on('pointerover', () => {
      this.scrollThumb.setFillStyle(0xffdd44, 1);
    });

    this.scrollThumb.on('pointerout', () => {
      this.scrollThumb.setFillStyle(0xffcc00, 0.8);
    });
  }

  close() {
    if (this.container) {
      this.scene.tweens.add({
        targets: this.container,
        scale: 0,
        duration: 200,
        onComplete: () => {
          this.destroy();
          if (this.scene.closeCurrentSystem) this.scene.closeCurrentSystem();
        }
      });
    }
  }

  destroy() {
    if (this.container) {
      this.container.destroy();
      this.container = null;
    }
  }
}