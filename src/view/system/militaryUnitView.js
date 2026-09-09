/**
 * 兵力/图鉴查看界面
 */
import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import { saveSystem } from '../../system/saveSystem.js';
import { MILITARY } from '../../data/military.js';
import { MILITARY_UNIT } from '../../data/military_unit.js';
import { MILITARY_SKILL } from '../../data/military_skill.js';
import { MILITARY_TRANSLATE } from '../../data/military_translate.js';
import { MILITARY_TERM } from '../../data/military_term.js';
import { MILITARY_BUFF } from '../../data/military_buff.js';
import { get } from '../../system/i18n.js';
import { TECH_TREE } from '../../data/tech_tree.js';

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
          name: MILITARY_UNIT[unitKey].name,
          type: MILITARY_UNIT[unitKey].type,
          id: id,
          image: MILITARY_UNIT[unitKey].image,
          current_stats: soldier.stats,
          current_equipments: soldier.equipments,
          current_ability: soldier.ability,
          current_learned_skills: soldier.learnedSkills ?? {}, // 已学习技能池（含未携带的），供详情页展示
          level: soldier.level ?? 1,   // 士兵等级，默认1
          fromArmy: true,              // 区分兵力表和图鉴
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

    container.add([bg, border, imageObj, nameBg, nameText]);

    // 5. 交互：点击打开详情页
    bg.setInteractive({ useHandCursor: true });

    bg.on('pointerover', () => {
      border.setStrokeStyle(2, 0xffff00);
      container.setScale(1.02);
    });
    bg.on('pointerout', () => {
      border.setStrokeStyle(2, 0x88aa88);
      container.setScale(1);
    });
    bg.on('pointerdown', () => {
      UnitDetailPage.openWithLoader(this.scene, this.saveData, key, soldier);
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

    // 4. 交互：点击打开详情页
    bg.setInteractive({ useHandCursor: true });

    bg.on('pointerover', () => {
      border.setStrokeStyle(2, 0xffff00);
      container.setScale(1.02);
    });
    bg.on('pointerout', () => {
      border.setStrokeStyle(2, 0x888888);
      container.setScale(1);
    });
    bg.on('pointerdown', () => {
      UnitDetailPage.openWithLoader(this.scene, this.saveData, key, unit);
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

// ─────────────────────────────────────────────────────────────────────────────
// MilitarySkillViewer — 技能图鉴：展示所有主动技能。
// 显示方式和 MilitaryUnitViewer 保持一致：同样的标题/退出按钮样式、同样的卡片网格布局
// （cardWidth/cardHeight/spacing/margin 完全复用同一份 config），卡片本身也是
// "背景+边框+底部名字条+图片区"的同一套视觉语言，悬浮同样是描边变黄+放大。
// 差异只在于：技能图标没有像兵组图片那样预先加载成 Phaser 纹理，所以用 DOM <img>
// 展示（做法和战斗界面 battleSystem.js、UnitDetailPage._buildSkillGrid 里的技能图标一致）；
// 悬浮卡片时额外弹出一个描述浮窗，方便"查看"技能效果。
// ─────────────────────────────────────────────────────────────────────────────

export class MilitarySkillViewer {
  constructor(scene, saveData, name) {
    this.scene = scene;
    this.saveData = saveData;
    this.mainContainer = null;
    this.tooltip = null;
    this.title = name;

    // 配置参数（和 MilitaryUnitViewer 保持一致的卡片尺寸/间距，视觉上是同一套列表）
    this.config = {
      cardWidth: 150,
      cardHeight: 200,
      spacing: 20,
      sideMargin: 80,
      topMargin: 120,
      bottomMargin: 40,
      scrollBarWidth: 10,
    };

    // 滚动状态（技能数量超出一屏时用，见 showSkillList/_createScrollBar/onMouseWheel）
    this.maxScroll = 0;
    this.currentScrollY = 0;

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

    // 内容容器
    this.contentContainer = this.scene.add.container(0, 0);
    this.mainContainer.add(this.contentContainer);

    // 直接展示全部主动技能（不像兵力表/图鉴那样需要切换 Tab——只有一类内容）
    this.showSkillList();

    // 注册全局滚轮事件（技能数量超出一屏时支持上下滚动，和 MilitarySystem 的做法一致）
    this.scene.input.on('wheel', this.onMouseWheel, this);
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

  /**
   * 展示所有"主动技能"。判定逻辑和 UnitDetailPage._getSkillsByType('initiative') /
   * battleSystem.js 里挑选技能的逻辑保持一致：type 为 'initiative'，或者没有标注
   * type 字段的技能（默认视为主动技能）。
   * 技能数量超出一屏高度时支持上下滚动（遮罩 + 滚轮 + 可拖拽滚动条），做法和
   * military_ui.js 里 MilitarySystem.createScrollableContent 完全一致。
   */
  showSkillList() {
    this.contentContainer.removeAll(true);
    this._destroyScrollBar();
    if (this._maskShape) { this._maskShape.destroy(); this._maskShape = null; }
    // 技能图标是 DOM 元素，Phaser 的遮罩/setMask 对 DOM 元素完全无效（遮罩只裁剪
    // WebGL/Canvas 渲染的内容，DOM 元素是浏览器原生节点、叠在 canvas 上层，不受
    // Phaser 渲染管线控制），所以滚动时图标会"穿透"遮罩、飘在标题栏之类的区域上。
    // 这里改成手动裁剪：记录每张图标自身（不是整张卡片）的可视范围，滚动时用
    // _updateIconClipping 根据是否落在遮罩范围内手动显隐/裁剪，模拟出裁剪效果，
    // 具体做法见 _updateIconClipping 的注释。
    this._skillIconDoms = [];

    const { width, height } = this.scene.scale;
    const { cardWidth, cardHeight, spacing, sideMargin, topMargin, bottomMargin } = this.config;

    const skills = Object.entries(MILITARY_SKILL).filter(
      ([, skill]) => (skill.type ?? 'initiative') === 'initiative'
    );

    if (skills.length === 0) {
      const noDataText = this.scene.add.text(width / 2, topMargin + 100, '暂无主动技能', {
        fontSize: '24px', color: '#999999'
      }).setOrigin(0.5);
      this.contentContainer.add(noDataText);
      this.maxScroll = 0;
      return;
    }

    // 计算网格布局（和 MilitaryUnitViewer.showGlossary 完全一样的算法）
    const availableWidth = width - sideMargin * 2;
    let cols = Math.floor((availableWidth + spacing) / (cardWidth + spacing));
    if (cols < 1) cols = 1;

    const totalRowWidth = cols * cardWidth + (cols - 1) * spacing;
    const startX = sideMargin + (availableWidth - totalRowWidth) / 2 + cardWidth / 2;
    const startY = topMargin + cardHeight / 2;

    let lastY = startY;
    skills.forEach(([key, skill], index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);

      const x = startX + col * (cardWidth + spacing);
      const y = startY + row * (cardHeight + spacing);

      this.createSkillCard(key, skill, x, y);
      lastY = y + cardHeight / 2;
    });

    // ── 滚动支持：内容超出一屏高度时，遮罩只显示 topMargin 以下区域，
    //    并根据内容总高度算出最大可滚动距离，配合滚轮/滚动条使用 ──
    this.contentHeight = lastY + bottomMargin;
    this.viewportHeight = height;
    this.maxScroll = Math.max(0, this.contentHeight - this.viewportHeight);
    this.currentScrollY = 0;
    this.contentContainer.setY(0);

    const maskShape = this.scene.make.graphics();
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(0, topMargin - 10, width, height - topMargin + 10);
    this.contentContainer.setMask(maskShape.createGeometryMask());
    this._maskShape = maskShape;

    if (this.maxScroll > 0) {
      this._createScrollBar();
    }

    // 初始状态（scrollY=0）也要跑一次，处理卡片本来就有一部分超出可视区域的情况
    this._updateIconClipping();
  }

  /**
   * 手动裁剪技能图标（DOM 元素不受 Phaser 遮罩影响，见 showSkillList 里的说明）。
   *
   * 完全滚出可视范围的图标用 dom.setVisible(false) 整体隐藏——这里必须用 Phaser
   * GameObject 自己的 setVisible，而不是直接改 dom.node.style.display：Phaser 每帧
   * 渲染 DOM 元素时都会用 GameObject.visible 重新同步一次 style.display，直接改
   * style.display 下一帧就会被覆盖回来（实测验证过，和之前透明度那个坑同一个原因）。
   *
   * 但 setVisible 只能整体显隐一整张图标，没法只裁掉超出遮罩的那一部分像素——当某张
   * 图标刚好卡在遮罩边缘、只有一半在可视范围内时，如果只做整体显隐，那张图标会整个
   * 显示出来，超出遮罩的那部分就会"糊"到标题栏之类的区域上，看起来像遮罩完全没生效。
   * 所以边缘位置的图标额外用 clip-path 精确裁掉超出部分——Phaser 每帧只会同步
   * display/opacity/zIndex/pointerEvents/transform 等属性，不会碰 clip-path，可以放心
   * 手动控制，不会被覆盖。
   */
  _updateIconClipping() {
    if (!this._skillIconDoms || this._skillIconDoms.length === 0) return;

    const { topMargin } = this.config;
    const { height } = this.scene.scale;
    const maskTop = topMargin - 10;   // 和 showSkillList 里遮罩矩形的起始 y 保持一致
    const maskBottom = height;
    const offset = this.currentScrollY;

    this._skillIconDoms.forEach(({ dom, el, top, bottom, state }) => {
      if (state?.failed) return; // 素材加载失败的图标一直保持隐藏，不参与裁剪逻辑

      const screenTop = top - offset;
      const screenBottom = bottom - offset;
      const fullyOutside = screenBottom <= maskTop || screenTop >= maskBottom;

      if (fullyOutside) {
        dom.setVisible(false);
        return;
      }

      dom.setVisible(true);
      const clipTop = Math.max(0, maskTop - screenTop);
      const clipBottom = Math.max(0, screenBottom - maskBottom);
      el.style.clipPath = (clipTop > 0 || clipBottom > 0)
        ? `inset(${clipTop}px 0px ${clipBottom}px 0px)`
        : '';
    });
  }

  /**
   * 创建右侧可拖拽滚动条（轨道+滑块），和 MilitarySystem.createScrollBar 做法一致。
   */
  _createScrollBar() {
    const { width, height } = this.scene.scale;
    const { topMargin, bottomMargin, scrollBarWidth } = this.config;

    const trackHeight = height - topMargin - bottomMargin;
    const trackX = width - 20;
    const trackY = topMargin;

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
      this.contentContainer.y = -this.currentScrollY;
      this._updateIconClipping();
    });
  }

  _destroyScrollBar() {
    if (this.scrollTrack) { this.scrollTrack.destroy(); this.scrollTrack = null; }
    if (this.scrollThumb) { this.scrollThumb.destroy(); this.scrollThumb = null; }
    this.scrollThumbHeight = null;
    this.scrollTrackHeight = null;
    this.scrollTrackY = null;
  }

  onMouseWheel(pointer, gameObjects, deltaX, deltaY, deltaZ) {
    if (!this.maxScroll || this.maxScroll <= 0) return;
    const scrollSpeed = 0.5;
    this.currentScrollY += deltaY * scrollSpeed;
    this.currentScrollY = Phaser.Math.Clamp(this.currentScrollY, 0, this.maxScroll);
    this.contentContainer.y = -this.currentScrollY;
    this._updateIconClipping();

    if (this.scrollThumb) {
      const minY = this.scrollTrackY + this.scrollThumbHeight / 2;
      const maxY = this.scrollTrackY + this.scrollTrackHeight - this.scrollThumbHeight / 2;
      const ratio = this.currentScrollY / this.maxScroll;
      this.scrollThumb.y = minY + (maxY - minY) * ratio;
    }
  }

  /**
   * 创建单个技能卡片——布局/配色和 MilitaryUnitViewer.createUnitCard（兵种图鉴）保持一致：
   * 卡片底色+边框、底部名字条、上方图片区域；悬浮描边变黄+放大，并弹出技能描述浮窗。
   */
  createSkillCard(key, skill, x, y) {
    const { cardWidth, cardHeight } = this.config;
    const container = this.scene.add.container(x, y);

    // 1. 卡片背景与边框
    const bg = this.scene.add.rectangle(0, 0, cardWidth, cardHeight, 0x333333);
    const border = this.scene.add.rectangle(0, 0, cardWidth, cardHeight).setStrokeStyle(2, 0x888888);

    // 2. 名字区域
    const nameBgHeight = cardHeight * 0.15;
    const nameY = (cardHeight / 2) - (nameBgHeight / 2);
    const nameBg = this.scene.add.rectangle(0, nameY, cardWidth, nameBgHeight, 0x000000, 0.8);

    let displayName = skill.name ?? key;
    try { displayName = get.militaryTranslation(skill.name) || skill.name; } catch (e) { }

    const nameText = this.scene.add.text(0, nameY, displayName, {
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold',
      padding: { top: 4 },
    }).setOrigin(0.5);

    // 3. 图片区域——技能图标不像兵组图片那样预先加载成 Phaser 纹理，改用 DOM <img>
    // 直接读取 assets/military/skill/{key}.png（和战斗界面里的技能图标同一份素材）。
    // 图标故意用 pointer-events:auto 让它自己接管鼠标事件，而不是 pointer-events:none
    // 指望"穿透"给下层 canvas——实测 DOM 元素本来就渲染在 canvas 上层，鼠标放上去
    // 下层 Phaser 对象完全收不到事件（不会高亮、光标也不会变），所以让图标自己可交互，
    // 用自己的 cursor:pointer 保证光标正确，再把 mouseenter/mouseleave 转发成 bg 上
    // 已经注册好的 pointerover/pointerout，让悬浮在图标像素上和悬浮在卡片其它区域表现一致。
    const imageAreaHeight = cardHeight - nameBgHeight;
    const imageCenterY = -nameBgHeight / 2;
    const imgSize = Math.min(cardWidth, imageAreaHeight) - 16;

    const noImgText = this.scene.add.text(0, imageCenterY, 'NO IMAGE', {
      fontSize: '12px', color: '#666'
    }).setOrigin(0.5).setVisible(false);

    const iconEl = document.createElement('img');
    iconEl.src = `assets/military/skill/${key}.png`;
    iconEl.style.cssText = `width:${imgSize}px;height:${imgSize}px;object-fit:contain;display:block;pointer-events:auto;cursor:pointer;`;
    const iconDom = this.scene.add.dom(0, imageCenterY, iconEl).setDepth(1101);
    // 图标状态：素材加载失败时要一直隐藏，不能被 _updateIconClipping 按滚动位置重新显示出来
    const iconState = { failed: false };
    iconEl.onerror = () => {
      iconState.failed = true;
      noImgText.setVisible(true);
      // 隐藏失败的图标要用 GameObject 的 setVisible，不能直接改 iconEl.style.display——
      // Phaser 每帧都会把 DOM 元素的 display 从 GameObject.visible 重新同步回来，直接
      // 改 style.display 下一帧就被覆盖失效了（和之前透明度那个坑同一个原因）
      iconDom.setVisible(false);
    };

    // 登记进裁剪列表：top/bottom 用图标本身（不是整张卡片）在 contentContainer 局部
    // 坐标系里的范围，供 _updateIconClipping 按滚动位置精确裁剪
    const iconTop = y + imageCenterY - imgSize / 2;
    const iconBottom = y + imageCenterY + imgSize / 2;
    this._skillIconDoms.push({ dom: iconDom, el: iconEl, top: iconTop, bottom: iconBottom, state: iconState });

    container.add([bg, border, iconDom, noImgText, nameBg, nameText]);

    // 4. 交互：悬浮描边变黄+放大，并弹出技能描述浮窗（兵种卡片点击是打开详情页，
    //    但技能没有那么多结构化数据，所以用悬浮浮窗展示描述，和游戏里其它技能提示的做法一致）
    bg.setInteractive({ useHandCursor: true });

    bg.on('pointerover', () => {
      border.setStrokeStyle(2, 0xffff00);
      container.setScale(1.02);
      this._showSkillTip(skill);
    });
    bg.on('pointerout', () => {
      border.setStrokeStyle(2, 0x888888);
      container.setScale(1);
      this._hideSkillTip();
    });

    // 图标是独立的、自己接管鼠标事件的 DOM 元素，转发成同名事件触发上面已经注册好的处理逻辑
    iconEl.addEventListener('mouseenter', () => bg.emit('pointerover'));
    iconEl.addEventListener('mouseleave', () => bg.emit('pointerout'));

    // 图标接管了鼠标事件后，滚轮事件也会被它截走、传不到下层 canvas，导致 Phaser 全局
    // 注册的 wheel 监听收不到——鼠标放在技能图片上时滚轮会失效。这里把原生 wheel 事件
    // 直接转发给 onMouseWheel（deltaY 语义和 Phaser 的 wheel 事件一致），并阻止默认的
    // 页面滚动行为。
    iconEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.onMouseWheel(null, null, 0, e.deltaY, 0);
    }, { passive: false });

    this.contentContainer.add(container);
  }

  /**
   * 技能描述浮窗：名称（+等级）、魔力消耗（如果有）、效果描述。
   * 改用 DOM 元素而不是 Phaser Rectangle+Text——DOM 元素（技能图标）始终渲染在
   * canvas 上层，浮窗如果用 canvas 画（Rectangle/Text），一旦位置和某张卡片的
   * 技能图标重叠，就会被那张图标盖在上面，视觉上"浮窗消失了"。改成 DOM 之后浮窗
   * 和图标在同一层，通过创建顺序保证浮窗在最后添加、显示在最上面，不会被盖住。
   * 深色底+金边的样式，和游戏里其它技能提示浮窗（UnitDetailPage._showTip）风格统一。
   */
  _showSkillTip(skill) {
    this._hideSkillTip();

    const titleLine = skill.level != null ? `${skill.name}   Lv.${skill.level}` : (skill.name ?? '');
    const bodyLines = [];
    if (skill.cost?.mana != null) bodyLines.push(`消耗魔力：${skill.cost.mana}`);
    if (skill.des) bodyLines.push(skill.des);

    const div = document.createElement('div');
    div.style.cssText = [
      'width:240px',
      'background:rgba(17,17,34,0.95)',
      'border:1px solid #b8963e',
      'border-radius:4px',
      'padding:10px',
      'box-sizing:border-box',
      'font-family:sans-serif',
      'pointer-events:none', // 浮窗本身不需要接收鼠标事件，避免干扰卡片的悬浮判定
    ].join(';');

    const titleEl = document.createElement('div');
    titleEl.style.cssText = 'color:#ffcc44;font-size:14px;font-weight:bold;margin-bottom:6px;word-break:break-all;';
    titleEl.textContent = titleLine;
    div.appendChild(titleEl);

    if (bodyLines.length > 0) {
      const bodyEl = document.createElement('div');
      bodyEl.style.cssText = 'color:#cccccc;font-size:13px;word-break:break-all;line-height:1.5;white-space:pre-line;';
      bodyEl.textContent = bodyLines.join('\n');
      div.appendChild(bodyEl);
    }

    this.tooltip = this.scene.add.dom(0, 0, div).setDepth(2000);

    // 用全局 mousemove（document 级）驱动浮窗位置，而不是 Phaser 的 pointermove——
    // 技能图标自己接管了鼠标事件（见 createSkillCard），悬浮在图标像素上时 Phaser
    // 收不到原生 canvas 事件，只监听 Phaser pointermove 会导致浮窗在图标区域卡住不动。
    // rAF 节流到每帧最多更新一次位置，避免高频重绘。
    let pendingX = 0, pendingY = 0;
    let rafScheduled = false;
    const applyPosition = () => {
      rafScheduled = false;
      if (!this.tooltip) return;
      this._positionSkillTip(pendingX, pendingY);
    };
    this._tipMouseMove = (e) => {
      const canvas = this.scene.game.canvas;
      const rect = canvas.getBoundingClientRect();
      pendingX = e.clientX - rect.left;
      pendingY = e.clientY - rect.top;
      if (!rafScheduled) {
        rafScheduled = true;
        requestAnimationFrame(applyPosition);
      }
    };
    document.addEventListener('mousemove', this._tipMouseMove);

    // 初始位置：用当前指针位置，拿不到就先放在原点，下一帧 mousemove 会立刻纠正
    const p = this.scene.input.activePointer;
    this._positionSkillTip(p?.x ?? 0, p?.y ?? 0);
  }

  _positionSkillTip(px, py) {
    if (!this.tooltip) return;
    const { width, height } = this.scene.scale;
    const node = this.tooltip.node;

    // 直接读取浮窗真实渲染尺寸（浏览器已自动布局好）
    const w = node.offsetWidth || 240;
    const h = node.offsetHeight || 60;

    let tx = px + 16 + w / 2;
    let ty = py + 16 + h / 2;
    if (tx + w / 2 > width - 8) tx = px - 16 - w / 2;
    if (ty + h / 2 > height - 8) ty = py - 16 - h / 2;
    if (tx - w / 2 < 8) tx = 8 + w / 2;
    if (ty - h / 2 < 8) ty = 8 + h / 2;

    this.tooltip.setPosition(tx, ty);
  }

  _hideSkillTip() {
    if (this._tipMouseMove) {
      document.removeEventListener('mousemove', this._tipMouseMove);
      this._tipMouseMove = null;
    }
    if (this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = null;
    }
  }

  destroy() {
    this.scene.input.off('wheel', this.onMouseWheel, this);
    this._hideSkillTip();
    this._destroyScrollBar();
    if (this._maskShape) { this._maskShape.destroy(); this._maskShape = null; }
    if (this.mainContainer) this.mainContainer.destroy();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UnitDetailPage — 单个兵力的全屏详情页
// 点击兵力卡后打开，覆盖在列表页之上，关闭后回到列表页
// ─────────────────────────────────────────────────────────────────────────────

const DETAIL_DEPTH = 1200;
const DETAIL_BG = 0x12111e;
const DETAIL_PANEL = 0x1e1d2e;
const DETAIL_THEME = 0xffd700;

const STAT_KEYS = [
  'physical_attack',
  'spell_attack',
  'hp',
  'armor',
  'mana',
  'military_order',
];

class UnitDetailPage {
  /**
   * 静态入口：先显示加载遮罩和进度条，待所有图片加载完毕后再打开详情页。
   * 全程屏幕不可点击。
   */
  static openWithLoader(scene, saveData, unitKey, unitData) {
    const { width, height } = scene.scale;

    // 遮罩
    const loaderOverlay = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75)
      .setDepth(2000).setInteractive();

    // 进度条背景
    const barW = 320, barH = 16;
    const barBg = scene.add.rectangle(width / 2, height / 2 + 20, barW, barH, 0x333333, 1).setDepth(2001);
    const barFg = scene.add.rectangle(width / 2 - barW / 2, height / 2 + 20, 0, barH, 0xb8963e, 1)
      .setOrigin(0, 0.5).setDepth(2002);
    const loadTxt = scene.add.text(width / 2, height / 2 - 10, '加载中...', {
      fontSize: '18px', color: '#f0e6cc', padding: { top: 4 },
    }).setOrigin(0.5).setDepth(2001);

    // 收集需要加载的图片 key
    const keysToLoad = [];
    const tmpl = MILITARY_UNIT[unitKey];

    if (tmpl?.type) keysToLoad.push(`soldier_type_${tmpl.type}`);
    for (const tab of ['info', 'equip', 'train']) {
      keysToLoad.push(`tab_${tab}_select`, `tab_${tab}_unselect`);
    }
    for (const stat of STAT_KEYS) keysToLoad.push(`stat_${stat}`);
    keysToLoad.push(`soldier_${unitKey}`);
    keysToLoad.push('military_bg');

    // 过滤出真正还没加载的
    const toLoad = keysToLoad.filter(k => !scene.textures.exists(k));

    const destroyLoader = () => {
      loaderOverlay.destroy(); barBg.destroy(); barFg.destroy(); loadTxt.destroy();
    };

    const open = () => {
      destroyLoader();
      new UnitDetailPage(scene, saveData, unitKey, unitData);
    };

    if (toLoad.length === 0) { open(); return; }

    let loaded = 0;
    const onDone = () => {
      loaded++;
      barFg.setDisplaySize(barW * (loaded / toLoad.length), barH);
      if (loaded >= toLoad.length) {
        scene.load.off('filecomplete', onDone);
        scene.load.off('loaderror', onDone);
        open();
      }
    };
    scene.load.on('filecomplete', onDone);
    scene.load.on('loaderror', onDone);  // 加载失败也继续，不卡死

    // 需要的图片逐一加入 Phaser loader（只加未加载的）
    const pathMap = {};
    if (tmpl?.type) pathMap[`soldier_type_${tmpl.type}`] = `assets/military/soldier_type/${tmpl.type}.png`;
    for (const tab of ['info', 'equip', 'train']) {
      pathMap[`tab_${tab}_select`] = `assets/military/ui/${tab}_select.png`;
      pathMap[`tab_${tab}_unselect`] = `assets/military/ui/${tab}_unselect.png`;
    }
    for (const stat of STAT_KEYS) pathMap[`stat_${stat}`] = `assets/military/ui/${stat}.png`;
    if (tmpl?.image) pathMap[`soldier_${unitKey}`] = tmpl.image;
    pathMap['military_bg'] = 'assets/background/military_bg.jpg';

    toLoad.forEach(k => { if (pathMap[k]) scene.load.image(k, pathMap[k]); });
    scene.load.start();
  }
  /**
   * @param {Phaser.Scene} scene
   * @param {Object}       saveData
   * @param {string}       unitKey   — MILITARY_UNIT 里的 key
   * @param {Object}       unitData  — 已整合的展示数据（含 name/image/type 等）
   */
  constructor(scene, saveData, unitKey, unitData) {
    this.scene = scene;
    this.saveData = saveData;
    this.unitKey = unitKey;
    this.unitData = unitData;
    // 从配置表取基础模板（basic_stats / special_ability 等）
    this.template = MILITARY_UNIT[unitKey] ?? unitData;
    this.tooltip = null;
    this.currentTab = 'info';

    this._build();
  }

  // ── 主框架 ─────────────────────────────────────
  _build() {
    const { width, height } = this.scene.scale;

    // 全屏遮罩（阻止穿透到下层列表）
    this.overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.82)
      .setDepth(DETAIL_DEPTH).setInteractive();

    // 根容器
    this.root = this.scene.add.container(width / 2, height / 2).setDepth(DETAIL_DEPTH + 1);

    // 全屏背景（参考图羊皮纸色调）
    const bg = this.scene.add.rectangle(0, 0, width, height, 0xf0e6cc, 0.97);
    this.root.add(bg);

    // 背景图片（Phaser image，cover居中，不遮挡Canvas内容）
    // 需要在 gameScene.preload 中加载 'military_bg'
    if (this.scene.textures.exists('military_bg')) {
      const bgImg = this.scene.add.image(0, 0, 'military_bg');
      const scaleX = width / bgImg.width;
      const scaleY = height / bgImg.height;
      bgImg.setScale(Math.max(scaleX, scaleY)).setOrigin(0.5);
      this.root.add(bgImg);
    }

    // 布局常量
    const IMG_W = width * 0.30;
    const TAB_W = 72;
    const INFO_W = width - IMG_W - TAB_W;
    this._w = width; this._h = height;
    this._IMG_W = IMG_W; this._INFO_W = INFO_W; this._TAB_W = TAB_W;

    // 左侧图片（常驻）
    this._buildImagePanel(IMG_W, height);

    // 右侧 tab 条
    this._buildTabBar(IMG_W, TAB_W, height);

    // 中间信息区容器（可切换）
    const infoX = -width / 2 + IMG_W + INFO_W / 2;
    this._infoContainer = this.scene.add.container(infoX, 0);
    this.root.add(this._infoContainer);
    this._renderInfoTab();

    // 右上角关闭按钮
    this._buildCloseBtn(width, height);

    // 淡入
    this.root.setAlpha(0);
    this.overlay.setAlpha(0);
    this.scene.tweens.add({ targets: [this.root, this.overlay], alpha: 1, duration: 160 });
  }

  // ── 左侧图片区 ─────────────────────────────────
  _buildImagePanel(imgW, H) {
    const x = -this._w / 2 + imgW / 2;
    const absx = this._w / 2 - this._TAB_W - this._INFO_W + imgW / 2;  // canvas绝对x（从center）
    // Phaser dom坐标是相对于scene中心，convert to canvas-space
    const canvasW = this._w, canvasH = this._h;

    // 分隔线
    this.root.add(this.scene.add.rectangle(x + imgW / 2, 0, 1, H, 0xb8963e, 0.3));

    // 兵组图片（HTML img，object-fit:contain，等比例缩小，在边框内居中）
    const imgSrc = this.template?.image;

    // ── 固定 4:3 宽高比（宽优先，高度由比例推算，不受屏幕高度影响）──
    const RATIO = 4 / 3;          // 高/宽 比例（宽3:高4 → ratio≈1.33）
    const MARGIN = 40;              // 左右边距留白
    const qMaxW = imgW - MARGIN;   // 边框宽度（以左侧面板宽为基准）
    const qMaxH = Math.round(qMaxW * RATIO);  // 高度由比例推算，固定不变

    // 确保不超出屏幕可用高度（type图标 + 边距）
    const maxAllowedH = H - 80;
    const finalW = qMaxH > maxAllowedH
      ? Math.round(maxAllowedH / RATIO)
      : qMaxW;
    const finalH = Math.round(finalW * RATIO);

    // ── 距屏幕顶端的百分比（调整这个值改变整体垂直位置）──
    const topRatio = 0.03;   // 整体顶边距屏幕顶端的比例（0.08 = 8%）
    // imgY 是相对于屏幕中心的坐标，由百分比推算
    const imgY = H * topRatio + finalH / 2 - H / 2;
    // ── 图片相对边框的缩放比例（保持等比例） ──
    const scale = 0.9;
    const picW = Math.round(finalW * scale);
    const picH = Math.round(finalH * scale);

    if (imgSrc) {
      const el2 = document.createElement('img');
      el2.src = imgSrc;
      el2.style.cssText = `width:${picW}px;height:${picH}px;object-fit:contain;display:block;`;
      const dom2 = this.scene.add.dom(x, imgY, el2).setDepth(DETAIL_DEPTH + 2);
      this.root.add(dom2);
    } else {
      this.root.add(this.scene.add.text(x, imgY, this.template?.name ?? '?', {
        fontSize: '20px', color: '#8a7a5a', align: 'center', padding: { top: 4 },
      }).setOrigin(0.5));
    }

    // 品质边框（固定比例，和图片同中心点）
    const quality = this.template?.quality ?? 'normal';
    const qEl = document.createElement('img');
    qEl.src = `assets/military/ui/quality_${quality}.png`;
    qEl.style.cssText = `width:${finalW}px;height:${finalH}px;object-fit:fill;display:block;pointer-events:none;`;
    qEl.onerror = () => { qEl.style.display = 'none'; };
    const qDom = this.scene.add.dom(x, imgY, qEl).setDepth(DETAIL_DEPTH + 3);
    this.root.add(qDom);

  }

  // ── 右侧 Tab 条（上图标下文字）────────────────
  _buildTabBar(imgW, tabW, H) {
    const rx = this._w / 2 - tabW / 2;
    const tabs = this.unitData.fromArmy ? ['info', 'equip'] : ['info', 'equip', 'train'];
    const labels = { info: '信息', equip: '装备', train: '训练' };
    const tabH = 76;
    const startY = -H / 2 + 120;   // 从120开始，避开右上角关闭按钮

    this._tabObjects = {};

    tabs.forEach((tab, i) => {
      const ty = startY + i * (tabH + 6);
      const active = tab === this.currentTab;

      const tbg = this.scene.add.rectangle(rx, ty, tabW - 4, tabH, active ? 0x2a1a00 : 0xf0e6cc, 0.95)
        .setStrokeStyle(1.5, active ? 0xb8963e : 0xc8a86e, 1)
        .setInteractive({ useHandCursor: true });

      // 图标（上方，HTML img object-fit:contain 28px）
      const iconKey = `tab_${tab}_${active ? 'select' : 'unselect'}`;
      const iconSrc = `assets/military/ui/${tab}_${active ? 'select' : 'unselect'}.png`;
      const iconEl = document.createElement('img');
      iconEl.src = iconSrc;
      iconEl.style.cssText = 'width:28px;height:28px;object-fit:contain;display:block;pointer-events:none;cursor:pointer;';
      const iconDom = this.scene.add.dom(rx, ty - 18, iconEl).setDepth(DETAIL_DEPTH + 2);
      let iconObj = iconDom;

      // 文字（下方）
      const tlbl = this.scene.add.text(rx, ty + 18, labels[tab], {
        fontSize: '13px', color: active ? '#f0e6cc' : '#6b4c1e',
        fontStyle: active ? 'bold' : 'normal', padding: { top: 4 },
      }).setOrigin(0.5);

      tbg.on('pointerover', () => tbg.setAlpha(0.8));
      tbg.on('pointerout', () => tbg.setAlpha(1));
      tbg.on('pointerdown', () => { if (tab !== this.currentTab) this._switchTab(tab); });

      const objects = [tbg, tlbl];
      if (iconObj) objects.push(iconObj);
      this.root.add(objects);
      this._tabObjects[tab] = { tbg, tlbl, iconObj, tab };
    });
  }

  // ── 关闭按钮 ───────────────────────────────────
  _buildCloseBtn(W, H) {
    const cx = W / 2 - 40;
    const cy = -H / 2 + 40;
    const hit = this.scene.add.circle(cx, cy, 22, 0xff0000, 0)
      .setInteractive({ useHandCursor: true });
    const txt = this.scene.add.text(cx, cy, '✕', {
      fontSize: '28px', color: '#ff4444', fontStyle: 'bold',
      padding: { top: 4 },
    }).setOrigin(0.5);
    hit.on('pointerover', () => txt.setColor('#ffaaaa'));
    hit.on('pointerout', () => txt.setColor('#ff4444'));
    hit.on('pointerdown', () => this.destroy());
    this.root.add([hit, txt]);
  }

  // ── Tab 切换 ───────────────────────────────────
  _switchTab(tab) {
    this.currentTab = tab;
    for (const [t, obj] of Object.entries(this._tabObjects)) {
      const active = t === tab;
      obj.tbg.setFillStyle(active ? 0x2a1a00 : 0xf0e6cc, 0.95);
      obj.tbg.setStrokeStyle(1.5, active ? 0xb8963e : 0xc8a86e, 1);
      obj.tlbl.setColor(active ? '#f0e6cc' : '#6b4c1e');
      obj.tlbl.setFontStyle(active ? 'bold' : 'normal');
      // 切换图标纹理（直接修改 img src）
      if (obj.iconObj?.node) {
        obj.iconObj.node.src = `assets/military/ui/${t}_${active ? 'select' : 'unselect'}.png`;
      }
    }
    this._infoContainer.removeAll(true);
    if (tab === 'info') this._renderInfoTab();
    else if (tab === 'equip') this._renderEquipTab();
    else if (tab === 'train') this._renderTrainTab();
  }

  // ── 信息 Tab ───────────────────────────────────
  _renderInfoTab() {
    const c = this._infoContainer;
    const W = this._INFO_W - 16;
    const H = this._h;
    const pad = 20;
    let y = -H / 2 + pad;
    const t = this.template;

    if (!t) {
      c.add(this.scene.add.text(0, 0, '暂无数据', { fontSize: '18px', color: '#888', padding: { top: 4 } }).setOrigin(0.5));
      return;
    }

    // ── 兵力名（左侧type图标 + 名字）────────────
    const unitName = t.name ?? this.unitData?.name ?? '未知';
    const nameIconSize = 40;
    const nameY = y + nameIconSize / 2;

    // type 图标（DOM img，名字左侧，坐标相对_infoContainer）
    if (t.type) {
      const icEl = document.createElement('img');
      icEl.src = `assets/military/soldier_type/${t.type}.png`;
      icEl.style.cssText = `width:${nameIconSize}px;height:${nameIconSize}px;object-fit:contain;display:block;pointer-events:none;`;
      c.add(this.scene.add.dom(-W / 2 + nameIconSize / 2, nameY, icEl).setDepth(DETAIL_DEPTH + 2));
    }

    const nameOffsetX = t.type ? nameIconSize + 8 : 0;
    c.add(this.scene.add.text(-W / 2 + nameOffsetX, y, unitName, {
      fontSize: '32px', color: '#2c1a00', fontStyle: 'bold', padding: { top: 4 },
    }).setOrigin(0, 0));
    y += 46;

    // ── 分隔线 ───────────────────────────────────
    const divider = (dy) => {
      c.add(this.scene.add.rectangle(0, dy, W, 1, 0xb8963e, 0.4));
    };
    divider(y); y += 14;

    // ── 基础属性 ─────────────────────────────────
    c.add(this._sectionTitle('基础属性', y));
    y += 28;

    const stats = t.basic_stats ?? {};
    const extra = Object.keys(stats).filter(k => !STAT_KEYS.includes(k));
    const allStatKeys = [...STAT_KEYS, ...extra];
    const ROW_H = 42;
    const statRows = Math.ceil(allStatKeys.length / 2);
    const statH = statRows * ROW_H + 8;   // 按实际行数计算，不占用固定比例
    this._buildStatArea(c, t, -W / 2, y, W, statH);
    y += statH + 14;
    divider(y); y += 14;

    // ── 被动技能 ─────────────────────────────────
    c.add(this._sectionTitle('被动技能', y));
    y += 28;

    const passiveH = 56;
    const passive = (this._getSkillsByType('passive')[0] ?? null)?.skill ?? null;
    this._buildPassiveArea(c, passive, -W / 2, y, W, passiveH);
    y += passiveH + 14;
    divider(y); y += 14;

    // ── 主动技能四宫格 ────────────────────────────
    // 无 type 的技能默认视为主动技能（initiative）
    c.add(this._sectionTitle('主动技能', y));
    y += 28;

    const actives = this._getSkillsByType('initiative').slice(0, 4);
    const gridH = 100;
    const actualGridH = this._buildSkillGrid(c, actives, -W / 2, y, W, gridH);
    y += actualGridH + 14;

    // ── tag 标签技能（四宫格下方，第三类技能） ────────────────
    const tagSkills = this._getSkillsByType('tag');
    if (tagSkills.length > 0) {
      let tx = -W / 2;
      tagSkills.forEach(({ key, skill }) => {
        const lbl = this.scene.add.text(0, 0, skill.name, {
          fontSize: '13px', color: '#88ee88', padding: { top: 4 },
        }).setOrigin(0.5);
        const tw = lbl.width + 18;
        const tbg = this.scene.add.rectangle(tx + tw / 2, y + 13, tw, 26, 0x1a3020, 0.9)
          .setStrokeStyle(1, 0x55aa55, 0.8);
        lbl.setPosition(tx + tw / 2, y + 13);
        c.add([tbg, lbl]);
        if (skill.des) {
          tbg.setInteractive({ useHandCursor: false });
          tbg.on('pointerover', (ptr) => this._showTip(skill.name, skill.des, ptr));
          tbg.on('pointermove', (ptr) => this._moveTip(ptr));
          tbg.on('pointerout', () => this._hideTip());
        }
        tx += tw + 6;
      });
      y += 26 + 14;
    }

    // ── 已学习未携带技能（学派系统学会、但携带栏已满没能自动带上的技能）───
    // 只在兵力表（查看具体兵组）里有意义，图鉴没有"学会"这个概念
    const learnedNotCarried = this._getLearnedNotCarriedSkills();
    if (learnedNotCarried.length > 0) {
      c.add(this._sectionTitle('已学习未携带', y));
      y += 28;

      let lx = -W / 2;
      let ly = y;
      const rowMaxX = W / 2 - 20; // 超出这行宽度就换到下一行
      learnedNotCarried.forEach(({ key, skill }) => {
        const lbl = this.scene.add.text(0, 0, skill.name, {
          fontSize: '13px', color: '#cccccc', padding: { top: 4 },
        }).setOrigin(0.5);
        const tw = lbl.width + 18;
        if (lx + tw > rowMaxX && lx > -W / 2) {
          lx = -W / 2;
          ly += 32;
        }
        const tbg = this.scene.add.rectangle(lx + tw / 2, ly + 13, tw, 26, 0x2a2a2a, 0.9)
          .setStrokeStyle(1, 0x777777, 0.8);
        lbl.setPosition(lx + tw / 2, ly + 13);
        c.add([tbg, lbl]);
        if (skill.des) {
          tbg.setInteractive({ useHandCursor: false });
          tbg.on('pointerover', (ptr) => this._showTip(skill.name, skill.des, ptr));
          tbg.on('pointermove', (ptr) => this._moveTip(ptr));
          tbg.on('pointerout', () => this._hideTip());
        }
        lx += tw + 6;
      });
      y = ly + 26 + 14;
    }
  }

  /** 居中分区标题（参考图样式：菱形装饰 + 文字） */
  _sectionTitle(text, y) {
    const ct = this.scene.add.container(0, y + 12);
    ct.add(this.scene.add.text(0, 0, `◆ ${text} ◆`, {
      fontSize: '15px', color: '#b8963e', fontStyle: 'bold', padding: { top: 4 },
    }).setOrigin(0.5, 0.5));
    return ct;
  }

  // ── 属性区 ─────────────────────────────────────
  _buildStatArea(ct, t, x, y, w, h) {
    const stats = t.basic_stats ?? {};
    const extra = Object.keys(stats).filter(k => !STAT_KEYS.includes(k));
    const all = [...STAT_KEYS, ...extra];

    const GAP = 8;    // 两框之间的间距
    const COL_W = (w - GAP) / 2;
    const ROW_H = 44;
    const rows = Math.ceil(all.length / 2);
    const contentH = rows * ROW_H;

    // 左框、右框各自的背景
    const leftBg = this.scene.add.rectangle(x + COL_W / 2, y + contentH / 2, COL_W, contentH, 0xf5e8c8, 0.08).setStrokeStyle(1, 0xb8963e, 0.3);
    const rightBg = this.scene.add.rectangle(x + COL_W + GAP + COL_W / 2, y + contentH / 2, COL_W, contentH, 0xf5e8c8, 0.08).setStrokeStyle(1, 0xb8963e, 0.3);
    ct.add([leftBg, rightBg]);

    // 行分隔横线（从第1行之后开始，最后一行不加）
    for (let r = 1; r < rows; r++) {
      const lineY = y + r * ROW_H;
      ct.add(this.scene.add.rectangle(x + COL_W / 2, y + lineY - y, COL_W - 16, 1, 0xb8963e, 0.3));
      ct.add(this.scene.add.rectangle(x + COL_W + GAP + COL_W / 2, y + lineY - y, COL_W - 16, 1, 0xb8963e, 0.3));
    }

    const inner = this.scene.add.container(x, y);
    ct.add(inner);

    all.forEach((key, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      // 左列从x开始，右列从x+COL_W+GAP开始
      const ix = col === 0 ? 0 : COL_W + GAP;
      const iy = row * ROW_H;
      const val = stats[key] ?? 0;
      const label = MILITARY_TRANSLATE[key] ?? key;
      const term = MILITARY_TERM[key];

      // stat 图标（DOM img, 24px contain）
      const iconSrc = `assets/military/ui/${key}.png`;
      const icEl = document.createElement('img');
      icEl.src = iconSrc;
      icEl.style.cssText = 'width:24px;height:24px;object-fit:contain;display:block;pointer-events:none;';
      const domX = x + ix + 16;
      const domY = y + iy + ROW_H / 2;
      ct.add(ct.scene.add.dom(domX, domY, icEl).setDepth(DETAIL_DEPTH + 2));

      // 属性名（小字金棕，图标右侧）
      inner.add(this.scene.add.text(ix + 32, iy + ROW_H / 2, label, {
        fontSize: '14px', color: '#b8963e', padding: { top: 4 },
      }).setOrigin(0, 0.5));

      // 数值（大字深棕，右对齐）
      inner.add(this.scene.add.text(ix + COL_W - 8, iy + ROW_H / 2, String(val), {
        fontSize: '22px', color: '#2c1a00', fontStyle: 'bold', padding: { top: 4 },
      }).setOrigin(1, 0.5));

      // 有术语解释：透明 hitbox 覆盖图标+属性名区域，hover 显示浮窗
      if (term) {
        const hitW = COL_W * 0.65;  // 覆盖图标+属性名，不含数值
        const hitBg = this.scene.add.rectangle(
          x + ix + hitW / 2, y + iy + ROW_H / 2,
          hitW, ROW_H - 4, 0xffffff, 0
        ).setInteractive({ useHandCursor: true });
        ct.add(hitBg);
        hitBg.on('pointerover', (ptr) => this._showTip(label, term.des, ptr));
        hitBg.on('pointermove', (ptr) => this._moveTip(ptr));
        hitBg.on('pointerout', () => this._hideTip());
      }
    });
  }

  // ── 被动技能区 ─────────────────────────────────
  _buildPassiveArea(ct, skill, x, y, w, h) {
    const bg = this.scene.add.rectangle(x + w / 2, y + h / 2, w, h, 0xf5e8c8, 0.06)
      .setStrokeStyle(1, 0xb8963e, 0.2);
    ct.add(bg);

    if (!skill) {
      ct.add(this.scene.add.text(x + w / 2, y + h / 2, '暂无被动技能', {
        fontSize: '14px', color: '#8a7a5a', padding: { top: 4 },
      }).setOrigin(0.5));
      return;
    }

    const passiveLv = skill.level != null ? `${skill.name}   Lv.${skill.level}` : skill.name;
    ct.add(this.scene.add.text(x + 12, y + h / 2 - 10, passiveLv, {
      fontSize: '16px', color: '#2c1a00', fontStyle: 'bold', padding: { top: 4 },
    }).setOrigin(0, 0.5));

    if (skill.des) {
      ct.add(this.scene.add.text(x + 12, y + h / 2 + 12, skill.des, {
        fontSize: '13px', color: '#6b4c1e', padding: { top: 4 },
        wordWrap: { width: w - 24, useAdvancedWrap: true },
      }).setOrigin(0, 0.5));
      bg.setInteractive({ useHandCursor: false });
      bg.on('pointerover', (ptr) => this._showTip(skill.name, skill.des, ptr));
      bg.on('pointermove', (ptr) => this._moveTip(ptr));
      bg.on('pointerout', () => this._hideTip());
    }
  }

  // ── 技能与升级 2列网格 ──────────────────────────
  _buildSkillGrid(ct, actives, x, y, w, gridH) {
    const CELL_W = (w - 8) / 2;
    const CELL_H = Math.max(90, gridH / 2 - 6);
    const ICON_SZ = 58;
    const actualH = 2 * CELL_H + 8;   // 四宫格实际总高（供调用方使用）
    const pos = [
      [x, y],
      [x + CELL_W + 8, y],
      [x, y + CELL_H + 8],
      [x + CELL_W + 8, y + CELL_H + 8],
    ];

    pos.forEach(([cx, cy], i) => {
      const entry = actives[i] ?? null;
      const skill = entry?.skill ?? null;
      const key = entry?.key ?? null;

      const sbg = this.scene.add.rectangle(cx + CELL_W / 2, cy + CELL_H / 2, CELL_W, CELL_H, 0xf5e8c8, 0.08)
        .setStrokeStyle(1, skill ? 0xb8963e : 0x555544, skill ? 0.7 : 0.3);
      ct.add(sbg);

      if (skill) {
        // ── 技能图标（左侧，dom img，object-fit:contain）──
        const iconSrc = `assets/military/skill/${key}.png`;
        const icEl = document.createElement('img');
        icEl.src = iconSrc;
        icEl.style.cssText = `width:${ICON_SZ}px;height:${ICON_SZ}px;object-fit:contain;display:block;pointer-events:none;`;
        icEl.onerror = () => { icEl.style.display = 'none'; };  // 没有图片静默隐藏
        const icDom = this.scene.add.dom(cx + 4 + ICON_SZ / 2, cy + CELL_H / 2, icEl).setDepth(DETAIL_DEPTH + 2);
        ct.add(icDom);

        const textX = cx + ICON_SZ + 10;  // 文字在图标右侧
        const lv = skill.level != null ? `Lv.${skill.level}` : '';

        // 技能名
        ct.add(this.scene.add.text(textX, cy + 10, skill.name, {
          fontSize: '15px', color: '#2c1a00', fontStyle: 'bold', padding: { top: 4 },
          wordWrap: { width: CELL_W - ICON_SZ - 60 },
        }).setOrigin(0, 0));

        // 等级（右上角）
        if (lv) {
          ct.add(this.scene.add.text(cx + CELL_W - 6, cy + 10, lv, {
            fontSize: '13px', color: '#8a7a5a', padding: { top: 4 },
          }).setOrigin(1, 0));
        }

        // 描述
        if (skill.des) {
          ct.add(this.scene.add.text(textX, cy + 34, skill.des, {
            fontSize: '12px', color: '#6b4c1e', padding: { top: 4 },
            wordWrap: { width: CELL_W - ICON_SZ - 16, useAdvancedWrap: true },
          }).setOrigin(0, 0));
        }

        // 状态标签（右下角）
        const statusLabel = '已解锁';
        const sl = this.scene.add.text(cx + CELL_W - 6, cy + CELL_H - 10, statusLabel, {
          fontSize: '12px', color: '#ffffff', padding: { top: 3, bottom: 3, left: 6, right: 6 },
        }).setOrigin(1, 1);
        const slBg = this.scene.add.rectangle(
          cx + CELL_W - 6 - sl.width / 2 - 6, cy + CELL_H - 10 - 10,
          sl.width + 12, 22, 0x3a7a3a, 1
        );
        ct.add([slBg, sl]);

        if (skill.des) {
          sbg.setInteractive({ useHandCursor: false });
          sbg.on('pointerover', (ptr) => this._showTip(skill.name, skill.des, ptr, skill.term));
          sbg.on('pointermove', (ptr) => this._moveTip(ptr));
          sbg.on('pointerout', () => this._hideTip());
        }
      } else {
        ct.add(this.scene.add.text(cx + CELL_W / 2, cy + CELL_H / 2, '—', {
          fontSize: '18px', color: '#3a3a2a', padding: { top: 4 },
        }).setOrigin(0.5));
      }
    });
    return actualH;
  }

  // ── 装备 Tab ───────────────────────────────────
  _renderEquipTab() {
    this._infoContainer.add(this.scene.add.text(0, 0, '装备', {
      fontSize: '18px', color: '#555555', padding: { top: 4 },
    }).setOrigin(0.5));
  }

  // ── 训练 Tab ───────────────────────────────────
  _renderTrainTab() {
    const c = this._infoContainer;
    const W = this._INFO_W - 24;
    const H = this._h;
    const pad = 16;
    let y = -H / 2 + pad;
    const t = this.template;
    const training = t?.training ?? {};
    const saveData = this.saveData;
    const grids = saveData.map?.grids ?? {};

    // 当前选中的主城 gridId（用于人口消耗判断）
    // 存到实例字段，避免每次重新渲染训练 tab（如确认训练后刷新）时被重置
    let selectedMainGn = this._trainSelectedMainGn ?? null;

    // ── 科技要求 ──────────────────────────────────
    const filterTech = t?.filter?.tech ?? {};
    const unlocked = saveData.tech_tree?.unlocked ?? {};
    c.add(this.scene.add.text(-W / 2, y, '科技要求：', {
      fontSize: '14px', color: '#b8963e', fontStyle: 'bold', padding: { top: 4 },
    }).setOrigin(0, 0));
    y += 24;

    if (Object.keys(filterTech).length === 0) {
      c.add(this.scene.add.text(-W / 2 + pad, y, '无', {
        fontSize: '14px', color: '#8a7a5a', padding: { top: 4 },
      }).setOrigin(0, 0));
      y += 22;
    } else {
      for (const techKey of Object.keys(filterTech)) {
        const techName = TECH_TREE[techKey]?.name ?? techKey;
        const met = !!unlocked[techKey];
        c.add(this.scene.add.text(-W / 2 + pad, y, `• ${techName}`, {
          fontSize: '14px', color: met ? '#3a7a3a' : '#c0392b', padding: { top: 4 },
        }).setOrigin(0, 0));
        y += 22;
      }
    }
    y += 10;

    // ── 资源要求 ──────────────────────────────────
    const cost = training.cost ?? {};
    const resource = saveData.resource ?? {};
    c.add(this.scene.add.text(-W / 2, y, '资源要求：', {
      fontSize: '14px', color: '#b8963e', fontStyle: 'bold', padding: { top: 4 },
    }).setOrigin(0, 0));
    y += 24;

    // 把 population 和其他资源分开
    const popAmount = cost.population ?? 0;
    const otherCost = Object.entries(cost).filter(([k]) => k !== 'population');

    // population 是否满足：若已有恢复的选中主城，直接计算；否则视为不满足
    let popEnough = selectedMainGn
      ? (grids[selectedMainGn]?.population ?? 0) >= popAmount
      : false;

    // population 行（如果有）
    let popText = null;
    let popRowY = y;
    if (popAmount > 0) {
      // 图标
      const iconKey = 'icon_population';
      let ix = -W / 2 + pad;
      if (this.scene.textures.exists(iconKey)) {
        c.add(this.scene.add.image(ix + 11, y + 11, iconKey).setDisplaySize(22, 22));
        ix += 26;
      }
      // 数量文字（颜色动态更新，初始颜色根据已恢复的选中状态计算）
      popText = this.scene.add.text(ix, y, `人口 ×${popAmount}`, {
        fontSize: '15px', color: popEnough ? '#3a7a3a' : '#c0392b', fontStyle: 'bold', padding: { top: 4 },
      }).setOrigin(0, 0);
      c.add(popText);

      // "选择"按钮
      const selBW = 70, selBH = 28;
      const selX = W / 2 - selBW / 2 - 4;
      const selBg = this.scene.add.image(selX, y + 11, 'common_btn').setDisplaySize(selBW, selBH)
        .setInteractive({ useHandCursor: true });
      const selTxt = this.scene.add.text(selX, y + 11, '选择', {
        fontSize: '13px', color: '#1a1200', fontStyle: 'bold', padding: { top: 4 },
      }).setOrigin(0.5);
      c.add([selBg, selTxt]);

      // 选择后显示已选主城名的文字（若已恢复选中状态，初始就显示名字）
      const initialGnName = selectedMainGn ? (grids[selectedMainGn]?.name ?? selectedMainGn) : '';
      const selLabel = this.scene.add.text(selX - selBW / 2 - 8, y + 11, initialGnName, {
        fontSize: '13px', color: '#ffd700', padding: { top: 4 },
      }).setOrigin(1, 0.5);
      c.add(selLabel);

      selBg.on('pointerover', () => selBg.setAlpha(0.8));
      selBg.on('pointerout', () => selBg.setAlpha(1));
      selBg.on('pointerdown', () => selBg.setAlpha(0.6));
      selBg.on('pointerup', () => {
        selBg.setAlpha(1);
        this._showCitySelector(popAmount, grids, selectedMainGn, (gnId) => {
          selectedMainGn = gnId;
          this._trainSelectedMainGn = gnId;  // 同步到实例字段，跨渲染保持
          const gnName = grids[gnId]?.name ?? gnId;
          selLabel.setText(gnName);

          // 重新判断人口是否足够
          popEnough = (grids[gnId]?.population ?? 0) >= popAmount;
          popText.setColor(popEnough ? '#3a7a3a' : '#c0392b');

          // 更新训练按钮状态
          refreshTrainBtn();
        });
      });

      y += 36;
    }

    // 其他资源行
    let nonPopAfford = true;
    if (otherCost.length === 0 && popAmount === 0) {
      c.add(this.scene.add.text(-W / 2 + pad, y, '无', {
        fontSize: '14px', color: '#8a7a5a', padding: { top: 4 },
      }).setOrigin(0, 0));
      y += 28;
    } else if (otherCost.length > 0) {
      let tx = -W / 2 + pad;
      for (const [resKey, amount] of otherCost) {
        const have = resource[resKey] ?? 0;
        const enough = have >= amount && have >= 0;
        if (!enough) nonPopAfford = false;

        const iconKey = `icon_${resKey}`;
        if (this.scene.textures.exists(iconKey)) {
          c.add(this.scene.add.image(tx + 11, y + 11, iconKey).setDisplaySize(22, 22));
          tx += 26;
        }
        const resText = this.scene.add.text(tx, y, `×${amount}`, {
          fontSize: '15px', color: enough ? '#2c1a00' : '#c0392b', fontStyle: 'bold', padding: { top: 4 },
        }).setOrigin(0, 0);
        c.add(resText);
        tx += resText.width + 14;
      }
      y += 32;
    }

    // ── 回合数 ───────────────────────────────────
    const round = training.round ?? 1;
    c.add(this.scene.add.text(-W / 2, y, `训练时间：${round} 回合`, {
      fontSize: '14px', color: '#6b4c1e', padding: { top: 4 },
    }).setOrigin(0, 0));
    y += 36;

    // ── 训练按钮（动态刷新） ───────────────────────
    const techMet = Object.keys(filterTech).every(k => !!unlocked[k]);
    const BW = 130, BH = 38;
    const btnBg = this.scene.add.image(0, y + BH / 2, 'common_btn').setDisplaySize(BW, BH).setAlpha(0.5);
    const btnTxt = this.scene.add.text(0, y + BH / 2, '训练', {
      fontSize: '17px', color: '#1a1200', fontStyle: 'bold', padding: { top: 4 },
    }).setOrigin(0.5);
    c.add([btnBg, btnTxt]);

    const refreshTrainBtn = () => {
      const popOk = popAmount > 0 ? (popEnough && selectedMainGn !== null) : true;
      const canTrain = techMet && nonPopAfford && popOk;
      btnBg.removeAllListeners();
      if (canTrain) {
        btnBg.setAlpha(1);
        btnBg.setInteractive({ useHandCursor: true });
        btnBg.on('pointerover', () => btnBg.setAlpha(0.8));
        btnBg.on('pointerout', () => btnBg.setAlpha(1));
        btnBg.on('pointerdown', () => btnBg.setAlpha(0.6));
        btnBg.on('pointerup', () => {
          btnBg.setAlpha(1);
          this._showTrainConfirm(cost, round, selectedMainGn);
        });
      } else {
        btnBg.setAlpha(0.5);
        btnBg.disableInteractive();
      }
    };

    // 初始渲染
    refreshTrainBtn();
  }

  // ── 主城选择小窗 ────────────────────────────────
  _showCitySelector(popNeeded, grids, initialSelected, onConfirm) {
    const { width, height } = this.scene.scale;
    const W = 300, DEPTH = DETAIL_DEPTH + 30;
    const cx = width / 2, cy = height / 2;

    // 找出所有 isMain 的主城
    const mainCities = Object.entries(grids)
      .filter(([, gn]) => gn.isMain)
      .map(([id, gn]) => ({ id, name: gn.name ?? id, pop: gn.population ?? 0 }));

    const H = Math.max(160, 70 + mainCities.length * 46 + 56);

    const overlay = this.scene.add.rectangle(cx, cy, width, height, 0x000000, 0.55)
      .setDepth(DEPTH).setInteractive();
    const modal = this.scene.add.container(cx, cy).setDepth(DEPTH + 1);

    const bg = this.scene.add.rectangle(0, 0, W, H, DETAIL_BG, 0.97)
      .setStrokeStyle(1.5, DETAIL_THEME, 0.6);
    modal.add(bg);

    modal.add(this.scene.add.text(0, -H / 2 + 22, '选择主城', {
      fontSize: '16px', color: '#ffd700', fontStyle: 'bold', padding: { top: 4 },
    }).setOrigin(0.5));

    // 恢复上次选中状态
    let selected = initialSelected ?? null;
    const cityBgs = [];

    // 确认按钮（先创建占位引用，后面动态控制）
    const destroy = () => { modal.destroy(true); overlay.destroy(); };
    const btnY = H / 2 - 28;

    // 确认按钮：初始置灰
    const confirmBg = this.scene.add.image(-60, btnY, 'common_btn_green').setDisplaySize(100, 34).setAlpha(0.5);
    const confirmTxt = this.scene.add.text(-60, btnY, '确认', {
      fontSize: '15px', color: '#1a1200', fontStyle: 'bold', padding: { top: 4 },
    }).setOrigin(0.5);

    const refreshConfirmBtn = () => {
      confirmBg.removeAllListeners();
      if (selected) {
        confirmBg.setAlpha(1);
        confirmBg.setInteractive({ useHandCursor: true });
        confirmBg.on('pointerover', () => confirmBg.setAlpha(0.8));
        confirmBg.on('pointerout', () => confirmBg.setAlpha(1));
        confirmBg.on('pointerdown', () => confirmBg.setAlpha(0.6));
        confirmBg.on('pointerup', () => { confirmBg.setAlpha(1); onConfirm(selected); destroy(); });
      } else {
        confirmBg.setAlpha(0.5);
        confirmBg.disableInteractive();
      }
    };
    refreshConfirmBtn();
    modal.add([confirmBg, confirmTxt]);

    mainCities.forEach(({ id, name, pop }, i) => {
      const ry = -H / 2 + 56 + i * 46;
      const enough = pop >= popNeeded;
      const itemBg = this.scene.add.rectangle(0, ry, W - 24, 38,
        enough ? 0x1a2a1a : 0x2a1a1a, 0.9)
        .setStrokeStyle(1, enough ? 0x44aa44 : 0x444444, 1)
        .setInteractive({ useHandCursor: enough });

      const nameT = this.scene.add.text(-W / 2 + 20, ry, name, {
        fontSize: '15px', color: enough ? '#dddddd' : '#666666', padding: { top: 4 },
      }).setOrigin(0, 0.5);
      const popT = this.scene.add.text(W / 2 - 20, ry, `人口：${pop}`, {
        fontSize: '13px', color: enough ? '#aaaaaa' : '#555555', padding: { top: 4 },
      }).setOrigin(1, 0.5);

      modal.add([itemBg, nameT, popT]);
      cityBgs.push({ id, itemBg, enough });

      if (enough) {
        itemBg.on('pointerover', () => { if (selected !== id) itemBg.setAlpha(0.75); });
        itemBg.on('pointerout', () => itemBg.setAlpha(1));
        itemBg.on('pointerdown', () => {
          if (selected === id) {
            // 再次点击已选主城 → 取消选中
            selected = null;
          } else {
            selected = id;
          }
          cityBgs.forEach(({ id: bid, itemBg: bb, enough: e }) => {
            if (!e) return;
            const isSelected = bid === selected;
            bb.setStrokeStyle(1, isSelected ? DETAIL_THEME : 0x44aa44, 1);
            bb.setFillStyle(isSelected ? 0x2a2960 : 0x1a2a1a, 0.9);
            bb.setAlpha(1);
          });
          refreshConfirmBtn();
        });
      }
    });

    // 取消按钮
    // 城市列表渲染完成后，应用初始选中状态的高亮（恢复上次选择）
    if (selected) {
      cityBgs.forEach(({ id: bid, itemBg: bb, enough: e }) => {
        if (!e) return;
        const isSelected = bid === selected;
        bb.setStrokeStyle(1, isSelected ? DETAIL_THEME : 0x44aa44, 1);
        bb.setFillStyle(isSelected ? 0x2a2960 : 0x1a2a1a, 0.9);
      });
    }

    const cancelBg = this.scene.add.image(60, btnY, 'common_btn').setDisplaySize(100, 34)
      .setInteractive({ useHandCursor: true });
    const cancelTxt = this.scene.add.text(60, btnY, '取消', {
      fontSize: '15px', color: '#1a1200', fontStyle: 'bold', padding: { top: 4 },
    }).setOrigin(0.5);
    cancelBg.on('pointerover', () => cancelBg.setAlpha(0.8));
    cancelBg.on('pointerout', () => cancelBg.setAlpha(1));
    cancelBg.on('pointerdown', () => cancelBg.setAlpha(0.6));
    cancelBg.on('pointerup', () => { cancelBg.setAlpha(1); destroy(); });
    modal.add([cancelBg, cancelTxt]);

    modal.setAlpha(0); overlay.setAlpha(0);
    this.scene.tweens.add({ targets: [modal, overlay], alpha: 1, duration: 160 });
  }

  // ── 训练确认弹窗 ────────────────────────────────
  _showTrainConfirm(cost, round, selectedMainGn) {
    const { width, height } = this.scene.scale;
    const W = 340, H = 180;
    const cx = width / 2, cy = height / 2;
    const DEPTH = DETAIL_DEPTH + 20;
    const t = this.template;

    const overlay = this.scene.add.rectangle(cx, cy, width, height, 0x000000, 0.6)
      .setDepth(DEPTH).setInteractive();
    const modal = this.scene.add.container(cx, cy).setDepth(DEPTH + 1);

    const bg = this.scene.add.rectangle(0, 0, W, H, DETAIL_BG, 0.97)
      .setStrokeStyle(1.5, DETAIL_THEME, 0.7);

    const title = this.scene.add.text(0, -H / 2 + 22, '训练确认', {
      fontSize: '16px', color: '#ffd700', fontStyle: 'bold', padding: { top: 4 },
    }).setOrigin(0.5);

    const msg = this.scene.add.text(0, -10, `是否确定训练【${t.name}】？`, {
      fontSize: '17px', color: '#f5e6c8', align: 'center',
      wordWrap: { width: W - 40 }, padding: { top: 4 },
    }).setOrigin(0.5);

    modal.add([bg, title, msg]);

    const destroy = () => { modal.destroy(true); overlay.destroy(); };

    const addBtn = (x, key, label, onClick) => {
      const BW = 110, BH = 36;
      const btnBg = this.scene.add.image(x, H / 2 - 30, key).setDisplaySize(BW, BH)
        .setInteractive({ useHandCursor: true });
      const btnTxt = this.scene.add.text(x, H / 2 - 30, label, {
        fontSize: '16px', color: '#1a1200', fontStyle: 'bold', padding: { top: 4 },
      }).setOrigin(0.5);
      btnBg.on('pointerover', () => btnBg.setAlpha(0.8));
      btnBg.on('pointerout', () => btnBg.setAlpha(1));
      btnBg.on('pointerdown', () => btnBg.setAlpha(0.6));
      btnBg.on('pointerup', () => { btnBg.setAlpha(1); onClick(); });
      modal.add([btnBg, btnTxt]);
    };

    addBtn(-65, 'common_btn_green', '确认', () => {
      this.scene.events.emit('train_soldier', {
        unitKey: this.unitKey,
        cost,
        round,
        unitName: t.name,
        selectedMainGn, // 用于人口扣除
      });
      // 确认后立刻清空选中的主城，避免下次打开训练页沿用旧选择
      // （旧主城人口可能已被消耗，若不清空会导致训练按钮误判为可点击）
      this._trainSelectedMainGn = null;
      destroy();

      // 立即重新渲染训练 tab，确保按钮/人口颜色/选择标签都基于清空后的状态刷新
      // （避免旧渲染里的闭包变量仍持有过期的 selectedMainGn/popEnough，导致按钮误判可点）
      if (this.currentTab === 'train') {
        this._infoContainer.removeAll(true);
        this._renderTrainTab();
      }
    });
    addBtn(65, 'common_btn', '取消', () => destroy());

    modal.setAlpha(0); overlay.setAlpha(0);
    this.scene.tweens.add({ targets: [modal, overlay], alpha: 1, duration: 160 });
  }

  // ── 技能辅助 ───────────────────────────────────
  /**
   * 技能来源：兵力表（fromArmy）里查看的是某个具体兵组，要展示的是它当前实际
   * 携带的技能（soldier.ability，包含学派系统学会后自动携带上的技能），不是
   * 兵种模板出厂自带的默认技能表（template.special_ability）——之前这里一直
   * 读的是模板，导致学派学到的技能哪怕自动携带了也不会显示在兵力表详情页里。
   * 兵种图鉴（非 fromArmy，查看的是兵种本身，没有具体兵组）则继续用模板兜底。
   */
  _getSkillsByType(type) {
    const source = this.unitData?.fromArmy
      ? (this.unitData.current_ability ?? {})
      : (this.template?.special_ability ?? {});
    return Object.keys(source)
      .filter(k => {
        if (!source[k]) return false;
        const skillType = MILITARY_SKILL[k]?.type;
        const effective = skillType ?? 'initiative';
        return effective === type;
      })
      .map(k => ({
        key: k,
        skill: MILITARY_SKILL[k] ?? { name: k, type: 'initiative' },
      }));
  }

  /**
   * 已经学会、但当前没有携带的技能（携带栏满了学新技能时会出现这种情况）。
   * 只有兵力表（fromArmy）才有意义——图鉴没有具体兵组、没有"学会"的概念。
   */
  _getLearnedNotCarriedSkills() {
    if (!this.unitData?.fromArmy) return [];
    const learned = this.unitData.current_learned_skills ?? {};
    const carried = this.unitData.current_ability ?? {};
    return Object.keys(learned)
      .filter(k => learned[k] && !carried[k])
      .map(k => ({
        key: k,
        skill: MILITARY_SKILL[k] ?? { name: k, type: 'initiative' },
      }));
  }

  // ── 技能浮窗 ───────────────────────────────────
  _showTip(title, des, ptr, terms) {
    this._hideTip();

    const TIP_W = 220;
    const GAP = 8;

    const makeBox = (t, d, w) => {
      const div = document.createElement('div');
      div.style.cssText = [
        `width:${w}px`,
        'background:rgba(17,17,34,0.95)',
        'border:1px solid #b8963e',
        'border-radius:4px',
        'padding:10px',
        'box-sizing:border-box',
        'font-family:sans-serif',
      ].join(';');
      const titleEl = document.createElement('div');
      titleEl.style.cssText = 'color:#ffcc44;font-size:14px;font-weight:bold;margin-bottom:6px;word-break:break-all;';
      titleEl.textContent = t;
      const desEl = document.createElement('div');
      desEl.style.cssText = 'color:#cccccc;font-size:13px;word-break:break-all;line-height:1.5;';
      desEl.textContent = d;
      div.appendChild(titleEl);
      div.appendChild(desEl);
      return div;
    };

    // ── 内层 flex 容器：主浮窗 + term 堆叠，浏览器自动顶边对齐 ──
    // 不放在 Phaser add.dom 的根节点上，因为 Phaser 会覆写根节点的部分内联样式
    // （如 position/display），导致 flex 布局失效退化为普通块级堆叠。
    // 所以用一个纯定位用的 root 包裹一层真正做 flex 布局的 inner。
    const root = document.createElement('div');
    root.style.cssText = 'pointer-events:none;';

    const inner = document.createElement('div');
    inner.style.cssText = [
      'display:flex',
      'flex-direction:row',
      'align-items:stretch',
      `gap:${GAP}px`,
    ].join(';');
    root.appendChild(inner);

    const mainDiv = makeBox(title, des, TIP_W);
    inner.appendChild(mainDiv);

    if (terms) {
      const TERM_W = 160;
      const termCol = document.createElement('div');
      termCol.style.cssText = [
        'display:flex',
        'flex-direction:column',
        `gap:${GAP}px`,
      ].join(';');
      for (const termKey of Object.keys(terms)) {
        if (termKey === 'buff') {
          // buff 字段是一个数组，表示这个技能涉及的若干个增益/减益效果 ID，
          // 每个 ID 要去 MILITARY_BUFF（而不是 MILITARY_TERM）里查名字和描述
          const buffIds = terms.buff;
          if (!Array.isArray(buffIds)) continue;
          for (const buffId of buffIds) {
            const bd = MILITARY_BUFF[buffId];
            if (!bd) continue;
            termCol.appendChild(makeBox(bd.name ?? `buff_${buffId}`, bd.des ?? '', TERM_W));
          }
          continue;
        }
        const td = MILITARY_TERM[termKey];
        if (!td) continue;
        termCol.appendChild(makeBox(td.name ?? termKey, td.des ?? '', TERM_W));
      }
      if (termCol.children.length > 0) inner.appendChild(termCol);
    }

    this.tooltip = this.scene.add.dom(0, 0, root).setDepth(DETAIL_DEPTH + 50);

    // 全局 mousemove 驱动，用 rAF 节流到每帧最多更新一次位置，避免高频重绘闪烁
    let pendingX = ptr.x, pendingY = ptr.y;
    let rafScheduled = false;
    const applyPosition = () => {
      rafScheduled = false;
      if (!this.tooltip) return;
      this._positionTipDom(pendingX, pendingY);
    };
    this._tipMouseMove = (e) => {
      const canvas = this.scene.game.canvas;
      const rect = canvas.getBoundingClientRect();
      pendingX = e.clientX - rect.left;
      pendingY = e.clientY - rect.top;
      if (!rafScheduled) {
        rafScheduled = true;
        requestAnimationFrame(applyPosition);
      }
    };
    document.addEventListener('mousemove', this._tipMouseMove);

    this._positionTipDom(ptr.x, ptr.y);
  }

  _positionTipDom(px, py) {
    if (!this.tooltip) return;
    const { width, height } = this.scene.scale;
    const node = this.tooltip.node;

    // 直接读取整个 flex 容器的真实渲染尺寸（浏览器已自动布局对齐好）
    const w = node.offsetWidth || 220;
    const h = node.offsetHeight || 80;

    let tx = px + 16 + w / 2;
    let ty = py + 16 + h / 2;

    if (tx + w / 2 > width - 8) tx = px - 16 - w / 2;
    if (ty + h / 2 > height - 8) ty = py - 16 - h / 2;
    if (tx - w / 2 < 8) tx = 8 + w / 2;
    if (ty - h / 2 < 8) ty = 8 + h / 2;

    this.tooltip.setPosition(tx, ty);
  }

  _moveTip(ptr) {
    // 由全局 mousemove 驱动，此方法保留兼容旧调用但无需额外操作
  }

  _hideTip() {
    if (this._tipMouseMove) {
      document.removeEventListener('mousemove', this._tipMouseMove);
      this._tipMouseMove = null;
    }
    if (this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = null;
    }
  }

  // ── 销毁 ───────────────────────────────────────
  destroy() {
    this._hideTip();
    this.scene.tweens.add({
      targets: [this.root, this.overlay],
      alpha: 0, duration: 140,
      onComplete: () => {
        this.root.destroy(true);
        this.overlay.destroy();
      },
    });
  }
}