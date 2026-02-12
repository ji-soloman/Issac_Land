import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import { MILITARY } from '../../data/military.js';
import { MAPS } from '../../data/map.js';

export class MilitarySystem {
  constructor(scene, saveData) {
    this.scene = scene;
    this.saveData = saveData;

    // 配置参数
    this.config = {
      sidePadding: 80,    // 左右距离屏幕边缘的距离
      topPadding: 120,    // 卡片区域距离顶部的距离
      bottomPadding: 50,  // 卡片区域距离底部的距离
      cardWidth: 250,
      cardHeight: 150,
      cardSpacing: 30,
      scrollBarWidth: 10
    };

    this.create();
  }

  create() {
    const { width, height } = this.scene.scale;

    // 1. 主容器
    this.mainContainer = this.scene.add.container(0, 0).setDepth(1000);

    // 半透明黑色背景
    const bg = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x2a2a2a, 0.95);
    bg.setInteractive(); // 阻挡点击穿透
    this.mainContainer.add(bg);

    // 标题
    const titleText = this.scene.add.text(width / 2, 50, '军事行动', {
      fontSize: '36px',
      color: '#ffd700',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
      padding: { top: 2 },
    }).setOrigin(0.5);
    this.mainContainer.add(titleText);

    // 2. 初始化滚动区域
    this.createScrollableContent();

    // 3. 创建关闭按钮
    this.createCloseButton();

    // 4. 注册全局滚轮事件
    this.scene.input.on('wheel', this.onMouseWheel, this);
  }

  /**
   * 创建可滚动的卡片区域
   */
  createScrollableContent() {
    const { width, height } = this.scene.scale;
    const { sidePadding, topPadding, bottomPadding, cardWidth, cardHeight, cardSpacing } = this.config;

    // --- A. 计算布局 ---
    // 可用宽度 = 屏幕宽度 - 左右边距
    const availableWidth = width - (sidePadding * 2);
    // 每行卡片数 = 可用宽度 / (卡片宽 + 间距)
    let cardsPerRow = Math.floor((availableWidth + cardSpacing) / (cardWidth + cardSpacing));
    if (cardsPerRow < 1) cardsPerRow = 1;

    // 计算这一行卡片的实际总宽度，用于居中
    const totalRowWidth = cardsPerRow * cardWidth + (cardsPerRow - 1) * cardSpacing;
    // 起始 X 坐标 (屏幕中心 - 行宽的一半) + 半个卡片宽(因为卡片锚点是0.5)
    // 或者更简单：左边距 + (可用宽度 - 行宽)/2
    const startX = sidePadding + (availableWidth - totalRowWidth) / 2 + cardWidth / 2;

    // --- B. 准备数据 ---
    const mapType = this.saveData.map_type;
    const mapGrids = MAPS[mapType]?.grids || {};
    const saveGrids = this.saveData.map?.grids || {};
    const actions = Object.entries(MILITARY);

    // --- C. 创建滚动容器 ---
    // 这个容器用来放所有的卡片
    this.scrollContainer = this.scene.add.container(0, 0);
    this.mainContainer.add(this.scrollContainer);

    // --- D. 生成卡片 ---
    let lastY = 0;
    actions.forEach(([actionId, action], index) => {
      const row = Math.floor(index / cardsPerRow);
      const col = index % cardsPerRow;

      const x = startX + col * (cardWidth + cardSpacing);
      const y = topPadding + row * (cardHeight + cardSpacing) + cardHeight / 2;

      const isAvailable = this.checkActionAvailable(action, mapGrids, saveGrids);
      this.createActionCard(actionId, action, x, y, isAvailable);

      // 记录最后一张卡片的底部位置，用于计算总高度
      lastY = y + cardHeight / 2;
    });

    // --- E. 计算滚动参数 ---
    // 内容总高度 = 最后一张卡片的底部 + 底部边距
    this.contentHeight = lastY + bottomPadding;
    // 视口高度 (可视区域)
    this.viewportHeight = height;
    // 最大滚动距离 (内容高度 - 视口高度)，如果内容少于一屏，则为0
    this.maxScroll = Math.max(0, this.contentHeight - this.viewportHeight);
    this.currentScrollY = 0;

    // --- F. 设置遮罩 ---
    // 创建一个图形对象作为遮罩，只显示 topPadding 到 height 之间的区域
    const maskShape = this.scene.make.graphics();
    maskShape.fillStyle(0xffffff);
    // 遮罩区域：x=0, y=topPadding, w=width, h=height-topPadding
    maskShape.fillRect(0, topPadding - 10, width, height - topPadding + 10); // -10/+10是为了边缘平滑一点
    const mask = maskShape.createGeometryMask();
    this.scrollContainer.setMask(mask);

    // --- G. 创建滚动条 UI ---
    if (this.maxScroll > 0) {
      this.createScrollBar();
    }
  }

  /**
   * 创建滚动条
   */
  createScrollBar() {
    const { width, height } = this.scene.scale;
    const { topPadding, bottomPadding, scrollBarWidth } = this.config;

    const trackHeight = height - topPadding - bottomPadding;
    const trackX = width - 20; // 靠右侧显示
    const trackY = topPadding;

    // 滚动条轨道 (背景)
    this.scrollTrack = this.scene.add.rectangle(trackX, trackY + trackHeight / 2, scrollBarWidth, trackHeight, 0x000000, 0.3);
    this.mainContainer.add(this.scrollTrack);

    // 计算滑块(Thumb)的高度
    // 滑块高度 / 轨道高度 = 视口高度 / 内容高度
    // 限制最小高度为 50px，防止太小点不到
    let thumbHeight = (this.viewportHeight / this.contentHeight) * trackHeight;
    thumbHeight = Math.max(thumbHeight, 50);

    this.scrollThumbHeight = thumbHeight;
    this.scrollTrackHeight = trackHeight;
    this.scrollTrackY = trackY;

    // 滚动条滑块
    this.scrollThumb = this.scene.add.rectangle(trackX, trackY + thumbHeight / 2, scrollBarWidth, thumbHeight, 0x888888, 1);
    this.scrollThumb.setInteractive({ useHandCursor: true, draggable: true });
    this.mainContainer.add(this.scrollThumb);

    // 拖拽滚动条逻辑
    this.scene.input.setDraggable(this.scrollThumb);
    this.scrollThumb.on('drag', (pointer, dragX, dragY) => {
      // 限制拖拽范围
      const minY = this.scrollTrackY + this.scrollThumbHeight / 2;
      const maxY = this.scrollTrackY + this.scrollTrackHeight - this.scrollThumbHeight / 2;
      const clampedY = Phaser.Math.Clamp(dragY, minY, maxY);

      this.scrollThumb.y = clampedY;

      // 反向计算内容滚动的百分比
      const scrollRatio = (clampedY - minY) / (maxY - minY);
      this.currentScrollY = scrollRatio * this.maxScroll;

      // 更新容器位置
      this.scrollContainer.y = -this.currentScrollY;
    });
  }

  /**
   * 处理鼠标滚轮事件
   */
  onMouseWheel(pointer, gameObjects, deltaX, deltaY, deltaZ) {
    if (this.maxScroll <= 0) return;

    // 调整滚动速度
    const scrollSpeed = 0.5;
    this.currentScrollY += deltaY * scrollSpeed;

    // 限制滚动范围
    this.currentScrollY = Phaser.Math.Clamp(this.currentScrollY, 0, this.maxScroll);

    this.updateScrollPosition();
  }

  /**
   * 更新视图位置
   */
  updateScrollPosition() {
    // 1. 移动内容容器
    this.scrollContainer.y = -this.currentScrollY;

    // 2. 移动滚动条滑块
    if (this.scrollThumb) {
      const minY = this.scrollTrackY + this.scrollThumbHeight / 2;
      const maxY = this.scrollTrackY + this.scrollTrackHeight - this.scrollThumbHeight / 2;

      // 计算当前滚动比例
      const ratio = this.currentScrollY / this.maxScroll;

      // 线性插值计算滑块位置
      this.scrollThumb.y = minY + (maxY - minY) * ratio;
    }
  }

  checkActionAvailable(action, mapGrids, saveGrids) {
    if (!action.filter || typeof action.filter !== 'function') return true;
    try {
      return action.filter({ saveGrids, mapGrids });
    } catch (error) {
      return false;
    }
  }

  createActionCard(actionId, action, x, y, isAvailable) {
    const { cardWidth, cardHeight } = this.config;

    // 注意：这里我们不再新建Container来包裹卡片，而是直接添加到 this.scrollContainer
    // 但为了卡片内部元素的相对定位，我们还是需要一个小容器
    const cardContainer = this.scene.add.container(x, y);

    // 背景 (带交互)
    const bgColor = isAvailable ? 0x4a4a4a : 0x2a2a2a;
    const bg = this.scene.add.rectangle(0, 0, cardWidth, cardHeight, bgColor, 0.9);
    cardContainer.add(bg);

    // 边框
    const borderColor = isAvailable ? 0xffd700 : 0x666666;
    const border = this.scene.add.rectangle(0, 0, cardWidth, cardHeight)
      .setStrokeStyle(3, borderColor, 1);
    cardContainer.add(border);

    // 文本
    const nameColor = isAvailable ? '#ffffff' : '#666666';
    const nameText = this.scene.add.text(0, -20, action.name, {
      fontSize: '24px',
      color: nameColor,
      fontStyle: 'bold',
      align: 'center',
      padding: { top: 2 },
      wordWrap: { width: cardWidth - 20 }
    }).setOrigin(0.5);
    cardContainer.add(nameText);

    const statusText = this.scene.add.text(0, 30, isAvailable ? '可执行' : '不可用', {
      fontSize: '16px',
      color: isAvailable ? '#00ff00' : '#ff0000',
      fontStyle: 'italic',
      padding: { top: 2 },
    }).setOrigin(0.5);
    cardContainer.add(statusText);

    // 交互
    if (isAvailable) {
      bg.setInteractive({ useHandCursor: true });

      bg.on('pointerover', () => {
        bg.setFillStyle(0x5a5a5a, 0.9);
        border.setStrokeStyle(4, 0xffff00, 1);
        cardContainer.setScale(1.05);
      });

      bg.on('pointerout', () => {
        bg.setFillStyle(0x4a4a4a, 0.9);
        border.setStrokeStyle(3, 0xffd700, 1);
        cardContainer.setScale(1);
      });

      bg.on('pointerdown', () => {
        // 防止拖动滚动条时误触卡片，可以加个简单的判定，但这里简化处理
        this.onActionClick(actionId, action);
      });
    } else {
      cardContainer.setAlpha(0.6);
    }

    this.scrollContainer.add(cardContainer);
  }

  onActionClick(actionId, action) {
    console.log('执行:', action.name);
    // 这里执行具体逻辑...
  }

  createCloseButton() {
    const { width } = this.scene.scale;

    // 放在右上角，但需要考虑Padding避免贴边太近
    const closeBtn = this.scene.add.container(width - 50, 50);

    const closeBg = this.scene.add.circle(0, 0, 25, 0xff0000, 0.8);
    const closeText = this.scene.add.text(0, 0, '×', {
      fontSize: '36px',
      color: '#ffffff',
      fontStyle: 'bold',
      padding: { top: 2 },
    }).setOrigin(0.5);

    closeBtn.add([closeBg, closeText]);

    closeBg.setInteractive({ useHandCursor: true });

    closeBg.on('pointerover', () => {
      closeBg.setFillStyle(0xff3333, 1);
      closeBtn.setScale(1.1);
    });

    closeBg.on('pointerout', () => {
      closeBg.setFillStyle(0xff0000, 0.8);
      closeBtn.setScale(1.0);
    });

    closeBg.on('pointerdown', () => {
      this.scene.closeCurrentSystem();
    });

    this.mainContainer.add(closeBtn);
  }

  destroy() {
    // 移除事件监听，防止内存泄漏或报错
    this.scene.input.off('wheel', this.onMouseWheel, this);

    if (this.mainContainer) {
      this.mainContainer.destroy();
      this.mainContainer = null;
    }
  }
}