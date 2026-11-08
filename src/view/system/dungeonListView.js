import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import { DUNGEON } from '../../data/dungeon.js';
import { DungeonSelector } from './dungeonSelector.js';

const DEPTH = 1800;
const BG_COLOR = 0x0d0d1a;
const THEME_COLOR = 0xb8963e;

// UI 素材纹理 key
// - 标题牌：assets/ui_dungeon/header.png（副本专用，运行时按需加载）
// - 关闭按钮：和学派界面共用 assets/ui_academy/close.png，key 与 academyView.js 保持一致，
//   这样学派界面已经加载过的话这里直接复用，不会重复加载
// 关卡列表外框里一次显示的关卡数，超出部分通过滚动条查看
const LIST_VISIBLE_ROWS = 5;

const HEADER_KEY = 'dungeon_header';
const HEADER_PATH = 'assets/ui_dungeon/header.png';
const CLOSE_KEY = 'academy_close';
const CLOSE_PATH = 'assets/ui_academy/close.png';
// 整屏背景图：assets/background/dungeon.png（运行时按需加载，缺失时退回纯色底）
const BG_KEY = 'dungeon_bg';
const BG_PATH = 'assets/background/dungeon.png';

/**
 * DungeonListView —— 副本选关界面
 *
 * 版式参考"选关 + 详情"的经典三栏布局：
 *   左栏：当前选中关卡的大图（固定宽3:高4）+ 关卡名
 *   中栏：关卡列表（外框内固定显示5个，超出时右侧滚动条/滚轮滚动；点击切换选中的关卡）
 *   右栏：关卡详情（名称/等级/简介/敌方阵容）+ "开始挑战"按钮
 *
 * 暂时没有素材/功能的部分一律不做：队伍配置（点"开始挑战"后直接进入选兵出战面板
 * DungeonSelector，不再单独配置队伍）、掉落物、奖励。
 *
 * 关卡数据全部来自 data/dungeon.js 的 DUNGEON，以后往里加关卡会自动出现在列表里：
 *   - level（可选）：关卡等级，缺省时用在列表里的序号
 *   - des（可选）：关卡简介文字，缺省时不显示简介
 */
export class DungeonListView {
  constructor(scene, saveData) {
    this.scene = scene;
    this.saveData = saveData;
    this.entries = Object.entries(DUNGEON);
    this.selectedId = this.entries.length > 0 ? this.entries[0][0] : null;
    this.listScroll = 0; // 关卡列表当前滚动位置（像素）
    this._loadAndBuild();
  }

  /** 关卡 id 对应的"等级"：优先取 data.level，否则用列表序号（从1开始） */
  _levelOf(id) {
    const idx = this.entries.findIndex(([k]) => k === id);
    return DUNGEON[id]?.level ?? (idx + 1);
  }

  /** 敌方单位头像的纹理 key——和 DungeonSelector/BattleSystem 里 boss 的 soldier_${name} 完全一致，可共用缓存 */
  _bossKey(id, unitKey) {
    return `soldier_dungeon_${id}_${unitKey}`;
  }

  /**
   * 运行时按需加载本界面用到的所有贴图（比照 battleSystem.js 的 _loadAssetsAndBuild）：
   * 标题牌、关闭按钮（共用学派素材）、各关卡缩略图 dungeon_select_${id}、各关卡敌方单位头像。
   * 全部已存在则跳过加载直接构建；加载失败（素材缺失）也继续构建，由各处的兜底样式处理。
   */
  _loadAndBuild() {
    const keysToLoad = [];
    const pathMap = {};
    const need = (key, path) => {
      if (!path || pathMap[key] || this.scene.textures.exists(key)) return;
      keysToLoad.push(key);
      pathMap[key] = path;
    };

    need(BG_KEY, BG_PATH);
    need(HEADER_KEY, HEADER_PATH);
    need(CLOSE_KEY, CLOSE_PATH);
    this.entries.forEach(([id, data]) => {
      need(`dungeon_select_${id}`, data.image);
      Object.entries(data.units ?? {}).forEach(([unitKey, u]) => need(this._bossKey(id, unitKey), u.image));
    });

    if (keysToLoad.length === 0) {
      this._build();
      return;
    }

    const { width, height } = this.scene.scale;
    const overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75)
      .setDepth(DEPTH + 100).setInteractive();
    const barW = 320, barH = 16;
    const barBg = this.scene.add.rectangle(width / 2, height / 2 + 20, barW, barH, 0x333333, 1).setDepth(DEPTH + 101);
    const barFg = this.scene.add.rectangle(width / 2 - barW / 2, height / 2 + 20, 0, barH, THEME_COLOR, 1)
      .setOrigin(0, 0.5).setDepth(DEPTH + 102);
    const loadTxt = this.scene.add.text(width / 2, height / 2 - 10, '加载中...', {
      fontSize: '18px', color: '#f0e6cc', padding: { top: 4 },
    }).setOrigin(0.5).setDepth(DEPTH + 101);
    const destroyLoader = () => { overlay.destroy(); barBg.destroy(); barFg.destroy(); loadTxt.destroy(); };

    let loaded = 0;
    const onDone = () => {
      loaded++;
      barFg.setDisplaySize(Math.max(1, barW * (loaded / keysToLoad.length)), barH);
      if (loaded >= keysToLoad.length) {
        this.scene.load.off('filecomplete', onDone);
        this.scene.load.off('loaderror', onDone);
        destroyLoader();
        this._build();
      }
    };
    this.scene.load.on('filecomplete', onDone);
    this.scene.load.on('loaderror', onDone); // 加载失败也继续，不卡死

    keysToLoad.forEach(k => this.scene.load.image(k, pathMap[k]));
    this.scene.load.start();
  }

  _build() {
    const { width, height } = this.scene.scale;

    this.overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.85)
      .setDepth(DEPTH).setInteractive();
    this.root = this.scene.add.container(0, 0).setDepth(DEPTH + 1);

    // 背景：有背景图时按"cover"等比缩放铺满全屏（不拉伸变形，超出部分被屏幕裁掉），
    // 再叠一层半透明黑色遮罩保证上面的文字清晰；没有背景图时退回纯色底
    this.root.add(this.scene.add.rectangle(width / 2, height / 2, width, height, BG_COLOR, 1));
    if (this.scene.textures.exists(BG_KEY)) {
      const bgImg = this.scene.add.image(width / 2, height / 2, BG_KEY).setOrigin(0.5);
      bgImg.setScale(Math.max(width / bgImg.width, height / bgImg.height));
      this.root.add(bgImg);
      this.root.add(this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.3));
    }

    this._buildHeader();
    this._buildCloseButton(width);

    // 会随选中关卡变化而重建的部分（左栏大图、列表高亮、右栏详情）放进这个子容器
    this.dynContainer = this.scene.add.container(0, 0);
    this.root.add(this.dynContainer);

    this._renderAll();

    // 鼠标滚轮滚动关卡列表
    this._wheelHandler = (pointer, objs, dx, dy) => this._onWheel(pointer, objs, dx, dy);
    this.scene.input.on('wheel', this._wheelHandler);
  }

  /** 标题牌（assets/ui_dungeon/header.png）：纯装饰，只按目标高度等比缩放，素材缺失则退回文字标题 */
  _buildHeader() {
    if (this.scene.textures.exists(HEADER_KEY)) {
      const header = this.scene.add.image(0, 0, HEADER_KEY).setOrigin(0, 0);
      header.setScale(84 / header.height);
      this.root.add(header);
      return;
    }
    this.root.add(this.scene.add.text(24, 30, '副本', {
      fontSize: '28px', color: '#f0e6cc', fontStyle: 'bold', fontFamily: 'serif', padding: { top: 4 },
    }));
  }

  /** 关闭按钮：和学派界面共用 assets/ui_academy/close.png，素材缺失时退回文字按钮"退出" */
  _buildCloseButton(width) {
    if (this.scene.textures.exists(CLOSE_KEY)) {
      const closeBtn = this.scene.add.image(width, 0, CLOSE_KEY).setOrigin(1, 0);
      closeBtn.setScale(60 / closeBtn.height);
      closeBtn.setInteractive({ useHandCursor: true });
      closeBtn.on('pointerover', () => closeBtn.setAlpha(0.85));
      closeBtn.on('pointerout', () => closeBtn.setAlpha(1));
      closeBtn.on('pointerdown', () => this.destroy());
      this.root.add(closeBtn);
      return;
    }
    const closeBtn = this.scene.add.text(width - 50, 40, '退出', {
      fontSize: '20px', backgroundColor: '#cc0000', color: '#ffffff', padding: { x: 10, y: 5, top: 4 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.destroy());
    this.root.add(closeBtn);
  }

  /** 整体重绘：切换选中关卡时调用（销毁动态子容器的全部内容后按 this.selectedId 重建） */
  _renderAll() {
    this.dynContainer.removeAll(true);
    const { width, height } = this.scene.scale;

    // 三栏布局：左栏大图 | 中栏列表 | 右栏详情
    const top = 110;
    const bottom = height - 30;
    const margin = 40, gap = 24;

    const leftW = 210;                         // 左栏：宽3:高4 → 高 280
    const leftX = margin;
    const listW = 240;
    const listX = leftX + leftW + gap;
    const panelX = listX + listW + gap;
    const panelW = width - margin - panelX;

    this._renderBigCard(leftX, top, leftW);
    this._renderLevelList(listX, top, listW);
    this._renderDetailPanel(panelX, top, panelW, bottom - top);
  }

  /** 左栏：选中关卡的大图（固定3:4）+ 顶部等级徽标 + 底部名称横幅 */
  _renderBigCard(x, y, w) {
    const id = this.selectedId;
    if (id == null) return;
    const data = DUNGEON[id];
    const h = w / 3 * 4;
    const c = this.dynContainer;

    c.add(this.scene.add.rectangle(x + w / 2, y + h / 2, w + 8, h + 8, 0x1e1d2e, 0.95)
      .setStrokeStyle(2, 0xb8963e, 1));

    const imgKey = `dungeon_select_${id}`;
    if (this.scene.textures.exists(imgKey)) {
      const img = this.scene.add.image(x + w / 2, y + h / 2, imgKey);
      img.setScale(Math.min(w / img.width, h / img.height)).setOrigin(0.5);
      c.add(img);
    } else {
      c.add(this.scene.add.rectangle(x + w / 2, y + h / 2, w, h, 0x333333, 1));
      c.add(this.scene.add.text(x + w / 2, y + h / 2, data.name, {
        fontSize: '16px', color: '#8a7a5a', align: 'center', padding: { top: 4 },
        wordWrap: { width: w - 16 },
      }).setOrigin(0.5));
    }

    // 等级徽标（左上角）
    c.add(this.scene.add.rectangle(x + 6, y + 6, 64, 24, 0x000000, 0.65).setOrigin(0, 0)
      .setStrokeStyle(1, 0xb8963e, 0.9));
    c.add(this.scene.add.text(x + 38, y + 18, `Lv.${this._levelOf(id)}`, {
      fontSize: '14px', color: '#ffd700', fontStyle: 'bold', padding: { top: 4 },
    }).setOrigin(0.5));

    // 名称横幅（底部）
    c.add(this.scene.add.rectangle(x, y + h - 40, w, 40, 0x000000, 0.7).setOrigin(0, 0));
    c.add(this.scene.add.text(x + w / 2, y + h - 20, data.name, {
      fontSize: '18px', color: '#f0e6cc', fontStyle: 'bold', fontFamily: 'serif', padding: { top: 4 },
      wordWrap: { width: w - 12 },
    }).setOrigin(0.5));
  }

  /**
   * 中栏：关卡列表。固定用一个外框包住，框内一次只显示 LIST_VISIBLE_ROWS（5）个关卡，
   * 超出时框内右侧出现滚动条，可以拖动滚动条滑块或用鼠标滚轮上下滚动查看其余关卡。
   * 每行"名称 + Lv.n"，选中行金色高亮，点击切换选中。
   *
   * 实现要点：
   *  - 所有关卡行放进 listContainer，用几何遮罩只显示外框内的区域（遮罩图形不加入显示列表）；
   *  - 滚动位置存在 this.listScroll 里，切换选中关卡触发整体重绘后会沿用，列表不会跳回顶部；
   *  - 被遮罩藏起来的行依然会收到点击，所以行的点击/悬停里要判断指针是否在可视区内。
   */
  _renderLevelList(x, y, w) {
    const c = this.dynContainer;
    const rowH = 72, rowGap = 10;
    const padV = 8, padH = 8;
    const barW = 8, barGap = 6;                       // 滚动条宽度、与行之间的间距

    const n = this.entries.length;
    const viewH = LIST_VISIBLE_ROWS * rowH + (LIST_VISIBLE_ROWS - 1) * rowGap; // 可视区高度（固定 5 行）
    const contentH = n > 0 ? n * rowH + (n - 1) * rowGap : 0;
    const maxScroll = Math.max(0, contentH - viewH);
    const needBar = maxScroll > 0;

    const viewX = x + padH, viewY = y + padV;
    const rowW = w - padH * 2 - (needBar ? barW + barGap : 0);
    this._listView = { x: x, y: y, w: w, viewY, viewH };
    this._listMaxScroll = maxScroll;
    this.listScroll = Math.min(Math.max(0, this.listScroll), maxScroll);

    // 外框
    c.add(this.scene.add.rectangle(x, y, w, viewH + padV * 2, 0x000000, 0.35).setOrigin(0, 0)
      .setStrokeStyle(2, 0xb8963e, 1));

    // 遮罩：只显示外框内部的可视区
    this._clearListMask();
    this.listMaskGfx = this.scene.make.graphics({ x: 0, y: 0, add: false });
    this.listMaskGfx.fillStyle(0xffffff, 1);
    this.listMaskGfx.fillRect(viewX, viewY, w - padH * 2, viewH);
    this.listMask = this.listMaskGfx.createGeometryMask();

    this.listContainer = this.scene.add.container(0, 0);
    this.listContainer.setMask(this.listMask);
    c.add(this.listContainer);

    const inView = (pointer) => pointer.y >= viewY && pointer.y <= viewY + viewH;

    this.entries.forEach(([id, data], i) => {
      const ry = viewY + i * (rowH + rowGap);
      const selected = id === this.selectedId;

      const bg = this.scene.add.rectangle(viewX, ry, rowW, rowH, selected ? 0x3a3320 : 0x1e1d2e, 0.95)
        .setOrigin(0, 0)
        .setStrokeStyle(2, selected ? 0xffd700 : 0x555544, selected ? 1 : 0.8)
        .setInteractive({ useHandCursor: true });
      this.listContainer.add(bg);

      this.listContainer.add(this.scene.add.text(viewX + 16, ry + rowH / 2 - 11, data.name, {
        fontSize: '18px', color: selected ? '#ffd700' : '#f0e6cc', fontStyle: 'bold', padding: { top: 4 },
        wordWrap: { width: rowW - 32 },
      }).setOrigin(0, 0.5));
      this.listContainer.add(this.scene.add.text(viewX + 16, ry + rowH / 2 + 15, `Lv.${this._levelOf(id)}`, {
        fontSize: '13px', color: '#b8963e', padding: { top: 4 },
      }).setOrigin(0, 0.5));

      if (!selected) {
        bg.on('pointerover', (p) => { if (inView(p)) bg.setStrokeStyle(2, 0xffd700, 1); });
        bg.on('pointerout', () => bg.setStrokeStyle(2, 0x555544, 0.8));
      }
      bg.on('pointerdown', (p) => {
        if (!inView(p)) return; // 行被滚出可视区（遮罩藏起来了）时忽略点击
        if (this.selectedId === id) return;
        this.selectedId = id;
        this._renderAll();
      });
    });

    // 滚动条（只有关卡数超过可视行数时才出现）：轨道 + 可拖拽滑块，位于外框内部右侧
    this.listThumb = null;
    if (needBar) {
      const trackX = x + w - padH - barW;
      c.add(this.scene.add.rectangle(trackX, viewY, barW, viewH, 0x000000, 0.5).setOrigin(0, 0)
        .setStrokeStyle(1, 0x555544, 0.8));

      const thumbH = Math.max(32, viewH * viewH / contentH);
      this._thumbH = thumbH;
      this._thumbX = trackX;
      this.listThumb = this.scene.add.rectangle(trackX, viewY, barW, thumbH, 0xb8963e, 1).setOrigin(0, 0)
        .setInteractive({ useHandCursor: true, draggable: true });
      this.listThumb.on('pointerover', () => this.listThumb.setFillStyle(0xffd700, 1));
      this.listThumb.on('pointerout', () => this.listThumb.setFillStyle(0xb8963e, 1));
      // 拖动：滑块在轨道内的位置比例 → 列表滚动位置
      this.listThumb.on('drag', (pointer, dragX, dragY) => {
        const range = viewH - thumbH;
        const ratio = range > 0 ? Math.min(1, Math.max(0, (dragY - viewY) / range)) : 0;
        this._setListScroll(ratio * maxScroll);
      });
      c.add(this.listThumb);
      if (this.scene.input.setDraggable) this.scene.input.setDraggable(this.listThumb);
    }

    // 应用沿用下来的滚动位置
    this._setListScroll(this.listScroll);
  }

  /** 设置列表滚动位置（像素，0 ~ 最大滚动量）：同步移动列表内容和滚动条滑块 */
  _setListScroll(v) {
    if (!this.listContainer || !this._listView) return;
    const { viewY, viewH } = this._listView;
    const maxScroll = this._listMaxScroll;
    this.listScroll = Math.min(Math.max(0, v), maxScroll);
    this.listContainer.y = -this.listScroll;
    if (this.listThumb) {
      const range = viewH - this._thumbH;
      this.listThumb.y = viewY + (maxScroll > 0 ? (this.listScroll / maxScroll) * range : 0);
    }
  }

  /** 鼠标滚轮：指针在列表外框内时滚动列表 */
  _onWheel(pointer, objs, dx, dy) {
    const lv = this._listView;
    if (!lv || this._listMaxScroll <= 0) return;
    if (pointer.x < lv.x || pointer.x > lv.x + lv.w) return;
    if (pointer.y < lv.y || pointer.y > lv.viewY + lv.viewH + (lv.viewY - lv.y)) return;
    this._setListScroll(this.listScroll + (dy > 0 ? 1 : -1) * 48);
  }

  /** 销毁列表的遮罩（重绘列表前、关闭界面时调用，避免遮罩图形泄漏） */
  _clearListMask() {
    this.listMask?.destroy?.();
    this.listMaskGfx?.destroy();
    this.listMask = null;
    this.listMaskGfx = null;
  }

  /** 右栏：详情面板（浅色卷轴风底板）——名称/等级、简介、敌方阵容、"开始挑战"按钮 */
  _renderDetailPanel(x, y, w, h) {
    const id = this.selectedId;
    if (id == null) return;
    const data = DUNGEON[id];
    const c = this.dynContainer;

    c.add(this.scene.add.rectangle(x, y, w, h, 0xe9dcb8, 0.96).setOrigin(0, 0)
      .setStrokeStyle(3, 0x8a6a2a, 1));

    const pad = 24;
    let cy = y + pad;

    c.add(this.scene.add.text(x + pad, cy, data.name, {
      fontSize: '26px', color: '#3b2a10', fontStyle: 'bold', fontFamily: 'serif', padding: { top: 4 },
    }).setOrigin(0, 0));
    c.add(this.scene.add.text(x + w - pad, cy + 4, `Lv.${this._levelOf(id)}`, {
      fontSize: '18px', color: '#8a4a10', fontStyle: 'bold', padding: { top: 4 },
    }).setOrigin(1, 0));
    cy += 44;

    c.add(this.scene.add.rectangle(x + pad, cy, w - pad * 2, 2, 0x8a6a2a, 0.6).setOrigin(0, 0));
    cy += 14;

    // 简介（可选字段 des）
    if (data.des) {
      const desTxt = this.scene.add.text(x + pad, cy, data.des, {
        fontSize: '16px', color: '#4a3a20', padding: { top: 4 },
        wordWrap: { width: w - pad * 2 }, lineSpacing: 6,
      }).setOrigin(0, 0);
      c.add(desTxt);
      cy += desTxt.height + 18;
    }

    // 敌方阵容：按 team 站位顺序展示头像+名称（同一单位出场多次就显示多次）
    c.add(this.scene.add.text(x + pad, cy, '敌方阵容', {
      fontSize: '17px', color: '#8a4a10', fontStyle: 'bold', padding: { top: 4 },
    }).setOrigin(0, 0));
    cy += 32;

    const team = data.team ?? [];
    const iconSize = 76, iconGap = 14;
    const perRow = Math.max(1, Math.floor((w - pad * 2 + iconGap) / (iconSize + iconGap)));
    team.forEach((unitKey, i) => {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const ix = x + pad + col * (iconSize + iconGap);
      const iy = cy + row * (iconSize + 40);
      const unitDef = data.units?.[unitKey];

      c.add(this.scene.add.rectangle(ix, iy, iconSize, iconSize, 0x2a2418, 0.9).setOrigin(0, 0)
        .setStrokeStyle(2, 0x8a6a2a, 1));

      const key = this._bossKey(id, unitKey);
      if (this.scene.textures.exists(key)) {
        const img = this.scene.add.image(ix + iconSize / 2, iy + iconSize / 2, key);
        img.setScale(Math.min((iconSize - 6) / img.width, (iconSize - 6) / img.height)).setOrigin(0.5);
        c.add(img);
      }
      c.add(this.scene.add.text(ix + iconSize / 2, iy + iconSize + 14, unitDef?.name ?? '', {
        fontSize: '13px', color: '#3b2a10', align: 'center', padding: { top: 4 },
        wordWrap: { width: iconSize + iconGap },
      }).setOrigin(0.5));
    });

    // "开始挑战"按钮（面板右下角）：直接进入选兵出战面板
    this._renderStartButton(x + w - pad - 90, y + h - pad - 23);
  }

  /** 开始挑战按钮：优先用通用绿色按钮底板（和 DungeonSelector 的"确认出征"一致），缺失时退回矩形 */
  _renderStartButton(cx, cy) {
    const c = this.dynContainer;
    const BW = 180, BH = 46;
    let hit;

    if (this.scene.textures.exists('common_btn_green')) {
      hit = this.scene.add.image(cx, cy, 'common_btn_green').setDisplaySize(BW, BH);
    } else {
      hit = this.scene.add.rectangle(cx, cy, BW, BH, 0xb8963e, 1).setStrokeStyle(2, 0x6a4a10, 1);
    }
    hit.setInteractive({ useHandCursor: true });
    const txt = this.scene.add.text(cx, cy, '开始挑战', {
      fontSize: '20px', color: '#1a1200', fontStyle: 'bold', padding: { top: 4 },
    }).setOrigin(0.5);

    hit.on('pointerover', () => hit.setAlpha(0.8));
    hit.on('pointerout', () => hit.setAlpha(1));
    hit.on('pointerdown', () => hit.setAlpha(0.6));
    hit.on('pointerup', () => { hit.setAlpha(1); this._enterLevel(this.selectedId); });
    c.add([hit, txt]);
  }

  _enterLevel(dungeonId) {
    this.destroy();
    new DungeonSelector(this.scene, this.saveData, dungeonId);
  }

  destroy() {
    if (this._wheelHandler) { this.scene.input.off('wheel', this._wheelHandler); this._wheelHandler = null; }
    this._clearListMask();
    this.root?.destroy(true);
    this.overlay?.destroy();
  }
}
