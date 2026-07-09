import { terrain as TERRAIN } from '../../data/terrain.js';
import { MAPS } from '../../data/map/EWland/map.js';
import { saveSystem } from '../../system/saveSystem.js';

/**
 * InitGame — 游戏初始化流程（saveData.status == 0 时触发）
 *
 * 流程：
 *  1. 隐藏左侧栏（行动/军事等）和底部栏，进入专属的选城界面
 *  2. 显示"请选择你的初始主城" + 底部"点击屏幕任何位置继续"
 *  3. 点击任意位置 → 提示消失，地图进入格点选择（不属于开发者编辑模式）
 *  4. 点击格点 → 弹出地形浮窗（图片 + 地形名，不显示格点编号）+ 确认按钮
 *     水域/无地形格点不可建城
 *  5. 点击确认 → 弹出"是否在当前位置（地形名）建城？" + 确认/取消
 *  6. 确认建城 → 写入 saveData，保存，还原 UI，销毁 InitGame
 *
 * MAPS 结构：{ grids: { g1: { type: 'ocean', isWater: true }, ... } }
 * TERRAIN 结构：{ ocean: { name: '海洋', image: '...' }, ... }
 *
 * @param {Phaser.Scene} scene
 * @param {Object}       saveData
 */
export class InitGame {
  constructor(scene, saveData) {
    this.scene = scene;
    this.saveData = saveData;
    this.mapView = scene.mapView;

    this.UI_DEPTH = 1001;

    // 临时屏蔽常规格子点击，避免 prompt 阶段误开 GridPanel
    this._savedOnGridClick = this.mapView.onGridClick;
    this.mapView.onGridClick = null;

    // UI 节点引用
    this.titleText = null;
    this.hintText = null;
    this.terrainCard = null;
    this.confirmModal = null;
    this._dimOverlay = null;

    // 隐藏左侧栏和底部栏
    this._setUiVisible(false);

    this._showPrompt();
  }

  // ─────────────────────────────────────────────────────
  // 左侧栏 / 底部栏 显示控制
  // ─────────────────────────────────────────────────────
  /**
   * 隐藏或还原 leftSideBar / bottomBar。
   * 兼容两种常见写法：对象直接有 setVisible()，或对象有 .container 属性。
   * 同时设置 isDisabled，防止隐藏期间误触按钮。
   */
  _setUiVisible(visible) {
    for (const key of ['leftSideBar', 'bottomBar']) {
      const bar = this.scene[key];
      if (!bar) continue;
      if (typeof bar.setVisible === 'function') bar.setVisible(visible);
      if (bar.container && typeof bar.container.setVisible === 'function') {
        bar.container.setVisible(visible);
      }
      // isDisabled 供 gameScene.bindEvents 内部的按钮回调判断用
      if (!visible) bar.isDisabled = true;
      else delete bar.isDisabled;
    }
  }

  // ─────────────────────────────────────────────────────
  // Step 1：提示文字
  // ─────────────────────────────────────────────────────
  _showPrompt() {
    const { width, height } = this.scene.scale;

    this.titleText = this.scene.add.text(
      width / 2, height / 2,
      '请选择你的初始主城',
      {
        fontFamily: 'serif',
        fontSize: '36px',
        color: '#f5e6c8',
        stroke: '#2c1a0e',
        strokeThickness: 6,
        shadow: { offsetX: 2, offsetY: 3, color: '#000', blur: 6, fill: true },
      }
    ).setOrigin(0.5).setDepth(this.UI_DEPTH).setAlpha(0);

    this.hintText = this.scene.add.text(
      width / 2, height - 18,
      '点击屏幕任何位置继续',
      { fontFamily: 'sans-serif', fontSize: '13px', color: '#999999' }
    ).setOrigin(0.5, 1).setDepth(this.UI_DEPTH).setAlpha(0);

    this.scene.tweens.add({
      targets: [this.titleText, this.hintText],
      alpha: 1, duration: 500, ease: 'Power2',
      onComplete: () => {
        this.scene.tweens.add({
          targets: this.hintText,
          alpha: { from: 1, to: 0.25 },
          duration: 900, yoyo: true, repeat: -1,
          ease: 'Sine.easeInOut',
        });
      },
    });

    this._promptClick = () => this._onContinue();
    this.scene.input.once('pointerdown', this._promptClick);
  }

  // ─────────────────────────────────────────────────────
  // Step 2：进入格点选择
  // ─────────────────────────────────────────────────────
  _onContinue() {
    this.scene.tweens.add({
      targets: [this.titleText, this.hintText],
      alpha: 0, duration: 280, ease: 'Linear',
      onComplete: () => {
        this.titleText?.destroy(); this.titleText = null;
        this.hintText?.destroy(); this.hintText = null;
      },
    });

    // devMode: false → 不是开发者工具，外部 dev UI（如"地形排布开发工具"标签）
    // 应检查 mapView.editMode.isDevMode 决定是否显示自己
    this.mapView.editMode.choosePanel((gridId) => {
      this._showTerrainCard(gridId);
    }, { devMode: false });
  }

  // ─────────────────────────────────────────────────────
  // Step 3：地形浮窗
  // ─────────────────────────────────────────────────────
  _showTerrainCard(gridId) {
    this._destroyTerrainCard();

    // 地形数据来自 MAPS.grids[gridId].type，不显示格点编号（gn）
    const gridMeta = MAPS.grids?.[gridId];
    const terrainKey = gridMeta?.type;
    const isWater = gridMeta?.isWater === true;
    const info = (terrainKey && !isWater) ? TERRAIN[terrainKey] : null;

    const { width, height } = this.scene.scale;
    const W = 320, H = 140;
    const cx = width / 2;
    // bottomBar 已隐藏，卡片贴近底部显示
    const cy = height - H / 2 - 16;

    this.terrainCard = this.scene.add.container(cx, cy).setDepth(this.UI_DEPTH);

    // ── 背景 ──────────────────────────────────────────
    const bg = this.scene.add.rectangle(0, 0, W, H, 0x0d0d1a, 0.92)
      .setStrokeStyle(1.5, 0x5a4a3a, 0.9);
    this.terrainCard.add(bg);

    if (info) {
      // ── 地形图片（左侧）──────────────────────────────
      const imageKey = `terrain_${terrainKey}`;
      if (this.scene.textures.exists(imageKey)) {
        const img = this.scene.add.image(-W / 2 + 60, -10, imageKey);
        const scale = Math.min(80 / img.width, 80 / img.height);
        img.setScale(scale).setOrigin(0.5);
        this.terrainCard.add(img);
      }

      // ── 地形名（右侧）────────────────────────────────
      const nameText = this.scene.add.text(
        -W / 2 + 128, -26, info.name,
        { fontFamily: 'serif', fontSize: '22px', color: '#f5e6c8' }
      ).setOrigin(0, 0.5);
      this.terrainCard.add(nameText);

      // ── 确认按钮 ──────────────────────────────────────
      this._addCardButton(
        this.terrainCard, -W / 2 + 200, 22,
        '确认', 'common_btn_green',
        () => this._showConfirmModal(gridId, info.name)
      );
    } else {
      // 水域或无地形数据，不可建城
      const reason = isWater ? '水域地块，不可建城' : '此处地形未知，不可建城';
      this.terrainCard.add(
        this.scene.add.text(0, 0, reason, {
          fontFamily: 'sans-serif', fontSize: '18px', color: '#666666',
        }).setOrigin(0.5)
      );
    }

    this.terrainCard.setAlpha(0);
    this.scene.tweens.add({
      targets: this.terrainCard, alpha: 1, duration: 180, ease: 'Linear',
    });
  }

  // ─────────────────────────────────────────────────────
  // Step 4：二次确认弹窗
  // ─────────────────────────────────────────────────────
  _showConfirmModal(gridId, terrainName) {
    this._destroyTerrainCard();
    this._destroyConfirmModal();

    const { width, height } = this.scene.scale;
    const W = 340, H = 160;
    const cx = width / 2, cy = height / 2;

    // ── 半透明遮罩（阻止点击穿透到地图格点）────────────
    this._dimOverlay = this.scene.add
      .rectangle(cx, cy, width, height, 0x000000, 0.55)
      .setDepth(this.UI_DEPTH)
      .setInteractive();

    // ── 弹窗容器 ──────────────────────────────────────
    this.confirmModal = this.scene.add.container(cx, cy).setDepth(this.UI_DEPTH + 1);

    const bg = this.scene.add.rectangle(0, 0, W, H, 0x12111e, 0.97)
      .setStrokeStyle(1.5, 0x7a6050, 1);
    this.confirmModal.add(bg);

    // 提示文字
    const msg = this.scene.add.text(
      0, -36,
      `是否在当前位置（${terrainName}）建城？`,
      {
        fontFamily: 'serif', fontSize: '20px', color: '#f5e6c8',
        wordWrap: { width: W - 40 }, align: 'center',
      }
    ).setOrigin(0.5);
    this.confirmModal.add(msg);

    // 确认按钮
    this._addCardButton(
      this.confirmModal, -80, 44,
      '确认', 'common_btn_green',
      () => this._saveMainCity(gridId)
    );

    // 取消按钮
    this._addCardButton(
      this.confirmModal, 80, 44,
      '取消', 'common_btn',
      () => this._destroyConfirmModal()
      // 取消后继续留在格点选择状态，玩家可重新点选其他格点
    );

    this.confirmModal.setAlpha(0);
    this._dimOverlay.setAlpha(0);
    this.scene.tweens.add({
      targets: [this.confirmModal, this._dimOverlay],
      alpha: 1, duration: 200, ease: 'Linear',
    });
  }

  // ─────────────────────────────────────────────────────
  // Step 5：写入存档，还原 UI，结束初始化
  // ─────────────────────────────────────────────────────
  _saveMainCity(gridId) {
    this.saveData.map.grids[gridId] = {
      region: 'main',
      buildings: {},
      products: {},
      isMain: true,
    };
    // 建城完成，游戏正式进入回合流程
    this.saveData.status = 1;

    saveSystem.save().then(() => {
      console.log('初始主城已建立：', gridId);
      // 先销毁选点 UI / 关闭选点模式（会清理临时发光格子），再刷新地图，
      // 避免 refreshMap 内部整体清空 gridsContainer 时和 choosePanel 的临时格子互相冲突
      this.destroy();
      // 刷新地图，让新建的主城格子（isMain）立即以主城样式显示出来
      this.mapView.refreshMap(this.saveData.map);
    });
  }

  // ─────────────────────────────────────────────────────
  // 内部工具
  // ─────────────────────────────────────────────────────

  /**
   * 在 container 内创建图片+文字叠加的可点击按钮
   */
  _addCardButton(parent, x, y, label, textureKey, onClick) {
    const BW = 120, BH = 38;
    const btnBg = this.scene.add.image(x, y, textureKey).setDisplaySize(BW, BH);
    const btnTxt = this.scene.add.text(x, y, label, {
      fontFamily: 'sans-serif', fontSize: '17px', color: '#ffffff',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);

    btnBg.setInteractive({ useHandCursor: true });
    btnBg.on('pointerover', () => btnBg.setAlpha(0.8));
    btnBg.on('pointerout', () => btnBg.setAlpha(1));
    btnBg.on('pointerdown', () => btnBg.setAlpha(0.6));
    btnBg.on('pointerup', () => { btnBg.setAlpha(1); onClick(); });

    parent.add([btnBg, btnTxt]);
  }

  _destroyTerrainCard() {
    if (this.terrainCard) { this.terrainCard.destroy(true); this.terrainCard = null; }
  }

  _destroyConfirmModal() {
    if (this.confirmModal) { this.confirmModal.destroy(true); this.confirmModal = null; }
    if (this._dimOverlay) { this._dimOverlay.destroy(); this._dimOverlay = null; }
  }

  // ─────────────────────────────────────────────────────
  // 销毁全部 UI，还原地图和 UI 状态
  // ─────────────────────────────────────────────────────
  destroy() {
    this.scene.input.off('pointerdown', this._promptClick);
    this.titleText?.destroy();
    this.hintText?.destroy();
    this._destroyTerrainCard();
    this._destroyConfirmModal();
    this.mapView.editMode.closeChoosePanel();
    this.mapView.onGridClick = this._savedOnGridClick;
    // 还原左侧栏和底部栏
    this._setUiVisible(true);
  }
}