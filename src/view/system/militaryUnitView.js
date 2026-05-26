/**
 * 兵力/图鉴查看界面
 */
import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import { saveSystem } from '../../system/saveSystem.js';
import { MILITARY } from '../../data/military.js';
import { MILITARY_UNIT } from '../../data/military_unit.js';
import { MAPS } from '../../data/map.js';
import { get } from '../../system/i18n.js';

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