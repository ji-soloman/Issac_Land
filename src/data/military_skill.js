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
  Inquisition_dark: {
    name: '宗教审判',
    level: 3,
    des: '瞬移到目标身后，对目标进行一次无视护盾的攻击，额外造成4×魔法攻击的魔法伤害并对目标施加4轮诅咒，对目标周围至多4个其他角色造成2×魔法攻击的溅射伤害。',
    term: {
      buff_2: true,
      dam_3: true,
    }
  },
  Ninjutsu: {
    name: '秘术·回旋',
    level: 4,
    des: '向前方投掷回旋镖并收回，回旋镖至多穿过3名敌方目标，对路径上的目标造成20点折返的物理伤害，并对终点的目标造成30点物理伤害，同时造成12点溅射的魔法伤害。',
    term: {
      buff_1: true,
      dam_3: true,
      dam_4: true,
    }
  },
  magic_fire_lv1_1: {
    name: '召唤火鸦',
    type: 'initiative',
    des: '',
    level: 1,
  },
  magic_fire_lv2_1: {
    name: '火墙术',
    type: 'initiative',
    des: '',
    level: 2,
  },
  magic_fire_lv3_1: {
    name: '流星火雨',
    type: 'initiative',
    des: '',
    level: 3,
  },
  magic_ice_lv1_1: {
    name: '寒冰盾',
    type: 'initiative',
    des: '给己方或友方1组单位增加10×单位等级的寒冰护甲',
    level: 1,
    term: {
      armor_1: true,
    }
  },
  magic_ice_lv2_1: {
    name: '寒冰射线',
    type: 'initiative',
    des: '',
    level: 2,
  },
  magic_ice_lv3_1: {
    name: '寒冰之棺',
    type: 'initiative',
    des: '',
    level: 3,
  },
  nomad_fight_lv1_1: {
    name: '破甲击',
    des: '对目标造成6×武器等级的无视护甲的物理伤害',
    level: 1,
  },
  nomad_fight_lv2_1: {
    name: '刺击',
    des: '',
    level: 2,
  },
  nomad_fight_lv3_1: {
    name: '半月斩',
    des: '',
    level: 3,
  },
  mutation_devil_lv1_1: {
    name: '暗影箭',
    des: '',
    level: 1,
  },
  mutation_devil_lv2_1: {
    name: '骸骨护盾',
    des: '',
    level: 2,
  },
  mutation_devil_lv3_1: {
    name: '罗睺一斩',
    des: '攻击5组敌人并额外造成15×武器等级的物理伤害，被杀死的单位自动转换为骷髅（受到召唤生物战术宽度限制）',
    level: 3,
    term: {
      summon_1: true,
    }
  },
}