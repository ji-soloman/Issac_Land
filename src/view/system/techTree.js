import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import { TECH_TREE } from '../../data/tech_tree.js';

export class TechTreeSystem {
  constructor(scene, saveData) {
    this.scene = scene;
    this.saveData = saveData;

    // ===== 强制科技节点尺寸 =====
    this.NODE_WIDTH = 214;
    this.NODE_HEIGHT = 56;

    this.MAX_ROWS = 5;
    this.COL_SPACING = 260;

    this.TOP_PADDING = 120;
    this.BOTTOM_PADDING = 120;

    // ===== UI参数 =====
    this.ICON_OFFSET_X = 14;
    this.TEXT_CENTER_OFFSET = 0;
    this.initialRows = {
      farming_1: 1,
      construction_1: 3,
      leadership_1: 5
    };

    this.scrollX = 0;
    this.maxScrollX = 0;
    this.isDragging = false;

    this.create();
  }

  create() {
    const { width, height } = this.scene.scale;

    this.ROW_SPACING =
      (height - this.TOP_PADDING - this.BOTTOM_PADDING - this.NODE_HEIGHT) /
      (this.MAX_ROWS - 1);

    this.container = this.scene.add.container(0, 0).setDepth(1000);

    this.container.add(
      this.scene.add.rectangle(
        width / 2,
        height / 2,
        width,
        height,
        0x1a1a1a,
        0.95
      )
    );

    this.contentContainer = this.scene.add.container(0, 0);
    this.container.add(this.contentContainer);

    this.calculateTechPositions();
    this.drawTechNodes();
    this.drawConnections();
    this.createScrollBar();
    this.createCloseButton();
    this.setupDragging();
  }

  // ================= 布局 =================

  calculateTechPositions() {
    this.techPositions = {};
    const used = {};

    const occupy = (c, r, id) => {
      if (!used[c]) used[c] = {};
      used[c][r] = id;
    };

    Object.entries(this.initialRows).forEach(([id, row]) => {
      this.techPositions[id] = {
        col: 0,
        row,
        x: 140,
        y:
          this.TOP_PADDING +
          (row - 1) * this.ROW_SPACING +
          this.NODE_HEIGHT / 2
      };
      occupy(0, row, id);
    });

    const sorted = this.topologicalSort();

    sorted.forEach(id => {
      if (this.techPositions[id]) return;

      const tech = TECH_TREE[id];
      if (!tech) return;

      let col = 0;
      if (tech.requires?.length) {
        col =
          Math.max(
            ...tech.requires.map(r => this.techPositions[r]?.col ?? 0)
          ) + 1;
      }

      let prefer = tech.requires?.length
        ? this.techPositions[tech.requires[0]]?.row ?? 3
        : 3;

      if (!used[col]) used[col] = {};
      const row = this.findAvailableRow(used[col], prefer);

      occupy(col, row, id);

      this.techPositions[id] = {
        col,
        row,
        x: col * this.COL_SPACING + 140,
        y:
          this.TOP_PADDING +
          (row - 1) * this.ROW_SPACING +
          this.NODE_HEIGHT / 2
      };
    });

    const maxCol = Math.max(...Object.values(this.techPositions).map(p => p.col));
    this.maxScrollX = Math.max(
      0,
      (maxCol + 1) * this.COL_SPACING - this.scene.scale.width + 200
    );
  }

  topologicalSort() {
    const v = new Set();
    const res = [];

    const dfs = id => {
      if (v.has(id)) return;
      v.add(id);
      TECH_TREE[id]?.requires?.forEach(dfs);
      res.push(id);
    };

    Object.keys(TECH_TREE).forEach(dfs);
    return res;
  }

  findAvailableRow(map, pref) {
    if (!map[pref]) return pref;

    for (let d = 1; d <= this.MAX_ROWS; d++) {
      if (pref - d >= 1 && !map[pref - d]) return pref - d;
      if (pref + d <= this.MAX_ROWS && !map[pref + d]) return pref + d;
    }
    return pref;
  }

  // ================= 节点 =================

  drawTechNodes() {
    Object.entries(TECH_TREE).forEach(([id, tech]) => {
      const pos = this.techPositions[id];
      if (pos) this.createTechNode(id, tech, pos.x, pos.y);
    });
  }

  createTechNode(id, tech, x, y) {
    const c = this.scene.add.container(x, y);

    const bg = this.scene.add.image(
      0,
      0,
      `common_btn_${tech.color || 'green'}`
    );
    bg.setDisplaySize(this.NODE_WIDTH, this.NODE_HEIGHT);
    c.add(bg);

    // ---------- icon ----------
    const icon = this.scene.add.image(
      -this.NODE_WIDTH / 2 +
      this.NODE_HEIGHT * 0.5 +
      this.ICON_OFFSET_X,
      0,
      `tech_icon_${id}`
    );

    const maxIcon = this.NODE_HEIGHT * 0.7;
    const scale = Math.min(maxIcon / icon.width, maxIcon / icon.height);
    icon.setScale(scale);
    c.add(icon);

    // ---------- 文本居中 ----------
    const label = this.scene.add
      .text(
        this.TEXT_CENTER_OFFSET, // 文本整体微调
        0,
        tech.name,
        {
          fontSize: '16px',
          color: '#fff',
          fontStyle: 'bold',
          align: 'center',
          padding: { top: 10 },
          wordWrap: { width: this.NODE_WIDTH - this.NODE_HEIGHT * 1.4 }
        }
      )
      .setOrigin(0.5, 0.5);

    c.add(label);

    if (!this.canResearch(tech)) c.setAlpha(0.45);

    c.setSize(this.NODE_WIDTH, this.NODE_HEIGHT);
    c.setInteractive(
      new Phaser.Geom.Rectangle(
        -this.NODE_WIDTH / 2,
        -this.NODE_HEIGHT / 2,
        this.NODE_WIDTH,
        this.NODE_HEIGHT
      ),
      Phaser.Geom.Rectangle.Contains
    );

    c.on('pointerover', () =>
      this.scene.input.setDefaultCursor('pointer')
    );
    c.on('pointerout', () =>
      this.scene.input.setDefaultCursor('default')
    );

    c.on('pointerdown', () => {
      if (!this.isDragging) this.onTechClick(id, tech);
    });

    this.contentContainer.add(c);
  }

  // ================= 连线 =================

  drawConnections() {
    const g = this.scene.add.graphics();
    g.lineStyle(2, 0xffffff, 0.5);

    Object.entries(TECH_TREE).forEach(([id, tech]) => {
      tech.requires?.forEach(req => {
        const a = this.techPositions[req];
        const b = this.techPositions[id];
        if (!a || !b) return;

        g.beginPath();
        g.moveTo(a.x + this.NODE_WIDTH / 2, a.y);
        g.lineTo(b.x - this.NODE_WIDTH / 2, b.y);
        g.strokePath();
      });
    });

    this.contentContainer.add(g);
    this.contentContainer.sendToBack(g);
  }

  canResearch(tech) {
    if (!tech.requires?.length) return true;
    return tech.requires.every(id => this.saveData.techs?.[id]);
  }

  // ================= UI =================

  createScrollBar() {
    const { width, height } = this.scene.scale;
    const barW = width - 100;
    const barX = 50;
    const y = height - 40;

    this.container.add(
      this.scene.add.rectangle(width / 2, y, barW, 8, 0x444444)
    );

    const handleW = Math.max(
      90,
      barW * (width / (width + this.maxScrollX))
    );

    this.scrollHandle = this.scene.add.rectangle(
      barX + handleW / 2,
      y,
      handleW,
      18,
      0x888888
    );

    this.scrollHandle.setInteractive({ draggable: true });
    this.container.add(this.scrollHandle);

    this.scrollHandle.on('drag', (_, dx) => {
      const min = barX + handleW / 2;
      const max = barX + barW - handleW / 2;
      const x = Phaser.Math.Clamp(dx, min, max);

      this.scrollHandle.x = x;
      const p = (x - min) / (max - min);
      this.scrollX = p * this.maxScrollX;
      this.contentContainer.x = -this.scrollX;
    });
  }

  setupDragging() {
    let startX = 0;
    let startContent = 0;

    this.scene.input.on('pointerdown', p => {
      startX = p.x;
      startContent = this.contentContainer.x;
    });

    this.scene.input.on('pointermove', p => {
      if (!p.isDown) return;

      const dx = p.x - startX;
      if (Math.abs(dx) > 6) {
        this.isDragging = true;

        const nx = Phaser.Math.Clamp(
          startContent + dx,
          -this.maxScrollX,
          0
        );
        this.contentContainer.x = nx;
        this.scrollX = -nx;
        this.updateScrollHandle();
      }
    });

    this.scene.input.on('pointerup', () => {
      setTimeout(() => (this.isDragging = false), 30);
    });
  }

  updateScrollHandle() {
    const { width } = this.scene.scale;
    const barW = width - 100;
    const barX = 50;
    const hw = this.scrollHandle.width;

    const min = barX + hw / 2;
    const max = barX + barW - hw / 2;

    this.scrollHandle.x =
      min + (this.scrollX / this.maxScrollX) * (max - min);
  }

  createCloseButton() {
    const { width } = this.scene.scale;

    const btn = this.scene.add.image(width - 60, 60, 'ui_close_btn');
    btn.setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => this.scene.closeCurrentSystem());

    this.container.add(btn);
  }

  onTechClick(id, tech) {
    console.log('研究科技:', id);
  }

  destroy() {
    if (this.container) {
      this.container.destroy();
      this.container = null;
    }
  }
}
