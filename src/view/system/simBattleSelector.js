import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import { MILITARY_UNIT } from '../../data/military_unit.js';
import { BattleSystem } from './battleSystem.js';

const DEPTH = 1800;
const BG_COLOR    = 0x0d0d1a;
const THEME_COLOR = 0xb8963e;
const MAX_PICK    = 5;

// AI 默认阵容：兵组 key 对应 MILITARY_UNIT 里的条目（已核对实际配置表）。
// 不指定 quality，自动使用各兵种模板自带的品质。
const AI_DEFAULT_TEAM = [
  { name: 'scout' },       // 普通斥候
  { name: 'warrior' },     // 勇士
  { name: 'pitcher' },     // 投石手
  { name: 'Axeman' },      // 巨斧手
  { name: 'Inquisition' }, // 宗教审判官
];

/**
 * SimBattleSelector — 模拟战斗选兵面板
 *
 * 玩家从 saveData.military 中已拥有的兵组里选择至多 5 个参战，
 * 确认后启动 BattleSystem：玩家为进攻方，AI 使用固定的默认阵容作为防守方。
 */
export class SimBattleSelector {
  constructor(scene, saveData) {
    this.scene    = scene;
    this.saveData = saveData;
    this.selected = new Set(); // 选中的 soldierId 集合

    this._build();
  }

  _build() {
    const { width, height } = this.scene.scale;

    this.overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.85)
      .setDepth(DEPTH).setInteractive();
    this.root = this.scene.add.container(0, 0).setDepth(DEPTH + 1);

    const bg = this.scene.add.rectangle(width / 2, height / 2, width, height, BG_COLOR, 0.97);
    this.root.add(bg);

    this.root.add(this.scene.add.text(width / 2, 34, '模拟战斗 · 选择参战兵组', {
      fontSize: '24px', color: '#f0e6cc', fontStyle: 'bold', fontFamily: 'serif', padding: { top: 4 },
    }).setOrigin(0.5));

    this.hintText = this.scene.add.text(width / 2, 66, `已选择 0 / ${MAX_PICK}`, {
      fontSize: '15px', color: '#b8963e', padding: { top: 4 },
    }).setOrigin(0.5);
    this.root.add(this.hintText);

    // 关闭按钮
    const closeHit = this.scene.add.circle(width - 44, 34, 20, 0, 0)
      .setInteractive({ useHandCursor: true });
    const closeTxt = this.scene.add.text(width - 44, 34, '✕', {
      fontSize: '26px', color: '#ff4444', fontStyle: 'bold', padding: { top: 4 },
    }).setOrigin(0.5);
    closeHit.on('pointerdown', () => this.destroy());
    this.root.add([closeHit, closeTxt]);

    this._buildTroopGrid(width, height);
    this._buildConfirmButton(width, height);
  }

  _buildTroopGrid(width, height) {
    const military = this.saveData.military ?? {};
    const entries   = Object.entries(military);

    const cardW = 130, cardH = 150, gap = 16;
    const cols  = Math.max(1, Math.floor((width - 100) / (cardW + gap)));
    const startX = (width - (cols * cardW + (cols - 1) * gap)) / 2 + cardW / 2;
    const startY = 110;

    this._cardMap = new Map(); // soldierId -> { bg, ... }

    entries.forEach(([soldierId, soldier], i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cardW + gap);
      const y = startY + row * (cardH + gap) + cardH / 2;

      this._buildTroopCard(soldierId, soldier, x, y, cardW, cardH);
    });
  }

  _buildTroopCard(soldierId, soldier, x, y, w, h) {
    const tmpl = MILITARY_UNIT[soldier.name] ?? {};
    const container = this.scene.add.container(x, y);

    const cardBg = this.scene.add.rectangle(0, 0, w, h, 0x1e1d2e, 0.95)
      .setStrokeStyle(2, 0x555544, 0.8)
      .setInteractive({ useHandCursor: true });
    container.add(cardBg);

    const imgKey = `soldier_${soldier.name}`;
    if (this.scene.textures.exists(imgKey)) {
      const img = this.scene.add.image(0, -14, imgKey);
      const scale = Math.min((w - 16) / img.width, (h - 50) / img.height);
      img.setScale(scale).setOrigin(0.5);
      container.add(img);
    } else {
      container.add(this.scene.add.text(0, -14, tmpl.name ?? soldier.name, {
        fontSize: '13px', color: '#8a7a5a', align: 'center', padding: { top: 4 },
        wordWrap: { width: w - 12 },
      }).setOrigin(0.5));
    }

    container.add(this.scene.add.text(0, h / 2 - 24, tmpl.name ?? soldier.name, {
      fontSize: '14px', color: '#f0e6cc', fontStyle: 'bold', padding: { top: 4 },
      wordWrap: { width: w - 12 },
    }).setOrigin(0.5));

    container.add(this.scene.add.text(0, h / 2 - 10, `Lv.${soldier.level ?? 1}`, {
      fontSize: '12px', color: '#b8963e', padding: { top: 4 },
    }).setOrigin(0.5));

    // 若兵组已在行动中（currentStatus 非空），不可选
    const disabled = !!soldier.currentStatus;
    if (disabled) {
      cardBg.setFillStyle(0x111111, 0.9);
      container.add(this.scene.add.text(0, 0, '行动中', {
        fontSize: '13px', color: '#666666', padding: { top: 4 },
      }).setOrigin(0.5));
      cardBg.disableInteractive();
    } else {
      cardBg.on('pointerover', () => {
        if (!this.selected.has(soldierId)) cardBg.setStrokeStyle(2, 0xffd700, 1);
      });
      cardBg.on('pointerout', () => {
        if (!this.selected.has(soldierId)) cardBg.setStrokeStyle(2, 0x555544, 0.8);
      });
      cardBg.on('pointerdown', () => this._toggleSelect(soldierId, cardBg));
    }

    this.root.add(container);
    this._cardMap.set(soldierId, { cardBg });
  }

  _toggleSelect(soldierId, cardBg) {
    if (this.selected.has(soldierId)) {
      this.selected.delete(soldierId);
      cardBg.setStrokeStyle(2, 0x555544, 0.8);
      cardBg.setFillStyle(0x1e1d2e, 0.95);
    } else {
      if (this.selected.size >= MAX_PICK) {
        return; // 达到上限，忽略
      }
      this.selected.add(soldierId);
      cardBg.setStrokeStyle(2, 0xffd700, 1);
      cardBg.setFillStyle(0x2a2960, 0.95);
    }
    this.hintText.setText(`已选择 ${this.selected.size} / ${MAX_PICK}`);
    this._refreshConfirmBtn();
  }

  _buildConfirmButton(width, height) {
    const y = height - 50;
    const BW = 180, BH = 46;

    this.confirmBg = this.scene.add.image(width / 2, y, 'common_btn').setDisplaySize(BW, BH).setAlpha(0.5);
    this.confirmTxt = this.scene.add.text(width / 2, y, '确认出征', {
      fontSize: '18px', color: '#1a1200', fontStyle: 'bold', padding: { top: 4 },
    }).setOrigin(0.5);
    this.root.add([this.confirmBg, this.confirmTxt]);

    this._refreshConfirmBtn();
  }

  _refreshConfirmBtn() {
    const canConfirm = this.selected.size > 0;
    this.confirmBg.removeAllListeners();
    if (canConfirm) {
      this.confirmBg.setTexture('common_btn_green').setAlpha(1);
      this.confirmBg.setInteractive({ useHandCursor: true });
      this.confirmBg.on('pointerover',  () => this.confirmBg.setAlpha(0.8));
      this.confirmBg.on('pointerout',   () => this.confirmBg.setAlpha(1));
      this.confirmBg.on('pointerdown',  () => this.confirmBg.setAlpha(0.6));
      this.confirmBg.on('pointerup',    () => { this.confirmBg.setAlpha(1); this._startBattle(); });
    } else {
      this.confirmBg.setTexture('common_btn').setAlpha(0.5);
      this.confirmBg.disableInteractive();
    }
  }

  _startBattle() {
    const military = this.saveData.military ?? {};

    // 玩家阵容：从已选中的 soldierId 里取出兵组数据
    const playerTroops = [...this.selected].map(soldierId => ({
      soldierId,
      ...military[soldierId],
    }));

    const playerPerson = {
      id: 'player',
      name: this.saveData.name ?? '玩家',
      isPlayer: true,
      troops: playerTroops,
    };

    // AI 阵容：固定默认队伍
    const aiTroops = AI_DEFAULT_TEAM.map((cfg, i) => ({
      soldierId: `ai_default_${i}`,
      name:      cfg.name,
      level:     1,
      stats:     {},
      ability:   {},
    }));

    const aiPerson = {
      id: 'ai',
      name: 'AI',
      isPlayer: false,
      troops: aiTroops,
    };

    this.destroy();

    new BattleSystem(this.scene, this.saveData, {
      attackers: [playerPerson],
      defenders: [aiPerson],
    });
  }

  destroy() {
    this.root?.destroy(true);
    this.overlay?.destroy();
  }
}