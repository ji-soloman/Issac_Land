import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import { MILITARY_UNIT } from '../../data/military_unit.js';
import { MILITARY_SKILL } from '../../data/military_skill.js';
import { MILITARY_BUFF } from '../../data/military_buff.js';

const DEPTH = 1600;
const BG_COLOR = 0x0d0d1a;
const BG_IMAGE_KEY = 'battle_bg_image'; // 战场背景图纹理 key，图片路径见 _loadAssetsAndBuild
// 魔力图标改用 DOM <img> 展示（和技能图标一致的做法，见 _addActionBtn），
// 直接用路径而不走 Phaser 纹理加载，路径复用兵组详情页(militaryUnitView.js)同一份素材
const MANA_ICON_PATH = 'assets/military/ui/mana.png';
const THEME_COLOR = 0xb8963e;
const THEME_COLOR_HEX = '#b8963e'; // THEME_COLOR 的字符串形式，供 Text 的 color 参数使用
const LOG_HIGHLIGHT_COLOR = '#ffd700'; // 战斗记录里兵组名/技能名高亮成的黄色，和场上其它金色高亮（如行动中高亮描边）保持一致的色调
const ATTACKER_TINT = 0xff6666;
const DEFENDER_TINT = 0x6699ff;

// 面板视觉主题（战斗记录/行动框/功能栏/标题牌统一用这一套）：深蓝黑圆角底 + 金色描边，
// 对照参考图新增——比之前的纯色矩形面板更接近参考图里"深色卡片+金色细边"的调性。
const PANEL_BG_COLOR = 0x0c1420;  // 面板深蓝黑色底
const PANEL_BG_ALPHA = 0.82;
const PANEL_RADIUS = 12;        // 面板圆角半径
const PANEL_TEXT_COLOR = '#ede0c0'; // 面板暖白/米金色文字
const PANEL_MUTED_TEXT_COLOR = '#7d7566'; // 面板里"不可用/次要"状态的文字（如技能负担不起时）

// 每行（每人）最多显示的兵组数量，超出部分仍参与战斗，但一路的卡牌总宽度可能超出
// 屏幕可用空间——此时会在这一路下方出现可拖动的横向拉条（见 _renderRowScrollbar），
// 不会真的把卡牌硬挤在一起。
const MAX_SLOTS_PER_ROW = 8;
// 召唤生物在战场上的数量上限——这是一条独立于"战术宽度"（MAX_SLOTS_PER_ROW，
// 站位队列的显示/排布上限）的规则：不管这一方站位队列还剩多少空位，只要这一方
// 场上存活的召唤物（isSummoned标记）数量已经达到这个上限，就无法再召唤新的。
const MAX_SUMMONED_PER_SIDE = 5;
const SLOT_W = 104;
const SLOT_H = 132;
const SLOT_GAP = 12;
const ROW_GAP = 78; // 卡牌上方有血条/护甲条、下方有法力条+buff图标行，行间距要留够空间避免相邻行重叠
const FRONT_GAP = 50; // 攻守双方最前排卡牌之间的额外间距（避免贴在中线上）
const FIELD_TOP = 96; // 兵组卡牌区域顶部起始 y（_renderField 用它排布卡牌，_buildUI 用它定位VS标记/中线）
const ROW_SCROLLBAR_H = 6; // 一路兵组过多时，下方横向拉条的轨道粗细

// 底部三栏面板（战斗记录 / 行动 / 功能）统一布局参数——三栏顶对齐、等高、水平排成一行，
// 具体每栏的 x/宽度由 _getBottomLayout() 统一计算，不要在各自的构建函数里各算一套。
const BOTTOM_MARGIN = 16;        // 三栏面板离屏幕左右/底边的间距
const BOTTOM_PANEL_H = 210;      // 三栏面板统一高度
const BOTTOM_GAP = 14;           // 三栏面板之间的水平间距
// 战斗记录栏和功能栏宽度占比保持相等，这样行动栏（剩余宽度）会自动左右对称、居中显示
const LOG_PANEL_W_RATIO = 0.23;  // 战斗记录栏宽度占比（三栏可用总宽度）
const FUNC_PANEL_W_RATIO = 0.23; // 功能栏宽度占比——行动栏占剩余宽度

/**
 * DAMAGE_TYPE — 伤害类型注册表。
 *
 * 伤害拆分（components）是形如 { physical: 10, magic: 5, pure: 3 } 的对象——
 * 只需要传实际用到的类型，缺失的类型视为0，不要求每次都把所有类型的 key 都写全。
 * 新增一种伤害类型（比如以后要加"神圣伤害"）只需要在这里加一条注册，
 * 求和（sumDamageComponents）、飘字颜色（_spawnDamageFloaters）、是否默认无视护甲
 * （dealDamage 里的 inferIgnoreArmor）都会自动识别，不需要再去各处手动加 if 分支。
 *
 *   color       — 该类型伤害飘字的文字颜色（描边统一是黑色，见 _spawnDamageFloaters）
 *   ignoreArmor — 该类型伤害是否天然无视护甲：当一次 dealDamage 调用里所有>0的伤害类型
 *                 都是这种"天然无视护甲"的类型时，自动无视护甲抵消，不需要调用方每次
 *                 手动传 { ignoreArmor: true }；调用方显式传 options.ignoreArmor 时
 *                 以调用方为准（可以强制开启或关闭）。
 */
const DAMAGE_TYPE = {
  physical: { color: '#ff4444', ignoreArmor: false }, // 物理伤害：红色
  magic: { color: '#99e6ff', ignoreArmor: false }, // 魔法伤害：淡蓝色
  pure: { color: '#ffffff', ignoreArmor: true },  // 真实伤害：白色（黑边），无视护甲——烧伤/冻伤等特殊结算用
};

/**
 * 计算一份伤害拆分的总伤害——只累加 DAMAGE_TYPE 里注册过的类型字段，
 * 未注册的字段（脏数据/拼写错误的 key）会被忽略而不是被当成有效伤害。
 * @param {Record<string, number>} [components]
 * @returns {number}
 */
function sumDamageComponents(components) {
  if (!components) return 0;
  let total = 0;
  for (const key of Object.keys(DAMAGE_TYPE)) {
    total += Math.max(0, components[key] ?? 0);
  }
  return total;
}

/**
 * 判断一份伤害拆分是否应该自动无视护甲：当且仅当这次造成的、大于0的伤害类型
 * 全部是 DAMAGE_TYPE 里标记了 ignoreArmor:true 的类型（例如只有 pure 一种）——
 * 只要掺杂了任意一种"不无视护甲"的类型（如 physical/magic），就不会自动触发。
 * @param {Record<string, number>} [components]
 * @returns {boolean}
 */
function inferIgnoreArmor(components) {
  if (!components) return false;
  const activeKeys = Object.keys(DAMAGE_TYPE).filter(key => (components[key] ?? 0) > 0);
  if (activeKeys.length === 0) return false;
  return activeKeys.every(key => DAMAGE_TYPE[key].ignoreArmor);
}

/**
 * buff 分类表 —— 用于"免疫控制类/免疫弱化类"这类效果的判定（例如玄藏、守护、无双）。
 * 新增的 buff 如果需要参与这类免疫判定，把它的 key 加入对应集合即可，不需要改动别处逻辑。
 * 目前只做"是否允许施加”的拦截判定，不涉及"无法行动"类效果本身的回合跳过（那是另一套
 * 尚未实装的机制），仅用于让骸骨护盾（施加玄藏）等技能对未来的控制类效果产生实际免疫效果。
 */
const CONTROL_BUFF_KEYS = new Set([1, 5, 6, 8]);     // 眩晕/疲惫/恐惧/冰冻——"无法行动"类控制效果
const DEBUFF_BUFF_KEYS = new Set([3, 4, 9, 10]);    // 烧伤/中毒/衰弱/溺水——伤害/削弱类弱化效果
const CONTROL_IMMUNE_BUFF_KEYS = new Set([11, 16]);  // 振奋/玄藏——持有时免疫控制类
const DEBUFF_IMMUNE_BUFF_KEYS = new Set([12, 17]);  // 无双/守护——持有时免疫弱化类

/** 判断目标身上是否持有 keySet 集合里的任意一个、且剩余轮次>0的 buff */
function hasActiveBuffFromSet(troop, keySet) {
  if (!troop?.buffs) return false;
  return Object.keys(troop.buffs).some(k => (troop.buffs[k] ?? 0) > 0 && keySet.has(Number(k)));
}

/**
 * 判断一个兵组当前是否"存在于战场上"——统一入口，供所有"这个目标还在不在场上"的
 * 判定使用（目标候选计算、回合行动队列、buff触发扫描、嘲讽判定、战斗结束判定等）。
 *
 * 除了生命值必须大于0，还要求没有被打上【消逝】标记（troop._vanished）。
 * 【消逝】是一种特殊的阵亡状态：某些技能（例如罗睺一斩）杀死目标并将其转化为
 * 召唤物时，除了照常触发这个目标自己的普通阵亡结算流程（清空buff、变灰禁用交互、
 * 播报"已阵亡"，见 _resolveDeath）之外，还会额外给这个目标打上 _vanished 标记——
 * 没有专门的前端显示（不出现任何图标/文字），纯粹是内部状态：这个目标已经彻底
 * 从战场上消失了，即使未来出现某些"复活/回复生命"效果意外把它的生命值改回了
 * 正数，只要 _vanished 为 true，依然要在所有"是否在场上"的判定里把它当作不存在，
 * 不会被复活或重新参与战斗。
 * @param {object} troop
 * @returns {boolean}
 */
function isOnBattlefield(troop) {
  return (troop?.currentHp ?? 0) > 0 && !troop?._vanished;
}

/**
 * BattleSystem — 战斗准备与推进系统
 *
 * 外部调用方式：
 *   new BattleSystem(scene, saveData, {
 *     attackers: [
 *       {
 *         id: 'player1', name: '玩家', isPlayer: true,
 *         troops: [
 *           { soldierId: 's123', name: 'warrior', stats: {...}, equipments: {...}, ability: {...}, level: 2, quality: 'good' },
 *           ...
 *         ]
 *       },
 *       ...
 *     ],
 *     defenders: [ ... ]  // 结构同 attackers
 *   })
 *
 * 每个 troop 条目的字段结构和 saveData.military 里的兵组记录一致：
 *   name        — 对应 MILITARY_UNIT 的 key（兵种模板）
 *   stats       — 覆盖 basic_stats 的数值（缺省则使用模板默认值）
 *   equipments  — 装备（暂未使用，预留）
 *   ability     — 覆盖 special_ability 的技能标记（缺省则使用模板默认值）
 *   level       — 兵组等级
 *   quality     — 品质（缺省 'normal'）
 *
 * 流程：
 *   1. 初始化所有兵组（合并模板与实例数据，拆分主动/被动/tag技能）
 *   2. 每个人的军队按 military_order 降序排列（顺位大在前）
 *   3. 攻守双方对着站，展示兵组图片
 *   4. 玩家可在同顺位组内拖拽调整站位；AI 默认不换
 *   5. 点击【开始战斗】：重新排序所有队伍（为未来 AI 排序逻辑预留），进入回合 1
 */
export class BattleSystem {
  constructor(scene, saveData, battleConfig) {
    this.scene = scene;
    this.saveData = saveData;

    this.attackers = battleConfig?.attackers ?? [];
    this.defenders = battleConfig?.defenders ?? [];

    this.round = 0;

    this._dragState = null; // 当前拖拽状态
    this._battleStarted = false; // 是否已点击开始战斗（决定卡牌是否可拖拽）
    this._troopRecordMap = new Map(); // instanceId -> record，用于战斗中快速定位卡牌显示对象
    this.turnOrder = []; // 当前回合的行动顺序队列
    this._turnIndex = 0; // 当前回合内的行动指针
    // 说明：伤害飘字、攻击动画、受击动画、（以后可能的）骨骼特效等所有"战斗表现效果"
    // 都是在特定时机"插入"的异步表现，统一通过 _beginEffect / _endEffect 计数追踪，分两层记录：
    //   1. 每个兵组自己有多少特效还没播完（target._pendingEffects）、是否在等待
    //      "自己的"阵亡结算（_deathPending / _dead），记在该兵组对象自己身上——
    //      哪个目标的特效先播完，哪个目标就先进入阵亡结算，互不等待（见 _maybeResolveDeath）。
    //   2. this._pendingEffectCount 是当前这一次行动产生的特效总数（所有效果累加，
    //      不管挂在哪个目标身上、甚至不挂在任何目标身上），用于"进入下一回合/下一轮前，
    //      必须等这次行动的所有特效+伤害结算（含阵亡）全部完成"——
    //      见 _waitForPendingEffects，被 _advanceTurn 和 _resolveRoundEnd 使用。
    // 新增一种特效（例如攻击动画/受击动画）时，只需要在它开始播放时调用 this._beginEffect(target)，
    // 播放结束的回调/事件里调用 this._endEffect(target)，不需要新增专门的计数器或改动结算流程。
    this._pendingEffectCount = 0;

    this._loadAssetsAndBuild();
  }

  // ─────────────────────────────────────────────
  // 资源加载（加载期间显示遮罩+进度条，避免卡死）
  // ─────────────────────────────────────────────
  _loadAssetsAndBuild() {
    const { width, height } = this.scene.scale;

    const overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75)
      .setDepth(DEPTH + 100).setInteractive();
    const barW = 320, barH = 16;
    const barBg = this.scene.add.rectangle(width / 2, height / 2 + 20, barW, barH, 0x333333, 1).setDepth(DEPTH + 101);
    const barFg = this.scene.add.rectangle(width / 2 - barW / 2, height / 2 + 20, 0, barH, THEME_COLOR, 1)
      .setOrigin(0, 0.5).setDepth(DEPTH + 102);
    const loadTxt = this.scene.add.text(width / 2, height / 2 - 10, '战斗准备中...', {
      fontSize: '18px', color: '#f0e6cc', padding: { top: 4 },
    }).setOrigin(0.5).setDepth(DEPTH + 101);

    const destroyLoader = () => { overlay.destroy(); barBg.destroy(); barFg.destroy(); loadTxt.destroy(); };

    // 收集所有参战兵组需要的图片 key
    const allPersons = [...this.attackers, ...this.defenders];
    const keysToLoad = new Set();
    const pathMap = {};
    for (const person of allPersons) {
      for (const troop of (person.troops ?? [])) {
        const tmpl = MILITARY_UNIT[troop.name];
        if (!tmpl?.image) continue;
        const key = `soldier_${troop.name}`;
        if (!this.scene.textures.exists(key)) {
          keysToLoad.add(key);
          pathMap[key] = tmpl.image;
        }
      }
    }

    // 预加载所有 buff 图标（数量少，直接全部预载一次，
    // 避免战斗过程中某个技能第一次施加某个 buff 时素材还没加载完成）
    for (const buffKey of Object.keys(MILITARY_BUFF)) {
      const key = `buff_${buffKey}`;
      if (!this.scene.textures.exists(key)) {
        keysToLoad.add(key);
        pathMap[key] = `assets/military/buff/${buffKey}.png`;
      }
    }

    // 预加载战场背景图（见 _buildUI 里的 BG_IMAGE_KEY，等比缩放撑满屏幕居中显示）
    if (!this.scene.textures.exists(BG_IMAGE_KEY)) {
      keysToLoad.add(BG_IMAGE_KEY);
      pathMap[BG_IMAGE_KEY] = 'assets/background/battle_bg.jpg';
    }

    // 骷髅（罗睺一斩等技能战斗中途召唤的兵种）不在参战名单里，无法通过上面遍历参战兵组
    // 的方式采集到贴图，但战斗中随时可能需要用到，这里统一预加载，避免召唤时贴图缺失。
    if (MILITARY_UNIT.skeleton?.image) {
      const skeletonKey = 'soldier_skeleton';
      if (!this.scene.textures.exists(skeletonKey)) {
        keysToLoad.add(skeletonKey);
        pathMap[skeletonKey] = MILITARY_UNIT.skeleton.image;
      }
    }

    // 魔力图标现在用 DOM <img src="MANA_ICON_PATH"> 展示（见 _addActionBtn），
    // 不再需要预先加载成 Phaser 纹理

    const toLoad = [...keysToLoad];
    if (toLoad.length === 0) {
      destroyLoader();
      this._build();
      return;
    }

    let loaded = 0;
    const onDone = () => {
      loaded++;
      barFg.setDisplaySize(barW * (loaded / toLoad.length), barH);
      if (loaded >= toLoad.length) {
        this.scene.load.off('filecomplete', onDone);
        this.scene.load.off('loaderror', onDone);
        destroyLoader();
        this._build();
      }
    };
    this.scene.load.on('filecomplete', onDone);
    this.scene.load.on('loaderror', onDone); // 加载失败也继续，不卡死

    toLoad.forEach(k => this.scene.load.image(k, pathMap[k]));
    this.scene.load.start();
  }

  // ─────────────────────────────────────────────
  // 构建：初始化兵组 → 排序 → 渲染 UI
  // ─────────────────────────────────────────────
  _build() {
    this._initTroops();
    this._sortArmies();
    this._buildUI();
  }

  // ── Step 1：初始化所有兵组 ─────────────────────
  _initTroops() {
    for (const person of [...this.attackers, ...this.defenders]) {
      person.troops = (person.troops ?? []).map((raw, idx) => this._createTroopInstance(raw, person, idx));
    }
  }

  _createTroopInstance(raw, person, idx) {
    const tmpl = MILITARY_UNIT[raw.name] ?? {};
    const stats = { ...(tmpl.basic_stats ?? {}), ...(raw.stats ?? {}) };
    const ability = { ...(tmpl.special_ability ?? {}), ...(raw.ability ?? {}) };

    const troop = {
      instanceId: raw.soldierId ?? `${person.id}_t${idx}`,
      unitKey: raw.name,
      displayName: tmpl.name ?? raw.name,
      image: tmpl.image,
      quality: raw.quality ?? tmpl.quality ?? 'normal',
      level: raw.level ?? 1,
      stats,
      ability,
      equipments: raw.equipments ?? tmpl.equipments ?? {},
      maxHp: stats.hp ?? 0,
      currentHp: stats.hp ?? 0,
      maxArmor: stats.armor ?? 0,     // 护甲上限（即兵种自带的 armor 数值）
      currentArmor: stats.armor ?? 0,   // 当前护甲值，优先于生命值被扣除，未来可由技能恢复但不超过上限
      maxMana: stats.mana ?? 0,      // 魔力上限（兵种自带的 mana 数值），供技能 cost 消耗判定
      currentMana: stats.mana ?? 0,     // 当前魔力值
      buffs: {},                   // buff 状态表：{ [buffKey]: 剩余轮次数 }，key 对应 MILITARY_BUFF
      owner: person,
      originalIndex: idx,
    };

    // 拆分技能分类
    troop.activeSkills = this._getSkillsByType(troop, 'initiative');
    troop.passiveSkills = this._getSkillsByType(troop, 'passive');
    troop.tagSkills = this._getSkillsByType(troop, 'tag');

    return troop;
  }

  /**
   * 战斗中途召唤一个新兵组，加入指定 person 的站位队列，受"召唤生物数量上限"
   * （MAX_SUMMONED_PER_SIDE，固定为5）限制——这一方场上存活的召唤物数量已达到
   * 上限时无法继续召唤，返回 null（例如罗睺一斩杀死目标转化为骷髅时，如果施法者
   * 所在队伍的召唤物已经满编，则那个目标就不会被转化）。这个限制和"战术宽度"
   * （MAX_SLOTS_PER_ROW，站位队列的显示排布上限）是两条独立的规则，互不影响。
   * 复用 _createTroopInstance 保证新兵组和备战阶段初始化出来的兵组结构完全一致，
   * 再统一"升级"为 Player 实例（与 _convertTroopsToPlayerClass 的做法一致）。
   * 新召唤的兵组本回合不参与行动（summonedOnRound 标记，_buildTurnOrder 已经支持这一规则）。
   * @param {object} ownerPerson - 加入哪一方（this.attackers/this.defenders 里的一个 person）
   * @param {string} unitKey - MILITARY_UNIT 的 key，例如 'skeleton'
   * @param {object} [statsOverride] - 覆盖模板基础六维（例如"转化阵亡目标"场景需要
   *   沿用阵亡目标自己的 physical_attack/spell_attack/hp/armor/mana/military_order）
   * @returns {object|null} 召唤出的 Player 实例；受数量上限无法召唤时返回 null
   */
  _summonTroop(ownerPerson, unitKey, statsOverride = {}) {
    if (!ownerPerson) return null;

    const currentSummonCount = (ownerPerson.troops ?? [])
      .filter(t => t.isSummoned && isOnBattlefield(t)).length;
    if (currentSummonCount >= MAX_SUMMONED_PER_SIDE) return null; // 召唤生物数量已达上限

    const idx = ownerPerson.troops.length; // _createTroopInstance 需要一个位置索引，稍后会重新插入正确站位
    const raw = { soldierId: `${ownerPerson.id ?? 'p'}_summon_${unitKey}_${Date.now()}_${idx}`, name: unitKey };
    const troop = this._createTroopInstance(raw, ownerPerson, idx);

    // 覆盖基础六维（不影响 ability——召唤物固定沿用模板自己的技能配置，
    // 骷髅模板 special_ability 是空对象，即"没有技能"）
    Object.assign(troop.stats, statsOverride);
    troop.maxHp = troop.stats.hp ?? troop.maxHp;
    troop.currentHp = troop.maxHp;
    troop.maxArmor = troop.stats.armor ?? troop.maxArmor;
    troop.currentArmor = troop.maxArmor;
    troop.maxMana = troop.stats.mana ?? troop.maxMana;
    troop.currentMana = troop.maxMana;

    Object.setPrototypeOf(troop, Player.prototype);
    troop.battle = this;
    troop.summonedOnRound = this.round; // 本回合刚被召唤，不参与本回合行动
    troop.isSummoned = true; // 标记为召唤物，供"召唤生物数量上限"判定使用

    // 继承所属方在场上已有兵组共同的阵营标记；battleOrderIndex 取该方当前最大值+1，
    // 保证回合内出手顺序排序（_compareByActionOrder）能正常处理新召唤的兵组
    const siblingSample = ownerPerson.troops[0];
    troop.isAttackerSide = siblingSample ? siblingSample.isAttackerSide : this.attackers.includes(ownerPerson);
    const maxOrderIndex = Math.max(-1, ...ownerPerson.troops.map(t => t.battleOrderIndex ?? -1));
    troop.battleOrderIndex = maxOrderIndex + 1;

    // 按顺位插入到"可能的最前面"的站位：找到第一个顺位 <= 自己的位置插进去
    // （即排在所有同顺位的现有单位最前面），而不是简单追加到队列末尾——
    // 既不破坏"顺位大在前"的排序规则，又能让新召唤的单位尽量靠前
    const order = troop.stats.military_order ?? 0;
    let insertIndex = ownerPerson.troops.length;
    for (let i = 0; i < ownerPerson.troops.length; i++) {
      if ((ownerPerson.troops[i].stats?.military_order ?? 0) <= order) { insertIndex = i; break; }
    }
    ownerPerson.troops.splice(insertIndex, 0, troop);

    // 中途登场（例如被召唤）：立即单独触发一次这个兵组自己的"自身登场时"技能效果
    // （例如嘲讽——见 _fireSkillHook 的说明；注意这里只触发 onEnterBattlefield，
    // 不是 onGameStart——初始兵组和中途登场的兵组走的是两个互斥的节点），要在
    // _renderField() 之前触发，这样如果技能给自己施加了 buff，首次渲染卡牌时
    // 就能带上正确的 buff 图标。
    this._fireSkillHook('onEnterBattlefield', troop);

    this._renderField();
    this._logBattle(`${ownerPerson.name ?? ownerPerson.id}召唤了一个${troop.displayName}`);
    return troop;
  }

  /**
   * 触发一个兵组在某个技能钩子节点上生效的效果——遍历这个兵组拥有的技能
   * （special_ability），调用技能定义 trigger 对象里声明的对应钩子函数
   * （如果有的话）。技能定义里 trigger 的写法和 military_buff.js 的 buff
   * trigger 是同一套约定：trigger 只负责声明"什么时机做什么"，skill 函数
   * （如果有）负责"被主动使用时做什么"，两者互不影响。
   * 目前支持两个独立的节点，二者互斥，不会在同一次登场里同时触发：
   *   'onGameStart'        —— 游戏开始时：只对战斗开始时就已经在场上的初始兵组
   *                           生效，所有初始兵组按站位顺序（_compareByActionOrder）
   *                           依次触发一次，见 _onStartBattle。
   *   'onEnterBattlefield' —— 自身登场时：只对战斗中途才登场的兵组生效
   *                           （例如被召唤，或者未来任何让这个兵组"重新登场"的
   *                           效果），这个兵组自己单独触发一次，见 _summonTroop。
   *                           游戏开始时就在场上的初始兵组不会触发这个节点。
   * 新增一个"游戏开始时"或"自身登场时"生效的技能（例如嘲讽——为自身施加永久的
   * 嘲讽buff，见 military_skill.js），只需要在 military_skill.js 对应条目的
   * trigger 对象里补充同名函数即可自动接入，不需要改动这里的调用方。
   */
  _fireSkillHook(hookName, troop) {
    for (const key of Object.keys(troop.ability ?? {})) {
      if (!troop.ability[key]) continue;
      const fn = MILITARY_SKILL[key]?.trigger?.[hookName];
      if (typeof fn === 'function') fn(troop);
    }
  }

  _getSkillsByType(troop, type) {
    return Object.keys(troop.ability ?? {})
      .filter(k => {
        if (!troop.ability[k]) return false;
        const skillType = MILITARY_SKILL[k]?.type ?? 'initiative';
        return skillType === type;
      })
      .map(k => ({ key: k, skill: MILITARY_SKILL[k] ?? { name: k, type: 'initiative' } }));
  }

  // ── Step 2：按顺位排序（顺位大在前） ────────────
  _sortArmies() {
    for (const person of [...this.attackers, ...this.defenders]) {
      person.troops = this._sortPersonTroops(person.troops);
    }
  }

  _sortPersonTroops(troops) {
    return [...troops].sort((a, b) => {
      const oa = a.stats.military_order ?? 0;
      const ob = b.stats.military_order ?? 0;
      if (ob !== oa) return ob - oa; // 降序：顺位大的排前面（数组靠前 = 站位靠前/靠近敌方）
      return a.originalIndex - b.originalIndex; // 同顺位保持稳定顺序，除非玩家手动拖拽调整
    });
  }

  /**
   * 把 troops 数组按连续相同 military_order 分组
   * 返回 [{ order, startIndex, troops: [...] }]
   */
  _groupByOrder(troops) {
    const groups = [];
    let cur = null;
    troops.forEach((t, i) => {
      const order = t.stats.military_order ?? 0;
      if (!cur || cur.order !== order) {
        cur = { order, startIndex: i, troops: [] };
        groups.push(cur);
      }
      cur.troops.push(t);
    });
    return groups;
  }

  // ─────────────────────────────────────────────
  // Step 3-4：构建战场 UI
  // ─────────────────────────────────────────────
  _buildUI() {
    const { width, height } = this.scene.scale;

    this.overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.9)
      .setDepth(DEPTH).setInteractive();
    this.root = this.scene.add.container(0, 0).setDepth(DEPTH + 1);

    // 战场背景：优先用背景图，等比缩放撑满整个界面（可能会裁掉超出屏幕比例的部分，
    // 类似 CSS 的 background-size: cover），上下左右居中；素材缺失时退回纯色背景兜底。
    let bg;
    if (this.scene.textures.exists(BG_IMAGE_KEY)) {
      bg = this.scene.add.image(width / 2, height / 2, BG_IMAGE_KEY);
      const coverScale = Math.max(width / bg.width, height / bg.height);
      bg.setScale(coverScale);
    } else {
      bg = this.scene.add.rectangle(width / 2, height / 2, width, height, BG_COLOR, 0.97);
    }
    this.root.add(bg);

    // 标题牌：深色圆角底板 + 金边（见 _drawPanel），文字用暖金色——
    // 背景换成实景图后标题不再直接浮在天空/大理石这类明暗不一的区域上，
    // 而是有自己的深色底板，保证不管背景那块区域多亮都看得清
    const titlePlaqueW = 260, titlePlaqueH = 46;
    this.root.add(this._drawPanel(width / 2, 30, titlePlaqueW, titlePlaqueH, { radius: titlePlaqueH / 2 }));
    this._titleText = this.scene.add.text(width / 2, 30, '战斗准备', {
      fontSize: '24px', color: PANEL_TEXT_COLOR, fontStyle: 'bold', fontFamily: 'serif',
      padding: { top: 4 },
    }).setOrigin(0.5);
    this.root.add(this._titleText);

    // 中线（分隔攻守双方）：只覆盖兵组卡牌区域的高度，不再贯穿整个屏幕（避免穿过底部三栏面板）
    const dividerTop = FIELD_TOP - 20;
    const dividerBottom = FIELD_TOP + SLOT_H + 30;
    this.root.add(this.scene.add.rectangle(
      width / 2, (dividerTop + dividerBottom) / 2, 2, dividerBottom - dividerTop, THEME_COLOR, 0.5,
    ));

    // VS 标记：叠在中线与首行兵组纵向中心的交界处，呼应两军对阵的视觉焦点
    const vsY = FIELD_TOP + SLOT_H / 2;
    this.root.add(this._drawPanel(width / 2, vsY, 56, 32, { radius: 16 }));
    this.root.add(this.scene.add.text(width / 2, vsY, 'VS', {
      fontSize: '18px', color: PANEL_TEXT_COLOR, fontStyle: 'bold italic', fontFamily: 'serif',
    }).setOrigin(0.5));

    // 战场内容容器（后续 refresh 时整体重建）
    this.fieldContainer = this.scene.add.container(0, 0);
    this.root.add(this.fieldContainer);

    this._renderField();

    // 备战阶段"开始战斗"按钮外面不显示边框——只有点击开始战斗后，底部三栏
    // （战斗记录/行动/功能）才一起出现边框，所以这份常驻底板也和记录/功能面板一样
    // 包一层 container 用于统一切换可见性，默认隐藏，_onStartBattle 里再一起显示。
    // 进入战斗后 _showActionMenu 会在同样的位置叠加自己的面板+按钮，视觉上无缝衔接。
    const bottomLayout = this._getBottomLayout();
    this._actionBackdrop = this.scene.add.container(0, 0).setVisible(false);
    this.root.add(this._actionBackdrop);
    this._actionBackdrop.add(this._drawPanel(bottomLayout.action.x, bottomLayout.y, bottomLayout.action.w, bottomLayout.h));

    // 战斗记录面板（可滚动，备战阶段不显示，开始战斗后才出现）
    this._buildBattleLogPanel();

    // 功能面板（暂时留空，后续功能待实装）
    this._buildFunctionPanel();

    // 开始战斗按钮
    this._buildStartButton();

    // 退出按钮（不保存，直接销毁）
    this._buildExitButton(width, height);
  }

  /**
   * 计算底部三栏面板（战斗记录 / 行动 / 功能）的统一位置和宽度——
   * 三个面板都用这份布局，保证顶对齐、等高、间距一致，不在各自的构建函数里各算一套。
   */
  _getBottomLayout() {
    const { width, height } = this.scene.scale;
    const h = BOTTOM_PANEL_H;
    const y = height - BOTTOM_MARGIN - h / 2;
    const totalW = width - BOTTOM_MARGIN * 2;

    const logW = totalW * LOG_PANEL_W_RATIO;
    const funcW = totalW * FUNC_PANEL_W_RATIO;
    const actionW = totalW - logW - funcW - BOTTOM_GAP * 2;

    const left = BOTTOM_MARGIN;
    const logX = left + logW / 2;
    const actionX = left + logW + BOTTOM_GAP + actionW / 2;
    const funcX = left + logW + BOTTOM_GAP + actionW + BOTTOM_GAP + funcW / 2;

    return {
      y, h,
      log: { x: logX, w: logW },
      action: { x: actionX, w: actionW },
      func: { x: funcX, w: funcW },
    };
  }

  /**
   * 绘制一个圆角面板（深色半透明底 + 金色描边，见 PANEL_* 常量），返回 Graphics 对象。
   * Graphics 本身不方便做点击/滚轮交互，需要交互的地方（战斗记录的滚轮、行动按钮的点击）
   * 额外叠一个透明的 Rectangle 覆盖同样区域负责交互，视觉完全由这个 Graphics 负责。
   * @param {number} x - 面板中心 x
   * @param {number} y - 面板中心 y
   * @param {number} w
   * @param {number} h
   */
  _drawPanel(x, y, w, h, opts = {}) {
    const {
      radius = PANEL_RADIUS,
      fillColor = PANEL_BG_COLOR,
      fillAlpha = PANEL_BG_ALPHA,
      borderColor = THEME_COLOR,
      borderAlpha = 0.9,
      borderWidth = 2,
    } = opts;
    const g = this.scene.add.graphics();
    g.fillStyle(fillColor, fillAlpha);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
    g.lineStyle(borderWidth, borderColor, borderAlpha);
    g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, radius);
    return g;
  }

  // 渲染整个战场（进攻方 + 防守方），支持重复调用刷新
  _renderField() {
    this.fieldContainer.removeAll(true);
    this.slotSprites = []; // { gameObject, troop, person, row, slotIndex, isAttacker }

    const { width, height } = this.scene.scale;
    const centerX = width / 2;
    // 紧贴标题下方，卡牌区域从 FIELD_TOP 开始向下排列（不再整体垂直居中导致上方大片空白）。
    // 注意卡牌本体的血条/护甲条是画在卡牌顶部边缘之上的（见 _renderTroopSlot 里的
    // hpBarY/armorBarY），FIELD_TOP 要给它们留够向上延伸的空间，不能让它们贴到标题文字。
    // FIELD_TOP 同时也是 _buildUI 里定位中线长度/VS标记的依据，改这里两处会一起变。
    const fieldTop = FIELD_TOP;
    const fieldBottom = height - BOTTOM_MARGIN - BOTTOM_PANEL_H - BOTTOM_MARGIN;

    this._renderSide(this.attackers, true, centerX, fieldTop, fieldBottom);
    this._renderSide(this.defenders, false, centerX, fieldTop, fieldBottom);
  }

  /**
   * @param {number} top - 卡牌区域从这个 y 坐标开始向下排列（顶部对齐，不再整体垂直居中）——
   *   只有1行兵组时也会紧贴顶部，不会因为可用高度较大而在标题下方留出大片空白；
   *   行数较多、总高度超出可用区域时会自然向下延伸，接近 bottom（目前没有做压缩处理，
   *   兵组多的情况仍然只受 MAX_SLOTS_PER_ROW 提示约束，未来要处理溢出可以在这里加逻辑）。
   */
  _renderSide(persons, isAttacker, centerX, top, bottom) {
    const rowCount = persons.length;
    if (rowCount === 0) return;

    const rowH = SLOT_H + ROW_GAP;

    persons.forEach((person, rowIdx) => {
      const rowY = top + SLOT_H / 2 + rowIdx * rowH;
      this._renderPersonRow(person, rowY, isAttacker, centerX);
    });
  }

  _renderPersonRow(person, rowY, isAttacker, centerX) {
    const troops = person.troops;
    const n = troops.length;
    if (n === 0) return;

    const { width } = this.scene.scale;
    const edgePad = 16; // 距离屏幕左右边缘的固定间距

    // 人名标签：固定锚定在屏幕边缘，和卡牌数量/位置完全独立计算，
    // 避免卡牌少时标签跟着靠近中心、卡牌多时标签被推出屏幕外的问题
    const nameLabel = this.scene.add.text(0, rowY, person.name ?? person.id, {
      fontSize: '15px', color: person.isPlayer ? '#88cc88' : '#cccccc',
      fontStyle: 'bold', padding: { top: 4 },
    });

    if (isAttacker) {
      // 攻方：左对齐，紧贴屏幕左边缘
      nameLabel.setOrigin(0, 0.5).setX(edgePad);
    } else {
      // 守方：右对齐，紧贴屏幕右边缘
      nameLabel.setOrigin(1, 0.5).setX(width - edgePad);
    }

    this.fieldContainer.add(nameLabel);

    // ── 横向拉条：这一路（这个 person）的卡牌总宽度如果超出可用空间，
    // 就在下方出现一条可拖动的横向拉条，让玩家左右滑动查看这一路的完整阵容——
    // VS 标记和另一方的位置完全独立计算，不受这里的滚动偏移影响。
    const availableWidth = centerX - edgePad - 56; // 中线到屏幕边缘的可用宽度（预留一点名牌区域）
    const contentWidth = FRONT_GAP + SLOT_W + Math.max(0, n - 1) * (SLOT_W + SLOT_GAP);
    const overflow = contentWidth > availableWidth;
    const maxScrollOffset = overflow ? (contentWidth - availableWidth) : 0;

    // 每个 person 自己记一份当前的横向滚动偏移量，跨重渲染保留（拖完不会跳回0），
    // 兵组数量变化（例如中途召唤）导致上限变化时在这里重新裁剪一次
    if (person._rowScrollOffset == null) person._rowScrollOffset = 0;
    person._rowScrollOffset = Phaser.Math.Clamp(person._rowScrollOffset, 0, maxScrollOffset);

    // 这一路的卡牌都放进独立的 rowContainer 里：溢出时靠它的位移+遮罩实现横向滚动，
    // 不溢出时它始终停在 (0,0)，效果等同于直接挂在 fieldContainer 上，不影响原有行为。
    const rowContainer = this.scene.add.container(0, 0);
    this.fieldContainer.add(rowContainer);

    if (overflow) {
      const maskShape = this.scene.make.graphics();
      maskShape.fillStyle(0xffffff);
      const maskX = isAttacker ? centerX - availableWidth : centerX;
      maskShape.fillRect(maskX, rowY - SLOT_H, availableWidth, SLOT_H * 2);
      rowContainer.setMask(maskShape.createGeometryMask());
    }

    // 槽位从中线向外排列：index 0（顺位最大，最靠前）离中线最近。
    // 位置本身按"未滚动"的原始站位计算，横向滚动统一通过下面的 rowContainer.x 实现，
    // 不需要在这里把 scrollOffset 混进每张卡牌的坐标计算。
    troops.forEach((troop, slotIndex) => {
      const dist = slotIndex; // 第几个槽位（0=最靠前/最靠近中线）
      const slotCenterOffset = FRONT_GAP + (SLOT_W / 2) + dist * (SLOT_W + SLOT_GAP);
      const slotX = isAttacker ? centerX - slotCenterOffset : centerX + slotCenterOffset;

      this._renderTroopSlot(troop, person, slotX, rowY, isAttacker, slotIndex, rowContainer);
    });

    // 滚动方向：scrollOffset 增大＝想看更靠外侧（远离中线）的卡牌——
    // 攻方卡牌本来往左延伸，需要把 rowContainer 往右移（+）才能把左边溢出的部分移入可视区；
    // 守方卡牌往右延伸，需要把 rowContainer 往左移（-）。
    rowContainer.x = isAttacker ? person._rowScrollOffset : -person._rowScrollOffset;

    if (overflow) {
      this._renderRowScrollbar(person, rowY, isAttacker, centerX, availableWidth, contentWidth, maxScrollOffset, rowContainer);
    }
  }

  /**
   * 绘制并挂载"这一路兵组过多时"的横向拉条：拖动它只更新 person._rowScrollOffset
   * 和 rowContainer.x（配合拉条本身的重绘），不重新渲染整个战场——
   * 这样才不会在拖动过程中把正在拖动的拉条自己销毁掉。
   * 拉条本身和命中区域都直接挂在 fieldContainer 上（不放进 rowContainer），
   * 所以不会被 rowContainer 自己的遮罩裁切掉，滚动时始终可见。
   */
  _renderRowScrollbar(person, rowY, isAttacker, centerX, availableWidth, contentWidth, maxScrollOffset, rowContainer) {
    const trackY = rowY + SLOT_H / 2 + 54; // 卡牌下方（避开血条/护甲条/法力条/buff图标行）
    const trackX = isAttacker ? centerX - availableWidth : centerX;
    const trackW = availableWidth;
    const trackH = ROW_SCROLLBAR_H;
    const thumbW = Math.max(24, trackW * Math.min(1, availableWidth / contentWidth));

    const g = this.scene.add.graphics();
    this.fieldContainer.add(g);

    const drawThumb = () => {
      g.clear();
      g.fillStyle(0xffffff, 0.12);
      g.fillRoundedRect(trackX, trackY - trackH / 2, trackW, trackH, trackH / 2);
      const scrollRatio = maxScrollOffset > 0 ? (person._rowScrollOffset ?? 0) / maxScrollOffset : 0;
      const thumbX = trackX + (trackW - thumbW) * scrollRatio;
      g.fillStyle(THEME_COLOR, 0.85);
      g.fillRoundedRect(thumbX, trackY - trackH / 2, thumbW, trackH, trackH / 2);
    };
    drawThumb();

    // 透明命中区域覆盖整条轨道（比可视拉条略高一些，方便点中），负责拖动交互
    const hit = this.scene.add.rectangle(trackX + trackW / 2, trackY, trackW, trackH + 14, 0, 0)
      .setInteractive({ useHandCursor: true, draggable: true });
    this.fieldContainer.add(hit);
    this.scene.input.setDraggable(hit);

    let dragStartPointerX = 0;
    let dragStartOffset = 0;

    hit.on('dragstart', (pointer) => {
      dragStartPointerX = pointer.x;
      dragStartOffset = person._rowScrollOffset ?? 0;
    });

    hit.on('drag', (pointer) => {
      // 拖动量按"拉条轨道宽度 : 实际可滚动内容宽度"的比例放大，
      // 保证把滑块从轨道一端拖到另一端正好对应 scrollOffset 从0滚到 maxScrollOffset
      const deltaX = pointer.x - dragStartPointerX;
      const deltaOffset = deltaX * (contentWidth / availableWidth);
      person._rowScrollOffset = Phaser.Math.Clamp(dragStartOffset + deltaOffset, 0, maxScrollOffset);
      rowContainer.x = isAttacker ? person._rowScrollOffset : -person._rowScrollOffset;
      drawThumb();
    });
  }

  _renderTroopSlot(troop, person, x, y, isAttacker, slotIndex, parentContainer = this.fieldContainer) {
    const container = this.scene.add.container(x, y);

    // 只有己方（person.isPlayer）的兵组才允许悬浮查看血量/护甲/蓝量的具体数值，
    // 对方（AI）的兵组鼠标放上去不会显示——避免暴露敌方的隐藏数值信息
    const canRevealStats = !!person.isPlayer;

    // 背景框（阵营颜色区分）
    const tintColor = isAttacker ? ATTACKER_TINT : DEFENDER_TINT;
    const frame = this.scene.add.rectangle(0, 0, SLOT_W, SLOT_H, 0x1e1d2e, 0.9)
      .setStrokeStyle(2, tintColor, 0.8);
    container.add(frame);

    // ── 血条（卡牌上方，绿色，显示 当前/最大 体力）──────────────────
    // 己方兵组的具体数值常驻显示（不再需要悬浮才能看到），敌方（AI）兵组
    // 依然不显示具体数值——只由 canRevealStats 控制是否创建/显示这个文字，
    // 血量变化时的刷新见 _updateHpBar。
    const maxHp = troop.stats.hp ?? troop.maxHp ?? 1;
    const hpBarY = -SLOT_H / 2 - 16;
    const hpBarW = SLOT_W - 8;
    const hpBarH = 10;

    const hpBarBg = this.scene.add.rectangle(0, hpBarY, hpBarW, hpBarH, 0x333333, 1)
      .setStrokeStyle(1, 0x000000, 0.6)
      .setInteractive({ useHandCursor: false });
    container.add(hpBarBg);

    const hpRatio = maxHp > 0 ? Phaser.Math.Clamp((troop.currentHp ?? maxHp) / maxHp, 0, 1) : 0;
    const hpBarFill = this.scene.add.rectangle(-hpBarW / 2, hpBarY, hpBarW * hpRatio, hpBarH, 0x2ecc40, 1)
      .setOrigin(0, 0.5);
    container.add(hpBarFill);

    // 黑底白边（黑色文字+白色描边）：纯黑字没有描边，遇到偏白/偏亮的背景区域
    // 就看不清，加一圈白色描边保证不管叠在哪块背景上都能看清数值
    const hpValueText = this.scene.add.text(0, hpBarY, canRevealStats ? `${Math.max(0, troop.currentHp ?? 0)}/${maxHp}` : '', {
      fontSize: '10px', color: '#000000', fontStyle: 'bold', padding: { top: 2 },
      stroke: '#ffffff', strokeThickness: 2,
    }).setOrigin(0.5).setVisible(canRevealStats);
    container.add(hpValueText);

    // ── 护甲条（血条上方，蓝色）──────────────────────
    // 护盾/护甲不存在上限，只有当前值：为0直接消失；有值时始终整条满宽显示（不做比例缩放）
    const armorBarY = hpBarY - 13;

    const armorBarBg = this.scene.add.rectangle(0, armorBarY, hpBarW, hpBarH, 0x1a2a44, 1)
      .setStrokeStyle(1, 0x000000, 0.6)
      .setInteractive({ useHandCursor: false });
    const armorBarFill = this.scene.add.rectangle(-hpBarW / 2, armorBarY, hpBarW, hpBarH, 0x3399ff, 1)
      .setOrigin(0, 0.5);
    const hasArmor = (troop.currentArmor ?? 0) > 0;
    armorBarBg.setVisible(hasArmor);
    armorBarFill.setVisible(hasArmor);
    container.add(armorBarBg);
    container.add(armorBarFill);

    // 黑底白边，原因同血条的 hpValueText；护盾没有上限概念，只显示当前值（不是 x/y 格式）
    const armorValueText = this.scene.add.text(0, armorBarY, canRevealStats ? `${Math.max(0, troop.currentArmor ?? 0)}` : '', {
      fontSize: '10px', color: '#000000', fontStyle: 'bold', padding: { top: 2 },
      stroke: '#ffffff', strokeThickness: 2,
    }).setOrigin(0.5).setVisible(canRevealStats && hasArmor);
    container.add(armorValueText);

    // 兵组名（顶部）
    container.add(this.scene.add.text(0, -SLOT_H / 2 + 16, troop.displayName, {
      fontSize: '13px', color: '#f0e6cc', fontStyle: 'bold', padding: { top: 4 },
      wordWrap: { width: SLOT_W - 8 },
    }).setOrigin(0.5));

    // 兵组图片（contain 缩放，保持比例，位于名字和等级之间）
    const imgKey = `soldier_${troop.unitKey}`;
    if (this.scene.textures.exists(imgKey)) {
      const img = this.scene.add.image(0, 4, imgKey);
      const scale = Math.min((SLOT_W - 12) / img.width, (SLOT_H - 58) / img.height);
      img.setScale(scale).setOrigin(0.5);
      container.add(img);
    } else {
      container.add(this.scene.add.text(0, 4, troop.displayName, {
        fontSize: '13px', color: '#8a7a5a', align: 'center', padding: { top: 4 },
        wordWrap: { width: SLOT_W - 10 },
      }).setOrigin(0.5));
    }

    // 顺位数值（左上角小标）
    container.add(this.scene.add.text(-SLOT_W / 2 + 6, -SLOT_H / 2 + 6, `${troop.stats.military_order ?? 0}`, {
      fontSize: '13px', color: '#ffd700', fontStyle: 'bold', padding: { top: 4 },
    }).setOrigin(0, 0));

    // 兵组等级（底部）
    container.add(this.scene.add.text(0, SLOT_H / 2 - 16, `Lv.${troop.level ?? 1}`, {
      fontSize: '14px', color: '#b8963e', padding: { top: 4 },
    }).setOrigin(0.5));

    // ── 法力条（卡牌下方，淡蓝色）──────────────────────
    // 所有兵组都显示这条，即使 maxMana 为 0（此时条为空但仍然显示）
    const maxMana = troop.maxMana ?? troop.stats.mana ?? 0;
    const manaBarY = SLOT_H / 2 + 16;
    const manaBarW = SLOT_W - 8;
    const manaBarH = 8;

    const manaBarBg = this.scene.add.rectangle(0, manaBarY, manaBarW, manaBarH, 0x1a2233, 1)
      .setStrokeStyle(1, 0x000000, 0.5)
      .setInteractive({ useHandCursor: false });
    container.add(manaBarBg);

    const manaRatio = maxMana > 0 ? Phaser.Math.Clamp((troop.currentMana ?? maxMana) / maxMana, 0, 1) : 0;
    const manaBarFill = this.scene.add.rectangle(-manaBarW / 2, manaBarY, manaBarW * manaRatio, manaBarH, 0x7ec8ff, 0.85)
      .setOrigin(0, 0.5);
    container.add(manaBarFill);

    // 黑底白边，原因同血条的 hpValueText
    const manaValueText = this.scene.add.text(0, manaBarY, canRevealStats ? `${Math.max(0, troop.currentMana ?? 0)}/${maxMana}` : '', {
      fontSize: '10px', color: '#000000', fontStyle: 'bold', padding: { top: 2 },
      stroke: '#ffffff', strokeThickness: 2,
    }).setOrigin(0.5).setVisible(canRevealStats);
    container.add(manaValueText);

    // ── Buff 图标行（法力条下方，持续堆放展示当前持有的所有buff）───────
    const buffRowY = manaBarY + manaBarH / 2 + 14;
    const buffRow = this.scene.add.container(0, buffRowY);
    container.add(buffRow);

    parentContainer.add(container);

    const record = {
      container, frame, troop, person, isAttacker, slotIndex, baseX: x, baseY: y,
      rowContainer: parentContainer, // 所属的这一路容器，_handleDragEnd 换算绝对坐标时需要
      canRevealStats,
      hpBarBg, hpBarFill, hpValueText, hpBarW, maxHp,
      armorBarBg, armorBarFill, armorValueText,
      manaBarBg, manaBarFill, manaValueText, manaBarW, maxMana,
      buffRow,
    };
    this.slotSprites.push(record);
    if (!this._troopRecordMap) this._troopRecordMap = new Map();
    this._troopRecordMap.set(troop.instanceId, record);

    // 根据当前 troop.buffs 渲染一次 buff 图标（重渲染战场时也要还原已有的 buff 显示）
    this._updateBuffIcons(record);

    // 只在备战阶段（尚未点击开始战斗）设置基础可交互和拖拽能力。
    // 战斗开始后不应该有默认的可点击状态——交互只在 _beginTargeting 期间对候选目标
    // 临时开启，所以这里不能无条件 setInteractive，否则一旦战斗中因为 setStation 等
    // 原因触发重新渲染（_renderField），会把所有卡牌重新变回可交互，破坏"默认无点击事件"的约束。
    if (!this._battleStarted) {
      frame.setInteractive({ useHandCursor: true, draggable: person.isPlayer });
    }

    if (person.isPlayer && !this._battleStarted) {
      this.scene.input.setDraggable(frame);

      frame.on('dragstart', (pointer) => {
        // 记录拖拽起始时的指针世界坐标和 container 的初始坐标，
        // 后续用位移增量而不是 Phaser 提供的子对象局部 dragX（避免父子坐标系不一致导致跳飞）
        this._dragState = {
          record,
          startPointerX: pointer.x,
          startContainerX: container.x,
        };
        // 把当前卡牌提升到显示列表最上层，确保拖拽悬停在其他卡牌上方时可见
        // （Container 默认按添加顺序渲染，setDepth 对普通 Container 子元素不生效，
        //   必须用 bringToTop 调整其在所属父容器 list 中的位置——现在卡牌实际挂在
        //   每一路自己的 rowContainer 下面，所以要提升的是 parentContainer 而不是 fieldContainer）
        parentContainer.bringToTop(container);
        frame.setStrokeStyle(2, 0xffd700, 1);
      });

      frame.on('drag', (pointer) => {
        // 仅允许沿行方向（X 轴）拖动，Y 固定
        if (!this._dragState) return;
        const delta = pointer.x - this._dragState.startPointerX;
        container.setX(this._dragState.startContainerX + delta);
      });

      frame.on('dragend', () => {
        this._handleDragEnd(record);
        frame.setStrokeStyle(2, tintColor, 0.8);
        this._dragState = null;
      });
    }
  }

  // ── 更新护甲条显示（受伤扣减/护甲归零后调用）──────────
  // 护盾不存在上限，只有当前值：始终满宽显示，只需切换可见性（为0时隐藏）。
  // 注意：护甲"增加"时不要调用这个方法——应该调用 _animateArmorGain 播放增长动画，
  // 这里始终把蓝条摆回满宽，会直接盖掉动画效果。
  _updateArmorBar(record) {
    if (!record) return;
    const { troop, armorBarBg, armorBarFill, armorValueText, canRevealStats, hpBarW } = record;
    const hasArmor = (troop.currentArmor ?? 0) > 0;
    armorBarBg.setVisible(hasArmor);
    armorBarFill.setVisible(hasArmor);
    this.scene.tweens.killTweensOf(armorBarFill);
    armorBarFill.displayWidth = hpBarW; // 非"增加"场景（例如护甲被扣减到0后又被完全清空）始终满宽显示
    // 己方兵组的护甲数值常驻显示，随护甲变化同步刷新文字内容
    if (canRevealStats && armorValueText) {
      armorValueText.setText(`${Math.max(0, troop.currentArmor ?? 0)}`);
      armorValueText.setVisible(hasArmor);
    }
  }

  /**
   * 护甲"增加"专用动画（例如寒冰盾施加护甲）：
   *   1. 先把蓝色填充条瞬间收缩成"旧护甲值 / 新护甲值"的比例——视觉上相当于
   *      把护甲条的满格容量瞬间扩大到新的护甲值，但填充部分还停留在旧数值，
   *      所以旧数值现在只占新容量的一部分（例如旧值5、新值7，蓝条先收缩到 5/7 宽度）；
   *   2. 再用补间动画把蓝条从这个比例过渡到满宽——代表护甲真正"涨"上来，
   *      最终视觉效果和 _updateArmorBar 平时的"始终满宽"保持一致。
   * 数值文字（右侧显示的具体数字）直接刷新成最终结果，不参与这个过渡动画，
   * 和血量/魔力条的处理方式一致（见 _updateHpBar/_updateManaBar）。
   * 这只是装饰性动画，不接入 _beginEffect/_endEffect 计数——护甲增加不需要阻塞回合推进。
   * @param {object} record
   * @param {number} oldVal - 增加前的护甲值
   * @param {number} newVal - 增加后的护甲值（调用方需保证 newVal > oldVal）
   */
  _animateArmorGain(record, oldVal, newVal) {
    if (!record) return;
    const { armorBarBg, armorBarFill, armorValueText, canRevealStats, hpBarW } = record;
    armorBarBg.setVisible(true);
    armorBarFill.setVisible(true);

    if (canRevealStats && armorValueText) {
      armorValueText.setText(`${Math.max(0, newVal)}`);
      armorValueText.setVisible(true);
    }

    // 旧值相对新值的占比：newVal 大于0时才有意义（调用前已保证是"增加"场景，newVal>oldVal>=0）
    const startRatio = newVal > 0 ? Phaser.Math.Clamp(oldVal / newVal, 0, 1) : 0;
    this.scene.tweens.killTweensOf(armorBarFill);
    armorBarFill.displayWidth = hpBarW * startRatio; // 第一步：瞬间收缩成"旧值/新值"的比例，不做过渡

    // 第二步：从这个比例补间过渡到满宽
    this.scene.tweens.add({
      targets: armorBarFill,
      displayWidth: hpBarW,
      duration: 350,
      ease: 'Cubic.easeOut',
    });
  }

  /**
   * 用补间动画把一条"从左边缘往右延伸"的填充条（origin 是 (0,0.5)，左边缘固定在
   * 卡牌上的锚点位置不动）的显示宽度，从当前值过渡到目标宽度——由于左边缘不动，
   * 视觉上就是右边缘向左（变短/减少）或向右（变长/增加）滑动，而不是瞬间跳变。
   * 血条、法力条都是这种"左对齐、右边缘随数值变化"的条形，共用这一个过渡逻辑。
   * 会先清掉这个对象身上可能还没播完的旧补间，避免连续变化时新旧动画叠加冲突。
   *
   * @param {Phaser.GameObjects.Rectangle} fillObj
   * @param {number} targetWidth
   * @param {object} [effectTarget] - 传入时（例如血条），把这次动画也算进通用的
   *   "结算动画"计数（_beginEffect/_endEffect，和伤害飘字用的是同一套），
   *   动画播完前不会进入这个目标自己的阵亡结算，也不会推进到下一个兵组的回合——
   *   即"上一个角色事件里的所有动画都播完，才会开始下一个角色的回合"。
   *   不传（例如法力条）则只是纯视觉过渡，不参与结算时机的等待。
   */
  _tweenBarWidth(fillObj, targetWidth, effectTarget = null) {
    this.scene.tweens.killTweensOf(fillObj);

    // 如果这个填充条上一次登记的"结算动画"效果还没等到 onComplete 就被上面这行
    // killTweensOf 打断了，需要先手动把它收尾掉——否则 _pendingEffectCount 会
    // 永久多算一个，导致后面永远等不到"所有动画播完"，卡死在这一回合走不下去。
    if (fillObj._hpAnimPending) {
      fillObj._hpAnimPending = false;
      this._endEffect(fillObj._hpAnimEffectTarget);
    }

    if (effectTarget) {
      fillObj._hpAnimPending = true;
      fillObj._hpAnimEffectTarget = effectTarget;
      this._beginEffect(effectTarget);
    }

    this.scene.tweens.add({
      targets: fillObj,
      displayWidth: Math.max(0, targetWidth),
      duration: 350,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        if (fillObj._hpAnimPending) {
          fillObj._hpAnimPending = false;
          this._endEffect(fillObj._hpAnimEffectTarget);
        }
      },
    });
  }

  // ── 更新法力条显示（消耗/恢复法力后调用）──────────
  // 纯视觉过渡，不算进结算动画——消耗/恢复法力本身不参与"这一回合有没有播完"的判定
  _updateManaBar(record) {
    if (!record) return;
    const { troop, manaBarFill, manaBarW, maxMana, manaValueText, canRevealStats } = record;
    const mana = Math.max(0, troop.currentMana ?? 0);
    const ratio = maxMana > 0 ? Phaser.Math.Clamp(mana / maxMana, 0, 1) : 0;
    this._tweenBarWidth(manaBarFill, manaBarW * ratio);
    // 己方兵组的魔力数值常驻显示，随魔力变化同步刷新文字内容
    if (canRevealStats && manaValueText) {
      manaValueText.setText(`${mana}/${maxMana}`);
    }
  }

  // ── 更新血条显示（战斗中受伤/治疗后调用）───────────
  _updateHpBar(record) {
    if (!record) return;
    const { troop, hpBarFill, hpBarW, maxHp, hpValueText, canRevealStats } = record;
    const cur = Math.max(0, troop.currentHp ?? 0);
    const ratio = maxHp > 0 ? Phaser.Math.Clamp(cur / maxHp, 0, 1) : 0;
    // 血量变动动画和伤害飘字一样算进结算动画：播完之前不会触发这个目标的阵亡结算，
    // 也不会推进到下一个兵组的回合（见 _tweenBarWidth 的 effectTarget 说明）
    this._tweenBarWidth(hpBarFill, hpBarW * ratio, troop);
    // 血量过低时变红提示——颜色切换是瞬时的，不需要过渡动画
    hpBarFill.setFillStyle(ratio <= 0.25 ? 0xc0392b : 0x2ecc40, 1);
    // 己方兵组的体力数值常驻显示，随血量变化同步刷新文字内容
    if (canRevealStats && hpValueText) {
      hpValueText.setText(`${cur}/${maxHp}`);
    }
  }

  /**
   * 重建某个兵组卡牌下方的 buff 图标行（法力条下方，持续堆放展示）。
   * 每个图标使用 MILITARY_BUFF 表里 key 对应的 assets/military/buff/{key}.png 素材
   * （素材缺失时用色块兜底，不影响功能），左下角叠加显示剩余轮次数字；
   * 悬浮图标时复用行动按钮的浮窗组件展示 buff 名称 + 效果描述。
   * 施加/移除 buff、以及每轮结束递减剩余轮次后都要调用本方法刷新显示。
   * @param {object} record - _troopRecordMap 中的卡牌显示记录
   */
  _updateBuffIcons(record) {
    if (!record?.buffRow) return;
    const { buffRow, troop } = record;
    buffRow.removeAll(true);

    const keys = Object.keys(troop.buffs ?? {}).filter(k => (troop.buffs[k] ?? 0) > 0);
    if (keys.length === 0) return;

    const ICON = 18, GAP = 4, ROW_H = ICON + GAP + 5;
    const perRow = Math.max(1, Math.floor((SLOT_W + GAP) / (ICON + GAP)));

    keys.forEach((key, i) => {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const rowCount = Math.min(perRow, keys.length - row * perRow);
      const rowWidth = rowCount * ICON + (rowCount - 1) * GAP;
      const x = -rowWidth / 2 + ICON / 2 + col * (ICON + GAP);
      const y = row * ROW_H;

      const rounds = troop.buffs[key];
      const buffDef = MILITARY_BUFF[key];
      const iconKey = `buff_${key}`;

      const iconContainer = this.scene.add.container(x, y);

      const iconObj = this.scene.textures.exists(iconKey)
        ? this.scene.add.image(0, 0, iconKey).setDisplaySize(ICON, ICON)
        : this.scene.add.rectangle(0, 0, ICON, ICON, 0x552222, 0.9).setStrokeStyle(1, 0xffaa33, 0.9);
      iconContainer.add(iconObj);

      // 剩余轮次数：图标左下角——永久buff（rounds 为 Infinity，例如嘲讽）不显示这个数字
      if (Number.isFinite(rounds)) {
        iconContainer.add(this.scene.add.text(-ICON / 2, ICON / 2, `${rounds}`, {
          fontSize: '9px', color: '#ffffff', fontStyle: 'bold', padding: { top: 2 },
          stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0, 1));
      }

      // 透明命中区域：负责悬浮浮窗交互，不影响图标本身显示
      const hitZone = this.scene.add.rectangle(0, 0, ICON, ICON, 0, 0)
        .setInteractive({ useHandCursor: true });
      hitZone.on('pointerover', (ptr) => this._showActionTip(buffDef?.name ?? `未知状态(${key})`, buffDef?.des ?? '', ptr));
      hitZone.on('pointermove', (ptr) => this._moveActionTip(ptr));
      hitZone.on('pointerout', () => this._hideActionTip());
      iconContainer.add(hitZone);

      buffRow.add(iconContainer);
    });
  }

  // ── 拖拽结束：仅允许在同顺位组内交换位置 ──────────
  _handleDragEnd(record) {
    const { person, isAttacker, troop } = record;
    const troops = person.troops;
    const curIndex = troops.indexOf(troop);
    if (curIndex === -1) { this._renderField(); return; }

    // 找出同顺位分组的索引范围
    const order = troop.stats.military_order ?? 0;
    const groupIndices = troops
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => (t.stats.military_order ?? 0) === order)
      .map(({ i }) => i);

    if (groupIndices.length <= 1) {
      // 组内只有自己，无法交换，直接归位
      this._renderField();
      return;
    }

    // 找出组内各槽位的目标 X 坐标，选出离当前拖拽位置最近的槽位。
    // record.container.x 是相对于所属 rowContainer 的局部坐标，若这一路正处于
    // 横向滚动状态（rowContainer.x !== 0），需要加回这个偏移量才能还原成绝对屏幕坐标，
    // 和下面按绝对坐标算出来的 slotX 放在同一个坐标系里比较。
    const centerX = this.scene.scale.width / 2;
    const dragFinalX = record.container.x + (record.rowContainer?.x ?? 0);

    let bestIndex = curIndex;
    let bestDist = Infinity;
    for (const idx of groupIndices) {
      const slotOffsetInGroup = idx; // 数组下标即为该顺位在整体队列中的槽位序号
      const dist = slotOffsetInGroup; // 复用与渲染一致的偏移计算
      const slotCenterOffset = FRONT_GAP + (SLOT_W / 2) + dist * (SLOT_W + SLOT_GAP);
      const slotX = isAttacker ? centerX - slotCenterOffset : centerX + slotCenterOffset;
      const d = Math.abs(slotX - dragFinalX);
      if (d < bestDist) { bestDist = d; bestIndex = idx; }
    }

    if (bestIndex !== curIndex) {
      // 交换数组中两个位置（保持同顺位组内的相对排列，符合"同顺位可调整"规则）
      const tmp = troops[bestIndex];
      troops[bestIndex] = troops[curIndex];
      troops[curIndex] = tmp;
    }

    this._renderField();
  }

  // ─────────────────────────────────────────────
  // 退出按钮（不保存记录，直接销毁）
  // ─────────────────────────────────────────────
  _buildExitButton(width, height) {
    const closeHit = this.scene.add.circle(width - 44, 34, 20, 0, 0)
      .setInteractive({ useHandCursor: true });
    // 背景换成实景图后，✕ 底下不再一定是纯色，加一圈深色描边保证在任何区域都看得清
    const closeTxt = this.scene.add.text(width - 44, 34, '✕', {
      fontSize: '26px', color: '#ff4444', fontStyle: 'bold', padding: { top: 4 },
      stroke: '#1a0000', strokeThickness: 4,
    }).setOrigin(0.5);
    closeHit.on('pointerover', () => closeTxt.setColor('#ffaaaa'));
    closeHit.on('pointerout', () => closeTxt.setColor('#ff4444'));
    closeHit.on('pointerdown', () => {
      // 不保存任何战斗记录，直接销毁战场
      this.destroy();
    });
    this.root.add([closeHit, closeTxt]);
  }

  // ─────────────────────────────────────────────
  // 战斗记录面板（可滚动，底部三栏最左侧；备战阶段不显示，没有"清空记录"按钮）
  // ─────────────────────────────────────────────
  _buildBattleLogPanel() {
    const layout = this._getBottomLayout();
    const { x: logX, w: logW } = layout.log;
    const logH = layout.h;
    const logCenterY = layout.y;

    // 战斗记录面板在备战阶段（还没点"开始战斗"）不显示，整体包一层 container 方便一次性
    // 切换可见性——_onStartBattle 里会把它 setVisible(true)。
    this._logPanel = this.scene.add.container(0, 0).setVisible(false);
    this.root.add(this._logPanel);

    this._logPanel.add(this._drawPanel(logX, logCenterY, logW, logH));

    // 透明命中区域，负责鼠标滚轮交互——Graphics 面板本身不方便做交互，见 _drawPanel 注释
    const hit = this.scene.add.rectangle(logX, logCenterY, logW, logH, 0, 0).setInteractive();
    this._logPanel.add(hit);

    this._logPanel.add(this.scene.add.text(logX - logW / 2 + 16, logCenterY - logH / 2 + 18, '◆ 战斗记录', {
      fontSize: '14px', color: THEME_COLOR_HEX, fontStyle: 'bold', padding: { top: 4 },
    }).setOrigin(0, 0.5));

    // 内容区域（标题下方留出空间；右侧额外留出滚动条的位置，避免滚动条盖住文字）
    const leftPad = 16, rightPad = 16;
    const scrollbarW = 4, scrollbarGap = 8; // 滚动条宽度 + 和文字之间的间距
    const areaTop = logCenterY - logH / 2 + 40;
    const areaBottom = logCenterY + logH / 2 - 14;
    this._logAreaH = areaBottom - areaTop;
    const panelLeft = logX - logW / 2;
    this._logAreaW = logW - leftPad - rightPad - scrollbarW - scrollbarGap;
    this._logContentTopY = areaTop;
    const contentX = panelLeft + leftPad;

    this._logContent = this.scene.add.container(contentX, areaTop);
    this._logPanel.add(this._logContent);

    // 遮罩，超出内容区域的部分不显示
    const maskShape = this.scene.make.graphics();
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(contentX, areaTop, this._logAreaW, this._logAreaH);
    this._logContent.setMask(maskShape.createGeometryMask());
    this._logMaskShape = maskShape;

    this._logLines = [];
    this._logScrollY = 0;

    // 用于计算换行结果的"测量专用" Text 对象：字号/换行配置和真正显示的战斗记录文字
    // 完全一致，但本身不可见、不加入 _logContent——只是借助 Phaser 自带的 useAdvancedWrap
    // 换行算法，算出"这段文字会被自动分成哪几行"，这样就不需要自己重新实现一套中文换行
    // 逻辑，同时又能对换行后的每一行分别按关键词做局部变色（见 _renderRichLogLine）。
    this._logMeasureText = this.scene.add.text(0, 0, '', {
      fontSize: '13px', padding: { top: 4 },
      wordWrap: { width: this._logAreaW, useAdvancedWrap: true },
    }).setVisible(false);

    // 滚动条（贴文字区域右侧，轨道+滑块都在预留出的空间里，不会盖住文字）
    this._logScrollbarX = contentX + this._logAreaW + scrollbarGap + scrollbarW / 2;
    this._logScrollbarTrackTop = areaTop;
    this._logScrollbarW = scrollbarW;
    this._logScrollbarGfx = this.scene.add.graphics();
    this._logPanel.add(this._logScrollbarGfx);

    hit.on('wheel', (pointer, dx, dy) => {
      const lastLine = this._logLines[this._logLines.length - 1];
      const contentH = lastLine ? (lastLine.y + lastLine.height) : 0;
      const maxScroll = Math.max(0, contentH - this._logAreaH);
      this._logScrollY = Phaser.Math.Clamp(this._logScrollY + dy * 0.5, 0, maxScroll);
      this._logContent.setY(this._logContentTopY - this._logScrollY);
      this._updateLogScrollbar();
    });
  }

  // ─────────────────────────────────────────────
  // 功能面板（底部三栏最右侧；暂时留空，后续功能待实装）
  // ─────────────────────────────────────────────
  _buildFunctionPanel() {
    const layout = this._getBottomLayout();
    const { x: funcX, w: funcW } = layout.func;
    const funcH = layout.h;
    const funcCenterY = layout.y;

    // 和战斗记录面板一样，备战阶段不显示边框，开始战斗后才和另外两栏一起出现（见 _onStartBattle）
    this._funcPanel = this.scene.add.container(0, 0).setVisible(false);
    this.root.add(this._funcPanel);

    this._funcPanel.add(this._drawPanel(funcX, funcCenterY, funcW, funcH));

    this._funcPanel.add(this.scene.add.text(funcX - funcW / 2 + 16, funcCenterY - funcH / 2 + 18, '◆ 功能', {
      fontSize: '14px', color: THEME_COLOR_HEX, fontStyle: 'bold', padding: { top: 4 },
    }).setOrigin(0, 0.5));

    // 暂时留空，后续功能待实装
  }

  /**
   * 战斗记录里需要高亮成黄色的关键词表：所有兵种名称（MILITARY_UNIT 的 name）+
   * 所有技能名称（MILITARY_SKILL 的 name）+ 硬编码的"普通攻击"（它不是 MILITARY_SKILL
   * 里的条目，是 _executeAction 里单独拼出来的技能名）。这两张表在游戏运行期间不会变化，
   * 懒加载后缓存在 this._logHighlightTerms 上，不需要每条战斗记录都重新构建一次。
   * 按字符串长度从长到短排序，保证匹配时优先匹配更长的名字，避免短名字恰好是
   * 另一个长名字的前缀时被提前截断误判。
   * @returns {string[]}
   */
  _getLogHighlightTerms() {
    if (this._logHighlightTerms) return this._logHighlightTerms;
    const terms = new Set(['普通攻击']);
    for (const tmpl of Object.values(MILITARY_UNIT)) {
      if (tmpl?.name) terms.add(tmpl.name);
    }
    for (const skill of Object.values(MILITARY_SKILL)) {
      if (skill?.name) terms.add(skill.name);
    }
    this._logHighlightTerms = [...terms].sort((a, b) => b.length - a.length);
    return this._logHighlightTerms;
  }

  /**
   * 把一段文本按 _getLogHighlightTerms() 里的关键词切分成若干片段：
   * 命中关键词的片段 { text, highlight: true }（渲染成黄色），其余片段
   * { text, highlight: false }（默认颜色）。采用贪心最长匹配，每个位置优先尝试
   * 匹配最长的关键词，命中后跳过这段关键词的长度，不会出现重叠匹配。
   * @param {string} text
   * @returns {{ text: string, highlight: boolean }[]}
   */
  _splitLogHighlights(text) {
    const terms = this._getLogHighlightTerms();
    const segments = [];
    let i = 0;
    let plainStart = 0;
    while (i < text.length) {
      let matched = null;
      for (const term of terms) {
        if (term.length > 0 && text.startsWith(term, i)) { matched = term; break; }
      }
      if (matched) {
        if (i > plainStart) segments.push({ text: text.slice(plainStart, i), highlight: false });
        segments.push({ text: matched, highlight: true });
        i += matched.length;
        plainStart = i;
      } else {
        i++;
      }
    }
    if (plainStart < text.length) segments.push({ text: text.slice(plainStart), highlight: false });
    return segments;
  }

  /**
   * 渲染一条"富文本"战斗记录：兵组名/技能名等关键词高亮显示成黄色，其余文字保持原本的
   * 暖白色（PANEL_TEXT_COLOR）。
   *
   * 换行规则完全复用 Phaser Text 自带的高级自动换行算法（useAdvancedWrap，按字符宽度
   * 对中文断行）——先用 this._logMeasureText（不可见的"测量专用"Text，配置和这里要
   * 显示的文字完全一致）跑一遍换行，拿到跟"直接把整段文字塞进一个 Text 对象"完全一样的
   * 换行结果（各物理行的文字），再对每一行分别按关键词切分成若干色块，用多个小 Text
   * 对象左右拼接渲染——这样既不需要重新实现一套换行算法，又能做到"部分文字变色"。
   * （极端情况下如果某个关键词恰好被换行断开在两行之间，跨行的那部分不会被识别高亮，
   * 是可以接受的小瑕疵，不影响正常阅读。）
   *
   * @param {string} text - 完整的这一条战斗记录文本
   * @param {number} y - 这一行在 _logContent 容器内的起始 y 坐标
   * @returns {{ container: Phaser.GameObjects.Container, y: number, height: number }}
   */
  _renderRichLogLine(text, y) {
    const measure = this._logMeasureText;
    measure.setText(text);
    const wrappedLines = measure.getWrappedText(text);
    const totalHeight = measure.height;
    const lineHeight = wrappedLines.length > 0 ? totalHeight / wrappedLines.length : totalHeight;

    const container = this.scene.add.container(0, y);

    wrappedLines.forEach((line, lineIndex) => {
      const segments = this._splitLogHighlights(line);
      let x = 0;
      segments.forEach(seg => {
        if (seg.text.length === 0) return;
        const segTxt = this.scene.add.text(x, lineIndex * lineHeight, seg.text, {
          fontSize: '13px', color: seg.highlight ? LOG_HIGHLIGHT_COLOR : PANEL_TEXT_COLOR, padding: { top: 4 },
        }).setOrigin(0, 0);
        container.add(segTxt);
        x += segTxt.width;
      });
    });

    return { container, y, height: totalHeight };
  }

  /** 追加一条战斗记录，自动滚动到最新内容（具体的换行/变色渲染见 _renderRichLogLine）。 */
  _logBattle(text) {
    if (!this._logContent) { console.log(text); return; }

    let y = 0;
    if (this._logLines.length > 0) {
      const last = this._logLines[this._logLines.length - 1];
      y = last.y + last.height + 4;
    }

    const line = this._renderRichLogLine(text, y);
    this._logContent.add(line.container);
    this._logLines.push(line);

    const contentH = y + line.height;
    const maxScroll = Math.max(0, contentH - this._logAreaH);
    this._logScrollY = maxScroll;
    this._logContent.setY(this._logContentTopY - this._logScrollY);
    this._updateLogScrollbar();
  }

  /**
   * 重绘战斗记录面板右侧的滚动条（轨道 + 滑块）。内容没有超出可视区域时不显示；
   * 滑块高度按"可视高度/内容总高度"的比例计算，位置按当前滚动比例计算。
   * 滚动条画在文字区域之外预留出的空间里（见 _buildBattleLogPanel），不会盖住文字。
   */
  _updateLogScrollbar() {
    const g = this._logScrollbarGfx;
    if (!g) return;
    g.clear();

    const lastLine = this._logLines[this._logLines.length - 1];
    const contentH = lastLine ? (lastLine.y + lastLine.height) : 0;
    const areaH = this._logAreaH;
    if (contentH <= areaH) return; // 内容没填满可视区域，不需要滚动条

    const x = this._logScrollbarX;
    const w = this._logScrollbarW;
    const top = this._logScrollbarTrackTop;

    // 轨道：低调的浅色细条
    g.fillStyle(0xffffff, 0.12);
    g.fillRoundedRect(x - w / 2, top, w, areaH, w / 2);

    // 滑块：高度反映可视比例，位置反映当前滚动比例
    const maxScroll = contentH - areaH;
    const thumbH = Math.max(20, areaH * (areaH / contentH));
    const scrollRatio = maxScroll > 0 ? this._logScrollY / maxScroll : 0;
    const thumbY = top + (areaH - thumbH) * scrollRatio;

    g.fillStyle(THEME_COLOR, 0.85);
    g.fillRoundedRect(x - w / 2, thumbY, w, thumbH, w / 2);
  }

  // ─────────────────────────────────────────────
  // 开始战斗按钮（浮在底部三栏中间"行动栏"的常驻底板上，见 _buildUI）
  // ─────────────────────────────────────────────
  _buildStartButton() {
    const layout = this._getBottomLayout();
    const { x, y } = { x: layout.action.x, y: layout.y };
    const BW = 200, BH = 50;

    const btnBg = this.scene.add.image(x, y, 'common_btn_green').setDisplaySize(BW, BH)
      .setInteractive({ useHandCursor: true });
    const btnTxt = this.scene.add.text(x, y, '开始战斗', {
      fontSize: '20px', color: '#1a1200', fontStyle: 'bold', padding: { top: 4 },
    }).setOrigin(0.5);

    btnBg.on('pointerover', () => btnBg.setAlpha(0.8));
    btnBg.on('pointerout', () => btnBg.setAlpha(1));
    btnBg.on('pointerdown', () => btnBg.setAlpha(0.6));
    btnBg.on('pointerup', () => { btnBg.setAlpha(1); this._onStartBattle(); });

    this.root.add([btnBg, btnTxt]);
    this._startBtnBg = btnBg;
    this._startBtnTxt = btnTxt;
  }

  _onStartBattle() {
    // 备战阶段底部三栏（战斗记录/行动/功能）都不显示边框，点击开始战斗后一起出现
    this._logPanel?.setVisible(true);
    this._actionBackdrop?.setVisible(true);
    this._funcPanel?.setVisible(true);

    // 更新所有队伍的兵组顺位（预留 AI 排序逻辑的扩展点）
    this._finalizeOrder();

    // 记录"备战时的排序"（本函数调用后各 person.troops 数组顺序即为最终站位，
    // 后续回合内同顺位同阵营的行动先后就按这个顺序来）
    this._assignBattleOrderIndex();

    // 正式进入战斗：把每个兵组对象升级为 Player 类实例（拥有 attack/useSkill 等方法）
    this._convertTroopsToPlayerClass();

    // 游戏开始时：所有初始兵组按站位顺序（沿用行动顺序的排序规则）依次触发各自
    // "游戏开始时"生效的技能（例如嘲讽——见 _fireSkillHook 的说明；注意这里只
    // 触发 onGameStart，不是 onEnterBattlefield——这些初始兵组不算"登场"，
    // 后续如果因为某种效果被重新登场，则会另外触发一次 onEnterBattlefield）。
    // 必须放在 _convertTroopsToPlayerClass() 之后，此时每个兵组才是 Player 实例，
    // 才能调用 applyBuff 等方法。
    const initialTroops = [
      ...this.attackers.flatMap(p => p.troops ?? []),
      ...this.defenders.flatMap(p => p.troops ?? []),
    ].sort((a, b) => this._compareByActionOrder(a, b));
    initialTroops.forEach(troop => this._fireSkillHook('onGameStart', troop));

    // 战斗开始后不再允许拖拽调整站位，且默认不存在任何点击/拖拽事件——
    // 交互只在目标选择期间（_beginTargeting）对候选目标临时开启，选择结束即关闭
    //
    // 注意：disableInteractive() 只是把 input.enabled 置为 false，并不会清除
    // 备战阶段（_renderTroopSlot）里给我方兵组卡牌设置过的 draggable 状态和
    // dragstart/drag/dragend 监听。如果某个技能允许选择我方自己的兵组作为目标
    // （pool: 'ally'，且不是 auto 自动选择，例如"寒冰盾"），_beginTargeting()
    // 会对候选卡牌重新调用 setInteractive()，这会让之前残留的 draggable 状态
    // 重新生效——玩家在选择目标时如果不小心拖动了卡牌，就会触发 _handleDragEnd()
    // 里的 _renderField()，把所有卡牌销毁重建，而 _targetingHandlers 里还留着
    // 指向旧卡牌（已销毁对象）的引用，之后 _endTargeting() 再对它调用
    // disableInteractive() 时就会因为对象内部 scene 引用已被清空而报错
    // "Cannot read properties of undefined (reading 'sys')"。
    // 这里显式调用 setDraggable(frame, false) 彻底关闭拖拽能力，
    // 这样即使目标选择时重新 setInteractive()，卡牌也不会恢复可拖拽。
    this._battleStarted = true;
    this.slotSprites.forEach(r => {
      this.scene.input.setDraggable(r.frame, false);
      r.frame.disableInteractive();
    });

    // 战斗开始后不再需要"开始战斗"按钮
    this._startBtnBg?.destroy();
    this._startBtnTxt?.destroy();
    this._startBtnBg = null;
    this._startBtnTxt = null;

    // 进入回合 1
    this._startRound(1);
  }

  /**
   * 记录每个兵组在"备战完成"时的相对顺序（分side计数），
   * 用于回合内同顺位、同阵营的行动先后排序（同顺位比较时，先备战靠前的先行动）。
   */
  _assignBattleOrderIndex() {
    let idx = 0;
    for (const person of this.attackers) {
      person.troops.forEach(t => { t.battleOrderIndex = idx++; t.isAttackerSide = true; });
    }
    idx = 0;
    for (const person of this.defenders) {
      person.troops.forEach(t => { t.battleOrderIndex = idx++; t.isAttackerSide = false; });
    }
  }

  /**
   * 把每个兵组的普通对象"升级"为 Player 类实例。
   * 用 Object.setPrototypeOf 原地修改原型链，而不是创建新对象替换引用——
   * 这样 _troopRecordMap、turnOrder、person.troops 数组、record.troop 等
   * 所有已存在的引用会自动"变成" Player 实例，无需逐处重新关联。
   */
  _convertTroopsToPlayerClass() {
    for (const person of [...this.attackers, ...this.defenders]) {
      person.troops.forEach(troop => {
        Object.setPrototypeOf(troop, Player.prototype);
        // 让 Player 实例能访问所属的 BattleSystem，从而封装"选择目标""造成伤害"等操作，
        // 技能逻辑（写在 military_skill.js 里）只需要调用 player.xxx() 即可，不需要关心 battleSystem 内部细节
        troop.battle = this;
      });
    }
  }

  /**
   * 重新排序所有队伍。玩家方保留手动调整后的相对站位（同顺位组内的顺序），
   * AI 方目前无额外排序逻辑（默认不换），但仍统一调用排序函数，
   * 方便未来在 _aiReorder 中插入 AI 的排序策略。
   */
  _finalizeOrder() {
    for (const person of [...this.attackers, ...this.defenders]) {
      if (!person.isPlayer) {
        this._aiReorder(person);
      }
      // 无论玩家还是 AI，都统一用同一套排序规则重新校验一次顺位
      // （玩家的拖拽结果已经写入 person.troops 数组，这里只是保证同顺位分组内排序稳定）
      person.troops = this._sortPersonTroops(person.troops);
    }
  }

  /**
   * AI 排序钩子：当前默认不换（保持原有顺序）。
   * 后续可在此处实现 AI 的站位策略，直接调整 person.troops 数组顺序即可。
   */
  _aiReorder(person) {
    // no-op：AI 方默认不换
  }

  /**
   * 回合开始：重新计算本回合的行动顺序队列，然后开始逐个处理。
   *
   * 排序规则（详见 _buildTurnOrder）：
   *   1. military_order 从小到大（顺位越低出手优先级越高，小的先行动）
   *   2. 顺位相同：先看阵营，进攻方先出手
   *   3. 顺位相同且同阵营：站位靠后的先出手
   *
   * 本回合刚被召唤的兵组（troop.summonedOnRound === roundNumber）不参与本回合行动。
   */
  _startRound(roundNumber) {
    this.round = roundNumber;

    // 回合开始前先检查战斗是否已经结束（某一方全军覆没），避免继续无意义地推进
    if (this._checkBattleEnd()) return;

    console.log(`BattleSystem: 第 ${roundNumber} 回合开始`);
    this._logBattle(`第 ${roundNumber} 轮开始`);
    this._titleText?.setText(`第 ${roundNumber} 轮`);

    this.turnOrder = this._buildTurnOrder(roundNumber);
    this._turnIndex = 0;

    if (this.turnOrder.length === 0) {
      console.log('BattleSystem: 本回合没有可行动的兵组');
      return;
    }

    this._processNextTurn();
  }

  /**
   * 检查战斗是否已经结束（进攻方或防守方全军覆没）。
   * 若已结束：记录日志、显示结算面板，并返回 true 阻止继续推进回合
   * （这是修复"对局结束后无限递归开新回合导致爆栈"问题的关键——
   *  一方全灭后，剩下一方的兵组每次行动都因为没有目标而立刻同步进入下一回合，
   *  没有任何检查会导致这个过程无限嵌套下去，最终耗尽调用栈）。
   * 若还有双方都存活，返回 false，战斗正常继续。
   */
  _checkBattleEnd() {
    if (this._battleEnded) return true;

    const attackersAlive = this.attackers.some(p => (p.troops ?? []).some(t => isOnBattlefield(t)));
    const defendersAlive = this.defenders.some(p => (p.troops ?? []).some(t => isOnBattlefield(t)));

    if (attackersAlive && defendersAlive) return false; // 双方都还有存活兵组，战斗继续

    this._battleEnded = true;

    let resultText;
    if (!attackersAlive && !defendersAlive) {
      resultText = '战斗结束：双方同归于尽';
    } else {
      resultText = attackersAlive ? '战斗结束：进攻方获胜！' : '战斗结束：防守方获胜！';
    }

    this._logBattle(resultText);
    this._titleText?.setText('战斗结束');
    this._showBattleEndPanel(resultText);
    return true;
  }

  /** 战斗结算面板：显示胜负结果，点击关闭按钮销毁整个战场 */
  _showBattleEndPanel(resultText) {
    const { width, height } = this.scene.scale;
    const W = 360, H = 180;

    const overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.65).setDepth(3000);
    const panel = this.scene.add.container(width / 2, height / 2).setDepth(3001);

    const bg = this.scene.add.rectangle(0, 0, W, H, 0x12111e, 0.97).setStrokeStyle(2, THEME_COLOR, 0.9);
    panel.add(bg);

    panel.add(this.scene.add.text(0, -40, resultText, {
      fontSize: '20px', color: '#f0e6cc', fontStyle: 'bold', align: 'center',
      wordWrap: { width: W - 40 }, padding: { top: 4 },
    }).setOrigin(0.5));

    const btnBg = this.scene.add.image(0, 40, 'common_btn_green').setDisplaySize(140, 40)
      .setInteractive({ useHandCursor: true });
    const btnTxt = this.scene.add.text(0, 40, '关闭', {
      fontSize: '16px', color: '#1a1200', fontStyle: 'bold', padding: { top: 4 },
    }).setOrigin(0.5);
    btnBg.on('pointerover', () => btnBg.setAlpha(0.8));
    btnBg.on('pointerout', () => btnBg.setAlpha(1));
    btnBg.on('pointerdown', () => btnBg.setAlpha(0.6));
    btnBg.on('pointerup', () => { btnBg.setAlpha(1); this.destroy(); });
    panel.add([btnBg, btnTxt]);

    panel.setAlpha(0); overlay.setAlpha(0);
    this.scene.tweens.add({ targets: [panel, overlay], alpha: 1, duration: 200 });

    this._battleEndOverlay = overlay;
    this._battleEndPanel = panel;
  }

  /**
   * 回合内出手顺序排序规则：
   *   1. military_order 从小到大（顺位越低出手优先级越高，小的先行动）
   *   2. 顺位相同：先看阵营，进攻方先出手
   *   3. 顺位相同且同阵营：站位靠后的先出手（battleOrderIndex 越大越靠后，降序排列）
   */
  _buildTurnOrder(roundNumber) {
    const allTroops = [
      ...this.attackers.flatMap(p => p.troops),
      ...this.defenders.flatMap(p => p.troops),
    ];

    return allTroops
      .filter(t => isOnBattlefield(t))                     // 只有存活且未消逝的兵组参与
      .filter(t => t.summonedOnRound !== roundNumber)       // 本回合刚召唤的不行动
      .sort((a, b) => this._compareByActionOrder(a, b));
  }

  /**
   * 统一的"行动顺序"比较器：
   *   1. military_order 从小到大（顺位越低出手优先级越高，小的先行动）
   *   2. 顺位相同：先看阵营，进攻方先
   *   3. 顺位相同且同阵营：站位靠后（battleOrderIndex 更大）的先
   * 供 _buildTurnOrder（本回合行动顺序）和 _fireBuffTrigger（buff 触发顺序）共用，
   * 保证"依次触发"和"依次行动"是同一套顺序规则。
   */
  _compareByActionOrder(a, b) {
    const oa = a.stats?.military_order ?? 0;
    const ob = b.stats?.military_order ?? 0;
    if (oa !== ob) return oa - ob;
    if (a.isAttackerSide !== b.isAttackerSide) {
      return a.isAttackerSide ? -1 : 1;
    }
    return (b.battleOrderIndex ?? 0) - (a.battleOrderIndex ?? 0);
  }

  /**
   * 通用 buff 触发钩子：按行动顺序扫描场上所有存活兵组身上的 buff，
   * 依次调用 MILITARY_BUFF[buffKey].trigger[hookName]（若声明了的话）。
   *
   * 这是"buff 效果写在 military_buff.js 里，主循环只负责在正确的时机广播"的核心入口——
   * 新增一个 buff 效果不需要改动 BattleSystem 任何一处判断逻辑，只需要在
   * military_buff.js 对应条目里补充 trigger.<hookName> 函数即可自动接入。
   *
   * 每个 trigger 函数收到两个参数：
   *   ctx  — 本次事件的数据载体（由调用方定义结构，函数可以直接读写它来影响后续流程，
   *          例如 onUseSkill 的 ctx.cost / ctx.converted）
   *   meta — 触发上下文：{ battle, holder, buffKey, rounds }
   *          holder 是这条 buff 记录所属的兵组（不一定是 ctx 里描述的行动者，
   *          具体是否要对本次事件生效由 trigger 函数自己判断，例如诅咒的
   *          onUseSkill 里会检查 ctx.actor === meta.holder，只对buff持有者自己生效）
   *
   * @param {string} hookName - 触发时机名，例如 'onUseSkill'、'onRoundEnd'、'onBeforeDamage'
   * @param {object} [ctx]    - 传给每个 trigger 函数的事件数据，函数可直接修改它
   * @returns {object} ctx（便于调用方链式读取被修改后的结果）
   */
  _fireBuffTrigger(hookName, ctx = {}) {
    const allTroops = [
      ...this.attackers.flatMap(p => p.troops ?? []),
      ...this.defenders.flatMap(p => p.troops ?? []),
    ].filter(t => isOnBattlefield(t));

    const ordered = [...allTroops].sort((a, b) => this._compareByActionOrder(a, b));

    for (const holder of ordered) {
      if (!holder.buffs) continue;
      for (const buffKey of Object.keys(holder.buffs)) {
        const rounds = holder.buffs[buffKey];
        if (!(rounds > 0)) continue;

        const fn = MILITARY_BUFF[buffKey]?.trigger?.[hookName];
        if (typeof fn !== 'function') continue;

        fn(ctx, { battle: this, holder, buffKey, rounds });
      }
    }

    return ctx;
  }

  // ── 逐个处理行动队列中的下一个兵组 ─────────────────
  _processNextTurn() {
    // 先剔除本回合中途已阵亡（含已消逝）的兵组
    this.turnOrder = this.turnOrder.filter(t => isOnBattlefield(t));

    this._clearActiveHighlight();

    if (this._turnIndex >= this.turnOrder.length) {
      // 本回合结束：走到这里时上一个行动的特效+伤害结算（含阵亡）必定已经全部完成
      // （见 _advanceTurn 里的 _waitForPendingEffects），触发轮次结束时的判定
      // （buff/技能的定时效果，同样会等它自己产生的特效播完），
      // 再统一递减 buff 剩余轮次，最后进入下一轮。
      this._resolveRoundEnd(() => this._startRound(this.round + 1));
      return;
    }

    const troop = this.turnOrder[this._turnIndex];
    this._highlightActiveTroop(troop);
    this._logBattle(`${troop.displayName} 的回合开始`);

    if (troop.owner?.isPlayer) {
      this._showActionMenu(troop);
    } else {
      this._aiChooseAction(troop);
    }
  }

  /**
   * 轮次结束结算：
   *   1. 先按行动顺序广播 'onRoundEnd' 触发器，让场上所有声明了 trigger.onRoundEnd 的
   *      buff 各自结算自己的"轮次结束时"效果（例如烧伤、中毒等定时伤害类效果——
   *      具体逻辑写在 military_buff.js 对应条目里，这里不关心是哪个buff做了什么）；
   *   2. 全部处理完毕后，才统一递减所有兵组身上的 buff 剩余轮次——
   *      这一步必须晚于以上所有判定，顺序不能颠倒（诅咒等状态的"最后一轮"仍然完整生效）。
   * @param {Function} callback - 结算完毕后的回调（进入下一回合）
   */
  _resolveRoundEnd(callback) {
    // 按行动顺序触发场上所有buff声明的 onRoundEnd 效果（例如烧伤/中毒的定时伤害）。
    // 具体做什么完全由 military_buff.js 对应条目的 trigger.onRoundEnd 决定——
    // 目前 MILITARY_BUFF 里烧伤/中毒等效果还只有描述文字、没有声明 trigger，
    // 之后要接入时直接在 military_buff.js 里补上 trigger.onRoundEnd 函数即可，
    // 这里的主循环不需要新增任何 if 分支。
    this._fireBuffTrigger('onRoundEnd', { round: this.round });

    // onRoundEnd 触发器里可能会造成新的伤害、产生新的特效（例如未来实装的烧伤/中毒扣血）。
    // 必须先等这些特效+伤害结算（含阵亡）全部完成，才能统一递减buff剩余轮次、进入下一轮——
    // 这一步既要晚于以上 onRoundEnd 判定本身（保证诅咒等状态的"最后一轮"完整生效），
    // 也要晚于它产生的特效播放完毕，顺序不能颠倒。
    this._waitForPendingEffects(() => {
      this._tickBuffDurations();
      callback();
    });
  }

  /**
   * 统一递减所有兵组身上每个 buff 的剩余轮次数，归零后立即移除，并刷新对应卡牌的 buff 图标显示。
   * 跳过已阵亡（_dead）或正等待自己的阵亡结算（_deathPending，飘字还没播完）的兵组——
   * 这些兵组的buff会在它自己的 _resolveDeath 里被整体清空，这里不需要（也不应该）
   * 提前逐条递减、逐条播报"XXX的buff状态已消失"，避免和阵亡播报产生冗余/错乱的日志。
   */
  _tickBuffDurations() {
    const allTroops = [
      ...this.attackers.flatMap(p => p.troops ?? []),
      ...this.defenders.flatMap(p => p.troops ?? []),
    ];

    for (const troop of allTroops) {
      if (troop._dead || troop._deathPending) continue;
      if (!troop.buffs) continue;
      const keys = Object.keys(troop.buffs);
      if (keys.length === 0) continue;

      let changed = false;
      for (const key of keys) {
        const remaining = (troop.buffs[key] ?? 0) - 1;
        if (remaining <= 0) {
          delete troop.buffs[key];
          const buffName = MILITARY_BUFF[key]?.name ?? key;
          this._logBattle(`${troop.displayName}的【${buffName}】状态已消失`);
        } else {
          troop.buffs[key] = remaining;
        }
        changed = true;
      }

      if (changed) {
        this._updateBuffIcons(this._troopRecordMap.get(troop.instanceId));
      }
    }
  }

  /**
   * 进入下一个兵组的回合前，先等上一个行动产生的特效+伤害结算（含阵亡）全部播完/完成——
   * 特效播报后才进行伤害结算，伤害结算（包括角色阵亡）完成后才会开始下一回合，
   * 避免出现"攻击后先进入下一回合、阵亡日志才姗姗来迟"这种日志顺序错乱。
   * 注意这不影响"谁先播完谁先死"的独立结算顺序（见 _maybeResolveDeath）——
   * 这里只是等全部目标都播完+结算完，再统一放行进入下一回合。
   */
  _advanceTurn() {
    this._turnIndex++;
    this._waitForPendingEffects(() => {
      // 每次行动结束都检查一次战斗是否已经结束（此时阵亡结算已经全部完成）
      if (this._checkBattleEnd()) return;
      this._processNextTurn();
    });
  }

  /**
   * 等待"当前这次行动"产生的所有战斗表现效果（伤害飘字、攻击动画、受击动画等，
   * 由 _beginEffect / _endEffect 追踪）全部播放完毕——
   * 由于每个效果播完时都会顺带触发对应目标自己的阵亡结算检查（见 _endEffect → _maybeResolveDeath），
   * 等 this._pendingEffectCount 归零，就意味着这次行动的所有特效播报和伤害结算
   * （含所有相关目标的阵亡）都已经完成，可以安全地推进到下一回合/下一轮。
   */
  _waitForPendingEffects(callback) {
    if (this._pendingEffectCount > 0) {
      this.scene.time.delayedCall(100, () => this._waitForPendingEffects(callback));
      return;
    }
    callback();
  }

  /**
   * 通用"特效播放中"计数接口——飘字、攻击动画、受击动画、（以后可能的）骨骼特效等
   * 任何需要"播放完才能继续判定"的战斗表现效果，都应该在开始播放时调用这个方法，
   * 而不是各自维护一套计数器。与 _endEffect 配对使用。
   *
   * @param {Player|null} [target] - 这个特效依附的目标兵组（可选）：
   *   传入时，效果会同时计入该目标自己身上的 _pendingEffects，
   *   影响这个目标自己何时能进入阵亡结算（见 _maybeResolveDeath）；
   *   不传时（例如施法者自己的读条/引导动画，不依赖某个受击目标），
   *   只计入这次行动的总数，依然能让 _waitForPendingEffects 正确等到它播完。
   */
  _beginEffect(target = null) {
    if (target) target._pendingEffects = (target._pendingEffects ?? 0) + 1;
    this._pendingEffectCount++;
  }

  /**
   * 与 _beginEffect 配对，在特效播放结束时调用（Tween 的 onComplete、
   * 骨骼动画的 complete 事件、或任何异步效果的完成回调都可以）。
   * 传入了 target 的话，顺带检查一次这个目标自己是否可以进入阵亡结算——
   * 谁的特效先播完谁就先触发自己的阵亡结算，不等待场上其它目标。
   */
  _endEffect(target = null) {
    if (target) {
      target._pendingEffects = Math.max(0, (target._pendingEffects ?? 0) - 1);
    }
    this._pendingEffectCount = Math.max(0, this._pendingEffectCount - 1);
    if (target) this._maybeResolveDeath(target);
  }

  // ── 当前行动兵组高亮 ────────────────────────────
  _highlightActiveTroop(troop) {
    const record = this._troopRecordMap.get(troop.instanceId);
    if (!record) return;
    if (!record.turnGlow) {
      record.turnGlow = this.scene.add.rectangle(0, 0, SLOT_W + 10, SLOT_H + 10, 0, 0)
        .setStrokeStyle(3, 0xffd700, 1);
      record.container.addAt(record.turnGlow, 0);
    }
    record.turnGlow.setVisible(true);
    this._activeRecord = record;
  }

  _clearActiveHighlight() {
    if (this._activeRecord?.turnGlow) {
      this._activeRecord.turnGlow.setVisible(false);
    }
    this._activeRecord = null;
  }

  // ── 玩家回合：显示行动选择面板（底部三栏中间"行动栏"；图标按钮，图标下方是名称，
  //    再下方是魔力消耗——图标+数字，魔力图标复用兵组详情页同一份素材见 MANA_ICON_PATH）──
  _showActionMenu(troop) {
    this._hideActionMenu();

    const layout = this._getBottomLayout();
    const { x: panelX, w: panelW } = layout.action;
    const panelH = layout.h;

    const panel = this.scene.add.container(panelX, layout.y).setDepth(2000);
    panel.add(this._drawPanel(0, 0, panelW, panelH));

    // 小标题：告诉玩家当前是谁的回合（参考图这一栏没有单独的标题文字，
    // 但游戏需要这个信息，所以保留，样式和左右两栏的"◆ 标题"保持一致）
    panel.add(this.scene.add.text(-panelW / 2 + 16, -panelH / 2 + 18, `◆ ${troop.displayName} 的回合，请选择行动`, {
      fontSize: '13px', color: THEME_COLOR_HEX, fontStyle: 'bold', padding: { top: 4 },
    }).setOrigin(0, 0.5));

    // 技能按钮横向居中排列
    const actions = [
      // 普通攻击的图标素材文件名是 attack.png，和技能图标同一个目录（assets/military/skill/）
      { label: '普通攻击', actionKey: 'normal_attack', cost: null, des: null, iconKey: 'attack' },
      ...(troop.activeSkills ?? []).map(({ key, skill }) => (
        { label: skill.name ?? key, actionKey: key, cost: skill.cost, des: skill.des, iconKey: key }
      )),
    ];

    const btnW = 118, iconSize = 60, gap = 16;
    const totalW = actions.length * btnW + (actions.length - 1) * gap;
    let bx = -totalW / 2 + btnW / 2;
    const iconY = -8;

    actions.forEach(({ label, actionKey, cost, des, iconKey }) => {
      this._addActionBtn(panel, troop, bx, iconY, btnW, iconSize, label, actionKey, cost, des, iconKey);
      bx += btnW + gap;
    });

    this._actionMenuPanel = panel;
  }

  /**
   * 添加一个行动按钮（普通攻击/技能通用）：方形图标 + 名称 + 魔力消耗（图标+数字），
   * 竖直堆叠。按 canAfford 结果整体置灰不可点，悬浮时仍能看到技能效果描述（如果有）。
   * @param {Phaser.GameObjects.Container} panel - 挂载到哪个容器（局部坐标以 panel 原点为准）
   * @param {Player} troop - 当前行动的兵组
   * @param {number} cx - 按钮列中心 x（panel 局部坐标）
   * @param {number} iconY - 图标中心 y（panel 局部坐标）
   */
  _addActionBtn(panel, troop, cx, iconY, btnW, iconSize, label, actionKey, cost, des, iconKey) {
    const affordable = troop.canAfford(cost);
    const manaCost = cost?.mana ?? 0;

    // 技能图标（DOM img，参考兵组展示界面的做法，object-fit:contain；素材缺失静默隐藏）。
    // 不再画外框——DOM 图片本身就是交互点选对象，尺寸直接放大到之前外框的大小(iconSize)。
    // 这里故意不用 pointer-events:none——图标本身要能正确显示 pointer 光标，就必须让它
    // 自己接管这块区域的鼠标事件（pointer-events:none 只是把光标"穿透"给下层 canvas，
    // 图标自身的 cursor 样式不会生效）。所以图标是可交互的，鼠标事件再原样转发给下面
    // hitZone 已经注册好的悬浮/点击处理逻辑（见本方法末尾），保证行为和按钮其余区域一致。
    let iconEl = null;
    let iconDom = null;
    if (iconKey) {
      const imgSize = iconSize;
      iconEl = document.createElement('img');
      iconEl.src = `assets/military/skill/${iconKey}.png`;
      iconEl.style.cssText = `width:${imgSize}px;height:${imgSize}px;object-fit:contain;display:block;`
        + `pointer-events:auto;cursor:${affordable ? 'pointer' : 'default'};`
        + (affordable ? '' : 'filter:grayscale(1);');
      iconEl.onerror = () => { iconEl.style.display = 'none'; };
      iconDom = this.scene.add.dom(cx, iconY, iconEl).setDepth(2001);
      // 不透明度改用 Phaser DOM GameObject 自己的 alpha 通道（setAlpha），而不是直接改
      // node.style.opacity——Phaser 每一帧都会把这个 GameObject 的 alpha 同步写回
      // style.opacity，如果只手动改 style.opacity，下一帧就会被 Phaser 自己的渲染
      // 同步覆盖回去，视觉上等于完全没变化（这正是之前"透明度怎么不变"的原因）。
      iconDom.setAlpha(affordable ? 1 : 0.45);
      panel.add(iconDom);
    }

    // 名称（图标下方）。useAdvancedWrap:true——中文没有空格分词，普通 wordWrap 不会对中文断行，
    // 技能名比较长、一行放不下时必须用"高级"模式才会按字符宽度真正换行成两行。
    const nameY = iconY + iconSize / 2 + 14;
    const nameText = this.scene.add.text(cx, nameY, label, {
      fontSize: '12px', color: affordable ? PANEL_TEXT_COLOR : PANEL_MUTED_TEXT_COLOR, padding: { top: 4 },
      align: 'center', wordWrap: { width: btnW - 6, useAdvancedWrap: true },
    }).setOrigin(0.5, 0);
    panel.add(nameText);

    // 魔力消耗（名称下方）：图标 + 数字，普通攻击也统一显示（消耗为0）。
    // costY 按名称文字的实际渲染高度动态计算（而不是写死一个偏移量），并额外多留一点间距——
    // 这样不管名称是一行还是（换行后）两行，魔力这一行都会正好落在名称下方，不会和名称文字重叠。
    const costY = nameText.y + nameText.height + 8;

    // 魔力图标：和技能图标一样改用 DOM <img>（而不是 Phaser 纹理 Image），风格统一
    const manaIconEl = document.createElement('img');
    manaIconEl.src = MANA_ICON_PATH;
    manaIconEl.style.cssText = 'width:14px;height:14px;object-fit:contain;display:block;pointer-events:none;'
      + (affordable ? '' : 'opacity:0.5;filter:grayscale(1);');
    manaIconEl.onerror = () => { manaIconEl.style.display = 'none'; };
    const manaIconDom = this.scene.add.dom(cx - 9, costY, manaIconEl).setDepth(2001);
    panel.add(manaIconDom);

    panel.add(this.scene.add.text(cx + 3, costY, `${manaCost}`, {
      fontSize: '12px', color: affordable ? PANEL_TEXT_COLOR : PANEL_MUTED_TEXT_COLOR, fontStyle: 'bold', padding: { top: 4 },
    }).setOrigin(0, 0.5));

    // 透明命中区域覆盖整个按钮列（图标+名称+消耗），负责点击/悬浮交互；
    // 高度按内容实际范围（从图标顶部到魔力这一行下方）动态计算，保证不管名称是否换行，
    // 悬浮在技能图标区域时都能命中并显示 pointer 手型光标。
    const hitTop = iconY - iconSize / 2;
    const hitBottom = costY + 10;
    const hitZone = this.scene.add.rectangle(cx, (hitTop + hitBottom) / 2, btnW, hitBottom - hitTop, 0, 0);
    panel.add(hitZone);

    // 始终可交互：可负担时悬浮技能图标区域会变成 pointer 手型光标、可点击；
    // 不可负担但有效果描述时仍可悬浮查看效果（保持默认箭头光标，因为不可点击）
    hitZone.setInteractive({ useHandCursor: affordable });

    if (affordable) {
      // 悬浮时图标增加20%透明度（不透明度 100% → 80%），离开恢复；用 iconDom.setAlpha
      // 而不是直接改 style.opacity（原因见上面创建 iconDom 时的注释）
      hitZone.on('pointerover', () => { iconDom?.setAlpha(0.8); });
      hitZone.on('pointerout', () => { iconDom?.setAlpha(1); });
      hitZone.on('pointerdown', () => {
        this._hideActionMenu();
        this._beginTargeting(troop, actionKey);
      });
    }

    // 悬浮显示技能效果浮窗
    if (des) {
      hitZone.on('pointerover', (ptr) => this._showActionTip(label, des, ptr));
      hitZone.on('pointermove', (ptr) => this._moveActionTip(ptr));
      hitZone.on('pointerout', () => this._hideActionTip());
    }

    // 技能图标这张 DOM 图片是可交互的（见上面的创建注释），鼠标真的悬浮在图标像素上时
    // 浏览器会挡住 canvas，Phaser 自己的 hitZone 收不到原生事件——所以这里把图标的
    // 鼠标事件直接转发成同名的 pointerover/pointermove/pointerdown/pointerout，
    // 触发 hitZone 上面已经注册好的那些监听器，图标区域和按钮其余区域交互效果完全一致。
    if (iconEl) {
      const fwd = (name) => hitZone.emit(name, this.scene.input.activePointer);
      iconEl.addEventListener('mouseenter', () => fwd('pointerover'));
      iconEl.addEventListener('mousemove', () => fwd('pointermove'));
      iconEl.addEventListener('mouseleave', () => fwd('pointerout'));
      iconEl.addEventListener('mousedown', () => fwd('pointerdown'));
    }
  }

  _hideActionMenu() {
    if (this._actionMenuPanel) {
      this._actionMenuPanel.destroy(true);
      this._actionMenuPanel = null;
    }
    this._hideActionTip(); // 行动菜单收起时，技能浮窗也一并清理
  }

  // ── 技能效果浮窗（悬浮在行动按钮上显示技能名+描述）────
  _showActionTip(title, des, ptr) {
    this._hideActionTip();

    const TIP_W = 220;
    const div = document.createElement('div');
    div.style.cssText = [
      `width:${TIP_W}px`,
      'background:rgba(17,17,34,0.95)',
      'border:1px solid #b8963e',
      'border-radius:4px',
      'padding:10px',
      'pointer-events:none',
      'box-sizing:border-box',
      'font-family:sans-serif',
    ].join(';');

    const titleEl = document.createElement('div');
    titleEl.style.cssText = 'color:#ffcc44;font-size:14px;font-weight:bold;margin-bottom:6px;word-break:break-all;';
    titleEl.textContent = title;

    const desEl = document.createElement('div');
    desEl.style.cssText = 'color:#cccccc;font-size:13px;word-break:break-all;line-height:1.5;';
    desEl.textContent = des;

    div.appendChild(titleEl);
    div.appendChild(desEl);

    this._actionTooltip = this.scene.add.dom(0, 0, div).setDepth(5000);

    // 全局 mousemove 驱动，rAF 节流到每帧最多更新一次位置，避免高频重绘闪烁
    let pendingX = ptr.x, pendingY = ptr.y;
    let rafScheduled = false;
    const applyPosition = () => {
      rafScheduled = false;
      if (!this._actionTooltip) return;
      this._positionActionTip(pendingX, pendingY);
    };
    this._actionTipMouseMove = (e) => {
      const canvas = this.scene.game.canvas;
      const rect = canvas.getBoundingClientRect();
      pendingX = e.clientX - rect.left;
      pendingY = e.clientY - rect.top;
      if (!rafScheduled) {
        rafScheduled = true;
        requestAnimationFrame(applyPosition);
      }
    };
    document.addEventListener('mousemove', this._actionTipMouseMove);

    this._positionActionTip(ptr.x, ptr.y);
  }

  _positionActionTip(px, py) {
    if (!this._actionTooltip) return;
    const { width, height } = this.scene.scale;
    const node = this._actionTooltip.node;
    const w = node.offsetWidth || 220;
    const h = node.offsetHeight || 80;

    // 行动按钮在屏幕底部，浮窗默认往指针上方展开更合理
    let tx = px + 16 + w / 2;
    let ty = py - 16 - h / 2;

    if (tx + w / 2 > width - 8) tx = px - 16 - w / 2;
    if (ty - h / 2 < 8) ty = py + 16 + h / 2; // 上方放不下就改往下
    if (tx - w / 2 < 8) tx = 8 + w / 2;
    if (ty + h / 2 > height - 8) ty = height - 8 - h / 2;

    this._actionTooltip.setPosition(tx, ty);
  }

  _moveActionTip(ptr) {
    // 由全局 mousemove 驱动，此方法保留兼容旧调用但无需额外操作
  }

  _hideActionTip() {
    if (this._actionTipMouseMove) {
      document.removeEventListener('mousemove', this._actionTipMouseMove);
      this._actionTipMouseMove = null;
    }
    if (this._actionTooltip) {
      this._actionTooltip.destroy();
      this._actionTooltip = null;
    }
  }

  // ── 进入目标选择：高亮候选目标，等待玩家手动点击+确认 ───
  /**
   * 进入目标选择：高亮所有候选目标，等待玩家点击。
   * 不做任何自动结束——不管候选数量多少、是否已经选满上限，都必须点击"确认"按钮才会真正执行。
   * 选中的目标再次点击会取消选择（切换态）。
   * 提示文字和"确认"按钮复用底部的行动选择区（_actionMenuPanel）。
   */
  _beginTargeting(troop, actionKey) {
    const isSkill = actionKey !== 'normal_attack';

    // 未实装的技能（MILITARY_SKILL 里没有定义 skill() 函数）：
    // 不进入目标选择环节，直接判定为无事发生并推进到下一回合，避免任何边界情况卡死
    if (isSkill && typeof MILITARY_SKILL[actionKey]?.skill !== 'function') {
      const skillName = MILITARY_SKILL[actionKey]?.name ?? actionKey;
      this._logBattle(`${troop.displayName}使用了${skillName}，但技能效果尚未实装，什么也没有发生`);
      this.scene.time.delayedCall(450, () => this._advanceTurn());
      return;
    }

    // 消耗条件不满足（双重保险，正常流程下不可负担的技能按钮本来就不可点）：
    // 同样直接判定无事发生，避免误触发扣费/效果
    if (isSkill && !troop.canAfford(MILITARY_SKILL[actionKey]?.cost)) {
      const skillName = MILITARY_SKILL[actionKey]?.name ?? actionKey;
      this._logBattle(`${troop.displayName}尝试使用${skillName}，但消耗不足，什么也没有发生`);
      this.scene.time.delayedCall(450, () => this._advanceTurn());
      return;
    }

    // 技能声明为"自动执行，不需要玩家/AI 选择目标"（targeting.auto === true）：
    // 跳过整个候选计算和选择 UI，技能函数内部自己决定打谁（例如秘术·回旋固定从
    // 敌方最前排开始，沿站位队列自动往后找目标，完全不需要外部指定）
    if (isSkill && MILITARY_SKILL[actionKey]?.targeting?.auto) {
      if (troop.getEnemies().length === 0) {
        // 没有任何存活敌方，无法执行，直接结束这次行动
        this._advanceTurn();
        return;
      }
      this._executeAction(troop, actionKey, []); // 目标交给技能内部处理，这里传空数组占位
      return;
    }

    const { candidates, min, max } = this._getTargetCandidates(troop, actionKey);

    if (candidates.length === 0) {
      // 没有可选目标，直接结束这次行动
      this._advanceTurn();
      return;
    }

    // 记录本次目标选择的上下文
    this._selectedTargets = [];
    this._targetingCandidates = candidates;
    this._targetingMin = min;
    this._targetingMax = max;
    this._targetingTroop = troop;
    this._targetingActionKey = actionKey;
    this._targetingIsSkill = isSkill;

    // 高亮所有候选目标（未选中：红色描边），临时开启交互，点击切换选中状态
    this._targetingHandlers = [];
    for (const candidate of candidates) {
      const record = this._troopRecordMap.get(candidate.instanceId);
      if (!record) continue;
      record.frame.setStrokeStyle(3, 0xff3333, 1);
      record.frame.setInteractive({ useHandCursor: true }); // 目标选择期间临时开启交互

      const handler = () => this._toggleTargetSelection(candidate);
      record.frame.on('pointerdown', handler);
      this._targetingHandlers.push({ record, handler });
    }

    this._showTargetingConfirmPanel();
  }

  /**
   * 切换某个候选目标的选中状态：未选中→选中（金色描边）；已选中→取消选中（恢复红色）。
   * 已达到上限 max 时，不能再新增选择（但仍可以取消已选中的）。
   */
  _toggleTargetSelection(candidate) {
    const record = this._troopRecordMap.get(candidate.instanceId);
    const idx = this._selectedTargets.indexOf(candidate);

    if (idx !== -1) {
      // 已选中，再次点击取消选择
      this._selectedTargets.splice(idx, 1);
      record?.frame.setStrokeStyle(3, 0xff3333, 1);
    } else {
      if (this._selectedTargets.length >= this._targetingMax) return; // 已到上限，忽略新增
      this._selectedTargets.push(candidate);
      record?.frame.setStrokeStyle(3, 0xffd700, 1);
    }

    this._refreshTargetingConfirmPanel();
  }

  /**
   * 目标选择期间，复用底部行动选择区显示：
   *   一行提示"请选择 N 个目标（已选 X）"（N 为区间时显示"min-max"）
   *   一个"确认"按钮：未满足最少数量时置灰不可点，满足后点亮变绿可点
   */
  _showTargetingConfirmPanel() {
    this._hideActionMenu(); // 复用同一块面板区域，先清空

    const layout = this._getBottomLayout();
    const { x: panelX, w: panelW } = layout.action;
    const panelH = layout.h;

    const panel = this.scene.add.container(panelX, layout.y).setDepth(2000);
    panel.add(this._drawPanel(0, 0, panelW, panelH));

    const hintText = this.scene.add.text(0, -22, '', {
      fontSize: '15px', color: PANEL_TEXT_COLOR, padding: { top: 4 }, align: 'center',
    }).setOrigin(0.5);
    panel.add(hintText);

    const btnW = 140, btnH = 40;
    const confirmBg = this.scene.add.image(0, 26, 'common_btn').setDisplaySize(btnW, btnH).setAlpha(0.5);
    const confirmTxt = this.scene.add.text(0, 26, '确认', {
      fontSize: '15px', color: '#1a1200', fontStyle: 'bold', padding: { top: 4 },
    }).setOrigin(0.5);
    panel.add([confirmBg, confirmTxt]);

    panel._hintText = hintText;
    panel._confirmBg = confirmBg;

    this._actionMenuPanel = panel;
    this._refreshTargetingConfirmPanel();
  }

  _refreshTargetingConfirmPanel() {
    const panel = this._actionMenuPanel;
    if (!panel) return;

    const count = this._selectedTargets.length;
    const min = this._targetingMin, max = this._targetingMax;
    const rangeText = min === max ? `${min}` : `${min}-${max}`;
    panel._hintText.setText(`请选择 ${rangeText} 个目标（已选 ${count}）`);

    const canConfirm = count >= min;
    panel._confirmBg.removeAllListeners();
    if (canConfirm) {
      panel._confirmBg.setTexture('common_btn_green').setAlpha(1);
      panel._confirmBg.setInteractive({ useHandCursor: true });
      panel._confirmBg.on('pointerover', () => panel._confirmBg.setAlpha(0.8));
      panel._confirmBg.on('pointerout', () => panel._confirmBg.setAlpha(1));
      panel._confirmBg.on('pointerdown', () => panel._confirmBg.setAlpha(0.6));
      panel._confirmBg.on('pointerup', () => { panel._confirmBg.setAlpha(1); this._confirmTargeting(); });
    } else {
      panel._confirmBg.setTexture('common_btn').setAlpha(0.5);
      panel._confirmBg.disableInteractive();
    }
  }

  /** 点击"确认"后，正式执行本次行动 */
  _confirmTargeting() {
    const chosen = [...this._selectedTargets];
    const { troop, actionKey, isSkill } = {
      troop: this._targetingTroop,
      actionKey: this._targetingActionKey,
      isSkill: this._targetingIsSkill,
    };
    this._endTargeting();
    this._executeAction(troop, actionKey, isSkill ? chosen : chosen[0]);
  }

  _endTargeting() {
    if (this._targetingHandlers) {
      for (const { record, handler } of this._targetingHandlers) {
        record.frame.off('pointerdown', handler);
        record.frame.disableInteractive(); // 选择结束，恢复"默认不可点击"状态
        const tint = record.isAttacker ? ATTACKER_TINT : DEFENDER_TINT;
        record.frame.setStrokeStyle(2, tint, 0.8);
      }
      this._targetingHandlers = null;
    }
    this._selectedTargets = null;
    this._targetingCandidates = null;
    this._targetingMin = null;
    this._targetingMax = null;
    this._targetingTroop = null;
    this._targetingActionKey = null;
    this._targetingIsSkill = null;
    this._hideActionMenu(); // 目标选择用的正是这块面板区域，一并清理
  }

  _getAliveEnemies(troop) {
    const enemySide = troop.isAttackerSide ? this.defenders : this.attackers;
    return enemySide.flatMap(p => p.troops).filter(t => isOnBattlefield(t));
  }

  _getAliveAllies(troop) {
    const ownSide = troop.isAttackerSide ? this.attackers : this.defenders;
    return ownSide.flatMap(p => p.troops).filter(t => isOnBattlefield(t));
  }

  /**
   * 找出敌方每一路（每个人的站位队列）当前"最前面"的存活兵组——
   * 即该队列（person.troops 数组，备战阶段已按站位固定）里下标最小的存活兵组。
   *
   * 站位是备战阶段一次性确定的固定顺序（一般情况下顺位越大越靠前），
   * 一旦确定就不再随战斗中顺位数值的变化重新计算——判断"谁站最前面"
   * 看的是这个固定站位，不是实时比较 military_order 数值大小。
   *
   * 若某一路全灭，则该路没有"最前面目标"（不会跳到别的位置补位）；
   * 多路（敌方有多个角色）时，每一路各自的最前面目标都算候选，可能并列多个。
   */
  _getFrontmostEnemies(troop) {
    const enemySide = troop.isAttackerSide ? this.defenders : this.attackers;
    const fronts = [];
    for (const person of enemySide) {
      const frontmost = (person.troops ?? []).find(t => isOnBattlefield(t));
      if (frontmost) fronts.push(frontmost);
    }
    return fronts;
  }

  /**
   * 根据行动类型返回可选目标：
   *   普通攻击：只能选择敌方每一路站位最靠前的存活兵组（可能并列多路），
   *             但受"嘲讽"重定向规则约束，见 _getTauntAdjustedFrontmostEnemies
   *   技能：暂不限制，可选任意存活敌方
   */
  _getValidTargetsForAction(troop, actionKey) {
    if (actionKey !== 'normal_attack') return this._getAliveEnemies(troop);
    return this._getTauntAdjustedFrontmostEnemies(troop);
  }

  /**
   * 普通攻击专用的目标计算：默认取每一路敌方站位最靠前的存活兵组（_getFrontmostEnemies），
   * 但如果某一路里存在存活且持有【嘲讽】buff（buff key = 20，登场时由嘲讽技能施加，
   * 见 military_skill.js 的 onGameStart/onEnterBattlefield）的单位，则该路的普通攻击目标只能是
   * 这个嘲讽单位本身——不管它实际站在哪个位置，替换掉默认的"站位最靠前"目标。
   *
   * 注意：这个重定向只影响"普通攻击"的目标计算，不修改 getFrontmostEnemies()/
   * _getFrontmostEnemies() 本身——技能内部依赖"纯粹按站位取最前排"语义的逻辑
   * （例如秘术·回旋的起点判定）不会被嘲讽影响，符合嘲讽描述里"普通攻击"这个限定范围。
   */
  _getTauntAdjustedFrontmostEnemies(troop) {
    const enemySide = troop.isAttackerSide ? this.defenders : this.attackers;
    const result = [];
    for (const person of enemySide) {
      const troops = person.troops ?? [];
      const taunter = troops.find(t => isOnBattlefield(t) && t.hasBuff?.(20));
      const frontmost = taunter ?? troops.find(t => isOnBattlefield(t));
      if (frontmost) result.push(frontmost);
    }
    return result;
  }

  /**
   * 统一计算某个行动的候选目标列表 + 需要选择的数量范围（min/max）。
   * 供玩家点击选择（_beginTargeting）和 AI 自动选择（_aiSelectTargets）共用同一套规则。
   *
   * - 普通攻击：内置规则（敌方存活兵组中顺位最大者，可能并列），恒定选1个
   * - 技能：若在 MILITARY_SKILL[key].targeting 里声明了候选池/过滤条件/数量，按声明来；
   *   没有声明的技能沿用旧行为（任意存活敌方，选1个），保持向后兼容
   *
   * targeting 配置格式：
   *   {
   *     pool:   'enemy' | 'ally',               // 候选池，默认 'enemy'
   *     filter: (player, candidate) => boolean,  // 自定义过滤条件，可选
   *     count:  number | [min, max] | [n],       // 数量要求，默认 1
   *   }
   *
   * count 的三种写法：
   *   1        → 固定选 1 个
   *   [2, 5]   → 至少选 2 个，至多选 5 个
   *   [3]      → 固定选 3 个（等价于数字 3）
   *
   * count 还支持传入函数 (player) => number|[min,max]，用于"数量取决于施法者自身数值"
   * 的技能（例如流星火雨"至多等同于自身等级数量个目标"，等级因单位而异，无法写死）——
   * 计算候选时会先用当前 troop 调用一次这个函数，取得真正的 count 配置再走上面三种写法。
   *
   * count 会向 filter 结果让步：filter 筛出的候选数量若少于 min/max，
   * 实际可选数量会被裁剪到不超过候选数量（即使配置要求更多也无法凭空生出目标）。
   *
   * 嘲讽约束（见 _applyTauntConstraint）：敌方存在存活的嘲讽单位时，
   * "单目标"技能（解析出来的 max === 1）的候选会被收紧为"敌方全部嘲讽单位"；
   * 有数量要求的技能（max > 1）无视嘲讽，候选不受影响；只对候选池是敌方的技能生效，
   * 目标池是己方（pool:'ally'）的技能不受此约束。普通攻击不经过这里，
   * 有自己单独的"每一路取最靠前的嘲讽者"规则，见 _getTauntAdjustedFrontmostEnemies。
   *
   * @returns {{ candidates: Player[], min: number, max: number }}
   */
  _getTargetCandidates(troop, actionKey) {
    if (actionKey === 'normal_attack') {
      return { candidates: this._getValidTargetsForAction(troop, actionKey), min: 1, max: 1 };
    }

    const skillDef = MILITARY_SKILL[actionKey];
    const targeting = skillDef?.targeting;

    if (!targeting) {
      // 没有自定义 targeting 配置的技能：沿用旧行为——任意存活敌方，单目标，
      // 属于"允许选择任意目标"的技能，同样受嘲讽约束
      let candidates = this._getAliveEnemies(troop);
      candidates = this._applyTauntConstraint(troop, candidates, 1);
      return { candidates, min: Math.min(1, candidates.length), max: Math.min(1, candidates.length) };
    }

    const pool = targeting.pool === 'ally' ? this._getAliveAllies(troop) : this._getAliveEnemies(troop);
    let candidates = typeof targeting.filter === 'function'
      ? pool.filter(c => targeting.filter(troop, c))
      : pool;

    const rawCount = typeof targeting.count === 'function'
      ? targeting.count(troop)
      : (targeting.count ?? 1);
    const { min, max } = this._normalizeCount(rawCount);

    if (targeting.pool !== 'ally') {
      candidates = this._applyTauntConstraint(troop, candidates, max);
    }

    // count 向 filter 结果让步：不能要求比实际候选数量更多的目标
    return {
      candidates,
      min: Math.min(min, candidates.length),
      max: Math.min(max, candidates.length),
    };
  }

  /**
   * 嘲讽约束："对方有存活的嘲讽单位时，己方的攻击只能选择这些嘲讽单位"——
   * 但只对"单目标"技能生效（resolvedMax === 1，即允许选择任意目标的技能）：
   * 敌方存在嘲讽单位时，候选收紧为候选池和"敌方全部嘲讽单位"的交集
   * （不区分嘲讽单位分属哪个人/哪一路，本身就允许选任意目标，收紧后仍是任选其一）；
   * 有多个嘲讽单位时，同样按各自技能原本的 filter 规则筛选，不额外指定"选哪一个"。
   * "有数量要求的技能"（resolvedMax > 1，固定多个/区间/按等级动态等）无视嘲讽，
   * 候选不受影响，原样返回。
   *
   * 特殊情况——技能本身带有前提条件（targeting.filter）时：如果敌方的嘲讽单位
   * 里没有一个满足这个技能自己的前提条件（交集为空），说明嘲讽单位对这个技能
   * 来说根本不是合法目标，这时不应该收紧到"无候选可选"，而是退回技能自己筛选出的
   * 候选列表（即视为嘲讽对这个技能不生效），仍然从满足前提条件的目标里正常选择。
   * @param {Player} troop
   * @param {Player[]} candidates - 已经过技能自身 pool/filter 筛选后的候选
   * @param {number} resolvedMax - 这次技能已经解析出来的最大可选数量
   * @returns {Player[]}
   */
  _applyTauntConstraint(troop, candidates, resolvedMax) {
    if (resolvedMax > 1) return candidates; // 有数量要求的技能无视嘲讽
    const enemySide = troop.isAttackerSide ? this.defenders : this.attackers;
    const taunters = enemySide.flatMap(p => p.troops ?? [])
      .filter(t => isOnBattlefield(t) && t.hasBuff?.(20));
    if (taunters.length === 0) return candidates;
    const restricted = candidates.filter(c => taunters.includes(c));
    // 嘲讽单位里没有一个满足技能自身前提条件：嘲讽对这个技能不生效，
    // 退回未被嘲讽收紧过的候选列表，而不是让候选变成空
    return restricted.length > 0 ? restricted : candidates;
  }

  /**
   * 把 targeting.count 的三种写法（数字 / [min,max] / [n]）统一归一化成 { min, max }。
   */
  _normalizeCount(countSpec) {
    if (Array.isArray(countSpec)) {
      if (countSpec.length >= 2) {
        const min = Math.max(1, countSpec[0]);
        const max = Math.max(min, countSpec[1]);
        return { min, max };
      }
      if (countSpec.length === 1) {
        const n = Math.max(1, countSpec[0]);
        return { min: n, max: n };
      }
      return { min: 1, max: 1 }; // 空数组兜底
    }
    const n = Math.max(1, countSpec ?? 1);
    return { min: n, max: n };
  }

  // ── AI 回合：自动选择行动与目标 ─────────────────────
  _aiChooseAction(troop) {
    const actionKey = this._aiChooseActionKey(troop);
    const isSkill = actionKey !== 'normal_attack';
    const isAuto = isSkill && MILITARY_SKILL[actionKey]?.targeting?.auto;

    // 自动执行的技能不需要计算目标，技能函数内部自己决定打谁
    const targets = isAuto ? [] : this._aiSelectTargets(troop, actionKey);
    if (!isAuto && targets.length === 0) {
      this._advanceTurn();
      return;
    }

    // 短暂延迟一下再执行，方便玩家看清 AI 的行动
    this.scene.time.delayedCall(500, () => {
      this._executeAction(troop, actionKey, isSkill ? targets : targets[0]);
    });
  }

  /**
   * AI 选择本回合要执行的行动（普通攻击或某个主动技能）：
   * 在"cost 负担得起 + 存在可选目标"的行动里，选 effect 最高的一个；
   * 并列最高时随机挑一个。
   * 普通攻击默认 effect=1，没有 cost（永远可负担），作为保底选项。
   */
  _aiChooseActionKey(troop) {
    const options = [{ actionKey: 'normal_attack', effect: 1 }];

    for (const { key, skill } of troop.activeSkills ?? []) {
      if (!troop.canAfford(skill.cost)) continue; // 消耗条件不满足，跳过

      const { candidates } = this._getTargetCandidates(troop, key);
      if (candidates.length === 0) continue; // 没有可选目标，跳过

      options.push({ actionKey: key, effect: skill.effect ?? 0 });
    }

    const maxEffect = Math.max(...options.map(o => o.effect));
    const best = options.filter(o => o.effect === maxEffect);
    return best[Math.floor(Math.random() * best.length)].actionKey;
  }

  /**
   * AI 自动选择目标：基于 _getTargetCandidates 算出的候选池 + 数量范围。
   *
   * - 若技能在 MILITARY_SKILL[key].aiSelectTargets(player, candidates, min, max) 里
   *   定义了专属的 AI 选择逻辑，优先使用它（返回非空数组时生效）；
   * - 否则走默认策略：随机尝试选到（让步后的）上限 max 个。
   *
   * 普通攻击（actionKey === 'normal_attack'）没有对应的 MILITARY_SKILL 条目，恒定走默认随机策略。
   */
  _aiSelectTargets(troop, actionKey) {
    const { candidates, min, max } = this._getTargetCandidates(troop, actionKey);
    if (candidates.length === 0) return [];

    const skillDef = actionKey !== 'normal_attack' ? MILITARY_SKILL[actionKey] : null;
    if (typeof skillDef?.aiSelectTargets === 'function') {
      const result = skillDef.aiSelectTargets(troop, candidates, min, max);
      if (Array.isArray(result) && result.length > 0) return result;
      // 自定义函数没返回有效结果时，退回默认策略兜底
    }

    // 默认策略：随机打乱候选顺序，尽量选到上限 max 个
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, max);
  }

  // ── 执行行动：计算伤害并应用到目标 ──────────────────
  /**
   * @param {Player} troop
   * @param {string} actionKey
   * @param {Player|Player[]} targetOrTargets - 普通攻击是单个 Player；技能是 Player 数组（哪怕只选1个也是数组）
   */
  _executeAction(troop, actionKey, targetOrTargets) {
    const isSkill = actionKey !== 'normal_attack';
    let converted = false; // 是否被某个buff效果转换为普通攻击（例如【诅咒】）

    // 技能实际执行时扣除 cost（消耗），可用性已经在按钮上/选择行动前判定过。
    // 使用技能这一时机，先按行动顺序广播 'onUseSkill' 触发器，让场上所有声明了
    // trigger.onUseSkill 的 buff（例如【诅咒】：魔力翻倍 + 40%概率转为普通攻击）
    // 有机会读写 ctx 来修改本次的 cost / 是否转化——具体是哪个buff、做了什么，
    // 主循环完全不关心，只负责在正确的时机把 ctx 交出去、再把结果读回来。
    let cost = isSkill ? MILITARY_SKILL[actionKey]?.cost : null;
    if (isSkill) {
      const ctx = this._fireBuffTrigger('onUseSkill', { actor: troop, actionKey, cost, converted: false });
      cost = ctx.cost;
      converted = ctx.converted;

      troop.spendCost(cost);
    }

    const useNormalAttack = !isSkill || converted;

    // 被转化为普通攻击时，沿用普通攻击自身的目标规则（敌方每路站位最靠前的存活兵组，
    // 且同样受嘲讽重定向约束），而不是复用原技能已经选好的目标——
    // 两者的候选池/数量规则可能完全不同
    const attackTarget = useNormalAttack
      ? (isSkill ? (this._getTauntAdjustedFrontmostEnemies(troop)[0] ?? null) : targetOrTargets)
      : null;

    const components = useNormalAttack
      ? (attackTarget ? troop.attack(attackTarget) : {})
      : troop.useSkill(actionKey, targetOrTargets);

    const totalDmg = sumDamageComponents(components);
    const actionName = useNormalAttack ? '普通攻击' : (MILITARY_SKILL[actionKey]?.name ?? actionKey);

    // 日志用主目标（数组的第一个）展示；技能如果命中了多个目标，
    // 其余目标的伤害已经在技能函数内部通过 player.dealDamage() 各自结算，飘字会分别显示
    const primaryTarget = useNormalAttack ? attackTarget : targetOrTargets?.[0];
    if (primaryTarget) {
      this._logBattle(`${troop.displayName}使用了${actionName}对${primaryTarget.displayName}造成了${totalDmg}伤害，${primaryTarget.displayName}当前剩余体力${Math.max(0, primaryTarget.currentHp)}/${primaryTarget.maxHp}`);
    } else if (!useNormalAttack) {
      // 自动选择目标的技能（如秘术·回旋）没有外部传入的主目标，
      // 简单记录一条使用行为，详细的命中/伤害信息由技能函数内部通过 player.log() 自行记录
      this._logBattle(`${troop.displayName}使用了${actionName}`);
    }

    // 略微延迟后再进入下一个兵组的回合，方便玩家看清本次结算结果
    this.scene.time.delayedCall(450, () => this._advanceTurn());
  }

  /**
   * 在目标兵组头顶生成伤害飘字：颜色按 DAMAGE_TYPE 注册表逐类型生成（物理红色/魔法淡蓝色/
   * 真实伤害白色…），向上飘动并逐渐消失。components 里只需要传实际用到的伤害类型，
   * 新增伤害类型不需要改这个函数，去 DAMAGE_TYPE 里加一条注册即可。
   * 每条飘字都是一个独立的"特效"，通过 _beginEffect / _endEffect 计入通用的特效计数
   * （详见这两个方法的注释）——以后要加攻击动画、受击动画，同样按这个模式接入即可。
   */
  _spawnDamageFloaters(target, components) {
    const record = this._troopRecordMap.get(target.instanceId);
    if (!record) return;

    const parts = [];
    for (const [key, meta] of Object.entries(DAMAGE_TYPE)) {
      const val = components?.[key];
      if (val > 0) parts.push({ text: `-${val}`, color: meta.color });
    }
    if (parts.length === 0) parts.push({ text: '-0', color: '#aaaaaa' });

    const startY = -SLOT_H / 2 - 44; // 卡牌放大后护甲条上移了，飘字起始位置也相应上移，留出足够间距
    parts.forEach((p, i) => {
      const txt = this.scene.add.text(0, startY - i * 16, p.text, {
        fontSize: '16px', color: p.color, fontStyle: 'bold', padding: { top: 4 },
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5);
      record.container.add(txt);

      this._beginEffect(target);

      this.scene.tweens.add({
        targets: txt,
        y: txt.y - 42,
        alpha: 0,
        duration: 1300, // 略微减慢消失速度（原 900ms）
        ease: 'Cubic.easeOut',
        onComplete: () => {
          txt.destroy();
          this._endEffect(target);
        },
      });
    });
  }

  /**
   * @param {Player}  target
   * @param {number}  dmg
   * @param {{ ignoreArmor?: boolean }} [options] - ignoreArmor 为 true 时跳过护甲抵消，直接扣血
   */
  _applyDamage(target, dmg, options = {}) {
    const { ignoreArmor = false } = options;
    const record = this._troopRecordMap.get(target.instanceId);
    let remaining = dmg;

    // 优先扣除护甲（除非技能声明无视护盾）
    if (!ignoreArmor) {
      const armor = Math.max(0, target.currentArmor ?? 0);
      if (armor > 0) {
        const absorbed = Math.min(armor, remaining);
        target.currentArmor = armor - absorbed;
        remaining -= absorbed;
        this._updateArmorBar(record);
      }
    }

    // 剩余伤害再扣血量
    if (remaining > 0) {
      target.currentHp = Math.max(0, (target.currentHp ?? 0) - remaining);
      this._updateHpBar(record);
    }

    // 血量归零：这里只标记为"待处理阵亡"，不立即清空buff/播报/变灰、也不阻塞任何游戏判定流程——
    // 阵亡后续处理必须等这个目标自己身上的战斗表现效果（伤害飘字、以后可能的受击动画等，
    // 由 _beginEffect / _endEffect 追踪）全部播放完毕后才执行，由 _endEffect 播完时
    // 调用 _maybeResolveDeath → _resolveDeath 触发（唯一调用方 Player.dealDamage 里
    // _applyDamage 之后必定紧跟着调用 _spawnDamageFloaters，即使伤害为0也会生成一条
    // "-0"飘字，所以这里标记的 _deathPending 一定会被消费到）。
    // _deathPending 防止同一个目标被重复标记。
    if (target.currentHp <= 0 && !target._dead && !target._deathPending) {
      target._deathPending = true;
    }
  }

  /**
   * 检查某个目标自己是否可以进入阵亡结算：
   *   - 该目标确实处于"待阵亡"状态（_deathPending）且还没结算过（!_dead）；
   *   - 该目标自己身上挂着的所有战斗表现效果（伤害飘字、攻击/受击动画等，
   *     由 _beginEffect / _endEffect 追踪）已经全部播放完毕（_pendingEffects <= 0）。
   * 只由这个目标自己身上的效果播放完成来触发（见 _endEffect），完全不等待场上其它目标——
   * 例如宗教审判技能同时命中 C（主目标）和 ABDE（溅射），C 自己的效果先播完，
   * C 就会先进入阵亡结算，即使此时 A/B/D/E 的效果还在播放。
   */
  _maybeResolveDeath(target) {
    if (!target?._deathPending || target._dead) return;
    if ((target._pendingEffects ?? 0) > 0) return;
    this._resolveDeath(target);
  }

  /**
   * 单个兵组的阵亡结算（只处理这一个目标，不等待、不涉及场上其它兵组）：
   *   1. 清空自身持有的全部buff（并刷新buff图标显示）；
   *   2. 阵亡视觉标记（变灰+彻底禁用交互，避免死亡后仍可被点击选中/误触发目标选择）；
   *   3. 战斗记录里播报"XXX已阵亡"。
   */
  _resolveDeath(troop) {
    if (troop._dead) return; // 双重保险，避免重复处理
    troop._dead = true;
    troop._deathPending = false;

    // 阵亡清空自身全部buff
    if (troop.buffs) {
      for (const key of Object.keys(troop.buffs)) delete troop.buffs[key];
    }

    const record = this._troopRecordMap.get(troop.instanceId);
    this._updateBuffIcons(record);

    if (record) {
      record.frame.setFillStyle(0x000000, 0.85);
      record.container.setAlpha(0.5);
      record.frame.disableInteractive();
      record.isDead = true;
    }

    this._logBattle(`${troop.displayName}已阵亡`);
  }

  // ─────────────────────────────────────────────
  // 销毁
  // ─────────────────────────────────────────────
  destroy() {
    this._hideActionMenu();
    this._endTargeting();
    this._logMaskShape?.destroy();
    // _logMeasureText 是直接挂在场景显示列表上的测量用对象（没有加入 root 容器），
    // root.destroy(true) 不会连带销毁它，这里要单独清理
    this._logMeasureText?.destroy();
    this._battleEndPanel?.destroy(true);
    this._battleEndOverlay?.destroy();
    this.root?.destroy(true);
    this.overlay?.destroy();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Player — 战场上的一个兵组实例（正式进入战斗后，由普通对象升级而来）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Player — 战场上的一个兵组实例（正式进入战斗后，由普通对象升级而来）。
 *
 * 携带的属性（由 BattleSystem._createTroopInstance 初始化，构造/升级时已具备）：
 *   instanceId, unitKey, displayName, image, quality, level,
 *   stats, ability, equipments, maxHp, currentHp, maxArmor, currentArmor,
 *   buffs（{ [buffKey]: 剩余轮次数 }）,
 *   owner, originalIndex, activeSkills, passiveSkills, tagSkills,
 *   battleOrderIndex, isAttackerSide, battle（所属的 BattleSystem 实例）
 *
 * 设计原则：
 *   技能的具体判定流程（选择目标、造成多少伤害、是否无视护盾等）写在 military_skill.js
 *   对应技能条目的 skill(player, target) 函数里，Player 只负责提供封装好的底层能力
 *   （getEnemies / getAllies / dealDamage / applyBuff / log 等），技能函数内部调用
 *   player.xxx() 即可，不需要关心 BattleSystem 的内部实现。
 *
 *   useSkill(key, target) 会优先派发到 MILITARY_SKILL[key].skill 这个函数；
 *   没有定义 skill 函数的技能，走通用的 damage_base 兜底公式（保持向后兼容）。
 */
class Player {
  /**
   * 一般不会直接 new Player(...) 构造——BattleSystem 在兵组对象已经具备完整数据后，
   * 用 Object.setPrototypeOf(troop, Player.prototype) 直接"升级"成 Player 实例，
   * 保留所有既有引用（渲染记录、行动队列等都不需要重新关联）。
   * 这里仍保留标准构造函数，便于需要时直接实例化或单独测试。
   */
  constructor(data = {}) {
    Object.assign(this, data);
  }

  // ─────────────────────────────────────────────
  // 封装能力：供 military_skill.js 里的 skill() 函数调用
  // ─────────────────────────────────────────────

  /** 敌方存活兵组列表 */
  getEnemies() {
    return this.battle?._getAliveEnemies(this) ?? [];
  }

  /**
   * 敌方每一路（每个人的站位队列）当前最前面的存活兵组，可能并列多路。
   * 判断依据是站位（备战阶段确定的固定顺序），不是实时比较顺位数值大小。
   */
  getFrontmostEnemies() {
    return this.battle?._getFrontmostEnemies(this) ?? [];
  }

  /** 己方（含自己）存活兵组列表 */
  getAllies() {
    if (!this.battle) return [];
    const side = this.isAttackerSide ? this.battle.attackers : this.battle.defenders;
    return side.flatMap(p => p.troops).filter(t => t.isAlive?.());
  }

  /**
   * 获取目标在其"站位队列"（同一人的 troops 数组）中，前后相邻的兵组，用于"周围"类溅射效果。
   *
   * 规则：数组下标就是站位——下标越小站位越靠前。一般情况下站位由备战阶段按顺位排序决定，
   * 但站位本身是独立于 military_order 数值的值，一旦确定（或被某些特殊技能直接调整过）
   * 就以数组下标为准，不会再去比较顺位数值。分别向前(下标-1,-2,...)、向后(下标+1,+2,...)
   * 各最多找 maxEachSide 个；只要某个方向越过数组边界（没有更多兵组）就在该方向停止，
   * 不会跳到别的位置补位；已阵亡的兵组仍占据自己的站位（计入下标偏移），
   * 但不会出现在最终返回的可命中目标列表里。
   *
   * @param {Player} target
   * @param {number} [maxEachSide=2]
   * @returns {Player[]} 找到的相邻兵组（不含 target 自己），已过滤掉已阵亡的
   */
  getNearbyTroops(target, maxEachSide = 2) {
    const lineup = target?.owner?.troops;
    if (!lineup) return [];
    const idx = lineup.indexOf(target);
    if (idx === -1) return [];

    const result = [];
    // 前方：下标更小（站位更靠前）
    for (let i = 1; i <= maxEachSide; i++) {
      const t = lineup[idx - i];
      if (!t) break; // 越界，前方到头了
      result.push(t);
    }
    // 后方：下标更大（站位更靠后）
    for (let i = 1; i <= maxEachSide; i++) {
      const t = lineup[idx + i];
      if (!t) break; // 越界，后方到头了
      result.push(t);
    }

    return result.filter(t => t.isAlive?.());
  }

  /**
   * 把目标兵组移动到其所属队伍站位队列里的指定位置（默认移到最前面）。
   *
   * 顺位只是"默认情况下"决定初始站位的因素——备战阶段按顺位从大到小排序，产生了
   * 站位数组的初始顺序；但站位本身是独立于 military_order 数值的固定值，一旦确定，
   * 后续任何逻辑（getFrontmostEnemies / getNearbyTroops / 秘术回旋的链式判定等）都只
   * 读这个数组下标，不会重新按顺位排序。这个方法就是留给"顺位很低但拥有特殊技能，
   * 能把自己/队友提到队伍最前面"这类效果使用的接口：直接修改站位数组本身，
   * 不需要（也不应该）去改动 military_order 数值。
   *
   * 注意：这里只调整"站位数组顺序"本身（影响所有依赖数组下标的判定逻辑，以及
   * 战场上的视觉站位），暂不联动调整 battleOrderIndex（回合内同顺位同阵营的出手顺序
   * 次级排序键）——如果未来某个技能需要连带影响出手顺序，需要在这里一并处理。
   *
   * @param {Player} target      - 要移动的兵组（可以是自己，也可以是队友）
   * @param {number} [toIndex=0] - 目标站位下标，默认移到最前面（0）
   */
  setStation(target, toIndex = 0) {
    const lineup = target?.owner?.troops;
    if (!lineup) return;

    const curIndex = lineup.indexOf(target);
    if (curIndex === -1) return;

    lineup.splice(curIndex, 1);
    const clampedIndex = Math.max(0, Math.min(toIndex, lineup.length));
    lineup.splice(clampedIndex, 0, target);

    // _renderField 会销毁并重建所有卡牌的显示对象（含"轮到谁行动"的高亮特效），
    // 记录当前正在高亮的兵组，重渲染后需要重新关联到新生成的显示对象上，
    // 否则 this.battle._activeRecord 会指向已被销毁的旧对象，后续清除高亮时报错。
    const activeTroop = this.battle?._activeRecord?.troop;

    // 站位变化后，战场视觉需要重新渲染以反映新的位置
    this.battle?._renderField();

    if (activeTroop && this.battle) {
      this.battle._activeRecord = null;
      this.battle._highlightActiveTroop(activeTroop);
    }
  }

  /** setStation 的简便写法：把目标移动到队伍最前面（站位下标0） */
  moveToFront(target) {
    this.setStation(target, 0);
  }

  /**
   * 对目标造成伤害：内部会走 BattleSystem 的护甲抵消/扣血逻辑并生成伤害飘字。
   * @param {Player} target
   * @param {Record<string, number>} components - 伤害拆分，key 为 DAMAGE_TYPE 里注册的
   *   伤害类型（目前有 physical/magic/pure），只需要传实际用到的类型，例如烧伤只需要
   *   传 { pure: 10 }，不需要凑齐 physical/magic 这些用不到的字段。
   * @param {{ignoreArmor?:boolean}} [options] - 显式传 true/false 可以强制覆盖是否无视护甲；
   *   不传时按 DAMAGE_TYPE 的 ignoreArmor 规则自动判断（例如纯真实伤害会自动无视护甲）。
   * @returns {{hit: boolean, total: number, components: Record<string, number>}}
   *   hit    — 这次攻击是否真正命中并结算了伤害；为 false 表示被"命中前"钩子拦截
   *            （目前没有任何 buff 会拦截，是为未来的闪避/无效攻击等效果预留的接口）。
   *   total  — 实际造成的总伤害数值（未命中时为0）。
   *   components — 原样传回本次的伤害拆分，便于调用方需要时读取。
   *   像宗教审判这类"必须先命中主目标才会触发后续效果"的复合技能，应该在这次调用后
   *   检查返回值的 hit 字段，为 false 时中断自己的后续逻辑（诅咒/溅射等），不再执行。
   */
  dealDamage(target, components, options = {}) {
    if (!this.battle || !target) return { hit: false, total: 0, components: components ?? {} };

    // 命中判定钩子：伤害真正结算前，广播给场上所有 buff 一个介入机会——
    // 未来实装的闪避、无效攻击等效果，可以在自己声明的 trigger.onBeforeDamage 里
    // 把 ctx.cancelled 置为 true 来"打断"这次攻击（例如目标身上的闪避buff判定命中率后
    // 决定回避）。目前 MILITARY_BUFF 里还没有任何 buff 声明这个钩子，广播总是原样返回。
    const hookCtx = this.battle._fireBuffTrigger('onBeforeDamage', {
      attacker: this, target, components, cancelled: false,
    });

    if (hookCtx.cancelled) {
      return { hit: false, total: 0, components: components ?? {} };
    }

    const total = sumDamageComponents(components);
    const ignoreArmor = options.ignoreArmor ?? inferIgnoreArmor(components);
    this.battle._applyDamage(target, total, { ...options, ignoreArmor });
    this.battle._spawnDamageFloaters(target, components);
    return { hit: true, total, components };
  }

  /** 追加一条战斗记录 */
  log(text) {
    this.battle?._logBattle(text);
  }

  /**
   * 给目标增加护甲/护盾值，并播放护甲条的"增长"动画（见 BattleSystem._animateArmorGain）：
   * 蓝条先瞬间收缩成"旧护甲值/新护甲值"的比例，再补间过渡到满宽，直观展示这次增加了多少。
   * 护盾不存在上限，只有当前值——直接叠加到 currentArmor 上即可。
   * 供护盾/增益类技能使用，例如"寒冰盾：给己方1组单位增加10×等级的寒冰护甲"。
   * @param {Player} target
   * @param {number} amount
   * @returns {number} 实际增加的护甲值
   */
  grantArmor(target, amount) {
    if (!this.battle || !target || amount <= 0) return 0;
    const oldArmor = target.currentArmor ?? 0;
    target.currentArmor = oldArmor + amount;
    const record = this.battle._troopRecordMap.get(target.instanceId);
    this.battle._animateArmorGain(record, oldArmor, target.currentArmor);
    return amount;
  }

  /**
   * 召唤一个新兵组加入自己所在的队伍（战斗中途），例如罗睺一斩杀死目标后
   * 将其转化为骷髅。受"召唤生物数量上限"（固定为5，与站位队列的战术宽度是
   * 两条独立的规则）限制——达到上限时返回 null（调用方应据此判断是否要
   * 播报"无法召唤"的提示）。
   * @param {string} [unitKey='skeleton'] - MILITARY_UNIT 的 key
   * @param {object} [statsOverride] - 覆盖召唤物的基础六维（例如沿用被杀死目标自己的数值）
   * @returns {Player|null}
   */
  summonUnit(unitKey = 'skeleton', statsOverride = {}) {
    return this.battle?._summonTroop(this.owner, unitKey, statsOverride) ?? null;
  }

  /**
   * 是否持有某个 buff（且剩余轮次 > 0）。
   * @param {number|string} key - MILITARY_BUFF 的 key
   * @returns {boolean}
   */
  hasBuff(key) {
    return (this.buffs?.[key] ?? 0) > 0;
  }

  /**
   * 给目标施加一个 buff（剩余轮次数）。
   * 若目标已持有同一个 buff，取"现有剩余轮次"与"本次施加轮次"中的较大值——
   * 即刷新时长，不会因为重复施加而叠加轮次数，也不会让已有的更长持续时间被缩短。
   * 施加后立即刷新目标卡牌下方的 buff 图标显示（法力条下方，持续堆放）。
   * @param {Player} target
   * @param {number|string} key   - MILITARY_BUFF 的 key，例如诅咒是 2
   * @param {number} rounds       - 本次施加的持续轮次数
   */
  applyBuff(target, key, rounds) {
    if (!this.battle || !target || !(rounds > 0)) return;

    // 免疫判定：控制类/弱化类 buff 若目标当前持有对应的免疫状态（振奋/玄藏免疫控制类，
    // 无双/守护免疫弱化类），本次施加直接被拦截，不生效。见 CONTROL_BUFF_KEYS 等分类表。
    const numericKey = Number(key);
    if (CONTROL_BUFF_KEYS.has(numericKey) && hasActiveBuffFromSet(target, CONTROL_IMMUNE_BUFF_KEYS)) {
      this.log(`${target.displayName}免疫控制类异常状态，未受到【${MILITARY_BUFF[key]?.name ?? key}】影响`);
      return;
    }
    if (DEBUFF_BUFF_KEYS.has(numericKey) && hasActiveBuffFromSet(target, DEBUFF_IMMUNE_BUFF_KEYS)) {
      this.log(`${target.displayName}免疫弱化类异常状态，未受到【${MILITARY_BUFF[key]?.name ?? key}】影响`);
      return;
    }

    if (!target.buffs) target.buffs = {};

    const current = target.buffs[key] ?? 0;
    target.buffs[key] = Math.max(current, rounds);

    const buffName = MILITARY_BUFF[key]?.name ?? key;
    // 永久buff（rounds 为 Infinity）不显示剩余轮次数，也不加"（永久）"这个后缀——
    // 直接显示"XXX陷入了【YYY】状态"即可，见 _updateBuffIcons 里同类的"不显示轮次数字"处理
    const roundsSuffix = Number.isFinite(target.buffs[key]) ? `（剩余${target.buffs[key]}轮）` : '';
    this.log(`${target.displayName}陷入了【${buffName}】状态${roundsSuffix}`);

    const record = this.battle._troopRecordMap.get(target.instanceId);
    this.battle._updateBuffIcons(record);
  }

  /**
   * 立即移除目标身上的某个 buff（不等待轮次归零）。
   * @param {Player} target
   * @param {number|string} key
   */
  removeBuff(target, key) {
    if (!this.battle || !target?.buffs || target.buffs[key] == null) return;
    delete target.buffs[key];

    const record = this.battle._troopRecordMap.get(target.instanceId);
    this.battle._updateBuffIcons(record);
  }

  /**
   * 判断自己是否能负担某个技能的 cost（消耗）——必须所有消耗项都满足才算能用。
   * cost 格式如 { mana: 1 }，未来可能扩展出 { stamina: 2 } 等其他资源。
   * 已知资源（mana）走 current/max 追踪；未登记过 current/max 的资源键退化为直接比较
   * this.stats[key]（静态数值兜底，不做真实扣减），供尚未实装追踪机制的资源类型使用。
   *
   * 注意：canAfford 用于"按钮是否可点"的静态判定，按基础 cost（未叠加诅咒翻倍）计算——
   * 诅咒翻倍是"选择使用技能那一刻"才结算的动态效果（见 BattleSystem._executeAction），
   * 这样即使被诅咒，只要基础消耗能负担，技能按钮依然可点（点击后才可能因翻倍/转化而变化）。
   * @param {Record<string, number>} [cost]
   * @returns {boolean}
   */
  canAfford(cost) {
    if (!cost) return true; // 没有 cost 视为永远可用（如普通攻击）
    return Object.entries(cost).every(([key, amount]) => {
      const fields = Player.RESOURCE_FIELDS[key];
      const current = fields ? (this[fields.current] ?? 0) : (this.stats?.[key] ?? 0);
      return current >= amount;
    });
  }

  /**
   * 实际扣除某个技能的 cost（在技能确定要执行时调用一次）。
   * 只对已登记 current/max 追踪的资源（如 mana）做真实扣减；
   * 未登记的资源类型暂不实际扣除（因为还没有对应的"当前值"字段可以扣）。
   * @param {Record<string, number>} [cost]
   */
  spendCost(cost) {
    if (!cost) return;
    for (const [key, amount] of Object.entries(cost)) {
      const fields = Player.RESOURCE_FIELDS[key];
      if (!fields) continue; // 未登记追踪的资源类型，暂不实际扣除
      this[fields.current] = Math.max(0, (this[fields.current] ?? 0) - amount);
    }
    // 法力条需要实时刷新显示（其他已登记资源如未来的体力条，可以按同样方式扩展）
    if (cost.mana != null && this.battle) {
      const record = this.battle._troopRecordMap.get(this.instanceId);
      this.battle._updateManaBar(record);
    }
  }

  // ─────────────────────────────────────────────
  // 行动
  // ─────────────────────────────────────────────

  /**
   * 普通攻击：伤害 = 物理攻击 + 魔法攻击，内部直接调用 dealDamage 完成结算。
   */
  attack(target) {
    const components = {
      physical: Math.max(0, Math.round(this.stats?.physical_attack ?? 0)),
      magic: Math.max(0, Math.round(this.stats?.spell_attack ?? 0)),
    };
    this.dealDamage(target, components);
    return components;
  }

  /**
   * 技能统一入口：优先使用 MILITARY_SKILL[skillKey].skill(player, targets) 里定义的具体判定流程
   * （该函数内部自行调用 player.dealDamage() / player.getEnemies() 等完成"选择目标、造成伤害"等逻辑）；
   * 没有单独实现 skill 函数的技能视为"尚未实装"，返回空效果（不造成任何伤害/影响），
   * 避免任何未定义行为——BattleSystem._beginTargeting 会在进入这里之前就拦截未实装的技能，
   * 这里的空效果兜底是双重保险。
   *
   * @param {string} skillKey  - 技能在 MILITARY_SKILL / special_ability 中的 key
   * @param {Player[]} targets - 目标兵组数组（UI 选择/AI 选择出的候选，哪怕只选1个也是长度1的数组）
   * @returns {Record<string, number>} 主目标（targets[0]）受到的伤害拆分（用于战斗记录文字），
   *   key 为 DAMAGE_TYPE 里注册的伤害类型，只需要包含实际用到的类型
   */
  useSkill(skillKey, targets) {
    const skillDef = MILITARY_SKILL[skillKey];

    if (typeof skillDef?.skill === 'function') {
      // 技能自己的完整判定逻辑（选择目标、造成伤害等）都写在 military_skill.js 里
      const result = skillDef.skill(this, targets);
      return result ?? {};
    }

    // 没有实装 skill() 函数的技能：默认空效果，什么也不做
    return {};
  }

  /** 是否存活——同时排除已打上【消逝】标记的目标，见 isOnBattlefield 的说明 */
  isAlive() {
    return isOnBattlefield(this);
  }
}

/**
 * 资源键 → Player 实例上对应的 current/max 字段名映射，供 canAfford/spendCost 使用。
 * 未来新增可消耗资源（如体力 stamina）时，先在 _createTroopInstance 里加上
 * maxStamina/currentStamina 字段，再在这里登记映射即可自动获得完整的消耗判定支持。
 */
Player.RESOURCE_FIELDS = {
  mana: { current: 'currentMana', max: 'maxMana' },
};