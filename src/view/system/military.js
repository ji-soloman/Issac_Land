import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import { MILITARY } from '../../data/military.js';
import { MILITARY_UNIT } from '../../data/military_unit.js';
import { MAPS } from '../../data/map.js';
import { get } from '../../system/i18n.js';

export class MilitarySystem {
  constructor(scene, saveData) {
    this.scene = scene;
    this.saveData = saveData;

    // 配置参数
    this.config = {
      sidePadding: 80,
      topPadding: 120,
      bottomPadding: 50,
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
    bg.setInteractive();
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

    const availableWidth = width - (sidePadding * 2);
    let cardsPerRow = Math.floor((availableWidth + cardSpacing) / (cardWidth + cardSpacing));
    if (cardsPerRow < 1) cardsPerRow = 1;

    const totalRowWidth = cardsPerRow * cardWidth + (cardsPerRow - 1) * cardSpacing;
    const startX = sidePadding + (availableWidth - totalRowWidth) / 2 + cardWidth / 2;

    const mapType = this.saveData.map_type;
    const mapGrids = MAPS[mapType]?.grids || {};
    const saveGrids = this.saveData.map?.grids || {};
    const actions = Object.entries(MILITARY);

    this.scrollContainer = this.scene.add.container(0, 0);
    this.mainContainer.add(this.scrollContainer);

    let lastY = 0;
    actions.forEach(([actionId, action], index) => {
      const row = Math.floor(index / cardsPerRow);
      const col = index % cardsPerRow;

      const x = startX + col * (cardWidth + cardSpacing);
      const y = topPadding + row * (cardHeight + cardSpacing) + cardHeight / 2;

      const isAvailable = this.checkActionAvailable(action, mapGrids, saveGrids);
      this.createActionCard(actionId, action, x, y, isAvailable);
      lastY = y + cardHeight / 2;
    });

    this.contentHeight = lastY + bottomPadding;
    this.viewportHeight = height;
    this.maxScroll = Math.max(0, this.contentHeight - this.viewportHeight);
    this.currentScrollY = 0;

    const maskShape = this.scene.make.graphics();
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(0, topPadding - 10, width, height - topPadding + 10);
    const mask = maskShape.createGeometryMask();
    this.scrollContainer.setMask(mask);

    if (this.maxScroll > 0) {
      this.createScrollBar();
    }
  }

  createScrollBar() {
    const { width, height } = this.scene.scale;
    const { topPadding, bottomPadding, scrollBarWidth } = this.config;

    const trackHeight = height - topPadding - bottomPadding;
    const trackX = width - 20;
    const trackY = topPadding;

    this.scrollTrack = this.scene.add.rectangle(trackX, trackY + trackHeight / 2, scrollBarWidth, trackHeight, 0x000000, 0.3);
    this.mainContainer.add(this.scrollTrack);

    let thumbHeight = (this.viewportHeight / this.contentHeight) * trackHeight;
    thumbHeight = Math.max(thumbHeight, 50);

    this.scrollThumbHeight = thumbHeight;
    this.scrollTrackHeight = trackHeight;
    this.scrollTrackY = trackY;

    this.scrollThumb = this.scene.add.rectangle(trackX, trackY + thumbHeight / 2, scrollBarWidth, thumbHeight, 0x888888, 1);
    this.scrollThumb.setInteractive({ useHandCursor: true, draggable: true });
    this.mainContainer.add(this.scrollThumb);

    this.scene.input.setDraggable(this.scrollThumb);
    this.scrollThumb.on('drag', (pointer, dragX, dragY) => {
      const minY = this.scrollTrackY + this.scrollThumbHeight / 2;
      const maxY = this.scrollTrackY + this.scrollTrackHeight - this.scrollThumbHeight / 2;
      const clampedY = Phaser.Math.Clamp(dragY, minY, maxY);

      this.scrollThumb.y = clampedY;

      const scrollRatio = (clampedY - minY) / (maxY - minY);
      this.currentScrollY = scrollRatio * this.maxScroll;
      this.scrollContainer.y = -this.currentScrollY;
    });
  }

  onMouseWheel(pointer, gameObjects, deltaX, deltaY, deltaZ) {
    if (this.maxScroll <= 0) return;
    const scrollSpeed = 0.5;
    this.currentScrollY += deltaY * scrollSpeed;
    this.currentScrollY = Phaser.Math.Clamp(this.currentScrollY, 0, this.maxScroll);
    this.updateScrollPosition();
  }

  updateScrollPosition() {
    this.scrollContainer.y = -this.currentScrollY;
    if (this.scrollThumb) {
      const minY = this.scrollTrackY + this.scrollThumbHeight / 2;
      const maxY = this.scrollTrackY + this.scrollTrackHeight - this.scrollThumbHeight / 2;
      const ratio = this.currentScrollY / this.maxScroll;
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
    const cardContainer = this.scene.add.container(x, y);

    const bgColor = isAvailable ? 0x4a4a4a : 0x2a2a2a;
    const bg = this.scene.add.rectangle(0, 0, cardWidth, cardHeight, bgColor, 0.9);
    cardContainer.add(bg);

    const borderColor = isAvailable ? 0xffd700 : 0x666666;
    const border = this.scene.add.rectangle(0, 0, cardWidth, cardHeight).setStrokeStyle(3, borderColor, 1);
    cardContainer.add(border);

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
        this.onActionClick(actionId, action);
      });
    } else {
      cardContainer.setAlpha(0.6);
    }
    this.scrollContainer.add(cardContainer);
  }

  onActionClick(actionId, action) {
    console.log('执行:', actionId);

    // 如果是查看兵力
    if (actionId === 'soldier_check') {
      // 1. 关闭当前界面
      if (this.scene.closeCurrentSystem) {
        this.scene.closeCurrentSystem();
      } else {
        this.destroy();
      }
      // 2. 打开新的兵力查看界面
      new MilitaryUnitViewer(this.scene, this.saveData, action.name);
      return;
    }
    // 2. 地形侦查
    if (actionId === 'explore_terrain') {
      // 关闭当前菜单
      // this.destroy(); 

      // 打开筛选选择器
      new SoldierSelector(this.scene, this.saveData, {
        title: '选择探索单位',
        requiredAbility: actionId,
      });
      return;
    }

    // 其他逻辑...
  }

  createCloseButton() {
    const { width } = this.scene.scale;
    const closeBtn = this.scene.add.container(width - 50, 50);
    const closeBg = this.scene.add.circle(0, 0, 25, 0xff0000, 0.8);
    const closeText = this.scene.add.text(0, 0, '×', {
      fontSize: '36px', color: '#ffffff', fontStyle: 'bold', padding: { top: 2 }
    }).setOrigin(0.5);

    closeBtn.add([closeBg, closeText]);
    closeBg.setInteractive({ useHandCursor: true });
    closeBg.on('pointerover', () => { closeBg.setFillStyle(0xff3333, 1); closeBtn.setScale(1.1); });
    closeBg.on('pointerout', () => { closeBg.setFillStyle(0xff0000, 0.8); closeBtn.setScale(1.0); });
    closeBg.on('pointerdown', () => {
      // 如果场景有统一的关闭方法则调用，否则自己销毁
      if (this.scene.closeCurrentSystem) {
        this.scene.closeCurrentSystem();
      } else {
        this.destroy();
      }
    });
    this.mainContainer.add(closeBtn);
  }

  destroy() {
    this.scene.input.off('wheel', this.onMouseWheel, this);
    if (this.mainContainer) {
      this.mainContainer.destroy();
      this.mainContainer = null;
    }
  }
}

/**
 * 兵力/图鉴查看界面
 */

export class MilitaryUnitViewer {
  constructor(scene, saveData, name) {
    this.scene = scene;
    this.saveData = saveData;
    this.mainContainer = null;
    this.tooltip = null;
    this.title = name;

    // 配置参数
    this.config = {
      cardWidth: 150,
      cardHeight: 200,
      spacing: 20,
      sideMargin: 80,
      topMargin: 120
    };

    this.create();
  }

  create() {
    const { width, height } = this.scene.scale;

    // 1. 主容器
    this.mainContainer = this.scene.add.container(0, 0).setDepth(1100);

    // 背景
    const bg = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x1a1a1a, 0.98);
    bg.setInteractive(); // 阻挡穿透
    this.mainContainer.add(bg);

    // 标题
    this.titleText = this.scene.add.text(width / 2, 40, this.title, {
      fontSize: '32px',
      color: '#ffffff',
      fontStyle: 'bold',
      padding: { top: 5 },
    }).setOrigin(0.5);

    this.mainContainer.add(this.titleText);


    // 关闭按钮
    this.createCloseButton();

    // 2. 创建"图鉴"和"当前军队"按钮
    this.createGlossaryButton();

    // 初始化内容容器
    this.contentContainer = this.scene.add.container(0, 0);
    this.mainContainer.add(this.contentContainer);

    // 默认显示当前军队
    this.showMyArmy();
  }

  createCloseButton() {
    const { width } = this.scene.scale;
    const closeBtn = this.scene.add.text(width - 50, 40, '退出', {
      fontSize: '20px', backgroundColor: '#cc0000', padding: { x: 10, y: 5 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.destroy();
      });

    this.mainContainer.add(closeBtn);
  }

  createGlossaryButton() {
    // 当前军队按钮
    const myArmyBtn = this.scene.add.text(100, 80, '兵力表', {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#229944',
      padding: { x: 15, y: 8 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    myArmyBtn.on('pointerover', () => myArmyBtn.setScale(1.05));
    myArmyBtn.on('pointerout', () => myArmyBtn.setScale(1));
    myArmyBtn.on('pointerdown', () => {
      this.titleText.setText('兵力表');
      this.showMyArmy();
    });

    // 兵种图鉴按钮
    const glossaryBtn = this.scene.add.text(250, 80, '兵种图鉴', {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#3366cc',
      padding: { x: 15, y: 8 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    glossaryBtn.on('pointerover', () => glossaryBtn.setScale(1.05));
    glossaryBtn.on('pointerout', () => glossaryBtn.setScale(1));
    glossaryBtn.on('pointerdown', () => {
      this.titleText.setText('兵种图鉴');
      this.showGlossary();
    });

    this.mainContainer.add([myArmyBtn, glossaryBtn]);
  }

  /**
   * 展示当前拥有的军队
   */
  showMyArmy() {
    this.contentContainer.removeAll(true);

    const { width } = this.scene.scale;
    const { cardWidth, cardHeight, spacing, sideMargin, topMargin } = this.config;

    // 从 saveData.military 获取士兵数据
    if (!this.saveData || !this.saveData.military) {
      const noDataText = this.scene.add.text(width / 2, topMargin + 100, '暂无军队数据', {
        fontSize: '24px',
        color: '#999999'
      }).setOrigin(0.5);
      this.contentContainer.add(noDataText);
      return;
    }

    const soldiers = Object.entries(this.saveData.military);

    if (soldiers.length === 0) {
      const noDataText = this.scene.add.text(width / 2, topMargin + 100, '当前没有士兵', {
        fontSize: '24px',
        color: '#999999'
      }).setOrigin(0.5);
      this.contentContainer.add(noDataText);
      return;
    }

    // 计算网格布局
    const availableWidth = width - sideMargin * 2;
    let cols = Math.floor((availableWidth + spacing) / (cardWidth + spacing));
    if (cols < 1) cols = 1;

    // 计算居中起始X
    const totalRowWidth = cols * cardWidth + (cols - 1) * spacing;
    const startX = sideMargin + (availableWidth - totalRowWidth) / 2 + cardWidth / 2;
    const startY = topMargin + cardHeight / 2;

    soldiers.forEach(([id, soldier], index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);

      const x = startX + col * (cardWidth + spacing);
      const y = startY + row * (cardHeight + spacing);

      // 从 MILITARY_UNIT 获取完整的兵种数据
      const unitKey = soldier.name;
      const unitData = MILITARY_UNIT[unitKey];

      if (unitData) {
        // 合并士兵数据和基础兵种数据
        const displayData = {
          //...unitData,
          name: MILITARY_UNIT[unitKey].name,
          type: MILITARY_UNIT[unitKey].type,
          id: id,
          image: MILITARY_UNIT[unitKey].image,
          current_stats: soldier.stats,
          current_equipments: soldier.equipments,
          current_ability: soldier.ability
        };
        this.createSoldierCard(unitKey, displayData, x, y, id);
      }
    });
  }

  /**
   * 展示图鉴网格
   */
  showGlossary() {
    this.contentContainer.removeAll(true);

    const { width } = this.scene.scale;
    const { cardWidth, cardHeight, spacing, sideMargin, topMargin } = this.config;

    const units = Object.entries(MILITARY_UNIT);

    // 计算网格布局
    const availableWidth = width - sideMargin * 2;
    // 计算一行能放几个
    let cols = Math.floor((availableWidth + spacing) / (cardWidth + spacing));
    if (cols < 1) cols = 1;

    // 计算居中起始X
    const totalRowWidth = cols * cardWidth + (cols - 1) * spacing;
    const startX = sideMargin + (availableWidth - totalRowWidth) / 2 + cardWidth / 2;
    const startY = topMargin + cardHeight / 2;

    units.forEach(([key, unit], index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);

      const x = startX + col * (cardWidth + spacing);
      const y = startY + row * (cardHeight + spacing);

      this.createUnitCard(key, unit, x, y);
    });
  }

  /**
   * 创建当前士兵卡片
   */
  createSoldierCard(key, soldier, x, y, id) {
    const { cardWidth, cardHeight } = this.config;
    const container = this.scene.add.container(x, y);

    // 1. 卡片背景与边框
    const bg = this.scene.add.rectangle(0, 0, cardWidth, cardHeight, 0x2a4a2a); // 绿色
    const border = this.scene.add.rectangle(0, 0, cardWidth, cardHeight).setStrokeStyle(2, 0x88aa88);

    // 2. ID 标签，暂时不显示但是留着
    // const idText = this.scene.add.text(-cardWidth / 2 + 5, -cardHeight / 2 + 5, id.toUpperCase(), {
    //   fontSize: '12px',
    //   color: '#ffff00',
    //   backgroundColor: '#000000',
    //   padding: { x: 4, y: 2 }
    // }).setOrigin(0);

    // 3. 名字区域
    const nameBgHeight = cardHeight * 0.15;
    const nameY = (cardHeight / 2) - (nameBgHeight / 2);
    const nameBg = this.scene.add.rectangle(0, nameY, cardWidth, nameBgHeight, 0x000000, 0.8);

    let displayName = soldier.name;
    try { displayName = get.militaryTranslation(soldier.name) || soldier.name; } catch (e) { }

    const nameText = this.scene.add.text(0, nameY, displayName, {
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold',
      padding: { top: 4 },
    }).setOrigin(0.5);

    // 4. 图片区域
    const imageAreaHeight = cardHeight - nameBgHeight;
    const imageCenterY = -nameBgHeight / 2;

    let imageObj;
    if (soldier.image && soldier.image !== "") {
      imageObj = this.scene.add.image(0, imageCenterY, `soldier_${key}`);

      const maxImgW = cardWidth - 10;
      const maxImgH = imageAreaHeight - 10;

      const scale = Math.min(maxImgW / imageObj.width, maxImgH / imageObj.height);
      imageObj.setScale(scale);
    } else {
      imageObj = this.scene.add.text(0, imageCenterY, 'NO IMAGE', {
        fontSize: '12px', color: '#666'
      }).setOrigin(0.5);
    }

    container.add([bg, border, imageObj, nameBg, nameText/*, idText*/]);

    // 5. 交互：Tooltip
    bg.setInteractive({ useHandCursor: true });

    bg.on('pointerover', (pointer) => {
      border.setStrokeStyle(2, 0xffff00);
      container.setScale(1.02);
      this.showTooltip(soldier, x, y);
    });

    bg.on('pointerout', () => {
      border.setStrokeStyle(2, 0x88aa88);
      container.setScale(1);
      this.hideTooltip();
    });

    this.contentContainer.add(container);
  }

  /**
   * 创建单个士兵卡片 - 用于图鉴
   */
  createUnitCard(key, unit, x, y) {
    const { cardWidth, cardHeight } = this.config;
    const container = this.scene.add.container(x, y);

    // 1. 卡片背景与边框
    const bg = this.scene.add.rectangle(0, 0, cardWidth, cardHeight, 0x333333);
    const border = this.scene.add.rectangle(0, 0, cardWidth, cardHeight).setStrokeStyle(2, 0x888888);

    // 2. 名字区域
    const nameBgHeight = cardHeight * 0.15;
    const nameY = (cardHeight / 2) - (nameBgHeight / 2);
    const nameBg = this.scene.add.rectangle(0, nameY, cardWidth, nameBgHeight, 0x000000, 0.8);

    let displayName = unit.name;
    try { displayName = get.militaryTranslation(unit.name) || unit.name; } catch (e) { }

    const nameText = this.scene.add.text(0, nameY, displayName, {
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold',
      padding: { top: 4 },
    }).setOrigin(0.5);

    // 3. 图片区域
    const imageAreaHeight = cardHeight - nameBgHeight;
    const imageCenterY = -nameBgHeight / 2;

    let imageObj;
    if (unit.image && unit.image !== "") {
      imageObj = this.scene.add.image(0, imageCenterY, `soldier_${key}`);

      const maxImgW = cardWidth - 10;
      const maxImgH = imageAreaHeight - 10;

      const scale = Math.min(maxImgW / imageObj.width, maxImgH / imageObj.height);
      imageObj.setScale(scale);
    } else {
      imageObj = this.scene.add.text(0, imageCenterY, 'NO IMAGE', {
        fontSize: '12px', color: '#666'
      }).setOrigin(0.5);
    }

    container.add([bg, border, imageObj, nameBg, nameText]);

    // 4. 交互：Tooltip
    bg.setInteractive({ useHandCursor: true });

    bg.on('pointerover', (pointer) => {
      border.setStrokeStyle(2, 0xffff00);
      container.setScale(1.02);
      this.showTooltip(unit, x, y);
    });

    bg.on('pointerout', () => {
      border.setStrokeStyle(2, 0x888888);
      container.setScale(1);
      this.hideTooltip();
    });

    this.contentContainer.add(container);
  }

  /**
   * 生成并显示 Tooltip
   */
  showTooltip(unit, cardX, cardY) {
    if (this.tooltip) this.hideTooltip();

    // 解析数据内容
    const contentLines = this.getTooltipContent(unit);
    const textStyle = { fontSize: '14px', color: '#ffffff', lineSpacing: 5 };

    // 预计算尺寸
    const tempText = this.scene.add.text(0, 0, contentLines, textStyle);
    const txtWidth = tempText.width;
    const txtHeight = tempText.height;
    tempText.destroy();

    const padding = 12;
    const boxWidth = txtWidth + padding * 2;
    const boxHeight = txtHeight + padding * 2;

    const { width, height } = this.scene.scale;

    // 位置逻辑：优先显示在右侧，不够则左侧
    let tipX = cardX + this.config.cardWidth / 2 + 10;
    let tipY = cardY - this.config.cardHeight / 2; // 对齐卡片顶部

    if (tipX + boxWidth > width) {
      tipX = cardX - this.config.cardWidth / 2 - boxWidth - 10;
    }
    // 防止底部溢出
    if (tipY + boxHeight > height) {
      tipY = height - boxHeight - 10;
    }
    // 防止顶部溢出
    if (tipY < 10) tipY = 10;

    this.tooltip = this.scene.add.container(tipX, tipY).setDepth(2000);

    const bg = this.scene.add.rectangle(0, 0, boxWidth, boxHeight, 0x000000, 0.9).setOrigin(0);
    const border = this.scene.add.rectangle(0, 0, boxWidth, boxHeight).setStrokeStyle(1, 0xaaaaaa).setOrigin(0);
    const text = this.scene.add.text(padding, padding, contentLines, textStyle);

    this.tooltip.add([bg, border, text]);
  }

  hideTooltip() {
    if (this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = null;
    }
  }

  /**
   * 递归解析 Unit 数据，处理翻译和布尔值逻辑
   */
  getTooltipContent(obj, indent = 0) {
    let lines = [];
    const spacer = ' '.repeat(indent * 2);

    for (const [key, value] of Object.entries(obj)) {
      // 1. 忽略不需要展示的基础字段
      if (indent === 0 && ['name', 'image', 'id'].includes(key)) continue;

      // 2. 翻译 Key
      let displayKey = key;
      try {
        displayKey = get.militaryTranslation(key) || key;
      } catch (e) { }

      // 3. 处理不同类型的值
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // 如果是对象（例如 basic_stats），且不为空，则显示标题并递归
        if (Object.keys(value).length > 0) {
          lines.push(`${spacer}${displayKey}：`);
          lines.push(...this.getTooltipContent(value, indent + 1));
        }
      } else if (typeof value === 'boolean') {
        // 布尔值处理
        if (value === true) {
          lines.push(`${spacer}• ${displayKey}`);
        }
      } else {
        // 普通值 (数字/字符串) 处理
        let displayValue = value;
        if (typeof value === 'string') {
          try {
            displayValue = get.militaryTranslation(value) || value;
          } catch (e) { }
        }

        lines.push(`${spacer}${displayKey}: ${displayValue}`);
      }
    }
    return lines;
  }

  destroy() {
    if (this.mainContainer) this.mainContainer.destroy();
    if (this.tooltip) this.tooltip.destroy();
  }
}

/**
 * 士兵选择器
 * 用于列出特定任务可用的士兵
 */
export class SoldierSelector {
  constructor(scene, saveData, config) {
    this.scene = scene;
    this.saveData = saveData;

    // 配置
    this.config = {
      title: config.title || '选择单位',
      requiredAbility: config.requiredAbility || '', // 筛选必须具备的能力

      // UI 参数
      width: 600,
      height: 500,
      cardHeight: 80, // 列表项高度
      cardSpacing: 10,
      themeColor: 0xffd700
    };

    // 绑定上下文，防止事件丢失
    this.onMouseWheel = this.onMouseWheel.bind(this);

    this.create();
  }

  create() {
    const { width, height } = this.scene.scale;
    const boxW = this.config.width;
    const boxH = this.config.height;

    // --- 1. 创建全屏遮罩 ---
    // 放在最底层 (depth 1199)，颜色黑色半透明
    this.overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
    this.overlay.setDepth(1199);
    // 关键：设置为可交互，这样点击事件会被它“吃掉”，不会传给游戏底层的地图
    this.overlay.setInteractive();

    // --- 2. 主容器 ---
    this.mainContainer = this.scene.add.container(width / 2, height / 2).setDepth(1200);

    // 背景
    const bg = this.scene.add.rectangle(0, 0, boxW, boxH, 0x1a1a1a, 1);
    const border = this.scene.add.rectangle(0, 0, boxW, boxH).setStrokeStyle(2, this.config.themeColor);

    // 窗口背景也设为交互，防止穿透
    bg.setInteractive();
    this.mainContainer.add([bg, border]);

    // --- 3. 标题 ---
    const titleText = this.scene.add.text(0, -boxH / 2 + 30, this.config.title, {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.mainContainer.add(titleText);

    // --- 4. 关闭按钮 ---
    // 增加一个透明的点击区域 circle，比文字大一点，更容易点中
    const closeBtnContainer = this.scene.add.container(boxW / 2 - 25, -boxH / 2 + 25);

    const closeHitArea = this.scene.add.circle(0, 0, 20, 0xff0000, 0); // 透明圆
    closeHitArea.setInteractive({ useHandCursor: true });

    const closeText = this.scene.add.text(0, 0, '×', {
      fontSize: '32px', color: '#ff4444', fontStyle: 'bold'
    }).setOrigin(0.5);

    closeBtnContainer.add([closeHitArea, closeText]);
    this.mainContainer.add(closeBtnContainer);

    // 事件处理
    closeHitArea.on('pointerover', () => closeText.setColor('#ffaaaa'));
    closeHitArea.on('pointerout', () => closeText.setColor('#ff4444'));
    closeHitArea.on('pointerdown', () => {
      this.destroy();
    });

    // --- 5. 创建列表 ---
    this.createSoldierList(boxW, boxH);
  }

  createSoldierList(boxW, boxH) {
    // 筛选符合条件的士兵
    const validSoldiers = this.getAvailableSoldiers();

    const listW = boxW - 40;
    const listH = boxH - 80; // 减去标题高度
    const startY = -boxH / 2 + 70; // 列表起始Y (容器内坐标)

    // 1. 创建遮罩
    const maskShape = this.scene.make.graphics();
    // 遮罩使用的是世界坐标，需要计算
    const absX = this.mainContainer.x - listW / 2;
    const absY = this.mainContainer.y + startY;

    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(absX, absY, listW, listH);
    const mask = maskShape.createGeometryMask();

    // 2. 列表容器
    this.listContainer = this.scene.add.container(0, startY);
    this.listContainer.setMask(mask);
    this.mainContainer.add(this.listContainer);

    // 3. 如果没有数据
    if (validSoldiers.length === 0) {
      const noDataText = this.scene.add.text(0, 50, '无可执行任务的单位', {
        fontSize: '18px', color: '#999'
      }).setOrigin(0.5);
      this.listContainer.add(noDataText);
      return;
    }

    // 4. 生成卡片
    let currentY = 0;
    validSoldiers.forEach((item, index) => {
      const card = this.createSoldierRow(item.id, item.data, listW, currentY);
      this.listContainer.add(card);
      currentY += this.config.cardHeight + this.config.cardSpacing;
    });

    // 5. 滚动逻辑
    this.listContentHeight = currentY;
    this.listViewportHeight = listH;
    this.currentScrollY = 0;
    this.maxScroll = Math.max(0, this.listContentHeight - this.listViewportHeight);

    // 注册滚轮事件
    this.scene.input.on('wheel', this.onMouseWheel);
  }

  /**
   * 滚轮事件处理
   */
  onMouseWheel(pointer, gameObjects, deltaX, deltaY, deltaZ) {
    // 只有当最大滚动距离大于0时才滚动
    if (this.maxScroll <= 0) return;

    // 只有当鼠标在列表范围内才滚动 (可选优化，目前全屏滚动体验也好)
    this.currentScrollY += deltaY * 0.5;
    this.currentScrollY = Phaser.Math.Clamp(this.currentScrollY, 0, this.maxScroll);

    // 更新容器位置
    this.listContainer.y = (-this.config.height / 2 + 70) - this.currentScrollY;
  }

  getAvailableSoldiers() {
    if (!this.saveData || !this.saveData.military) return [];

    const result = [];
    const required = this.config.requiredAbility;

    for (const [id, soldier] of Object.entries(this.saveData.military)) {
      if (soldier.currentStatus) continue;

      let hasAbility = false;
      if (soldier.ability) {
        if (Array.isArray(soldier.ability)) {
          hasAbility = soldier.ability.includes(required);
        } else if (typeof soldier.ability === 'object') {
          hasAbility = soldier.ability[required];
        }
      }
      if (hasAbility) result.push({ id, data: soldier });
    }
    return result;
  }

  createSoldierRow(id, soldier, width, y) {
    const rowHeight = this.config.cardHeight;
    const container = this.scene.add.container(0, y + rowHeight / 2);

    const bg = this.scene.add.rectangle(0, 0, width, rowHeight, 0x333333).setInteractive({ useHandCursor: true });
    const border = this.scene.add.rectangle(0, 0, width, rowHeight).setStrokeStyle(1, 0x666666);

    bg.on('pointerover', () => { bg.setFillStyle(0x444444); border.setStrokeStyle(2, 0xffff00); });
    bg.on('pointerout', () => { bg.setFillStyle(0x333333); border.setStrokeStyle(1, 0x666666); });

    bg.on('pointerdown', () => {
      // ToDo: 执行任务

      // 选择后关闭
      this.destroy();
    });

    const nameText = this.scene.add.text(-width / 2 + 20, 0, MILITARY_UNIT[soldier.name].name, {
      fontSize: '20px', color: '#fff', fontStyle: 'bold'
    }).setOrigin(0, 0.5);

    // 属性显示
    let statsStr = "";
    if (soldier.stats) {
      const s = soldier.stats;
      statsStr = `攻:${s.physical_attack || 0} 魔:${s.mana || 0} 体:${s.hp || 0}`;
    }

    const statsText = this.scene.add.text(0, 0, statsStr, {
      fontSize: '14px', color: '#aaaaaa'
    }).setOrigin(0.5);

    const selectBtn = this.scene.add.text(width / 2 - 20, 0, '选择', {
      fontSize: '16px', color: '#00ff00'
    }).setOrigin(1, 0.5);

    container.add([bg, border, nameText, statsText, selectBtn]);
    return container;
  }

  /**
   * 销毁组件，清理资源
   */
  destroy() {
    // 1. 移除全局事件监听 (必须！)
    this.scene.input.off('wheel', this.onMouseWheel);

    // 2. 销毁遮罩
    if (this.overlay) {
      this.overlay.destroy();
      this.overlay = null;
    }

    // 3. 销毁主容器
    if (this.mainContainer) {
      this.mainContainer.destroy();
      this.mainContainer = null;
    }
  }
}