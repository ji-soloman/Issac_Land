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
    damage_base: {
      physical_attack: 3, // 算法是士兵数值乘以这里的基数，然后所有基数加起来就是总伤害
    }
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
}