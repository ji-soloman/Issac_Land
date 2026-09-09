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
    des: '目标存活时，其他目标的普通攻击只能以自身为目标',
    level: 1,
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
      player.dealDamage(target, mainDmg, { ignoreArmor: true });

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
    term: {
      dam_3: true,
    }
  },
  magic_fire_lv2_1: {
    name: '火墙术',
    type: 'initiative',
    des: '对己方站位最靠前的目标使用，令目标增加1×自身魔法攻击的护盾。',
    level: 2,
    cost: { mana: 1 },
  },
  magic_fire_lv3_1: {
    name: '流星火雨',
    type: 'initiative',
    des: '攻击至多等同于自身等级数量个目标并对最后1个目标施加2轮【烧伤】状态。',
    level: 3,
    cost: { mana: 2 },
    term: {
      buff: [3],
      dam_3: true,
    }
  },
  magic_ice_lv1_1: {
    name: '寒冰盾',
    type: 'initiative',
    des: '对己方任意目标使用，增加10×目标单位等级的寒冰护甲',
    level: 1,
    cost: { mana: 1 },
    effect: 4,
    /**
     * targeting 示例：候选池是己方（pool:'ally'），过滤条件是"护甲未满的"
     * （currentArmor < maxArmor，近似"已受伤"的护盾版本——优先给还没顶到护甲上限的单位），
     * 最多选1个（count:1）。前端会只高亮满足条件的己方卡牌供玩家点选；
     * AI 则会在这些候选里按 _aiSelectTargets 的策略自动选一个。
     */
    targeting: {
      pool: 'ally',
      filter: (player, candidate) => (candidate.currentArmor ?? 0) < (candidate.maxArmor ?? 0),
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
  },
  magic_ice_lv3_1: {
    name: '寒冰之棺',
    type: 'initiative',
    des: '对目标造成2×自身物理攻击和魔法攻击之和的魔法伤害，并令其进入1轮【冰冻】状态。',
    level: 3,
    cost: { mana: 2 },
    term: {
      buff: [8],
    }
  },
  nomad_fight_lv1_1: {
    name: '破甲击',
    des: '对目标进行无视护甲的攻击，并额外造成3点物理伤害。',
    cost: { mana: 1 },
    level: 1,
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
  },
  mutation_devil_lv3_1: {
    name: '罗睺一斩',
    des: '攻击至多5个目标并额外造成15×武器等级的物理伤害，被杀死的单位自动转换为骷髅（受到召唤生物战术宽度限制）',
    level: 3,
  },
  lightning_lv1_1: {
    name: '闪电链',
    level: 1
  },
  lightning_lv2_1: {
    name: '雷霆一击',
    level: 2
  },
  wind_lv4_1: {
    name: '罗天剑舞',
    level: 4,
  }
}