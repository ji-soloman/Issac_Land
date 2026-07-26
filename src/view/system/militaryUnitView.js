/**
 * 兵力/图鉴查看界面
 */
import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import { saveSystem } from '../../system/saveSystem.js';
import { MILITARY } from '../../data/military.js';
import { MILITARY_UNIT } from '../../data/military_unit.js';
import { MILITARY_SKILL } from '../../data/military_skill.js';
import { MILITARY_TRANSLATE } from '../../data/military_translate.js';
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
      new UnitDetailPage(this.scene, this.saveData, key, soldier);
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
      new UnitDetailPage(this.scene, this.saveData, key, unit);
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

    // 全屏背景
    const bg = this.scene.add.rectangle(0, 0, width, height, DETAIL_BG, 0.97);
    this.root.add(bg);

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
    const imgKey = `soldier_${this.unitKey}`;

    // 分隔线
    const sep = this.scene.add.rectangle(x + imgW / 2, 0, 1, H, DETAIL_THEME, 0.25);
    this.root.add(sep);

    if (this.scene.textures.exists(imgKey)) {
      const img = this.scene.add.image(x, 0, imgKey);
      const scale = Math.min((imgW - 20) / img.width, (H - 20) / img.height);
      img.setScale(scale).setOrigin(0.5);
      this.root.add(img);
    } else {
      const ph = this.scene.add.text(x, 0, this.template?.name ?? '?', {
        fontSize: '22px', color: '#555555', align: 'center',
        padding: { top: 4 },
      }).setOrigin(0.5);
      this.root.add(ph);
    }
  }

  // ── 右侧 Tab 条 ────────────────────────────────
  _buildTabBar(imgW, tabW, H) {
    const rx = this._w / 2 - tabW / 2;
    // 图鉴才有训练 tab，兵力表没有
    const tabs = this.unitData.fromArmy ? ['info', 'equip'] : ['info', 'equip', 'train'];
    const labels = { info: '信息', equip: '装备', train: '训练' };
    const tabH = 72;
    const startY = -H / 2 + 100;

    this._tabObjects = {};

    tabs.forEach((tab, i) => {
      const ty = startY + i * (tabH + 8);
      const active = tab === this.currentTab;

      const tbg = this.scene.add.rectangle(rx, ty, tabW - 6, tabH, active ? 0x2a2960 : DETAIL_PANEL, 0.95)
        .setStrokeStyle(1.5, active ? DETAIL_THEME : 0x444444, 1)
        .setInteractive({ useHandCursor: true });

      const tlbl = this.scene.add.text(rx, ty, labels[tab], {
        fontSize: '16px', color: active ? '#ffd700' : '#888888', fontStyle: 'bold',
        padding: { top: 4 },
      }).setOrigin(0.5);

      tbg.on('pointerover', () => tbg.setAlpha(0.75));
      tbg.on('pointerout', () => tbg.setAlpha(1));
      tbg.on('pointerdown', () => { if (tab !== this.currentTab) this._switchTab(tab); });

      this.root.add([tbg, tlbl]);
      this._tabObjects[tab] = { tbg, tlbl };
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
    for (const [t, { tbg, tlbl }] of Object.entries(this._tabObjects)) {
      const active = t === tab;
      tbg.setFillStyle(active ? 0x2a2960 : DETAIL_PANEL, 0.95);
      tbg.setStrokeStyle(1.5, active ? DETAIL_THEME : 0x444444, 1);
      tlbl.setColor(active ? '#ffd700' : '#888888');
    }
    this._infoContainer.removeAll(true);
    if (tab === 'info') this._renderInfoTab();
    else if (tab === 'equip') this._renderEquipTab();
    else if (tab === 'train') this._renderTrainTab();
  }

  // ── 信息 Tab ───────────────────────────────────
  _renderInfoTab() {
    const c = this._infoContainer;
    const W = this._INFO_W - 24;
    const H = this._h;
    const pad = 16;
    let y = -H / 2 + pad;
    const t = this.template;

    if (!t) {
      c.add(this.scene.add.text(0, 0, '暂无数据', { fontSize: '18px', color: '#888', padding: { top: 4 } }).setOrigin(0.5));
      return;
    }

    // ── 兵力名（confirm 底图，最上方）────────────
    const nameImgW = Math.min(W * 0.7, 340);
    const nameImgH = 44;
    const nameY = y + nameImgH / 2;
    // 底图先 add（在下层），文字后 add（在上层），Phaser 后 add 的在前面渲染
    if (this.scene.textures.exists('confirm')) {
      c.add(this.scene.add.image(0, nameY, 'confirm').setDisplaySize(nameImgW, nameImgH));
    }
    const unitName = t.name ?? this.unitData?.name ?? '未知';
    c.add(this.scene.add.text(0, nameY, unitName, {
      fontSize: '22px',
      // confirm 是金色底图时用深色；无底图时用白色
      color: this.scene.textures.exists('confirm') ? '#1a1200' : '#ffffff',
      fontStyle: 'bold',
      padding: { top: 4 },
    }).setOrigin(0.5));
    y += nameImgH + 10;

    // ── 兵种 ─────────────────────────────────────
    const typeName = MILITARY_TRANSLATE[t.type ?? this.unitData.type] ?? t.type ?? '';
    c.add(this.scene.add.text(-W / 2, y, `兵种：${typeName}`, {
      fontSize: '15px', color: '#aaaaaa', padding: { top: 4 },
    }).setOrigin(0, 0));
    y += 28;

    // ── 等级（仅兵力表）─────────────────────────
    if (this.unitData.fromArmy) {
      const lv = this.unitData.level ?? 1;
      c.add(this.scene.add.text(-W / 2, y, `等级：${lv}`, {
        fontSize: '15px', color: '#aaaaaa', padding: { top: 4 },
      }).setOrigin(0, 0));
      y += 28;
    } else {
      // ── 科技要求（仅图鉴）─────────────────────
      const filter = this.template?.filter;
      const techKeys = filter?.tech ? Object.keys(filter.tech) : [];
      const techStr = techKeys.length > 0
        ? techKeys.map(k => TECH_TREE[k]?.name ?? k).join('，')
        : '无';
      c.add(this.scene.add.text(-W / 2, y, `科技要求：${techStr}`, {
        fontSize: '15px', color: '#aaaaaa', padding: { top: 4 },
      }).setOrigin(0, 0));
      y += 28;
    }

    // ── 属性区（固定6项 + 额外，超高可滚动）─────
    const statH = Math.round(H * 0.28);
    this._buildStatArea(c, t, -W / 2, y, W, statH);
    y += statH + 12;

    // ── 被动技能区 ───────────────────────────────
    const passiveH = 52;
    const passive = this._getSkillsByType('passive')[0] ?? null;
    this._buildPassiveArea(c, passive, -W / 2, y, W, passiveH);
    y += passiveH + 12;

    // ── 主动技能四宫格 + tag 标签 ─────────────────
    const actives = this._getSkillsByType('initiative').slice(0, 4);
    const tags = this._getSkillsByType('tag');
    const gridH = Math.round(H * 0.22);
    this._buildSkillGrid(c, actives, tags, -W / 2, y, W, gridH);
  }

  // ── 属性区 ─────────────────────────────────────
  _buildStatArea(ct, t, x, y, w, h) {
    const stats = t.basic_stats ?? {};
    const extra = Object.keys(stats).filter(k => !STAT_KEYS.includes(k));
    const all = [...STAT_KEYS, ...extra];

    const PAD = 12;   // 增大内边距，确保第一行顶部完整显示
    const COL_W = (w - PAD) / 2;
    const ROW_H = 30;
    const contentH = Math.ceil(all.length / 2) * ROW_H + PAD * 2;

    const frame = this.scene.add.rectangle(x + w / 2, y + h / 2, w, h, DETAIL_PANEL, 0.85)
      .setStrokeStyle(1, DETAIL_THEME, 0.25);
    ct.add(frame);

    const inner = this.scene.add.container(x + PAD, y + PAD);
    ct.add(inner);

    all.forEach((key, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const ix = col * COL_W;
      const iy = row * ROW_H;
      const val = stats[key] ?? 0;
      const label = MILITARY_TRANSLATE[key] ?? key;
      inner.add(this.scene.add.text(ix, iy, `${label}：${val}`, {
        fontSize: '15px', color: '#dddddd', padding: { top: 4 },
      }).setOrigin(0, 0));
    });

    // 滚动支持
    if (contentH > h) {
      let sy = 0;
      frame.setInteractive();
      frame.on('wheel', (p, dx, dy) => {
        sy = Phaser.Math.Clamp(sy - dy * 0.5, -(contentH - h + PAD), 0);
        inner.setY(y + PAD + sy);
      });
    }
  }

  // ── 被动技能（专属特性）────────────────────────
  _buildPassiveArea(ct, skill, x, y, w, h) {
    const bg = this.scene.add.rectangle(x + w / 2, y + h / 2, w, h, DETAIL_PANEL, 0.85)
      .setStrokeStyle(1, 0x7766cc, 0.5);
    ct.add(bg);

    if (!skill) {
      ct.add(this.scene.add.text(x + w / 2, y + h / 2, '被动技能：无', {
        fontSize: '14px', color: '#444444', padding: { top: 4 },
      }).setOrigin(0.5));
      return;
    }

    ct.add(this.scene.add.text(x + 10, y + 6, '被动技能', {
      fontSize: '12px', color: '#9988ff', padding: { top: 4 },
    }).setOrigin(0, 0));
    const passiveLv = skill.level != null ? `${skill.name}  Lv${skill.level}` : skill.name;
    ct.add(this.scene.add.text(x + 10, y + 24, passiveLv, {
      fontSize: '17px', color: '#ffffff', fontStyle: 'bold', padding: { top: 4 },
    }).setOrigin(0, 0));

    if (skill.des) {
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', (ptr) => this._showTip(skill.name, skill.des, ptr));
      bg.on('pointermove', (ptr) => this._moveTip(ptr));
      bg.on('pointerout', () => this._hideTip());
    }
  }

  // ── 主动技能四宫格 + tag 标签 ──────────────────
  _buildSkillGrid(ct, actives, tags, x, y, w, gridH) {
    const CELL_W = (w - 4) / 2;
    const CELL_H = (gridH - 4) / 2;
    const pos = [
      [x, y],
      [x + CELL_W + 4, y],
      [x, y + CELL_H + 4],
      [x + CELL_W + 4, y + CELL_H + 4],
    ];

    pos.forEach(([cx, cy], i) => {
      const skill = actives[i] ?? null;
      const sbg = this.scene.add.rectangle(cx + CELL_W / 2, cy + CELL_H / 2, CELL_W, CELL_H, DETAIL_PANEL, 0.85)
        .setStrokeStyle(1, skill ? 0xffcc44 : 0x333333, skill ? 0.7 : 0.3);
      ct.add(sbg);

      if (skill) {
        const activeLv = skill.level != null ? `${skill.name}\nLv${skill.level}` : skill.name;
        ct.add(this.scene.add.text(cx + CELL_W / 2, cy + CELL_H / 2, activeLv, {
          fontSize: '15px', color: '#ffcc44', fontStyle: 'bold',
          align: 'center', wordWrap: { width: CELL_W - 10 },
          padding: { top: 4 },
        }).setOrigin(0.5));
        if (skill.des) {
          sbg.setInteractive({ useHandCursor: true });
          sbg.on('pointerover', (ptr) => this._showTip(skill.name, skill.des, ptr));
          sbg.on('pointermove', (ptr) => this._moveTip(ptr));
          sbg.on('pointerout', () => this._hideTip());
        }
      } else {
        ct.add(this.scene.add.text(cx + CELL_W / 2, cy + CELL_H / 2, '—', {
          fontSize: '20px', color: '#2a2a2a',
          padding: { top: 4 },
        }).setOrigin(0.5));
      }
    });

    // Tag 标签
    if (tags.length > 0) {
      let tx = x;
      const ty = y + gridH + 8;
      tags.forEach(skill => {
        const lbl = this.scene.add.text(0, 0, skill.name, { fontSize: '13px', color: '#88ee88', padding: { top: 4 } }).setOrigin(0.5);
        const tw = lbl.width + 18;
        const tby = ty + 14;
        const tbx = tx + tw / 2;
        const tbg = this.scene.add.rectangle(tbx, tby, tw, 26, 0x1a3020, 0.9)
          .setStrokeStyle(1, 0x55aa55, 0.8);
        lbl.setPosition(tbx, tby);
        ct.add([tbg, lbl]);
        if (skill.des) {
          tbg.setInteractive({ useHandCursor: true });
          tbg.on('pointerover', (ptr) => this._showTip(skill.name, skill.des, ptr));
          tbg.on('pointermove', (ptr) => this._moveTip(ptr));
          tbg.on('pointerout', () => this._hideTip());
        }
        tx += tw + 6;
      });
    }
  }

  // ── 装备 Tab ───────────────────────────────────
  _renderEquipTab() {
    this._infoContainer.add(this.scene.add.text(0, 0, '装备（暂未实装）', {
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
    let selectedMainGn = null;

    // ── 科技要求 ──────────────────────────────────
    const filterTech = t?.filter?.tech ?? {};
    const unlocked = saveData.tech_tree?.unlocked ?? {};
    c.add(this.scene.add.text(-W / 2, y, '科技要求：', {
      fontSize: '14px', color: '#aaaaaa', padding: { top: 4 },
    }).setOrigin(0, 0));
    y += 24;

    if (Object.keys(filterTech).length === 0) {
      c.add(this.scene.add.text(-W / 2 + pad, y, '无', {
        fontSize: '14px', color: '#888888', padding: { top: 4 },
      }).setOrigin(0, 0));
      y += 22;
    } else {
      for (const techKey of Object.keys(filterTech)) {
        const techName = TECH_TREE[techKey]?.name ?? techKey;
        const met = !!unlocked[techKey];
        c.add(this.scene.add.text(-W / 2 + pad, y, `• ${techName}`, {
          fontSize: '14px', color: met ? '#88cc88' : '#ff5555', padding: { top: 4 },
        }).setOrigin(0, 0));
        y += 22;
      }
    }
    y += 10;

    // ── 资源要求 ──────────────────────────────────
    const cost = training.cost ?? {};
    const resource = saveData.resource ?? {};
    c.add(this.scene.add.text(-W / 2, y, '资源要求：', {
      fontSize: '14px', color: '#aaaaaa', padding: { top: 4 },
    }).setOrigin(0, 0));
    y += 24;

    // 把 population 和其他资源分开
    const popAmount = cost.population ?? 0;
    const otherCost = Object.entries(cost).filter(([k]) => k !== 'population');

    // population 是否满足（初始未选主城视为不满足）
    let popEnough = false;

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
      // 数量文字（颜色动态更新）
      popText = this.scene.add.text(ix, y, `人口 ×${popAmount}`, {
        fontSize: '15px', color: '#ff5555', fontStyle: 'bold', padding: { top: 4 },
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

      // 选择后显示已选主城名的文字（占位，初始空）
      const selLabel = this.scene.add.text(selX - selBW / 2 - 8, y + 11, '', {
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
          const gnName = grids[gnId]?.name ?? gnId;
          selLabel.setText(gnName);

          // 重新判断人口是否足够
          popEnough = (grids[gnId]?.population ?? 0) >= popAmount;
          popText.setColor(popEnough ? '#dddddd' : '#ff5555');

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
        fontSize: '14px', color: '#888888', padding: { top: 4 },
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
          fontSize: '15px', color: enough ? '#dddddd' : '#ff5555', fontStyle: 'bold', padding: { top: 4 },
        }).setOrigin(0, 0);
        c.add(resText);
        tx += resText.width + 14;
      }
      y += 32;
    }

    // ── 回合数 ───────────────────────────────────
    const round = training.round ?? 1;
    c.add(this.scene.add.text(-W / 2, y, `训练时间：${round} 回合`, {
      fontSize: '14px', color: '#aaaaaa', padding: { top: 4 },
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
      destroy();
    });
    addBtn(65, 'common_btn', '取消', () => destroy());

    modal.setAlpha(0); overlay.setAlpha(0);
    this.scene.tweens.add({ targets: [modal, overlay], alpha: 1, duration: 160 });
  }

  // ── 技能辅助 ───────────────────────────────────
  _getSkillsByType(type) {
    const t = this.template;
    return Object.keys(t?.special_ability ?? {})
      .filter(k => t.special_ability[k] && MILITARY_SKILL[k]?.type === type)
      .map(k => MILITARY_SKILL[k]);
  }

  // ── 技能浮窗 ───────────────────────────────────
  _showTip(title, des, ptr) {
    this._hideTip();
    const TIP_W = 220;
    const PAD = 10;
    const ct = this.scene.add.container(ptr.x + 18, ptr.y + 18).setDepth(DETAIL_DEPTH + 20);

    const t1 = this.scene.add.text(PAD, PAD, title, {
      fontSize: '14px', color: '#ffcc44', fontStyle: 'bold',
      padding: { top: 4 },
      wordWrap: { width: TIP_W - PAD * 2, useAdvancedWrap: true },
    }).setOrigin(0, 0);
    const t2 = this.scene.add.text(PAD, PAD + t1.height + 4, des, {
      fontSize: '13px', color: '#cccccc',
      padding: { top: 4 },
      wordWrap: { width: TIP_W - PAD * 2, useAdvancedWrap: true },
    }).setOrigin(0, 0);

    const bgH = PAD * 2 + t1.height + 4 + t2.height;
    const bg = this.scene.add.rectangle(TIP_W / 2, bgH / 2, TIP_W, bgH, 0x111122, 0.95)
      .setStrokeStyle(1, DETAIL_THEME, 0.5);

    // 确保浮窗不超出屏幕边缘
    const { width, height } = this.scene.scale;
    let tx = ptr.x + 18;
    let ty = ptr.y + 18;
    if (tx + TIP_W > width - 8) tx = ptr.x - TIP_W - 8;
    if (ty + bgH > height - 8) ty = ptr.y - bgH - 8;
    ct.setPosition(tx, ty);

    ct.add([bg, t1, t2]);
    this.tooltip = ct;
  }
  _moveTip(ptr) { if (this.tooltip) this.tooltip.setPosition(ptr.x + 18, ptr.y + 18); }
  _hideTip() { if (this.tooltip) { this.tooltip.destroy(true); this.tooltip = null; } }

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