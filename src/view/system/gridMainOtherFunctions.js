import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import { MILITARY_UNIT } from '../../data/military_unit.js';
import { game } from '../../system/function.js';
import { MAPS } from '../../data/map/EWland/map.js';
import { terrain as TERRAIN } from '../../data/terrain.js';
import { saveSystem } from '../../system/saveSystem.js';

const DEPTH = 1100;
const BG_COLOR = 0x12111e;
const THEME_COLOR = 0xffd700;
const PANEL_COLOR = 0x1e1d2e;

/**
 * MainOtherFunctions — 主城"其他功能"全屏界面
 *
 * 点击主城 gridPanel 里的"其他功能"按钮后打开。
 * 点击某个功能后：关闭本界面，进入对应功能面板。
 *
 * @param {Phaser.Scene} scene
 * @param {Object}       saveData
 * @param {string}       gridId   — 触发的主城格点 id
 */
export class GridMainOtherFunctions {
  constructor(scene, saveData, gridId) {
    this.scene = scene;
    this.saveData = saveData;
    this.gridId = gridId;

    this._build();
  }

  _build() {
    const { width, height } = this.scene.scale;

    // 全屏遮罩
    this.overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.82)
      .setDepth(DEPTH).setInteractive();

    this.root = this.scene.add.container(0, 0).setDepth(DEPTH + 1);

    // 全屏背景
    const bg = this.scene.add.rectangle(width / 2, height / 2, width, height, BG_COLOR, 0.96);
    this.root.add(bg);

    // 标题
    const title = this.scene.add.text(width / 2, 36, '其他功能', {
      fontSize: '28px', color: '#ffd700', fontFamily: 'serif', fontStyle: 'bold',
      stroke: '#3a2000', strokeThickness: 4, padding: { top: 4 },
    }).setOrigin(0.5, 0.5);
    this.root.add(title);

    // 关闭按钮（右上角）
    const closeHit = this.scene.add.circle(width - 44, 36, 22, 0, 0)
      .setInteractive({ useHandCursor: true });
    const closeTxt = this.scene.add.text(width - 44, 36, '✕', {
      fontSize: '28px', color: '#ff4444', fontStyle: 'bold', padding: { top: 4 },
    }).setOrigin(0.5);
    closeHit.on('pointerover', () => closeTxt.setColor('#ffaaaa'));
    closeHit.on('pointerout', () => closeTxt.setColor('#ff4444'));
    closeHit.on('pointerdown', () => this.destroy());
    this.root.add([closeHit, closeTxt]);

    // 功能列表
    this._buildFunctionList(width, height);

    // 淡入
    this.root.setAlpha(0); this.overlay.setAlpha(0);
    this.scene.tweens.add({ targets: [this.root, this.overlay], alpha: 1, duration: 180 });
  }

  // ── 功能列表 ───────────────────────────────────
  _buildFunctionList(width, height) {
    const CARD_W = Math.min(320, width * 0.38);
    const CARD_H = 90;
    const COLS = Math.floor(width / (CARD_W + 24));
    const START_X = (width - (COLS * CARD_W + (COLS - 1) * 24)) / 2 + CARD_W / 2;
    const START_Y = 100;
    const SPACING = CARD_H + 20;

    // 功能定义列表——后续在此追加
    const funcs = [
      {
        key: 'explore_far',
        name: '开拓远方',
        desc: '派遣移民星舟，开拓未知的远方地域',
        // 可用条件：存在闲置的移民星舟（训练完成且无 currentStatus）
        available: () => this._hasIdleMigrationUnit() && game.hasAvailableAction('military'),
        locked_tip: '需要闲置的开拓兵组且军事行动条充足',
        action: () => this._openExploreFar(),
      },
    ];

    funcs.forEach((fn, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const cx = START_X + col * (CARD_W + 24);
      const cy = START_Y + row * SPACING + CARD_H / 2;
      this._createFuncCard(cx, cy, CARD_W, CARD_H, fn);
    });
  }

  _createFuncCard(cx, cy, W, H, fn) {
    const avail = fn.available();

    const cardBg = this.scene.add.rectangle(cx, cy, W, H, avail ? PANEL_COLOR : 0x111111, 0.95)
      .setStrokeStyle(1.5, avail ? THEME_COLOR : 0x333333, avail ? 0.7 : 0.4);
    if (avail) cardBg.setInteractive({ useHandCursor: true });

    const nameText = this.scene.add.text(cx, cy - 16, fn.name, {
      fontSize: '20px', fontStyle: 'bold',
      color: avail ? '#ffffff' : '#555555',
      padding: { top: 4 },
    }).setOrigin(0.5);

    const descText = this.scene.add.text(cx, cy + 14, avail ? fn.desc : fn.locked_tip, {
      fontSize: '13px',
      color: avail ? '#aaaaaa' : '#444444',
      padding: { top: 4 },
    }).setOrigin(0.5);

    this.root.add([cardBg, nameText, descText]);

    if (avail) {
      cardBg.on('pointerover', () => { cardBg.setFillStyle(0x2a2960, 0.95); cardBg.setStrokeStyle(2, THEME_COLOR, 1); });
      cardBg.on('pointerout', () => { cardBg.setFillStyle(PANEL_COLOR, 0.95); cardBg.setStrokeStyle(1.5, THEME_COLOR, 0.7); });
      cardBg.on('pointerdown', () => {
        // 点击功能时关闭本界面，再打开对应功能面板
        this.destroy();
        fn.action();
      });
    }
  }

  // ── 条件判断 ───────────────────────────────────

  /**
   * 判断是否存在拥有 migration 技能标签的闲置兵组
   * 闲置 = 已训练（在 saveData.military 中）且 currentStatus 为空或不存在
   */
  _hasIdleMigrationUnit() {
    const military = this.saveData.military ?? {};
    return Object.values(military).some(soldier => {
      if (soldier.currentStatus) return false;
      const template = MILITARY_UNIT[soldier.name];
      return !!template?.special_ability?.migration;
    });
  }

  // ── 功能入口 ───────────────────────────────────

  _openExploreFar() {
    // Step 1：选择一个有 migration 技能的闲置兵组
    this._showMigrationUnitSelector((soldierId) => {
      // Step 2：关闭当前 gridPanel（如果打开着）
      if (this.scene.currentGridPanel) {
        this.scene.currentGridPanel.destroy();
        this.scene.currentGridPanel = null;
        this.scene.mapView?.clearSelectedGrid?.();
      }

      // Step 3：计算城池（主城 + 所有分城）周边的未知格点集合
      const grids = this.saveData.map?.grids ?? {};
      const mapView = this.scene.mapView;
      const unknownSet = new Set();

      // 收集本城池所有格点 id
      const cityGridIds = [this.gridId, ...Object.keys(grids).filter(
        gn => grids[gn]?.hasMain === this.gridId
      )];

      for (const gn of cityGridIds) {
        const neighbors = mapView.getGridNeighbors(gn);
        for (const neighborGn of neighbors) {
          if (!neighborGn) continue;
          if (grids[neighborGn]) continue;          // 已发现，跳过
          unknownSet.add(neighborGn);
        }
      }

      // Step 4：进入选点模式，只点亮未知邻格
      const savedOnGridClick = mapView.onGridClick;
      mapView.onGridClick = null;

      mapView.editMode.choosePanel((selectedGn) => {
        // 地形浮窗（任意格点均可选）
        this._showExploreTerrainCard(selectedGn, soldierId, () => {
          mapView.editMode.closeChoosePanel();
          mapView.onGridClick = savedOnGridClick;
          this._hideExploreHint();
        });
      }, { devMode: false, allowedGridIds: [...unknownSet] });

      // Step 5：屏幕上方提示
      this._showExploreHint();
    });
  }

  // ── 选择开拓兵组的小窗 ────────────────────────
  _showMigrationUnitSelector(onSelect) {
    const { width, height } = this.scene.scale;
    const military = this.saveData.military ?? {};
    const candidates = Object.entries(military).filter(([, s]) => {
      if (s.currentStatus) return false;
      return !!MILITARY_UNIT[s.name]?.special_ability?.migration;
    });

    const W = 320;
    const ITEM_H = 52;
    const H = Math.max(160, 70 + candidates.length * (ITEM_H + 10) + 56);
    const cx = width / 2, cy = height / 2;
    const DEPTH = 1300;

    const overlay = this.scene.add.rectangle(cx, cy, width, height, 0x000000, 0.6)
      .setDepth(DEPTH).setInteractive();
    const modal = this.scene.add.container(cx, cy).setDepth(DEPTH + 1);

    modal.add(this.scene.add.rectangle(0, 0, W, H, 0x12111e, 0.97)
      .setStrokeStyle(1.5, 0xffd700, 0.7));
    modal.add(this.scene.add.text(0, -H / 2 + 22, '选择开拓兵组', {
      fontSize: '17px', color: '#ffd700', fontStyle: 'bold', padding: { top: 4 },
    }).setOrigin(0.5));

    const destroy = () => { modal.destroy(true); overlay.destroy(); };

    candidates.forEach(([id, s], i) => {
      const unitName = MILITARY_UNIT[s.name]?.name ?? s.name;
      const iy = -H / 2 + 60 + i * (ITEM_H + 10);

      const itemBg = this.scene.add.rectangle(0, iy + ITEM_H / 2, W - 24, ITEM_H, 0x1e1d2e, 0.9)
        .setStrokeStyle(1, 0x44aa44, 0.8).setInteractive({ useHandCursor: true });
      const itemTxt = this.scene.add.text(0, iy + ITEM_H / 2, unitName, {
        fontSize: '16px', color: '#dddddd', padding: { top: 4 },
      }).setOrigin(0.5);

      itemBg.on('pointerover', () => { itemBg.setFillStyle(0x2a2960, 0.9); });
      itemBg.on('pointerout', () => { itemBg.setFillStyle(0x1e1d2e, 0.9); });
      itemBg.on('pointerdown', () => { destroy(); onSelect(id); });
      modal.add([itemBg, itemTxt]);
    });

    // 取消
    const btnY = H / 2 - 28;
    const cancelBg = this.scene.add.image(0, btnY, 'common_btn').setDisplaySize(110, 34)
      .setInteractive({ useHandCursor: true });
    const cancelTxt = this.scene.add.text(0, btnY, '取消', {
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

  // ── 屏幕提示文字 ─────────────────────────────────
  _showExploreHint() {
    this._setUiVisible(false);
    const { width } = this.scene.scale;
    this._exploreHint = this.scene.add.text(width / 2, 60, '请选择一个未知领域开始探索', {
      fontSize: '20px', color: '#ffd700', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4, padding: { top: 4 },
    }).setOrigin(0.5).setDepth(2000).setScrollFactor(0);
  }

  _hideExploreHint() {
    this._setUiVisible(true);
    if (this._exploreHint) { this._exploreHint.destroy(); this._exploreHint = null; }
  }

  /**
   * 隐藏或还原 leftSideBar / bottomBar（复用 initGame 的同名逻辑）
   */
  _setUiVisible(visible) {
    for (const key of ['leftSideBar', 'bottomBar']) {
      const bar = this.scene[key];
      if (!bar) continue;
      if (typeof bar.setVisible === 'function') bar.setVisible(visible);
      if (bar.container && typeof bar.container.setVisible === 'function') {
        bar.container.setVisible(visible);
      }
      if (!visible) bar.isDisabled = true;
      else delete bar.isDisabled;
    }
  }

  // ── 格点详情浮窗（任意格点均可选） ───────────────
  _showExploreTerrainCard(gridId, soldierId, onClose) {
    // 销毁上一张卡
    if (this._terrainCard) { this._terrainCard.destroy(true); this._terrainCard = null; }

    const { width, height } = this.scene.scale;
    const W = 320, H = 140;
    const cx = width / 2;
    const cy = height - H / 2 - 16;

    const mapGridMeta = MAPS.grids?.[gridId];
    const terrainKey = mapGridMeta?.type;
    const info = (terrainKey && typeof terrainKey === 'string') ? TERRAIN[terrainKey] : null;
    const terrainName = info?.name ?? terrainKey ?? '未知地形';

    this._terrainCard = this.scene.add.container(cx, cy).setDepth(1300);

    const bg = this.scene.add.rectangle(0, 0, W, H, 0x0d0d1a, 0.92)
      .setStrokeStyle(1.5, 0x5a4a3a, 0.9);
    this._terrainCard.add(bg);

    // 地形图片
    const imgKey = `terrain_${terrainKey}`;
    if (terrainKey && this.scene.textures.exists(imgKey)) {
      const img = this.scene.add.image(-W / 2 + 60, -10, imgKey);
      const scale = Math.min(80 / img.width, 80 / img.height);
      img.setScale(scale).setOrigin(0.5);
      this._terrainCard.add(img);
    }

    // 地形名
    this._terrainCard.add(this.scene.add.text(-W / 2 + 128, -26, terrainName, {
      fontFamily: 'serif', fontSize: '22px', color: '#f5e6c8', padding: { top: 4 },
    }).setOrigin(0, 0.5));

    // 确认按钮
    const BW = 120, BH = 38;
    const btnBg = this.scene.add.image(-W / 2 + 200, 22, 'common_btn_green').setDisplaySize(BW, BH)
      .setInteractive({ useHandCursor: true });
    const btnTxt = this.scene.add.text(-W / 2 + 200, 22, '确认', {
      fontFamily: 'sans-serif', fontSize: '17px', color: '#1a1200', padding: { top: 4 },
    }).setOrigin(0.5);
    btnBg.on('pointerover', () => btnBg.setAlpha(0.8));
    btnBg.on('pointerout', () => btnBg.setAlpha(1));
    btnBg.on('pointerdown', () => btnBg.setAlpha(0.6));
    btnBg.on('pointerup', () => {
      btnBg.setAlpha(1);
      if (this._terrainCard) { this._terrainCard.destroy(true); this._terrainCard = null; }
      this._doExploreConfirm(gridId, soldierId, terrainName, onClose);
    });
    this._terrainCard.add([btnBg, btnTxt]);

    this._terrainCard.setAlpha(0);
    this.scene.tweens.add({ targets: this._terrainCard, alpha: 1, duration: 180 });
  }

  // ── 确认选定格点，写入数据 ──────────────────────
  _doExploreConfirm(gridId, soldierId, terrainName, onClose) {
    const { width, height } = this.scene.scale;
    const W = 340, H = 180;
    const cx = width / 2, cy = height / 2;
    const DEPTH = 1300;

    const overlay = this.scene.add.rectangle(cx, cy, width, height, 0x000000, 0.6)
      .setDepth(DEPTH).setInteractive();
    const modal = this.scene.add.container(cx, cy).setDepth(DEPTH + 1);

    modal.add(this.scene.add.rectangle(0, 0, W, H, 0x12111e, 0.97)
      .setStrokeStyle(1.5, 0xffd700, 0.7));
    modal.add(this.scene.add.text(0, -H / 2 + 22, '开拓确认', {
      fontSize: '16px', color: '#ffd700', fontStyle: 'bold', padding: { top: 4 },
    }).setOrigin(0.5));
    modal.add(this.scene.add.text(0, -10, `是否前往（${terrainName}）领域开拓？`, {
      fontSize: '16px', color: '#f5e6c8', align: 'center',
      wordWrap: { width: W - 40 }, padding: { top: 4 },
    }).setOrigin(0.5));

    const destroy = () => { modal.destroy(true); overlay.destroy(); };

    const addBtn = (x, key, label, onClick) => {
      const BW = 110, BH = 36;
      const bg = this.scene.add.image(x, H / 2 - 30, key).setDisplaySize(BW, BH)
        .setInteractive({ useHandCursor: true });
      const txt = this.scene.add.text(x, H / 2 - 30, label, {
        fontSize: '16px', color: '#1a1200', fontStyle: 'bold', padding: { top: 4 },
      }).setOrigin(0.5);
      bg.on('pointerover', () => bg.setAlpha(0.8));
      bg.on('pointerout', () => bg.setAlpha(1));
      bg.on('pointerdown', () => bg.setAlpha(0.6));
      bg.on('pointerup', () => { bg.setAlpha(1); onClick(); });
      modal.add([bg, txt]);
    };

    addBtn(-65, 'common_btn_green', '确认', () => {
      destroy();
      onClose();

      // 写入格点（野地：有存档记录，无 isMain 也无 hasMain）
      const grids = this.saveData.map.grids;
      grids[gridId] = {
        region: null,
        buildings: {},
        products: {},
        soldier: soldierId,  // 兵组驻扎于此格点
      };

      // 兵组状态标记为行动中，初始化行驶记录
      const soldier = this.saveData.military[soldierId];
      if (soldier) {
        soldier.currentStatus = `explore_far_${gridId}`;
        soldier.visitedGrids = [gridId];   // 记录已经过的格点（含当前驻扎格）
      }

      // 加入军事行动（仅占位，回合结算时跳过）
      const actionKey = `explore_far_${soldierId}_${Date.now()}`;
      game.addAction('military', actionKey, {
        type: 'explore_far',
        soldier: soldierId,
        gridId,
        placeholder: true,
      });

      // 保存并刷新地图
      saveSystem.save().then(() => {
        this.scene.mapView?.refreshMap(this.saveData.map);
      });
    });

    addBtn(65, 'common_btn', '取消', () => { destroy(); });

    modal.setAlpha(0); overlay.setAlpha(0);
    this.scene.tweens.add({ targets: [modal, overlay], alpha: 1, duration: 160 });
  }

  // ── 销毁 ───────────────────────────────────────
  destroy() {
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