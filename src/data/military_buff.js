/**
 * MILITARY_BUFF — 战斗 buff/异常状态数据表。
 *
 * 每条记录：
 *   name — 显示名称（buff 图标悬浮浮窗的标题）
 *   des  — 效果文字描述（悬浮浮窗内容）
 *   trigger — 可选，声明这个 buff 在战斗流程各个时机要做的实际效果。
 *     BattleSystem 在对应时机会调用 _fireBuffTrigger(hookName, ctx)，
 *     按"行动顺序"扫描场上所有存活兵组身上的 buff，依次调用这里声明的函数——
 *     新增/修改一个 buff 的实际效果只需要编辑这个文件，不需要改动 BattleSystem 的主循环。
 *
 *     目前支持的时机（hookName）：
 *       onUseSkill(ctx, meta) — 某个兵组即将执行一个技能行动时触发。
 *         ctx:  { actor, actionKey, cost, converted }
 *           actor     — 本次行动的兵组（Player 实例）
 *           actionKey — 使用的技能 key
 *           cost      — 本次将要扣除的消耗（可直接整体替换为新对象来修改）
 *           converted — 置为 true 可以让 BattleSystem 把本次行动当普通攻击执行
 *         meta: { battle, holder, buffKey, rounds }
 *           holder — 这条 buff 记录所属的兵组（不一定是 ctx.actor，
 *                    是否要对本次事件生效由 trigger 函数自己判断）
 *       onRoundEnd(ctx, meta) — 每轮结束时触发（早于 buff 剩余轮次递减）。
 *         ctx:  { round }
 *         meta: 同上
 *       onBeforeDamage(ctx, meta) — 每次 Player.dealDamage 结算前触发，
 *         用于"让本次攻击不命中"的效果（例如未来的闪避），或者修改本次伤害数值
 *         的增伤/减伤类效果（例如凤隐——受到的魔法伤害-20%）。
 *         ctx:  { attacker, target, components, cancelled }
 *           attacker   — 本次造成伤害的一方（Player 实例）
 *           target     — 本次受到伤害的一方
 *           components — 本次的伤害拆分（未经护甲/免伤加成前的原始值）；
 *                        要修改伤害数值，直接整体重新赋值 ctx.components 为一份
 *                        新对象即可（和 onUseSkill 对 ctx.cost 的重新赋值是同一套
 *                        约定），dealDamage 会把 trigger 改过的值读回去实际生效。
 *           cancelled  — 置为 true 可以让这次攻击被判定为"未命中"，
 *                        dealDamage 会直接返回 { hit:false, total:0 }，不结算任何伤害
 *         meta: 同上
 *
 *         多个增伤/减伤类 buff 之间是"乘算"叠加的：基础伤害*(1+n%)*(1+m%)*(1-x%)*(1-y%)...
 *         （n%/m% 是增伤类，如无双+20%、皇威+10%、引雷+25%；x%/y% 是减伤类，
 *         如凤隐受到魔法伤害-20%、麟佑受到物理伤害-20%、衰弱造成物理伤害-20%、
 *         溺水造成魔法伤害-20%）。_fireBuffTrigger 会按顺序把同一个 ctx 依次交给
 *         场上每个持有相关 buff 的 trigger，所以只要每个 trigger 都在"当前"
 *         ctx.components 的基础上再乘自己的系数（而不是基于某个提前缓存的值），
 *         多个 buff 自然就会按顺序连乘、等价于上面这个公式。
 *         另外每个 trigger 都不要自己取整（不要用 Math.round/Math.floor）——
 *         取整统一由 dealDamage 在广播完所有 buff 之后做唯一一次，如果每个
 *         trigger 都各自提前取整，多个 buff 叠加时会因为多次舍入误差而偏离
 *         真正的乘算结果。写法可以参考下面凤隐(15)的实现。
 *
 *     trigger 函数里可以调用 meta.holder 上 Player 类提供的方法
 *     （dealDamage / applyBuff / removeBuff / log 等）来实现具体效果。
 */
export const MILITARY_BUFF = {
  1: {
    name: '眩晕',
    des: '无法行动',
    type: 'control',
  },

  2: {
    name: '诅咒',
    des: '使用技能消耗的魔力翻倍，且有40%概率被转换为普通攻击',
    type: 'weaken',
    trigger: {
      /**
       * 只在 buff 持有者自己使用技能时生效（不会影响别人使用技能）：
       *   1. 若本次技能有魔力消耗，翻倍；
       *   2. 40% 概率把本次行动转化为普通攻击。
       * 两个效果相互独立——即使被转化，翻倍后的魔力依然照常扣除。
       */
      onUseSkill(ctx, meta) {
        if (ctx.actor !== meta.holder) return; // 不是持有者本人在用技能，诅咒不生效

        if (ctx.cost?.mana != null) {
          ctx.cost = { ...ctx.cost, mana: ctx.cost.mana * 2 };
        }

        if (Math.random() < 0.4) {
          ctx.converted = true;
          meta.holder.log?.(`${meta.holder.displayName}受【诅咒】干扰，技能被转换为普通攻击！`);
        }
      },
    },
  },

  3: {
    name: '烧伤',
    des: '轮次结束时，失去最大生命1/8无视护甲的生命',
    type: 'weaken',
    trigger: {
      /**
       * 轮次结束时，对持有者造成"最大生命1/8"的伤害（向下取整，至少1点，
       * 避免最大生命较低时因为除法结果为0而完全不生效）。使用 pure 伤害类型，
       * 天然无视护甲，对应描述里的"无视护甲的生命"。
       */
      onRoundEnd(ctx, meta) {
        const holder = meta.holder;
        const maxHp = holder.maxHp ?? holder.stats?.hp ?? 0;
        const dmg = Math.max(1, Math.floor(maxHp / 8));
        holder.dealDamage(holder, { pure: dmg });
        holder.log?.(`${holder.displayName}受到【烧伤】的影响，失去了${dmg}点生命`);
      },
    },
  },

  4: {
    name: '中毒',
    des: '轮次结束时，失去最大生命1/8无视护甲的生命',
    type: 'weaken',
  },

  5: {
    name: '疲惫',
    des: '无法行动',
    type: 'control',
  },

  6: {
    name: '恐惧',
    des: '无法行动',
    type: 'control',
  },

  7: {
    name: '魅惑',
    des: '无法对敌方造成伤害',
    type: 'weaken',
  },

  8: {
    name: '冰冻',
    des: '无法行动',
    type: 'control',
  },

  9: {
    name: '衰弱',
    des: '造成的物理伤害减少20%；轮次结束时，失去最大生命1/8的生命',
    type: 'weaken',
  },

  10: {
    name: '溺水',
    des: '造成的魔法伤害减少20%',
    type: 'weaken',
  },

  11: {
    name: '振奋',
    des: '进入时解除自身全部弱化类异常状态；免疫控制类异常状态',
    type: 'strengthen',
  },

  12: {
    name: '无双',
    des: '免疫弱化类异常状态；造成的伤害提升20%',
    type: 'strengthen',
  },

  13: {
    name: '皇威',
    des: '进入时解除自身全部弱化类和控制类异常状态；造成的伤害提升10%；受到的伤害减少10%',
    type: 'strengthen',
  },

  14: {
    name: '麟佑',
    des: '受到的物理伤害减少20%',
    type: 'strengthen',
  },

  15: {
    name: '凤隐',
    des: '受到的魔法伤害减少20%',
    type: 'strengthen',
    trigger: {
      /**
       * 在伤害真正结算前介入：只对"自己承受伤害"的一方生效（本buff的持有者必须
       * 是这次受伤的目标 ctx.target，而不是造成伤害的一方——同一个兵组身上
       * 如果同时也在攻击别人，不会影响自己造成的伤害），把本次伤害拆分里的
       * magic（魔法伤害）再乘0.8，physical/pure 等其他类型不受影响。
       * 见 battleSystem.js 的 Player.dealDamage：这里对 ctx.components 的重新
       * 赋值会被读回去实际生效，和 onUseSkill 对 ctx.cost 的重新赋值是同一套约定。
       *
       * 注意：这里故意不取整（不用 Math.round/Math.floor）——多个增伤/减伤类
       * buff 之间是"乘算"叠加的（基础伤害*(1+n%)*(1+m%)*(1-x%)*(1-y%)...，
       * 例如以后麟佑/无双/皇威/引雷/衰弱/溺水等buff实装后会和凤隐同时生效），
       * 每个 buff 的 trigger 只管在当前值基础上再乘自己的系数，取整统一交给
       * dealDamage 在广播完所有 buff 之后做唯一一次——如果每个 buff 都各自提前
       * 取整，多个 buff 叠加时会因为多次舍入误差而偏离真正的乘算结果。
       */
      onBeforeDamage(ctx, meta) {
        if (ctx.target !== meta.holder) return; // 不是自己在承受这次伤害，凤隐不生效
        const magic = ctx.components?.magic ?? 0;
        if (!(magic > 0)) return;
        ctx.components = { ...ctx.components, magic: magic * 0.8 };
      },
    },
  },

  16: {
    name: '玄藏',
    des: '免疫控制类异常状态',
    type: 'strengthen',
    // 这个效果不需要写 trigger：battleSystem.js 里 Player.applyBuff 对
    // CONTROL_BUFF_KEYS（眩晕/疲惫/恐惧/冰冻）的施加判定，已经统一把玄藏(16)
    // 和振奋(11)登记进 CONTROL_IMMUNE_BUFF_KEYS——只要持有玄藏且剩余轮次>0，
    // 任何控制类异常状态都会在 applyBuff 里被直接拦截、不会生效，见该方法的注释。
  },

  17: {
    name: '守护',
    des: '免疫弱化类异常状态',
    type: 'strengthen',
  },

  18: {
    name: '引雷',
    des: '造成的伤害提升25%；轮次结束时，失去最大生命1/8的生命',
    type: 'special',
  },

  19: {
    name: '浴火',
    des: '自身阵亡时，恢复全部体力并解除该状态，解除全部弱化类异常，然后进入【守护】和【疲惫】状态',
    type: 'special',
  },
  20: {
    name: '嘲讽',
    des: '敌方目标攻击时，优先选择自己为目标',
    type: 'special',
  }
};