import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import { MILITARY_UNIT } from '../../data/military_unit.js';
import { DUNGEON } from '../../data/dungeon.js';
import { ITEM } from '../../data/item.js';
import { BattleSystem } from './battleSystem.js';
import { game } from '../../system/function.js';
import { saveSystem } from '../../system/saveSystem.js';

// ─────────────────────────────────────────────
// 副本关卡的解锁 / 通关记录逻辑（关卡数据 data/dungeon.js 里不写解锁方式）
//
// 通关记录：saveData.storage.dungeon.cleared = { [关卡id]: 通关次数 }，战斗胜利时由 DungeonSelector 写入。
//
// 解锁规则：
//   1. 默认：通关上一关（按 DUNGEON 里的关卡顺序）才解锁；第一关始终解锁
//   2. 额外前提：个别关卡除了"通关上一关"之外还要同时满足其他条件，写在下面的 EXTRA_UNLOCK 里
//   3. GM 也不能绕过关卡锁（GM 绕过的只有副本入口的时代限制，见 military_ui.js）
// ─────────────────────────────────────────────

// 额外解锁前提（和"通关上一关"同时满足才解锁）。格式：
//   [关卡id]: { reason: '未满足时显示的提示文字', check: (saveData) => boolean }
// 目前没有关卡有额外前提。
const EXTRA_UNLOCK = {};

/** 某关的通关次数（没打通过为 0；兼容旧存档里存成 true 的情况，按 1 次算） */
export function getDungeonClearCount(saveData, id) {
  const v = saveData?.storage?.dungeon?.cleared?.[String(id)];
  return Number(v) || 0;
}

/** 某关是否已通关（通关次数 > 0） */
export function isDungeonCleared(saveData, id) {
  return getDungeonClearCount(saveData, id) > 0;
}

/** 记录某关通关一次（战斗胜利时调用），返回累计通关次数 */
export function markDungeonCleared(saveData, id) {
  if (!saveData) return 0;
  if (!saveData.storage || typeof saveData.storage !== 'object') saveData.storage = {};
  if (!saveData.storage.dungeon) saveData.storage.dungeon = {};
  if (!saveData.storage.dungeon.cleared) saveData.storage.dungeon.cleared = {};
  const key = String(id);
  const count = getDungeonClearCount(saveData, key) + 1;
  saveData.storage.dungeon.cleared[key] = count;
  return count;
}

/** 上一关的 id（按 DUNGEON 里的顺序）；第一关返回 null */
export function getPrevDungeonId(id) {
  const keys = Object.keys(DUNGEON);
  const i = keys.indexOf(String(id));
  return i > 0 ? keys[i - 1] : null;
}

/** 关卡的未解锁原因：已解锁返回 null，未解锁返回要显示的提示文字 */
export function getDungeonLockReason(saveData, id) {
  const prevId = getPrevDungeonId(id);
  if (prevId != null && !isDungeonCleared(saveData, prevId)) {
    return `通关【${DUNGEON[prevId]?.name ?? prevId}】后解锁`;
  }

  const extra = EXTRA_UNLOCK[String(id)];
  if (extra) {
    let ok = false;
    try { ok = !!extra.check(saveData); } catch (e) { ok = false; }
    if (!ok) return extra.reason ?? '尚未满足解锁条件';
  }
  return null;
}

/** 关卡是否已解锁 */
export function isDungeonUnlocked(saveData, id) {
  return getDungeonLockReason(saveData, id) === null;
}

// ─────────────────────────────────────────────
// 挑战次数 / 军事行动占用
//
// 副本默认每回合最多挑战 1 次（无论输赢、无论哪一关），每次挑战占用 1 次军事行动，
// 在选兵面板点"确认出征"时占用（之后无论胜负、中途退出都不退还）。
// 本回合已挑战过几次，直接数 saveData.actionList.military 里 key 以 dungeon_ 开头的条目
// （回合结算后行动列表会清空，所以自动按回合重置）。
// ─────────────────────────────────────────────

/** 副本每回合最多挑战次数。以后有特殊 buff 能增加次数时，在这里按 saveData 叠加。 */
export function getDungeonTurnLimit(saveData) {
  return 1;
}

/** 本回合已经挑战副本的次数 */
export function getDungeonChallengedThisTurn(saveData) {
  return Object.keys(saveData?.actionList?.military ?? {}).filter(k => k.startsWith('dungeon_')).length;
}

/** 现在不能挑战副本的原因：可以挑战返回 null，否则返回提示文字 */
export function getDungeonChallengeBlockReason(saveData) {
  if (getDungeonChallengedThisTurn(saveData) >= getDungeonTurnLimit(saveData)) return '本回合已挑战过副本';
  if (!game.hasAvailableAction('military')) return '军事行动数量超过上限';
  return null;
}

/**
 * 发放通关奖励：把 DUNGEON[id].reward（{ [物品编号]: 数量 }）直接加进 saveData.item。
 * @returns {string} 用于展示的奖励文字（没有奖励返回空字符串）
 */
function grantDungeonReward(saveData, id) {
  const reward = DUNGEON[String(id)]?.reward ?? {};
  const parts = [];
  for (const [itemId, count] of Object.entries(reward)) {
    if (!(count > 0)) continue;
    if (!saveData.item || typeof saveData.item !== 'object') saveData.item = {};
    saveData.item[itemId] = (saveData.item[itemId] ?? 0) + count;
    parts.push(`${ITEM[itemId]?.name ?? `物品${itemId}`}×${count}`);
  }
  return parts.length > 0 ? `获得奖励：${parts.join('、')}` : '';
}

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
  constructor(scene, saveData, dungeonId = '1', opts = {}) {
    this.onExit   = opts?.onExit ?? null; // 战斗结束/离开战斗后的回调（例如回到副本选关界面）
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
    closeHit.on('pointerdown', () => {
      // 还没开战就退出选兵：同样回到上一级界面（副本选关），而不是直接回到军事行动界面
      const onExit = this.onExit;
      this.destroy();
      onExit?.();
    });
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
      // 兵组大图缩小到卡片里：走 mip 纹理去锯齿（见 function.js addFittedImage）
      container.add(game.addFittedImage(this.scene, 0, -14, imgKey, w - 16, h - 50));
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
    // 先占用一次军事行动（同时校验本回合挑战次数/行动条上限），占用失败不开战
    const blockReason = getDungeonChallengeBlockReason(this.saveData);
    if (blockReason) {
      game.showTips(this.scene, blockReason);
      return;
    }
    const actionKey = `dungeon_${this.dungeonId}_${Date.now()}`;
    const added = game.addAction('military', actionKey, { dungeonId: this.dungeonId });
    if (!added) {
      game.showTips(this.scene, '军事行动数量超过上限');
      return;
    }

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

    const onExit = this.onExit;
    const { saveData, dungeonId } = this;
    this.destroy();

    new BattleSystem(this.scene, this.saveData, {
      attackers: bossIsAttacker ? [bossPerson] : [playerPerson],
      defenders: bossIsAttacker ? [playerPerson] : [bossPerson],
      // 副本模式：点击右上角关闭时需要二级确认（战斗已分出胜负后关闭不再提示）
      closeConfirm: '离开战斗会消耗次数且失去奖励，是否继续？',
      // 战斗结束（结算面板关闭）或确认离开战斗后，回到副本选关界面而不是直接回到军事行动界面
      onExit,
      // 战斗分出胜负的瞬间：记录结果到行动列表条目；玩家胜利则该关通关次数+1（首次通关即解锁下一关），
      // 并直接发放通关奖励。返回的奖励文字会显示在结算面板上。
      onEnd: ({ playerWon }) => {
        const entry = saveData.actionList?.military?.[actionKey];
        if (entry) entry.result = playerWon ? 'win' : 'lose';
        let rewardText = '';
        if (playerWon) {
          markDungeonCleared(saveData, dungeonId);
          rewardText = grantDungeonReward(saveData, dungeonId);
        }
        saveSystem.save();
        return rewardText;
      },
    });
  }

  destroy() {
    this.root?.destroy(true);
    this.overlay?.destroy();
  }
}