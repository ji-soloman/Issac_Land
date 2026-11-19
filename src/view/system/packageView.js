import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import { ITEM } from '../../data/item.js';
import { game } from '../../system/function.js';

const DEPTH = 1000;          // 和其它系统面板（InfoSystem 等）同一层级
const TIP_DEPTH = 1100;      // 物品浮窗，盖在面板之上
const THEME_COLOR = 0xb8963e;

/**
 * PackageSystem — 仓库（点击底部栏「仓库」打开）
 *
 * 显示物品格子：图标 + 名称，右下角是当前拥有数量；鼠标悬浮显示物品名称 / info / ref。
 *   - GM 模式（saveData.gm === true）：显示 ITEM 里的全部物品，没有拥有的数量显示 0；
 *   - 普通玩家：只显示 saveData.item 里数量 > 0 的物品。
 * 物品定义见 data/item.js，背包存档格式：saveData.item = { [物品编号]: 数量 }。
 *
 * 和 InfoSystem 保持同样的接口：构造即打开，close() 播放收起动画后关闭，destroy() 清理显示对象。
 */
export class PackageSystem {
  constructor(scene, saveData) {
    this.scene = scene;
    this.saveData = saveData;
    this._destroyed = false;
    this._loadAndCreate();
  }

  /** 当前要显示的物品列表：[{ id, def, count }]，按物品编号排序 */
  _getEntries() {
    const isGm = this.saveData?.gm === true;
    const bag = this.saveData?.item ?? {};
    return Object.keys(ITEM)
      .map(id => ({ id, def: ITEM[id], count: Math.max(0, Number(bag[id]) || 0) }))
      .filter(e => isGm || e.count > 0)
      .sort((a, b) => Number(a.id) - Number(b.id));
  }

  _itemKey(id) {
    return `item_${id}`;
  }

  /** 先按需加载要显示的物品图标（和副本选关界面共用 item_${id} 纹理缓存），加载完（或失败）再创建界面 */
  _loadAndCreate() {
    const entries = this._getEntries();
    const toLoad = entries.filter(e => e.def?.image && !this.scene.textures.exists(this._itemKey(e.id)));
    if (toLoad.length === 0) {
      this.create(entries);
      return;
    }

    let loaded = 0;
    const onDone = () => {
      loaded++;
      if (loaded >= toLoad.length) {
        this.scene.load.off('filecomplete', onDone);
        this.scene.load.off('loaderror', onDone);
        if (!this._destroyed) this.create(entries);
      }
    };
    this.scene.load.on('filecomplete', onDone);
    this.scene.load.on('loaderror', onDone); // 素材缺失也继续，用文字兜底
    toLoad.forEach(e => this.scene.load.image(this._itemKey(e.id), e.def.image));
    this.scene.load.start();
  }

  create(entries) {
    const { width, height } = this.scene.scale;
    const centerX = width / 2;
    const centerY = height / 2;
    const isGm = this.saveData?.gm === true;

    // ====== 主容器 ======
    this.container = this.scene.add.container(centerX, centerY);
    this.container.setScale(0);
    this.container.setDepth(DEPTH);

    // 面板尺寸：避开底部栏（和 InfoSystem 同样的留白算法）
    const bottomMargin = Math.max(120, height / 6) + 5;
    const topMargin = 20;
    const panelH = height - topMargin - bottomMargin;
    const panelW = Math.min(width * 0.8, 920);
    // InfoSystem 的图片是以屏幕中心为基准整体居中的，这里面板中心也取可用区域的中心
    const offsetY = (topMargin - bottomMargin) / 2;
    this.container.y = centerY + offsetY;
    const panelCenterY = centerY + offsetY;

    const bg = this.scene.add.rectangle(0, 0, panelW, panelH, 0x12111e, 0.97)
      .setStrokeStyle(3, THEME_COLOR, 1);
    this.container.add(bg);

    // 标题
    this.container.add(this.scene.add.text(0, -panelH / 2 + 34, '仓库', {
      fontSize: '28px', color: '#ffcc00', fontStyle: 'bold', fontFamily: 'serif',
      stroke: '#3a2000', strokeThickness: 4, padding: { top: 6 },
    }).setOrigin(0.5));

    // 分隔线
    this.container.add(this.scene.add.rectangle(0, -panelH / 2 + 66, panelW - 48, 2, THEME_COLOR, 0.6));

    // ====== 物品格子区域（可滚动）======
    const pad = 24;
    const areaLeft = -panelW / 2 + pad;
    const areaTop = -panelH / 2 + 80;
    const areaBottom = panelH / 2 - 20;
    const areaH = areaBottom - areaTop;
    const scrollbarW = 8;
    const areaW = panelW - pad * 2 - scrollbarW - 6;

    const boxSize = 76, cellW = 100, cellH = 124;
    const cols = Math.max(1, Math.floor(areaW / cellW));
    const gridW = cols * cellW;
    const gridLeft = areaLeft + (areaW - gridW) / 2; // 格子整体在可用宽度内居中

    this.contentContainer = this.scene.add.container(0, 0);
    this.container.add(this.contentContainer);

    if (entries.length === 0) {
      this.contentContainer.add(this.scene.add.text(0, areaTop + areaH / 2 - 20, '仓库空空如也', {
        fontSize: '20px', color: '#888888', padding: { top: 6 },
      }).setOrigin(0.5));
    }

    entries.forEach((e, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const cx = gridLeft + col * cellW + cellW / 2;
      const top = areaTop + row * cellH + 6;
      this._createCell(e, cx, top, boxSize, cellW, isGm);
    });

    const rows = Math.ceil(entries.length / cols);
    const contentH = rows * cellH + 6;

    // ====== 遮罩 + 滚动 ======
    this.scrollY = 0;
    this.maxScrollY = Math.max(0, contentH - areaH);
    // 遮罩用世界坐标（面板弹出动画结束后和容器位置一致）
    const maskShape = this.scene.make.graphics();
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(
      centerX + areaLeft - 4,
      panelCenterY + areaTop - 2,
      areaW + 8,
      areaH + 4,
    );
    this.contentContainer.setMask(maskShape.createGeometryMask());
    this._maskShape = maskShape;

    if (this.maxScrollY > 0) {
      this._scrollbar = {
        x: panelW / 2 - pad - scrollbarW / 2 + 2,
        top: areaTop,
        h: areaH,
        w: scrollbarW,
        thumbH: Math.max(30, areaH * (areaH / contentH)),
      };
      this._scrollGfx = this.scene.add.graphics();
      this.container.add(this._scrollGfx);
      this._drawScrollbar();

      this._wheelHandler = (pointer, objs, dx, dy) => {
        if (this._destroyed || !this.container) return;
        // 只有指针在面板范围内才滚动
        const inPanel = Math.abs(pointer.x - centerX) <= panelW / 2
          && Math.abs(pointer.y - panelCenterY) <= panelH / 2;
        if (!inPanel) return;
        this.scrollY = Phaser.Math.Clamp(this.scrollY + (dy > 0 ? 1 : -1) * 48, 0, this.maxScrollY);
        this.contentContainer.y = -this.scrollY;
        this._drawScrollbar();
      };
      this.scene.input.on('wheel', this._wheelHandler);
    }

    // ====== 关闭按钮 ======
    const closeBtn = this.scene.add.container(panelW / 2 - 30, -panelH / 2 + 30);
    const closeBg = this.scene.add.circle(0, 0, 20, 0xff0000, 0.8);
    const closeIcon = this.scene.add.text(0, 0, '×', { fontSize: '32px', color: '#fff' }).setOrigin(0.5, 0.5);
    closeBtn.add([closeBg, closeIcon]);
    closeBg.setInteractive({ useHandCursor: true });
    closeBg.on('pointerdown', () => this.close());
    this.container.add(closeBtn);

    // ====== 弹出动画 ======
    this.scene.tweens.add({
      targets: this.container,
      scale: 1,
      duration: 500,
      ease: 'Back.out',
    });
  }

  /** 单个物品格：底框 + 图标 + 右下角数量 + 下方名称 + 悬浮浮窗 */
  _createCell(entry, cx, top, boxSize, cellW, isGm) {
    const { id, def, count } = entry;
    const c = this.contentContainer;
    const owned = count > 0;
    const boxCy = top + boxSize / 2;

    c.add(this.scene.add.rectangle(cx, boxCy, boxSize, boxSize, 0x1e1d2e, 0.95)
      .setStrokeStyle(2, owned ? 0xb8963e : 0x555544, owned ? 0.9 : 0.7));

    const key = this._itemKey(id);
    if (this.scene.textures.exists(key)) {
      const img = game.addFittedImage(this.scene, cx, boxCy, key, boxSize - 10, boxSize - 10);
      if (img) c.add(img);
    } else {
      c.add(this.scene.add.text(cx, boxCy, def?.name ?? `物品${id}`, {
        fontSize: '12px', color: '#8a7a5a', align: 'center', padding: { top: 4 },
        wordWrap: { width: boxSize - 8 },
      }).setOrigin(0.5));
    }

    // 数量：图标右下角，黑底白边描边保证看得清
    c.add(this.scene.add.text(cx + boxSize / 2 - 4, boxCy + boxSize / 2 - 2, `${count}`, {
      fontSize: '15px', color: owned ? '#ffffff' : '#999999', fontStyle: 'bold', padding: { top: 2 },
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(1, 1));

    // 名称
    c.add(this.scene.add.text(cx, top + boxSize + 16, def?.name ?? `物品${id}`, {
      fontSize: '13px', color: owned ? '#f0e6cc' : '#888888', align: 'center', padding: { top: 4 },
      wordWrap: { width: cellW - 8 },
    }).setOrigin(0.5, 0));

    // 透明命中区域：悬浮显示名称 / info / ref
    const hit = this.scene.add.rectangle(cx, boxCy, boxSize, boxSize, 0, 0)
      .setInteractive({ useHandCursor: false });
    hit.on('pointerover', (ptr) => this._showItemTip(def, id, ptr));
    hit.on('pointermove', (ptr) => this._moveItemTip(ptr));
    hit.on('pointerout', () => this._hideItemTip());
    c.add(hit);
  }

  _drawScrollbar() {
    const g = this._scrollGfx, s = this._scrollbar;
    if (!g || !s) return;
    g.clear();
    g.fillStyle(0xffffff, 0.12);
    g.fillRoundedRect(s.x - s.w / 2, s.top, s.w, s.h, s.w / 2);
    const ratio = this.maxScrollY > 0 ? this.scrollY / this.maxScrollY : 0;
    const thumbY = s.top + (s.h - s.thumbH) * ratio;
    g.fillStyle(THEME_COLOR, 0.85);
    g.fillRoundedRect(s.x - s.w / 2, thumbY, s.w, s.thumbH, s.w / 2);
  }

  // ── 物品浮窗：名称（金色加粗）+ info + ref，空字段不显示 ──────────────
  _showItemTip(def, id, ptr) {
    this._hideItemTip();
    const W = 240, pad = 10;
    const tip = this.scene.add.container(0, 0).setDepth(TIP_DEPTH);

    const bg = this.scene.add.rectangle(0, 0, W, 10, 0x111122, 0.95).setOrigin(0, 0)
      .setStrokeStyle(1, THEME_COLOR, 1);
    tip.add(bg);

    let ty = pad;
    const addLine = (text, style, gap) => {
      const t = this.scene.add.text(pad, ty, text, {
        padding: { top: 2 }, wordWrap: { width: W - pad * 2, useAdvancedWrap: true }, lineSpacing: 3, ...style,
      }).setOrigin(0, 0);
      tip.add(t);
      ty += t.height + gap;
    };
    addLine(def?.name ?? `物品${id}`, { fontSize: '16px', color: '#ffcc44', fontStyle: 'bold' }, 6);
    if (def?.info) addLine(def.info, { fontSize: '13px', color: '#dddddd' }, 6);
    if (def?.ref) addLine(def.ref, { fontSize: '13px', color: '#9ec7ff' }, 6);

    const H = ty - 6 + pad;
    bg.setSize(W, H);
    tip._w = W; tip._h = H;
    this._itemTip = tip;
    this._moveItemTip(ptr);
  }

  _moveItemTip(ptr) {
    const tip = this._itemTip;
    if (!tip) return;
    const { width, height } = this.scene.scale;
    let tx = ptr.x + 16, ty = ptr.y + 16;
    if (tx + tip._w > width - 8) tx = ptr.x - 16 - tip._w;
    if (ty + tip._h > height - 8) ty = ptr.y - 16 - tip._h;
    tip.setPosition(Math.max(8, tx), Math.max(8, ty));
  }

  _hideItemTip() {
    if (this._itemTip) { this._itemTip.destroy(true); this._itemTip = null; }
  }

  close() {
    this._hideItemTip();
    if (this.container) {
      this.scene.tweens.add({
        targets: this.container,
        scale: 0,
        duration: 200,
        onComplete: () => {
          this.destroy();
          if (this.scene.closeCurrentSystem) this.scene.closeCurrentSystem();
        },
      });
    }
  }

  destroy() {
    this._destroyed = true;
    this._hideItemTip();
    if (this._wheelHandler) {
      this.scene.input.off('wheel', this._wheelHandler);
      this._wheelHandler = null;
    }
    this._maskShape?.destroy();
    this._maskShape = null;
    if (this.container) {
      this.container.destroy();
      this.container = null;
    }
  }
}