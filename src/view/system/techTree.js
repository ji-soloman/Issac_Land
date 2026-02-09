import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import { TECH_TREE } from '../../data/tech_tree.js';
import { get } from '../../system/i18n.js';
import { saveSystem } from '../../system/saveSystem.js';

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
    this.tryInitData();
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

  tryInitData() {
    if (!this.saveData.tech_tree || Object.keys(this.saveData.tech_tree).length === 0) {
      this.saveData.tech_tree = {
        unlocked: {
          farming_1: true,
          construction_1: true,
          leadership_1: true,
        },
        researching: {},
      }
      saveSystem.save().then(() => {
        console.log('初始化科技树成功');
      });
    }
  }

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

    // 1. 创建底图并直接绑定交互
    const bg = this.scene.add.image(0, 0, `common_btn${'_' + tech.color || ''}`);
    bg.setDisplaySize(this.NODE_WIDTH, this.NODE_HEIGHT);

    // 强制绑定在图片上
    bg.setInteractive({ useHandCursor: true });

    // 2. 点击事件处理
    bg.on('pointerdown', (pointer) => {
      // 只有在非拖拽状态下触发
      if (!this.isDragging) {
        // 这里的 bg 是点击目标，我们传给弹窗函数
        this.onTechClick(id, tech, bg);
      }
    });

    // 悬停效果
    bg.on('pointerover', () => bg.setTint(0xeeeeee));
    bg.on('pointerout', () => bg.clearTint());

    c.add(bg);

    // ---------- 图标与文字 ----------
    let iconKey = this.scene.textures.exists(`tech_icon_${id}`) ? `tech_icon_${id}` : 'tech_icon_default';
    const icon = this.scene.add.image(-this.NODE_WIDTH / 2 + this.NODE_HEIGHT * 0.5 + this.ICON_OFFSET_X, 0, iconKey);
    if (icon.width > 0) {
      const scale = Math.min((this.NODE_HEIGHT * 0.7) / icon.width, (this.NODE_HEIGHT * 0.7) / icon.height);
      icon.setScale(scale);
    }
    c.add(icon);

    const label = this.scene.add.text(this.TEXT_CENTER_OFFSET, 0, tech.name, {
      fontSize: '16px',
      color: '#fff',
      fontStyle: 'bold',
      align: 'center',
      padding: { top: 2 },
      wordWrap: { width: this.NODE_WIDTH - this.NODE_HEIGHT * 1.4 }
    }).setOrigin(0.5, 0.5);
    c.add(label);

    if (!this.canResearch(tech)) c.setAlpha(0.45);

    this.contentContainer.add(c);
  }

  // ================= 连线 =================

  drawConnections() {
    const graphics = this.scene.add.graphics();

    // 1. 先画普通实线
    graphics.lineStyle(2, 0xffffff, 0.8); // 实线稍微亮一点

    Object.entries(TECH_TREE).forEach(([id, tech]) => {
      tech.requires?.forEach(req => {
        const a = this.techPositions[req];
        const b = this.techPositions[id];
        if (!a || !b) return;

        // 如果距离不超过1列（col<= 1），画实线
        if (Math.abs(b.col - a.col) <= 1) {
          graphics.beginPath();
          graphics.moveTo(a.x + this.NODE_WIDTH / 2, a.y);
          graphics.lineTo(b.x - this.NODE_WIDTH / 2, b.y);
          graphics.strokePath();
        }
      });
    });

    // 2. 再画长距离虚线
    graphics.lineStyle(2, 0xffffff, 0.5); // 虚线透明度 50%

    Object.entries(TECH_TREE).forEach(([id, tech]) => {
      tech.requires?.forEach(req => {
        const a = this.techPositions[req];
        const b = this.techPositions[id];
        if (!a || !b) return;

        // 如果距离超过1列，画虚线
        if (Math.abs(b.col - a.col) > 1) {
          const startX = a.x + this.NODE_WIDTH / 2;
          const startY = a.y;
          const endX = b.x - this.NODE_WIDTH / 2;
          const endY = b.y;

          this.drawDashedLine(graphics, startX, startY, endX, endY);
        }
      });
    });

    this.contentContainer.add(graphics);
    this.contentContainer.moveTo(graphics, 0);
  }

  // 辅助方法：绘制虚线
  drawDashedLine(graphics, x1, y1, x2, y2, dashLen = 8, gapLen = 6) {
    const distance = Phaser.Math.Distance.Between(x1, y1, x2, y2);
    const angle = Phaser.Math.Angle.Between(x1, y1, x2, y2);

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    let currentDist = 0;

    while (currentDist < distance) {
      // 计算当前这一段实线的长度
      const len = Math.min(dashLen, distance - currentDist);

      const segX1 = x1 + cos * currentDist;
      const segY1 = y1 + sin * currentDist;
      const segX2 = x1 + cos * (currentDist + len);
      const segY2 = y1 + sin * (currentDist + len);

      graphics.lineBetween(segX1, segY1, segX2, segY2);

      // 跳过实线长度 + 间隙长度
      currentDist += dashLen + gapLen;
    }
  }

  canResearch(tech) {
    if (!tech.requires?.length) return true;
    return tech.requires.every(id => this.saveData.techs?.[id]);
  }

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
  showTechInfo(tech, targetImage) {
    // 1. 清理旧弹窗
    if (this.infoPopup) {
      this.infoPopup.destroy();
      this.infoPopup = null;
    }

    // 2. 创建主容器
    this.infoPopup = this.scene.add.container(0, 0).setDepth(2000);

    const { width: screenW, height: screenH } = this.scene.scale;
    const blocker = this.scene.add.rectangle(screenW / 2, screenH / 2, screenW, screenH, 0x000000, 0.01)
      .setInteractive();
    blocker.on('pointerdown', () => {
      this.infoPopup.destroy();
      this.infoPopup = null;
    });
    this.infoPopup.add(blocker);

    // 4. 构建内容组件
    const popupWidth = 280;
    const padding = 16;
    const content = this.scene.add.container(0, 0);

    let currentY = padding;
    const textW = popupWidth - padding * 2;

    // === 修正Padding ===
    // top: 5 保证顶部不被切掉，bottom: 0 保持底部紧凑
    const textPad = { top: 5, bottom: 0, left: 0, right: 0 };
    // 在计算下一行位置时，减去这个高度
    const padHeightCorrection = textPad.top + textPad.bottom;

    // --- 标题 ---
    const title = this.scene.add.text(popupWidth / 2, currentY, tech.name, {
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
      padding: textPad
    }).setOrigin(0.5, 0);

    content.add(title);
    // 计算高度时减去 padHeightCorrection
    currentY += (title.height - padHeightCorrection) + 12;

    // --- 功能描述 ---
    const infoLabel = this.scene.add.text(padding, currentY, "功能：", {
      fontSize: '14px', color: '#88aaff', fontStyle: 'bold', padding: textPad
    });
    const infoVal = this.scene.add.text(padding + infoLabel.width, currentY, tech.info || "暂无", {
      fontSize: '14px',
      color: '#dddddd',
      wordWrap: { width: textW - infoLabel.width },
      padding: textPad
    });
    content.add([infoLabel, infoVal]);
    // 同样减去修正值
    currentY += (Math.max(infoLabel.height, infoVal.height) - padHeightCorrection) + 10;

    // --- Cost ---
    if (tech.cost && Object.keys(tech.cost).length > 0) {
      const costLabel = this.scene.add.text(padding, currentY, "解锁要求：", {
        fontSize: '14px', color: '#88aaff', fontStyle: 'bold', padding: textPad
      });

      let costStrings = Object.entries(tech.cost).map(([key, val]) => {
        const resourceName = get.translation(key) || key;
        return `${resourceName}: ${val}`;
      });

      const costVal = this.scene.add.text(padding + costLabel.width, currentY, costStrings.join('  '), {
        fontSize: '14px',
        color: '#ffcc66',
        wordWrap: { width: textW - costLabel.width },
        padding: textPad
      });
      content.add([costLabel, costVal]);
      currentY += (Math.max(costLabel.height, costVal.height) - padHeightCorrection) + 10;
    }

    // --- 前置条件 ---
    const reqLabel = this.scene.add.text(padding, currentY, "前置条件：", {
      fontSize: '14px', color: '#88aaff', fontStyle: 'bold', padding: textPad
    });
    content.add(reqLabel);

    // 计算流式布局起始点
    // 注意：因为 label 加了 top padding，它的视觉位置下移了，所以后续文字的 Y 也要匹配这个“视觉Y”
    // 这里我们不需要额外加 padding.top，因为 currentY 已经是包含 padding 偏移的基准了
    let currentLineX = padding + reqLabel.width;
    let currentLineY = currentY;

    // 行高设定：字体大小(14) + 一点间隙，不再依赖 height 属性，避免 padding 干扰
    const lineHeight = 20;

    if (!tech.requires || tech.requires.length === 0) {
      // 这里的 Y 不需要修正，因为我们在流式布局里手动控制 Y
      const noneText = this.scene.add.text(currentLineX, currentLineY, "暂无", {
        fontSize: '14px', color: '#dddddd', padding: textPad
      });
      content.add(noneText);
      currentY += lineHeight + 10;
    } else {
      tech.requires.forEach((reqId, index) => {
        const reqName = TECH_TREE[reqId]?.name || reqId;
        const isUnlocked = this.saveData.tech_tree?.unlocked?.[reqId];
        const reqColor = isUnlocked ? '#dddddd' : '#ff5555';

        const reqText = this.scene.add.text(currentLineX, currentLineY, reqName, {
          fontSize: '14px',
          color: reqColor,
          padding: textPad // <--- 加上 Padding
        });

        // 换行判断：这里用 width (包含了padding) 判断是安全的
        // 但是我们需要减去 padding 对宽度的轻微影响来做精确判断吗？通常不需要，留点余量更好
        if (currentLineX + reqText.width > popupWidth - padding) {
          currentLineX = padding;
          currentLineY += lineHeight;
          reqText.setPosition(currentLineX, currentLineY);
        }

        content.add(reqText);
        // 这里累加 X 时，text.width 包含了左右 padding (默认0) 和文字宽度
        // 如果你觉得字之间间距太大，可以手动减一点，例如: reqText.width - 2
        currentLineX += reqText.width;

        if (index < tech.requires.length - 1) {
          const comma = this.scene.add.text(currentLineX, currentLineY, ", ", {
            fontSize: '14px',
            color: '#ffffff',
            padding: textPad
          });
          content.add(comma);
          currentLineX += comma.width;
        }
      });

      currentY = currentLineY + lineHeight + 10;
    }

    // 5. 绘制背景板
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1a1a1a, 0.95);
    bg.lineStyle(2, 0x444444, 1);
    bg.fillRoundedRect(0, 0, popupWidth, currentY, 8);
    bg.strokeRoundedRect(0, 0, popupWidth, currentY, 8);

    const visualGroup = this.scene.add.container(0, 0);
    visualGroup.add(bg);
    visualGroup.add(content);
    this.infoPopup.add(visualGroup);

    // 7. 定位逻辑
    const matrix = targetImage.getWorldTransformMatrix();
    const worldX = matrix.tx;
    const worldY = matrix.ty;

    let targetX = worldX + this.NODE_WIDTH / 2 + 10;
    let targetY = worldY - currentY / 2;

    if (targetX + popupWidth > screenW - 20) {
      targetX = worldX - this.NODE_WIDTH / 2 - popupWidth - 10;
    }
    targetY = Phaser.Math.Clamp(targetY, 20, screenH - currentY - 20);
    targetX = Phaser.Math.Clamp(targetX, 20, screenW - popupWidth - 20);

    visualGroup.setPosition(targetX, targetY);

    // 8. 动画
    visualGroup.setScale(0.9);
    visualGroup.setAlpha(0);
    this.scene.tweens.add({
      targets: visualGroup,
      scale: 1,
      alpha: 1,
      duration: 150,
      ease: 'Back.easeOut'
    });
  }

  onTechClick(id, tech, containerNode) {
    console.log('查看科技详情:', id);
    // 传入当前节点对象，用于计算位置
    this.showTechInfo(tech, containerNode);
  }

  destroy() {
    if (this.infoPopup) this.infoPopup.destroy();
    if (this.container) {
      this.container.destroy();
      this.container = null;
    }
  }
}