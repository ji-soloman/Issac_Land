import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import { MILITARY_UNIT } from '../../data/military_unit.js';
import { DUNGEON } from '../../data/dungeon.js';
import { BattleSystem } from './battleSystem.js';

const DEPTH = 1800;
const BG_COLOR    = 0x0d0d1a;
const THEME_COLOR = 0xb8963e;
const MAX_PICK    = 5;

/**
 * DungeonSelector — 副本选兵面板
 *
 * 玩家从 saveData.military 中已拥有的兵组里选择至多 5 个出战，
 * 确认后启动 BattleSystem，对手固定为 DUNGEON[dungeonId] 定义的boss队伍。
 * 界面/交互流程完全参照 SimBattleSelector（模拟战斗选兵面板），
 * 唯一区别是对手数据来源和攻守方分配（见 _startBattle）。
 *
 * 暂时不做选关UI——固定自动应用第一关（dungeonId 默认为 '1'）。
 */
export class DungeonSelector {
  constructor(scene, saveData, dungeonId = '1') {
    this.scene    = scene;
    this.saveData = saveData;
    this.dungeonId = String(dungeonId);
    this.dungeonData = DUNGEON[this.dungeonId];
    this.selected = new Set(); // 选中的 soldierId 集合

    if (!this.dungeonData) {
      console.error(`DungeonSelector: 找不到副本数据 DUNGEON['${this.dungeonId}']`);
      return;
    }

    this._build();
  }

  _build() {
    const { width, height } = this.scene.scale;

    this.overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.85)
      .setDepth(DEPTH).setInteractive();
    this.root = this.scene.add.container(0, 0).setDepth(DEPTH + 1);

    const bg = this.scene.add.rectangle(width / 2, height / 2, width, height, BG_COLOR, 0.97);
    this.root.add(bg);

    this.root.add(this.scene.add.text(width / 2, 34, `副本 · ${this.dungeonData.name} · 选择出战兵组`, {
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

    this._cardMap = new Map(); // soldierId -> { cardBg }

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

  /**
   * 把副本数据（DUNGEON[dungeonId]）转换成 BattleSystem 能识别的 boss 阵营配置。
   *
   * - units 表里每个单位都没有对应的 MILITARY_UNIT 模板（battleSystem.js 的
   *   _createTroopInstance 会退回直接使用这里传入的 stats/ability/displayName/image
   *   等字段，见该方法的注释）。
   * - team 是站位顺序数组（元素是 units 的 key，可重复——同一个单位可以出场多次），
   *   数组下标0在战场上对应"离中线最近/最前排"（见 battleSystem.js
   *   _renderPersonRow 的站位计算，攻守双方下标0都是最靠前）。不过 BattleSystem
   *   在备战阶段（_sortArmies）还会再按 military_order 从大到小重新排一次序，
   *   dungeon.js 里 team 数组本身的排列顺序已经和各单位的 military_order 保持一致
   *   （顺位大的排在前面），所以这里按 team 原样构建即可，最终呈现的站位顺序
   *   自然和 team 描述的一致，不需要额外处理。
   * - init_buff 是boss开局自带的buff（true=永久，否则为持续轮次数），由
   *   battleSystem.js 的 _createTroopInstance/_buildInitBuffs 早于被动技能初始化
   *   （onGameStart 钩子）之前写入，这里只需要原样透传。
   * - position（'attack'/'defend'）决定boss站进攻方还是防守方，玩家永远站在
   *   boss的对面——因为进攻方在同顺位时会优先出手（见 battleSystem.js
   *   _compareByActionOrder），position 直接影响开局的出手优先级。
   */
  _buildBossPerson() {
    const dungeonData = this.dungeonData;
    const troops = dungeonData.team.map((unitKey, idx) => {
      const unitDef = dungeonData.units[unitKey];
      return {
        soldierId: `dungeon_${this.dungeonId}_${unitKey}_${idx}`,
        // name 仅用于 MILITARY_UNIT 模板查找（这里注定查不到）和 Phaser 纹理缓存 key，
        // 加上关卡+站位前缀，避免不同副本关卡即使复用相同的 unitKey（如都叫'1'/'2'）
        // 也会互相冲突（例如纹理缓存串图、instanceId 重复）。
        name: `dungeon_${this.dungeonId}_${unitKey}`,
        displayName: unitDef.name,
        image: unitDef.image,
        type: unitDef.type,
        level: 1,
        stats: { ...(unitDef.basic_stats ?? {}) },
        ability: { ...(unitDef.special_ability ?? {}) },
        equipments: { ...(unitDef.equipments ?? {}) },
        init_buff: { ...(unitDef.init_buff ?? {}) },
      };
    });

    return {
      id: `dungeon_${this.dungeonId}`,
      name: dungeonData.name,
      isPlayer: false,
      troops,
    };
  }

  _startBattle() {
    const military = this.saveData.military ?? {};

    // 玩家阵容：从已选中的 soldierId 里取出兵组数据（和 SimBattleSelector 完全一致）
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

    const bossPerson = this._buildBossPerson();
    const bossIsAttacker = this.dungeonData.position === 'attack';

    this.destroy();

    new BattleSystem(this.scene, this.saveData, {
      attackers: bossIsAttacker ? [bossPerson] : [playerPerson],
      defenders: bossIsAttacker ? [playerPerson] : [bossPerson],
    });
  }

  destroy() {
    this.root?.destroy(true);
    this.overlay?.destroy();
  }
}