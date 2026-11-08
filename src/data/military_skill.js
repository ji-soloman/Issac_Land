export const MILITARY_SKILL = {
  explore_terrain: {
    name: '探索地区',
    type: 'tag',
    des: '可以探索主城附近的未知区域'
  },
  explore_resource: {
    name: '探索物资',
    type: 'tag',
    des: '可以向民众征集物产，或在领地区域内探索',
  },
  migration: {
    name: '开拓',
    type: 'tag',
    des: '移民星舟可以从任意主城出发，向着未知的区域探索...',
  },
  taunt: {
    name: '嘲讽',
    type: 'passive',
    des: '目标存活时，其他目标的攻击只能以自身为目标',
    level: 1,
    term: {
      buff: [20],
    },
    /**
     * 嘲讽没有主动技能效果（skill 函数），实际效果完全通过 trigger 声明的两个
     * "登场"钩子触发（见 battleSystem.js 的 _fireSkillHook 说明），二者互斥，
     * 同一个兵组不会在同一次登场里被触发两次：
     *   1. onGameStart —— 游戏开始时：只对战斗开始时就已经在场上的初始兵组生效，
     *      所有初始兵组按站位顺序依次触发一次；
     *   2. onEnterBattlefield —— 自身登场时：只对战斗中途才登场的兵组生效
     *      （例如被召唤，或者未来任何让这个兵组"重新登场"的效果），在登场的
     *      那一刻单独触发一次。游戏开始时就在场上的初始兵组不会触发这个节点；
     *      但如果之后这个兵组因为某种效果被"再次登场"，则确实会再触发一次。
     * 两者效果相同：为自身施加永久的【嘲讽】buff（buff key = 20，见 military_buff.js）。
     * 永久buff的剩余轮次用 Infinity 表示，不会随轮次递减/消失，buff图标上也不会
     * 显示剩余轮次数字（见 battleSystem.js 的 _updateBuffIcons）。嘲讽的实际拦截
     * 效果（"其他目标的普通攻击/单目标技能优先以自己为目标"）由 BattleSystem 里
     * 判断 t.hasBuff(20) 的地方统一处理，这里只负责施加这个buff。
     */
    trigger: {
      onGameStart(player) {
        player.applyBuff(player, 20, Infinity);
      },
      onEnterBattlefield(player) {
        player.applyBuff(player, 20, Infinity);
      },
    },
  },
  pitch: {
    name: '投掷',
    type: 'initiative',
    des: '对目标进行投掷攻击，可以穿越顺位',
    level: 1,
    pitch: true, // 投掷类攻击，可以无视部分前方屏障,
    cost: { mana: 1 },
    effect: 5, // AI 会在负担得起的行动里优先选 effect 最高的，普攻默认 effect=1
    damage_base: {
      physical_attack: 3, // 算法是士兵数值乘以这里的基数，然后所有基数加起来就是总伤害
    },
    /**
     * AI 使用这个技能时的目标选择逻辑：优先打血量最低的目标（而不是默认的随机策略）。
     * 参数：player(使用技能的AI自己)、candidates(已经过targeting筛选的候选)、min、max。
     * 返回一个 Player 数组即为 AI 选中的目标；不写这个函数则 AI 走默认的"随机选到 max 个"策略。
     */
    aiSelectTargets(player, candidates, min, max) {
      const sorted = [...candidates].sort((a, b) => (a.currentHp ?? 0) - (b.currentHp ?? 0));
      return sorted.slice(0, max);
    },
    /**
     * 技能判定流程写在这里：接收 player（自己，Player 实例）和 targets（目标数组），
     * 用 player 封装好的方法执行"造成伤害"，返回值用于战斗记录展示。
     */
    skill(player, targets) {
      const target = targets[0];
      const components = {
        physical: Math.round((player.stats?.physical_attack ?? 0) * 3),
        magic: 0,
      };
      player.dealDamage(target, components);
      return components;
    },
  },
  sailing_lv1: {
    name: '航行',
    type: 'tag',
    sailing: true,
    des: '可以在水中使用'
  },
  convey_lv1: {
    name: '基础运载',
    type: 'tag',
    convey: true,
    des: '可以运载其他单位，战斗时继承防御属性和护甲且优先被消耗'
  },
  Inquisition_dark: {
    name: '宗教审判',
    level: 3,
    des: '瞬移到目标身后，对目标进行一次无视护甲的攻击，额外造成4×魔法攻击的魔法伤害并对目标施加4轮【诅咒】，对目标周围至多4个其他角色造成2×魔法攻击的溅射伤害。',
    cost: { mana: 4 },
    effect: 12, // 复合技能（无视护盾+溅射），收益比普通技能更高
    term: {
      buff: [2],
      dam_4: true,
    },
    /**
     * "选择任意目标 + 无视护盾 + 按站位溅射相邻单位 + 施加诅咒"的复合技能。
     * - 目标不受限制，可选任意存活敌方（不像普通攻击限定顺位最大者）
     * - 对主目标：“一次无视护盾的攻击”= 一次完整的普通攻击伤害（物理攻击+魔法攻击），
     *   “额外造成4×魔法攻击的魔法伤害”= 在这次攻击基础上再叠加的部分（不是取代基础伤害）
     * - 诅咒：对主目标施加 4 轮【诅咒】状态（MILITARY_BUFF key = 2，与 military_buff.js
     *   保持一致；效果本身——技能消耗魔力翻倍、40%概率被转为普攻——由 BattleSystem
     *   在目标后续使用技能时结算，这里只负责施加/刷新 buff）
     * - 溅射：目标所属队伍站位队列中，前后相邻的兵组（各最多2个，越过边界即停），
     *   造成 2×魔法攻击 的溅射伤害；具体规则见 player.getNearbyTroops() 的说明
     */
    skill(player, targets) {
      const target = targets[0];
      const physAtk = player.stats?.physical_attack ?? 0;
      const magicAtk = player.stats?.spell_attack ?? 0;

      // 主目标：“一次攻击”（物理攻击+魔法攻击，等同普通攻击）+ 额外4×魔法攻击，均无视护盾
      const mainDmg = {
        physical: Math.round(physAtk),
        magic: Math.round(magicAtk), // 基础攻击的魔法部分 + 额外4倍
      };
      const mainResult = player.dealDamage(target, mainDmg, { ignoreArmor: true });

      // 必须先成功命中第一目标，才会触发后续的诅咒和溅射——如果因为任何原因
      // （例如未来出现的闪避、无效攻击等效果）导致这次攻击未命中，后续效果全部中断。
      if (!mainResult.hit) {
        player.log(`${player.displayName}对${target.displayName}的攻击未能命中，宗教审判的后续效果未能触发`);
        return mainDmg;
      }

      // 对主目标施加4轮【诅咒】（buff key = 2，见 data/military_buff.js）
      player.applyBuff(target, 2, 4);

      // 溅射：目标站位队列中前后相邻的兵组（各最多2个，越界即停）
      const splashDmg = { physical: 0, magic: Math.round(magicAtk * 2) };
      player.getNearbyTroops(target, 2)
        .forEach(t => player.dealDamage(t, splashDmg));

      return mainDmg; // 战斗记录展示主目标受到的伤害
    },
  },
  Ninjutsu: {
    name: '秘术·回旋',
    level: 4,
    des: '向前方投掷回旋镖并收回，回旋镖至多穿过3名敌方目标，对路径上的目标造成20点折返的物理伤害，并对终点的目标造成30点物理伤害，同时造成12点溅射的魔法伤害。',
    cost: { mana: 4 },
    effect: 15, // 去程+回程+终点+溅射，总伤害量很高
    term: {
      buff: [1],
      dam_3: true,
      dam_4: true,
    },
    /**
     * targeting.auto = true："从对方最前面的目标开始"是技能自动判定的，
     * 不需要玩家/AI 手动选择——BattleSystem 看到这个标记会直接执行技能，
     * 完全跳过候选计算和选择 UI。起点由 skill() 内部自己找。
     */
    targeting: {
      auto: true,
    },
    /**
     * 秘术·回旋完整流程：
     * 1. 起点：敌方每一路站位最靠前的存活兵组（如有多路并列，固定取第一路），不需要外部指定。
     * 2. 从起点出发，沿其所属队伍的站位队列往后（数组下标递增方向）最多找到3个目标：
     *    target1(起点)、target2、target3(终点)；队列里剩余目标不足3个时，
     *    链条以实际能找到的数量为准，链条最后一个自动视为"终点"。
     * 3. 去程：链条中除终点外的目标（target1、target2）各受到 20 点物理伤害。
     * 4. 终点：链条最后一个目标受到 30 点物理伤害。
     * 5. 溅射：以终点为中心，前后各1个相邻兵组（getNearbyTroops(终点, 1)）各受到 12 点魔法伤害。
     * 6. 回程（折返）：去程打过的目标（target1、target2）按原顺序倒序再次各受到 20 点物理伤害。
     */
    skill(player, targets) {
      // 起点：敌方每一路站位最靠前的存活兵组，自动判定，不依赖外部传入的 targets
      const fronts = player.getFrontmostEnemies();
      if (fronts.length === 0) return { physical: 0, magic: 0 };
      const start = fronts[0]; // 若有多路并列，固定取第一路

      const lineup = start?.owner?.troops;
      if (!lineup) return { physical: 0, magic: 0 };

      const startIdx = lineup.indexOf(start);
      if (startIdx === -1) return { physical: 0, magic: 0 };

      // 沿站位队列往后找，最多3个（起点+后面2个），越界（没有更多兵组）就到此为止，
      // 不足3个时链条最后一个自动视为"终点"
      const chain = [];
      for (let i = 0; i < 3; i++) {
        const t = lineup[startIdx + i];
        if (!t) break;
        chain.push(t);
      }
      if (chain.length === 0) return { physical: 0, magic: 0 };

      const pathTargets = chain.slice(0, -1);       // 去/回程都要打的目标（链条中除终点外）
      const endTarget = chain[chain.length - 1]; // 终点（链条最后一个；链长为1时终点就是起点本身）

      player.log(`${player.displayName}向${start.displayName}投掷回旋镖，穿过${chain.length}名目标`);

      // 去程：路径上的目标各 20 点物理伤害
      pathTargets.forEach(t => player.dealDamage(t, { physical: 20, magic: 0 }));

      // 终点：30 点物理伤害
      const endDmg = { physical: 30, magic: 0 };
      player.dealDamage(endTarget, endDmg);

      // 溅射：终点前后各1个相邻兵组，12点魔法伤害
      player.getNearbyTroops(endTarget, 1)
        .forEach(t => player.dealDamage(t, { physical: 0, magic: 12 }));

      // 回程（折返）：路径上的目标按原顺序倒序再次各受到 20 点物理伤害
      [...pathTargets].reverse().forEach(t => player.dealDamage(t, { physical: 20, magic: 0 }));

      player.log(`回旋镖收回，终点${endTarget.displayName}共受到${endDmg.physical}点直接伤害`);

      return endDmg;
    },
  },
  magic_fire_lv1_1: {
    name: '召唤火鸦',
    type: 'initiative',
    des: '对目标造成2×魔法攻击的魔法伤害，同时造成魔法攻击一半的溅射伤害。',
    level: 1,
    cost: { mana: 1 },
    effect: 5, // 之前漏填这个字段，AI选行动时effect缺省会当0处理、比普攻的1还低，导致AI永远不会选这个技能，一直普攻
    term: {
      dam_3: true,
    },
    /**
     * 未声明 targeting：沿用默认规则——任意存活敌方，单目标。
     * 主目标：2×魔法攻击的魔法伤害；溅射：技能描述里没有写明具体数量
     * （只说"同时造成...溅射伤害"），按约定使用 getNearbyTroops 的默认值——
     * 只波及目标站位队列中紧邻的前1个和后1个（各最多1个，越界或紧邻的
     * 那个已阵亡则该侧不命中，不会找更远的替补），各受到 0.5×魔法攻击的
     * 魔法伤害。只有像宗教审判那样明确写出"至多4个其他角色"的技能，
     * 才需要显式传更大的 maxEachSide。
     */
    skill(player, targets) {
      const target = targets[0];
      if (!target) return { physical: 0, magic: 0 };
      const magicAtk = player.stats?.spell_attack ?? 0;

      const mainDmg = { physical: 0, magic: Math.round(magicAtk * 2) };
      player.dealDamage(target, mainDmg);

      const splashDmg = { physical: 0, magic: Math.round(magicAtk / 2) };
      player.getNearbyTroops(target)
        .forEach(t => player.dealDamage(t, splashDmg));

      return mainDmg;
    },
  },
  magic_fire_lv2_1: {
    name: '火墙术',
    type: 'initiative',
    des: '对己方站位最靠前的目标使用，令目标增加1×自身魔法攻击的护盾。',
    level: 2,
    cost: { mana: 1 },
    effect: 4, // 同为护盾类技能，和寒冰盾(magic_ice_lv1_1)同一档；之前漏填会导致AI永远选不到这个技能
    // 目标固定为"己方站位最靠前的存活单位"，不需要玩家/AI 手动选择，
    // 技能函数内部自己从施法者所在的站位队列（player.owner.troops）里找
    targeting: {
      auto: true,
    },
    skill(player) {
      const lineup = player.owner?.troops ?? [];
      const target = lineup.find(t => t.isAlive?.());
      if (!target) return { physical: 0, magic: 0 };

      const magicAtk = player.stats?.spell_attack ?? 0;
      const bonus = Math.round(magicAtk);
      player.grantArmor(target, bonus);
      player.log(`${player.displayName}施展火墙术，为${target.displayName}增加了${bonus}点护盾`);
      return { physical: 0, magic: 0 }; // 没有造成伤害
    },
  },
  magic_fire_lv3_1: {
    name: '流星火雨',
    type: 'initiative',
    des: '攻击至多等同于自身等级数量个目标并对最后1个目标施加2轮【烧伤】状态。',
    level: 3,
    cost: { mana: 2 },
    effect: 9, // 多目标伤害+烧伤，之前漏填这个字段导致AI永远不会用（同样问题见下面几个技能的注释）
    term: {
      buff: [3],
      dam_3: true,
    },
    /**
     * 目标数量取决于施法者自身等级（"至多等同于自身等级数量个"），不是固定值——
     * count 传入函数 (player) => [1, 等级]，由 BattleSystem 在计算候选目标时
     * 用当前施法者动态解析（见 battleSystem.js 的 _getTargetCandidates）。
     */
    targeting: {
      count: (player) => [1, Math.max(1, player.level ?? 1)],
    },
    /**
     * 每个目标各受到一次"攻击"（物理攻击+魔法攻击，未额外说明倍率，按普通攻击同等公式结算），
     * 命中顺序即选中顺序，最后一个目标额外施加2轮【烧伤】（buff key = 3）。
     */
    skill(player, targets) {
      if (!targets || targets.length === 0) return { physical: 0, magic: 0 };
      const dmg = {
        physical: Math.round(player.stats?.physical_attack ?? 0),
        magic: Math.round(player.stats?.spell_attack ?? 0),
      };

      targets.forEach(t => player.dealDamage(t, dmg));

      const lastTarget = targets[targets.length - 1];
      player.applyBuff(lastTarget, 3, 2);

      return dmg;
    },
  },
  magic_fire_lv4_1: {
    name: '火舞旋风',
    level: 4,
    des: '对敌方目标使用，造成3×魔法攻击的魔法伤害，并对其和其身后的1个目标施加3轮【烧伤】状态。'
  },
  magic_ice_lv1_1: {
    name: '寒冰盾',
    type: 'initiative',
    des: '对己方任意目标使用，增加10×目标单位等级的寒冰护甲',
    level: 1,
    cost: { mana: 1 },
    effect: 4,
    /**
     * targeting：候选池是己方（pool:'ally'），和技能描述"对己方任意目标使用"一致，
     * 不做任何过滤，最多选1个（count:1）。
     *
     * 注意：这里不能像之前那样用 currentArmor < maxArmor 做"护甲未满"过滤——
     * 护甲本身没有上限（grantArmor 会无上限地叠加到 currentArmor 上，见 battleSystem.js
     * 的说明），maxArmor 只是兵组初始基础护甲值，只有护甲被打掉一部分之后 currentArmor
     * 才会小于 maxArmor。也就是说，只要场上没有任何兵组挨过护甲扣减，所有人的
     * currentArmor 都等于 maxArmor，这个过滤条件会把所有候选目标都排除掉，导致
     * 寒冰盾在整局战斗前期完全选不出任何目标、技能形同虚设——这正是之前"寒冰盾用不出来"
     * 的原因，去掉这个过滤条件即可让技能按描述那样可以对任意己方目标使用。
     */
    targeting: {
      pool: 'ally',
      count: 1,
    },
    skill(player, targets) {
      const target = targets[0];
      if (!target) return { physical: 0, magic: 0 };
      const bonus = 10 * (target.level ?? 1);
      player.grantArmor(target, bonus);
      player.log(`${player.displayName}为${target.displayName}施加了寒冰护甲，护甲增加${bonus}点`);
      return { physical: 0, magic: 0 }; // 没有造成伤害
    },
  },
  magic_ice_lv2_1: {
    name: '寒冰射线',
    type: 'initiative',
    des: '攻击目标并额外造成2×魔法攻击的物理伤害。',
    level: 2,
    cost: { mana: 1 },
    effect: 6, // 之前漏填这个字段，导致AI（比如副本boss侍女）永远选不到这个技能，一直普攻
    /**
     * "攻击目标"= 一次普通攻击的伤害公式（物理攻击+魔法攻击），
     * "额外造成2×魔法攻击的物理伤害"= 在此基础上叠加的物理类型伤害（用魔法攻击数值计算）。
     */
    skill(player, targets) {
      const target = targets[0];
      if (!target) return { physical: 0, magic: 0 };
      const physAtk = player.stats?.physical_attack ?? 0;
      const magicAtk = player.stats?.spell_attack ?? 0;

      const dmg = {
        physical: Math.round(physAtk + magicAtk * 2),
        magic: Math.round(magicAtk),
      };
      player.dealDamage(target, dmg);
      return dmg;
    },
  },
  magic_ice_lv3_1: {
    name: '寒冰之棺',
    type: 'initiative',
    des: '对目标造成2×自身物理攻击和魔法攻击之和的魔法伤害，并令其进入1轮【冰冻】状态。',
    level: 3,
    cost: { mana: 2 },
    effect: 8, // 高倍伤害+控制，之前漏填这个字段导致AI永远选不到
    term: {
      buff: [8],
    },
    skill(player, targets) {
      const target = targets[0];
      if (!target) return { physical: 0, magic: 0 };
      const physAtk = player.stats?.physical_attack ?? 0;
      const magicAtk = player.stats?.spell_attack ?? 0;

      const dmg = { physical: 0, magic: Math.round((physAtk + magicAtk) * 2) };
      player.dealDamage(target, dmg);
      player.applyBuff(target, 8, 1);
      return dmg;
    },
  },
  magic_ice_lv4_1: {
    name: '飞檐溅雪',
    level: 4,
    des: '对目标造成3×武器等级的魔法伤害，然后令其进入2轮【恐惧】和【衰弱】状态。',
  },
  nomad_fight_lv1_1: {
    name: '破甲击',
    des: '对目标进行无视护甲的攻击，并额外造成3点物理伤害。',
    cost: { mana: 1 },
    level: 1,
    effect: 4, // 无视护甲+额外伤害，之前漏填这个字段导致AI永远选不到
    skill(player, targets) {
      const target = targets[0];
      if (!target) return { physical: 0, magic: 0 };
      const dmg = {
        physical: Math.round((player.stats?.physical_attack ?? 0) + 3),
        magic: Math.round(player.stats?.spell_attack ?? 0),
      };
      player.dealDamage(target, dmg, { ignoreArmor: true });
      return dmg;
    },
  },
  nomad_fight_lv2_1: {
    name: '刺击',
    des: '对敌方顺位不高于自己的目标进行攻击，造成2×物理攻击的物理伤害。',
    level: 2,
    cost: { mana: 2 },
    effect: 3,
    /**
     * targeting 示例：候选池是敌方（pool:'ally'不填即默认'enemy'），
     * 过滤条件是"目标顺位不大于自己"（candidate.military_order <= player.military_order），
     * 最多选1个。
     */
    targeting: {
      filter: (player, candidate) =>
        (candidate.stats?.military_order ?? 0) <= (player.stats?.military_order ?? 0),
      count: 1,
    },
    skill(player, targets) {
      const target = targets[0];
      const components = {
        physical: Math.round((player.stats?.physical_attack ?? 0) * 2),
        magic: 0,
      };
      player.dealDamage(target, components);
      return components;
    },
  },
  nomad_fight_lv3_1: {
    name: '半月斩',
    des: '攻击至多3个目标并额外造成6点物理伤害和6点魔法伤害。',
    level: 3,
    cost: { mana: 3 },
    effect: 9, // 多目标伤害，之前漏填这个字段导致AI永远选不到
    // "至多3个"：玩家/AI 可以选择1~3个目标
    targeting: {
      count: [1, 3],
    },
    skill(player, targets) {
      if (!targets || targets.length === 0) return { physical: 0, magic: 0 };
      const dmg = {
        physical: Math.round((player.stats?.physical_attack ?? 0) + 6),
        magic: Math.round((player.stats?.spell_attack ?? 0) + 6),
      };
      targets.forEach(t => player.dealDamage(t, dmg));
      return dmg;
    },
  },
  mutation_devil_lv1_1: {
    name: '暗影箭',
    des: '',
    level: 1,
  },
  mutation_devil_lv2_1: {
    name: '骸骨护盾',
    des: '失去1点体力，令自身进入2轮【玄藏】状态。',
    level: 2,
    cost: { mana: 1 },
    effect: 3, // 纯防御/免疫类自我增益，之前漏填这个字段导致AI永远选不到
    term: {
      buff: [16],
    },
    // 只对自己生效，不需要选择目标
    targeting: {
      auto: true,
    },
    skill(player) {
      // "失去1点体力"：直接扣减自身生命值，走 pure 伤害类型（天然无视护甲）
      player.dealDamage(player, { pure: 1 }, { ignoreArmor: true });
      // 令自身进入2轮【玄藏】（buff key = 16，免疫控制类异常状态，见 military_buff.js）
      player.applyBuff(player, 16, 2);
      player.log(`${player.displayName}使用骸骨护盾，失去1点体力，进入了【玄藏】状态`);
      return { physical: 0, magic: 0 };
    },
  },
  mutation_devil_lv3_1: {
    name: '罗睺一斩',
    des: '攻击至多5个目标并额外造成15×武器等级的物理伤害，被杀死的单位自动转换为骷髅（受到召唤生物战术宽度限制）',
    level: 3,
    // 技能描述中未给出魔力消耗，参照同为3级、多目标的半月斩/流星火雨等技能规模暂定为4，
    // 后续如需按数值平衡调整，直接改这里的 cost 即可
    cost: { mana: 4 },
    effect: 13, // 多目标高额外伤害+击杀转化骷髅，收益很高；之前漏填这个字段导致AI永远选不到
    term: {
      summon_1: true,
    },
    // "至多5个"：玩家/AI 可以选择1~5个目标
    targeting: {
      count: [1, 5],
    },
    /**
     * "武器等级"目前没有对应的装备系统（military_unit.js 里所有兵种的 equipments 都是
     * 空对象），这里暂时兜底取 player.equipments?.weapon?.level，取不到时退回自身等级
     * player.level——后续实装真正的武器/装备系统后，直接去掉这个兜底即可自动生效，
     * 不需要改这里的技能逻辑。
     *
     * 每个目标各受到一次"攻击"（物理攻击+魔法攻击）+ 15×武器等级 的额外物理伤害；
     * 被直接打死的目标会转化为骷髅加入施法者所在队伍（player.summonUnit），沿用
     * 阵亡目标自己的基础六维（攻击/魔攻/生命/护甲/蓝量/顺位），不继承任何技能。
     * 若该队伍场上的召唤物数量已经达到战场数量上限（固定为5，是一条独立于
     * 站位队列"战术宽度"的规则），则这一次转化失败，只播报一条提示。
     */
    skill(player, targets) {
      if (!targets || targets.length === 0) return { physical: 0, magic: 0 };

      const weaponLevel = player.equipments?.weapon?.level ?? player.level ?? 1;
      const dmg = {
        physical: Math.round((player.stats?.physical_attack ?? 0) + 15 * weaponLevel),
        magic: Math.round(player.stats?.spell_attack ?? 0),
      };

      targets.forEach(target => {
        player.dealDamage(target, dmg);
        if ((target.currentHp ?? 0) <= 0) {
          // 骷髅沿用阵亡目标自己的基础六维，而不是骷髅模板的默认数值
          const baseStats = {
            physical_attack: target.stats?.physical_attack ?? 0,
            spell_attack: target.stats?.spell_attack ?? 0,
            hp: target.stats?.hp ?? target.maxHp ?? 0,
            armor: target.stats?.armor ?? target.maxArmor ?? 0,
            mana: target.stats?.mana ?? target.maxMana ?? 0,
            military_order: target.stats?.military_order ?? 0,
          };
          const summoned = player.summonUnit('skeleton', baseStats);
          if (summoned) {
            // 转化成功：给被转化的目标额外打上【消逝】标记（没有专门的前端显示），
            // 表示它属于一种特殊的阵亡状态——除了照常走一遍普通的阵亡结算流程
            // （清空buff、变灰、播报"已阵亡"），还要在所有"是否在场上"的判定里
            // 永远视为不存在于战场上，见 battleSystem.js 的 isOnBattlefield 说明。
            target._vanished = true;
          } else {
            player.log(`召唤生物数量已达战场上限，${target.displayName}未能转化为骷髅`);
          }
        }
      });

      return dmg;
    },
  },
  lightning_lv1_1: {
    name: '闪电链',
    level: 1,
    des: '对目标和目标身后的1个目标造成等同于自身魔法攻击的魔法伤害。',
  },
  lightning_lv2_1: {
    name: '雷霆一击',
    level: 2,
    des: '攻击任意目标并造成3×武器等级的溅射伤害。'
  },
  lightning_lv3_1: {
    name: '惊雷',
    level: 3
  },
  wind_lv1_1: {
    name: '疾风刃',
    level: 1,
    des: '攻击站位最靠前的3名目标。'
  },
  wind_lv1_2: {
    name: '快攻',
    level: 1,
    cost: { mana: 0 },
    des: '攻击任意1名目标，并额外造成2点魔法伤害。'
  },
  wind_lv3_1: {
    name: '借风',
    level: 2,
    des: '攻击站位最靠后的目标，并令自身和己方站位最靠前的目标进入【凤隐】状态，持续2轮。'
  },
  wind_lv4_1: {
    name: '罗天剑舞',
    level: 4,
  },
  mutation_blood_lv1_1: {
    name: '血刺',
    level: 1,
    des: '攻击任意目标并额外造成1×魔法攻击的魔法伤害。'
  },
  mutation_blood_lv2_1: {
    name: '血契',
    level: 2,
    des: '令至多3名目标进入【衰弱】状态，持续4轮。',
  },
  mutation_blood_lv3_1: {
    name: '血池',
    level: 3,
    des: '攻击目标并额外造成3×魔法攻击的真实伤害，造成伤害的20%恢复自身体力。',
  },
  mutation_blood_lv4_1: {
    name: '血海',
    level: 4,
  },
  berserk_might_lv1_1: {
    name: '狂龙震',
    level: 1,
    des: '攻击目标并为自身增加等同于双方血量之差的护甲（至多为10）。',
  },
  berserk_might_lv2_1: {
    name: '猛虎破',
    level: 2,
    des: '攻击目标并造成6×防具等级点无视护甲的物理伤害。',
  },
  berserk_might_lv3_1: {
    name: '伏龙枪',
    level: 3,
    des: '攻击任意目标并令其进入【疲惫】状态，持续2轮。',
  },
  berserk_might_lv4_1: {
    name: '无敌无我',
    level: 4,
    des: '可以在处于控制类异常状态时使用；令自身进入【皇威】状态，持续2轮；攻击目标并造成2×物理攻击的物理伤害，并造成等同于造成伤害的溅射伤害。',
  },
  berserk_might_lv5_1: {
    name: '天龙扑月',
    level: 5,
    des: '',
  },
  berserk_might_lv6_1: {
    name: '铁血征尘',
    level: 6,
    des: '',
  },
  berserk_might_lv7_1: {
    name: '威临九霄',
    level: 7,
    des: '',
  },
  berserk_might_lv8_1: {
    name: '星河倒卷',
    level: 8,
    des: '',
  },
}