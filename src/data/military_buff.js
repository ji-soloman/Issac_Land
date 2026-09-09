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
 *
 *     trigger 函数里可以调用 meta.holder 上 Player 类提供的方法
 *     （dealDamage / applyBuff / removeBuff / log 等）来实现具体效果。
 */
export const MILITARY_BUFF = {
  1: {
    name: '眩晕',
    des: '无法行动',
  },

  2: {
    name: '诅咒',
    des: '使用技能消耗的魔力翻倍，且有40%概率被转换为普通攻击',
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
  },

  4: {
    name: '中毒',
    des: '轮次结束时，失去最大生命1/8无视护甲的生命',
  },

  5: {
    name: '疲惫',
    des: '无法行动',
  },

  6: {
    name: '恐惧',
    des: '无法行动',
  },

  7: {
    name: '魅惑',
    des: '无法对敌方造成伤害',
  },

  8: {
    name: '冰冻',
    des: '无法行动',
  },

  9: {
    name: '衰弱',
    des: '造成的物理伤害减少20%；轮次结束时，失去最大生命1/8的生命',
  },

  10: {
    name: '溺水',
    des: '造成的魔法伤害减少20%',
  },

  11: {
    name: '振奋',
    des: '进入时解除自身全部弱化类异常状态；免疫控制类异常状态',
  },

  12: {
    name: '无双',
    des: '免疫弱化类异常状态；造成的伤害提升20%',
  },

  13: {
    name: '皇威',
    des: '进入时解除自身全部弱化类和控制类异常状态；造成的伤害提升10%；受到的伤害减少10%',
  },

  14: {
    name: '麟佑',
    des: '受到的物理伤害减少20%',
  },

  15: {
    name: '凤隐',
    des: '受到的魔法伤害减少20%',
  },

  16: {
    name: '玄藏',
    des: '免疫控制类异常状态',
  },

  17: {
    name: '守护',
    des: '免疫弱化类异常状态',
  },

  18: {
    name: '引雷',
    des: '造成的伤害提升25%；轮次结束时，失去最大生命1/8的生命',
  },

  19: {
    name: '浴火',
    des: '自身阵亡时，恢复全部体力并解除该状态，解除全部弱化类异常，然后进入【守护】和【疲惫】状态',
  },
};