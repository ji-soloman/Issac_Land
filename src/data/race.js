// 种族配置表
//
// 字段说明：
//   name       种族名称
//   image      种族立绘
//   breeding   繁育一个人口的基础单价（第 k 个新人口的消耗 = 当前人口数 × 单价，可以是 0.5 之类的小数，结算时总价向上取整）
//   region     种族起始特区（REGION 表里的 key）
//   found_terrain 该种族建立主城（初始主城 / 建设新城）允许的地形，值是 terrain.js 里的地形 key 列表
//   des        种族特点说明（文字）
//   subraces   子种族：{ name, region（子种族特区）, des（说明）, found_terrain_extra?（额外允许的建城地形）, cost_mods? }
//   cost_mods  成本修正规则（种族和子种族都可以写）：{ 钩子名: [ { label, apply(cost, ctx) → 新 cost } ] }
//              钩子名见下方 COST_HOOKS；先应用种族规则，再应用子种族规则。
//
// 被注释掉的种族暂未开放，设定已写好，取消注释即可启用。
// （注意：building.js 里 require_race 用的种族 key 与这里被注释的 goblin / beastkin / lizardfolk /
//   corvidian / insectoid / plantfolk 并不一致，启用前需要先对齐。）

import { terrain as TERRAIN } from './terrain.js';

// ── 建城地形分组 ─────────────────────────────────────
// 基础：平原、丘陵、沙漠（森林、山脉需要种族特性才能建城）
export const BASE_CITY_TERRAINS = ['land', 'hills', 'desert'];
// 任意陆地：基础 + 森林 + 山脉（用于"可在幽暗地域建城"等，目前地图没有幽暗地域，先按任意陆地处理）
export const ANY_LAND_TERRAINS = ['land', 'hills', 'desert', 'forest', 'mountain'];
// 水域：海洋、浅海、海岸、河流
export const WATER_TERRAINS = ['ocean', 'neritic', 'coastal', 'river'];


// ═══════════════════════════════════════════════════════════
// 种族成本修正钩子
// ═══════════════════════════════════════════════════════════
// 游戏里所有"花资源"的地方，在【显示】、【判断够不够】、【真正扣除】三处都必须用同一份
// 修正后的成本，所以统一走 applyRaceCostMods(钩子名, 原成本, 种族, 子种族, ctx)。
// 新增一条种族成本规则只需要在对应种族/子种族里写 cost_mods，不用改任何界面代码。

/** 钩子注册表：name 是界面显示名，ctx 说明调用方会传入哪些上下文字段 */
export const COST_HOOKS = {
  build_building: {
    name: '建造建筑',
    ctx: '{ data, gridId, buildingKey, isWonder }',
    note: '建筑建造的资源消耗（createBuilding.js 显示/判足 + gameScene.js build_building 扣除）',
  },
  breed: {
    name: '繁衍人口',
    ctx: '{ data, gridId }',
    note: '作用于【每个新人口的单价】（不是总价），之后再按人口数叠加；单价允许小数，不在此处取整',
  },
  new_city: {
    name: '建设新城',
    ctx: '{ data, gridId }',
    note: '分城建设消耗（gridPanel.js _onBuildNewCity）',
  },
  train_unit: {
    name: '训练兵种',
    ctx: '{ data, unitKey }',
    note: '兵种训练消耗，可以把人口消耗换成别的资源（militaryUnitView.js 训练页）',
  },
  research_tech: {
    name: '研究科技',
    ctx: '{ data, tech }',
    note: '科技研究消耗（techTree.js getTechTotalCost）',
  },
  academy_upgrade: {
    name: '学派分支升级',
    ctx: '{ data, schoolKey, catKey, level }',
    note: '学派分支升级的文化消耗（academyView.js 升级按钮 + 确认弹窗 + 扣除）',
  },
};

/** 常用成本运算，供各种族 cost_mods 组合使用；都只读取、不修改传入的 cost，返回新对象 */
export const COST_OP = {
  /** 某项资源消耗 + delta（delta 为负就是减免）。该资源本来没有消耗时不增加；结果不低于 0 */
  add: (res, delta) => (cost) => {
    if (cost?.[res] == null || !delta) return cost;
    return { ...cost, [res]: Math.max(0, cost[res] + delta) };
  },
  /** 某项资源消耗 × factor（如 0.5 = 减半）；结果不低于 0（取整由 applyRaceCostMods 统一处理） */
  scale: (res, factor) => (cost) => {
    if (cost?.[res] == null) return cost;
    return { ...cost, [res]: Math.max(0, cost[res] * factor) };
  },
  /** 把 from 资源的消耗整体换成 to 资源，数量 × rate（如亡灵"不消耗人口只消耗财富"） */
  convert: (from, to, rate = 1) => (cost) => {
    const amount = cost?.[from];
    if (!amount) return cost;
    const next = { ...cost };
    delete next[from];
    next[to] = (next[to] ?? 0) + amount * rate;
    return next;
  },
};

/**
 * 统计某一类物产的种数（如"每种畜牧物产""每种矿石类物产"）。
 * 目前游戏里还没有物产系统（gridData.products 始终是空对象），先固定返回 0，
 * 这样依赖物产数量的种族规则现在不生效、也不会报错；等物产系统做出来后，
 * 只需要改这一个函数，所有相关种族规则会自动生效。
 * @param {object} data saveData
 * @param {string} kind 物产类别：'livestock'（畜牧）/ 'ore'（矿石）…
 */
export function countProducts(data, kind) {
  return 0;
}


export const RACES = {
  human: {
    name: '人类',
    image: 'assets/races/human.jpg',
    breeding: { food: 1 },
    region: 'farm',
    found_terrain: BASE_CITY_TERRAINS,
    des: '1食物繁育；农田特区；可建造特殊建筑花环石柱（出产额外的食物）；每个城市的三种物产增加该城市的1商路',
    subraces: {
      a: {
        name: '平原种',
        region: 'trade',
        des: '剑专精+2 格斗类单位只需要食物维护 农田食物物产+1 每时代全学派升级+1',
      },
      b: {
        name: '高原种',
        region: 'mine',
        des: '斧专精+2 斧破甲+2 矿场矿物物产+1 每时代游牧学派升级+1',
      },
      c: {
        name: '海岛种',
        region: 'harbor',
        des: '弩专精+2 船只维护费-2每组 港口海产+1 每时代全学派升级+1',
      },
      d: {
        name: '沼泽种',
        region: 'academy',
        des: '灵能掌握+2 投矛投斧+2灵魂伤害 牧场畜牧+1 每时代咒术学派升级+1',
      },
      e: {
        name: '沙漠种',
        region: 'holy',
        des: '弓专精+2 骑兵攻击+d2 贸易区贸易路线+1 每时代全学派升级+1',
      },
    },
  },
  elf: {
    name: '精灵',
    image: 'assets/races/elf.jpg',
    breeding: { food: 1, culture: 1 },
    region: 'academy',
    found_terrain: [...BASE_CITY_TERRAINS, 'forest'],
    des: '1食物1文化繁育；学院特区；可在森林建城；每种宝石物产增加法器类锻造成功率2%；可建造特殊建筑秘纹石柱（出产额外的文化）',
    subraces: {
      a: {
        name: '魔能种',
        region: 'entertainment',
        des: '魔法掌握+4 抄录卷轴使用次数+1且每回合释放卷轴次数+1 单位可以装备和研究魔法学派技能和法术超越1时代 每时代魔法学派升级+1',
      },
      b: {
        name: '咒能种',
        region: 'holy',
        des: '咒术掌握+4 施法类单位消耗一个回合让下回合技能和法术效果变成三倍 契约学派可召唤生物超越时代等级+2 每时代咒术学派升级+1',
      },
      c: {
        name: '森林种',
        region: 'farm',
        des: '远程和斥候类弓类专精+4 远程和斥候类升级+4酸毒素伤害 施法类召唤生物数量+1且召唤生物战术宽度+2 每个时代交流学派升级+1',
      },
      d: {
        name: '幽泉种',
        region: 'pasture',
        des: '弩类专精+4 施法类+2邪典掌握 所有单位每次升级+2三元伤害 每个时代升级变异学派升级+1',
      },
      e: {
        name: '潮汐种',
        region: 'harbor',
        des: '枪矛类专精+4 船只桅杆+1且船只可潜水 海上战术宽度+2 每个时代机械学派升级+1',
      },
      f: {
        name: '业火种',
        region: 'living',
        des: '双刃拳刃拳套类专精+4 斥候类刺客类单位升级+4元素伤害 元素伤害增加25% 每个时代游牧学派升级+1',
      },
    },
  },
  orc: {
    name: '兽人',
    image: 'assets/races/orc.jpg',
    breeding: { food: 1 },
    region: 'military',
    found_terrain: BASE_CITY_TERRAINS,
    des: '1食物繁育；军事特区；可建造特殊建筑鲜血图腾柱（出产额外的骑兵人口）；每种畜牧物产减少1繁育人口需要的食物和1单位维护费用和购买非资源非材料的财富花费',
    cost_mods: {
      // 每种畜牧物产：繁育一个人口需要的食物 -1（物产系统上线前 countProducts 恒为 0，不生效）
      breed: [{
        label: '兽人',
        apply: (unit, ctx) => COST_OP.add('food', -countProducts(ctx.data, 'livestock'))(unit),
      }],
    },
    subraces: {
      a: {
        name: '邪刃种',
        region: 'holy',
        des: '变异掌握+2 施法者升级+2三元伤害 每时代变异学派升级+1',
      },
      b: {
        name: '霜狼种',
        region: 'pasture',
        des: '野兽类武器掌握+2 牧场及其建筑的骑兵人口转化为野兽人口 每时代交流学派升级+1',
      },
      c: {
        name: '黑手种',
        region: 'mine',
        des: '骰子D6保底+1 RA+5保底 锻造装备成功率+5% 加工品最高等级当时时代+1 全单位+4护甲 每时代机械学派升级+1',
      },
      d: {
        name: '战歌种',
        region: 'entertainment',
        des: '格斗类单位斧类+2专精且斧类+1破盾 格斗类单位可以消耗一个回合换取四倍技能伤害1次 每时代游牧学派升级+1',
      },
      e: {
        name: '暗眼种',
        region: 'farm',
        des: '斥候类单位+2三元伤害且投掷专精+2 无视逆位神信条的负面效果 每时代奇迹学派升级+1',
      },
    },
  },
  dwarf: {
    name: '矮人',
    image: 'assets/races/elf.jpg',
    breeding: { food: 1, mine: 1 },
    region: 'mine',
    found_terrain: [...BASE_CITY_TERRAINS, 'mountain'],
    des: '1食物1矿石繁育；矿场特区；可在山脉建城；每种矿石物产增加防具类锻造成功率2%；可建造特殊建筑先祖石柱（出产额外的矿石）',
    subraces: {
      a: {
        name: '黑铁种',
        region: 'holy',
        des: '攻城单位攻击+d3 单位可以装备和研究机械学派技能和法术超越1时代 施法单位最大法术种类+1且得到+4机械掌握 每个时代机械学派升级+1',
      },
      b: {
        name: '铜皮种',
        region: 'academy',
        des: '锤专精+4 锻造装备消耗资源减半 锻造符文消耗减半 装备打孔数量+1（最大不超过6） 单位每次升级得到+3元素抗性 每个时代符文学派升级+1',
      },
      c: {
        name: '山脉种',
        region: 'farm',
        des: '投矛专精+4 召唤生物生命增加20% 远程单位每次升级得到+4酸毒伤害 全单位+5生命 每个时代天空学派升级+1',
      },
      d: {
        name: '帝国种',
        region: 'trade',
        des: '双手武器专精+4 传教每人口文化消耗-2 扩张土地消耗文化减少50% 格斗类角斗类升级+5护甲 每个时代奇迹学派升级+1',
        cost_mods: {
          // 扩张土地（建设新城）消耗的文化减半
          new_city: [{ label: '帝国种', apply: COST_OP.scale('culture', 0.5) }],
        },
      },
      e: {
        name: '蛮荒种',
        region: 'pasture',
        des: '斧专精+4 斧破甲+2 骑兵顺位-1 战术宽度+2 每个时代升级游牧学派+1',
      },
    },
  },
  // ── 地精（暂未开放）
  // goblin: {
  //   name: '地精',
  //   image: 'assets/races/human.jpg',
  //   breeding: { food: 0.5 },
  //   region: 'living',
  //   found_terrain: ANY_LAND_TERRAINS,
  //   des: '0.5食物繁育；居住特区；可在幽暗地域建城（目前地图没有幽暗地域，按任意陆地处理）；每城市的3种加工品物产增加该城市的垃圾堆材料1出产量；可建造特殊建筑垃圾堆（出产1随机材料）',
  //   subraces: {
  //     a: {
  //       name: '技工种',
  //       region: 'mine',
  //       des: '锤类专精+2 攻城器单位每次升级+5护甲 每个时代机械学派升级+1',
  //     },
  //     b: {
  //       name: '炼金种',
  //       region: 'academy',
  //       des: '枪矛类专精+2 炼制药剂数量+2 药剂每回合使用次数+1 药剂效果增加25% 每时代魔法学派升级+1',
  //     },
  //     c: {
  //       name: '邪月种',
  //       region: 'pasture',
  //       des: '邪典掌握+2 召唤生物高出时代等级+3 每时代变异学派升级+1',
  //     },
  //     d: {
  //       name: '日行种',
  //       region: 'holy',
  //       des: '剑类专精+2 食物物产出产食物+3（加工品无效） 护幕类法术释放效果增加50%且可以战斗开始时释放 每个时代奇迹学派升级+1',
  //     },
  //     e: {
  //       name: '屠虐种',
  //       region: 'military',
  //       des: '投石专精+2 战术宽度+2 装备投石索攻击次数+1 每时代游牧学派升级+1',
  //     },
  //   },
  // },
  // ── 兽耳人（暂未开放）
  // beastkin: {
  //   name: '兽耳人',
  //   image: 'assets/races/human.jpg',
  //   breeding: { food: 1, culture: 0.5 },
  //   region: 'holy',
  //   found_terrain: BASE_CITY_TERRAINS,
  //   des: '1食物0.5文化繁育；圣地特区；每种加工品类物产增加主动技能和法术最终效果1%；可建造特殊建筑契约石柱；拥有额外的施法人口支持',
  //   subraces: {
  //     a: {
  //       name: '兔耳种',
  //       region: 'academy',
  //       des: '治疗护盾专精+5 祝福效果10% 格斗类反骑兵类三元抗性+3 每时代奇迹学派升级+1',
  //     },
  //     b: {
  //       name: '猫耳种',
  //       region: 'farm',
  //       des: '斥候类拳刃双刃拳套专精+3 全单位间接抗性+3 每次战斗每组单位可以免疫1次攻击（不含召唤单位） 每时代交流学派升级+1',
  //     },
  //     c: {
  //       name: '羊角种',
  //       region: 'entertainment',
  //       des: '逆位神额外信仰+1 鲜血会献祭效果强化25% 施法类变异学派掌握+3 每时代变异学派升级+1',
  //     },
  //     d: {
  //       name: '狼耳种',
  //       region: 'pasture',
  //       des: '没有骑兵类单位全部变成野兽类单位 野兽类每次升级+4元素伤害 野兽类单位最终伤害+15% 每时代游牧学派升级+1',
  //     },
  //     e: {
  //       name: '龙角种',
  //       region: 'military',
  //       des: '附魔掌握+4 格斗类和反骑兵类单位初始可飞行 格斗类反骑兵类单位装备双手武器时可装备盾牌 每时代魔法学派升级+1',
  //     },
  //   },
  // },
  centaur: {
    name: '半人马',
    image: 'assets/races/centaur.jpg',
    breeding: { food: 1 },
    region: 'pasture',
    found_terrain: BASE_CITY_TERRAINS,
    des: '1食物繁育；牧场特区；没有步兵类、远程类、角斗类和刺客类单位，以上单位都是骑兵单位（只有斥候类、骑兵类、野兽类、施法类、船只类、飞行类，且斥候类占用骑兵人口）；每种畜牧类物产增加1攻城器的攻城伤害；可建造特殊建筑大纛旗帜；可容纳额外的1种畜牧物产',
    subraces: {
      a: {
        name: '长生天种',
        region: 'holy',
        des: '游牧学派施法类单位祝福效果增加25% 施法类单位顺位-1 施法类单位可装备法术最大种类+1初始法术种类+1 每时代游牧学派升级+1',
      },
      b: {
        name: '金帐种',
        region: 'trade',
        des: '贸易路线运输量翻倍 贸易物品收益+2财富每种 斥候类单位+3护盾 每时代游牧学派升级+1',
      },
      c: {
        name: '哲别种',
        region: 'military',
        des: '弓弩专精+2 弓弩破甲+2 升级远程武器消耗资源减半 单位可以装备和研究游牧学派技能和法术超越1时代 每时代游牧学派升级+1',
      },
      d: {
        name: '窝阔台种',
        region: 'farm',
        des: '枪矛专精+2 生命+5 英雄数量+1 英雄初始等级+2 每时代游牧学派升级+1',
      },
      e: {
        name: '乾元种',
        region: 'main',
        des: '额外政策条+1 建筑矿石消耗-3（不包括奇观） 斥候类单位每个大回合可执行两次任务 每时代游牧学派升级+1',
        cost_mods: {
          // 建筑矿石消耗 -3（不包括奇观）
          build_building: [{
            label: '乾元种',
            apply: (cost, ctx) => (ctx?.isWonder ? cost : COST_OP.add('mine', -3)(cost)),
          }],
        },
      },
    },
  },
  // ── 蜥蜴人（暂未开放）
  // lizardfolk: {
  //   name: '蜥蜴人',
  //   image: 'assets/races/human.jpg',
  //   breeding: { food: 0.5, culture: 1 },
  //   region: 'military',
  //   found_terrain: ANY_LAND_TERRAINS,
  //   des: '0.5食物1文化繁育；军事特区；可造特殊纪念碑古蛇石柱（拥有额外的施法人口支持）；每种矿石类物产增加格斗类武器锻造成功率2%；可在幽暗地域建城（目前地图没有幽暗地域，按任意陆地处理）',
  //   subraces: {
  //     a: {
  //       name: '金鳞种',
  //       region: 'holy',
  //       des: '所有单位升级三元抗性+3 反射25%法术伤害 每1人口+1财富 每时代奇迹学派升级+1',
  //     },
  //     b: {
  //       name: '暗血种',
  //       region: 'pasture',
  //       des: '全单位血液掌握+3 有生命单位的近战攻击自带额外25%近战伤害的酸毒伤害 每1人口+1食物 每时代变异学派升级+1',
  //     },
  //     c: {
  //       name: '彩鳞种',
  //       region: 'academy',
  //       des: '锤类专精+3 全单位元素抗性+3 消耗魔石让魔法学派效果翻倍1级1魔石1等级 每1人口+1文化 每时代魔法学派升级+1',
  //     },
  //     d: {
  //       name: '无鳞种',
  //       region: 'living',
  //       des: '无护甲值 但是所有护甲值会被换算为护盾值 每次升级+3护盾 灵能掌握+3 控制类效果法术持续时间+1 每5人口+1魔石 每时代咒术学派升级+1',
  //     },
  //     e: {
  //       name: '石鳞种',
  //       region: 'mine',
  //       des: '采集材料数量+5 格斗类反骑兵类每次升级钢甲抗性+3且+3元素抗性 每1人口+1矿石 每时代游牧学派升级+1',
  //     },
  //   },
  // },
  merfolk: {
    name: '人鱼',
    image: 'assets/races/human.jpg',
    breeding: { food: 1, culture: 0.5 },
    region: 'harbor',
    found_terrain: WATER_TERRAINS,
    des: '1食物0.5文化繁育；港口特区；只能在水域（海洋、浅海、海岸、河流）建城；没有船只类，船只全部算作攻城器；海上海中战术宽度+2；每个城市的4种水产类物产在该城市的主城区增加加工品物产槽位1；可建造特殊建筑碧海珊瑚柱（可拥有额外的魔尘出产）',
    subraces: {
      a: {
        name: '海潮种',
        region: 'academy',
        des: '施法类单位魔法掌握+3且最大法术位+1 超魔神职信条+1 每时代魔法学派升级+1',
      },
      b: {
        name: '深渊种',
        region: 'pasture',
        des: '暗影和冰霜掌握+3 药水效果翻倍 死亡后可半血复活一次（不包括护甲和护盾） 每时代变异学派升级+1',
      },
      c: {
        name: '鸣泣种',
        region: 'entertainment',
        des: '斥候类施法类潮汐掌握+3 海洋贸易路线运输量翻倍 每时代交流学派升级+1',
      },
      d: {
        name: '巡游种',
        region: 'military',
        des: '弓专精+2 全单位+3护盾 水中战斗顺位-1但是无法上陆地 每时代游牧学派升级+1',
      },
      e: {
        name: '刻符种',
        region: 'mine',
        des: '矿场熔炉魔石出产+1 施法类秘法掌握+3 装备可无损融入材料+1 每时代咒术学派升级+1',
      },
    },
  },
  // ── 鸦人（暂未开放）
  // corvidian: {
  //   name: '鸦人',
  //   image: 'assets/races/corvidian.jpg',
  //   breeding: { food: 1, culture: 1 },
  //   region: 'living',
  //   found_terrain: [...BASE_CITY_TERRAINS, 'mountain'],
  //   des: '1食物1文化繁育；居住特区；可以在山脉中建城；建造建筑不消耗矿石而消耗食物（但是防御建筑的城防只有一半，不包括奇观）；斥候类、格斗类、反骑兵类单位全部视为飞行单位；每10种加工品物产提供战场宽度+1效果；可建造特殊建筑初生巨蛋（提供额外文化和额外的住房）',
  //   subraces: {
  //     a: {
  //       name: '黑羽种',
  //       region: 'academy',
  //       des: '无法学习奇迹学派但变异掌握+4 法杖专精+4 敌人投射和技能命中降低20% 每时代变异学派升级+1',
  //     },
  //     b: {
  //       name: '白羽种',
  //       region: 'holy',
  //       des: '无法学习变异学派但奇迹掌握+4 长柄专精+4 召唤数量+1 召唤生物护甲+10每等级x时代 每时代奇迹学派升级+1',
  //     },
  //     c: {
  //       name: '彩羽种',
  //       region: 'trade',
  //       des: '施法类附魔掌握+5x时代 弓专精+3x时代 锻造和升级时饰品宝石类材料效果+1 采集宝石和金属类材料时等级+1 每时代魔法学派升级+2',
  //     },
  //     d: {
  //       name: '金羽种',
  //       region: 'harbor',
  //       des: '齿轮掌握+4 弩专精+3 船只可飞行且额外桅杆槽位+1 每时代机械学派升级+1',
  //     },
  //     e: {
  //       name: '青羽种',
  //       region: 'mine',
  //       des: '游牧掌握+4 双刃拳刃专精+3 斥候类刺客类单位释放游牧学派技能效果增加20% 每次斥候行动后如果平安归都会增加1人口 每时代游牧学派升级+1',
  //     },
  //   },
  // },
  // ── 虫人（暂未开放）
  // insectoid: {
  //   name: '虫人',
  //   image: 'assets/races/human.jpg',
  //   breeding: { food: 0.5 },
  //   region: 'main',
  //   found_terrain: ANY_LAND_TERRAINS,
  //   des: '0.5食物繁育；主城特区；可在幽暗地域建城（目前地图没有幽暗地域，按任意陆地处理）；每种物产增加该城市5住房；可建造特殊建筑虫眼哨塔（额外的远程人口和城防）',
  //   subraces: {
  //     a: {
  //       name: '甲壳种',
  //       region: 'military',
  //       des: '锤类专精+1 全单位护甲+2且生命+2 单手武器装备槽位+1 可双持单手武器 每时代变异学派升级+1',
  //     },
  //     b: {
  //       name: '万足种',
  //       region: 'trade',
  //       des: '长柄类专精+1 足部装备槽位+1 可消耗1次行动钻入地下减少受到的全部伤害的50%但在地下时无法行动（但是仍然可以让英雄使用卷轴药水魔导器） 每时代变异学派升级+1',
  //     },
  //     c: {
  //       name: '飞翅种',
  //       region: 'pasture',
  //       des: '弩专精+2 远程类施法类单位被视为飞行单位 增加额外装备种类槽位虫翼 每时代游牧学派升级+1',
  //     },
  //     d: {
  //       name: '群聚种',
  //       region: 'farm',
  //       des: '牙爪专精+2 格斗类斥候类反骑兵类无法装备普通武器只能装备牙爪类武器但占用战场宽度减半 单位无维护费 每时代游牧学派升级+1',
  //     },
  //     e: {
  //       name: '蝎尾种',
  //       region: 'mine',
  //       des: '全单位+2酸毒伤害 增加额外装备种类槽尾甲和尾刃 每受伤1点生命会给近战攻击者反射3点酸伤害 每时代变异学派升级+1',
  //     },
  //   },
  // },
  // ── 植物（暂未开放）
  // plantfolk: {
  //   name: '植物',
  //   image: 'assets/races/human.jpg',
  //   breeding: { food: 0.5, culture: 1 },
  //   region: 'farm',
  //   found_terrain: BASE_CITY_TERRAINS,
  //   des: '0.5食物1文化繁育；农田特区；建筑不需要矿石只消耗文化（不包括奇观）；每2种农作物物产增加1人口每回合；可建造特殊建筑园艺立柱（增加大量的住房和额外的文化）',
  //   subraces: {
  //     a: {
  //       name: '巨树',
  //       region: 'military',
  //       des: '双手类专精+3 格斗类反骑兵类单位每次升级+1城防但全单位顺位+1 全可消耗一个回合进行扎根，扎根后单位顺位再次+2 但是每回合回复25%护甲 森林学派升级+1',
  //     },
  //     b: {
  //       name: '花妖',
  //       region: 'academy',
  //       des: '魔杖专精+3 可额外装备魔典数量+1 死亡后单位转化为该单位每等级x时代数量的凋零单位（凋零单位无视战术宽度且没有任何技能只有凋零触摸） 魔法学派升级+1',
  //     },
  //     c: {
  //       name: '魔蕈',
  //       region: 'pasture',
  //       des: '长柄专精+4 可在幽暗地域建城（目前地图没有幽暗地域，按任意陆地处理）且城市可以紧挨在一起合并成一个超级城市 全单位+2酸毒伤害 每时代变异学派升级+1',
  //       found_terrain_extra: ANY_LAND_TERRAINS,
  //     },
  //     d: {
  //       name: '水藤',
  //       region: 'harbor',
  //       des: '投矛专精+3 可在海洋建城且城市基础地格+3 农田牧场物产槽位+1 每时代升级游牧学派+1',
  //       found_terrain_extra: WATER_TERRAINS,
  //     },
  //     e: {
  //       name: '地薯',
  //       region: 'mine',
  //       des: '锤类专精+3 可将食物和矿物进行等量转化每矿场转化量每回合10 锻造装备时也可以用任何资源取代矿石且任何物产都可以被视为农作物种在农田中 全单位+3三元抵抗 每时代升级奇迹学派+1',
  //     },
  //   },
  // },
  undead: {
    name: '亡灵',
    image: 'assets/races/human.jpg',
    breeding: { magic: 1 },
    region: 'academy',
    found_terrain: ANY_LAND_TERRAINS,
    des: '1魔石繁育；学院特区；可造额外的纪念碑通灵塔；拥有额外的步兵人口加成；每种宝石类物产让己方单位受到的伤害降低1%；可以在幽暗地域建城（目前地图没有幽暗地域，按任意陆地处理）；所有单位被视为亡灵，免疫很多效果',
    subraces: {
      a: {
        name: '骷髅国王',
        region: 'military',
        des: '只能招募骸骨类单位，招募单位不消耗人口只消耗财富（骸骨无法装备饰品） 1次可招募最多4组单位 战术宽度+3 无法混血 所有单位自带骸骨效果 全单位升级+3飞羽抗性 每时代变异学派升级+1',
        cost_mods: {
          // 招募单位不消耗人口、只消耗财富。
          // 【假设】财富数量 = 原人口数量（1:1），想改比例只需改下面的 rate；
          // "只能招募骸骨类单位"的限制属于招募条件，不在成本钩子范围内，尚未实现。
          train_unit: [{ label: '骷髅国王', apply: COST_OP.convert('population', 'wealth', 1) }],
        },
      },
      b: {
        name: '鲜血伯爵',
        region: 'living',
        des: '全单位血液掌握+5 全单位升级+5生命 全单位钢甲抗性+4且灵魂抗性+4 格斗类斥候类单位移动时算作飞行单位 每时代变异学派升级+2',
      },
      c: {
        name: '冤魂女爵',
        region: 'entertainment',
        des: '单位每次升级无法增加物理防御但是增加双倍生命在护盾 单位只有护盾 对应的护甲也会变成护盾 每次升级+3护盾 所有单位自带虚体 只能招募幽魂类单位 招募单位不消耗人口只消耗文化 无法混血 每时代变异学派升级+1',
        cost_mods: {
          // 招募单位不消耗人口、只消耗文化。
          // 【假设】文化数量 = 原人口数量（1:1），想改比例只需改下面的 rate；
          // "只能招募幽魂类单位"的限制属于招募条件，不在成本钩子范围内，尚未实现。
          train_unit: [{ label: '冤魂女爵', apply: COST_OP.convert('population', 'culture', 1) }],
        },
      },
      d: {
        name: '丧尸大公',
        region: 'mine',
        des: '杀死敌人增加人口 战场上杀死的敌人单位会变成己方本时代最弱的近战单位（战斗结束后决定消耗1魔石1单位等级决定是否让其永久保留） 战术宽度+3 近战类单位每次升级+3酸毒伤害 无法混血 每时代变异学派升级+1',
      },
      e: {
        name: '死灵宗师',
        region: 'holy',
        des: '取消格斗类单位全部视为攻城类单位 斥候也被视为攻城单位拥有独特的骸骨拼装斥候巨犬 攻城类单位无法携带远程武器且没有护甲和护盾只有生命，护盾和护甲被1比1转化为生命值 全部视为机械+亡灵生物且死亡后可以被修复（消耗魔石和技能或者魔导器和卷轴，每次战斗只能修复1次每组单位） 攻城类单位升级+5生命 每时代变异学派升级+2',
      },
    },
  },
  primordial: {
    name: '元灵',
    image: 'assets/races/primordial.jpg',
    breeding: { mine: 0.5, culture: 0.5 },
    region: 'holy',
    found_terrain: ANY_LAND_TERRAINS,
    des: '0.5矿石0.5文化繁育；圣地特区；无法研究生命变异学派，只能和其他元素生物进行元素融合；每种矿石类物产减少1建筑矿石消耗（包括奇观）；可以在对应元素地区建城（目前地图没有元素地区，按任意陆地处理）；可建造特殊建筑元素母柱（拥有额外的矿石出产）',
    cost_mods: {
      // 每种矿石类物产：建筑矿石消耗 -1（包括奇观；物产系统上线前不生效）
      build_building: [{
        label: '元灵',
        apply: (cost, ctx) => COST_OP.add('mine', -countProducts(ctx.data, 'ore'))(cost),
      }],
    },
    subraces: {
      a: {
        name: '石灵',
        region: 'mine',
        des: '矿物类宝石类物产产量翻倍（加工品无效） 食物物产产量降低一半（加工品无效） 城市主城区初始自带一种矿物物产 无法研究魔法学派和生物变异学派 所有单位没有生命数据，升级生命的一半会增加到护甲值上 所有兵组每次升级+4护甲 咒术学派单位每个时代升级次数+1',
      },
      b: {
        name: '风灵',
        region: 'entertainment',
        des: '所有单位顺位-1 无法研究咒术学派和生物变异学派 所有单位没有生命数据，升级生命的一半会增加到护盾值上 所有兵组每次升级+4护盾 人口不需要住房可以任意增加 交流学派单位每个时代升级次数+1',
      },
      c: {
        name: '火灵',
        region: 'military',
        des: '没有物理伤害，所有物理伤害转化为等量元素伤害 无法研究游牧学派和生物变异学派 所有单位没有生命数据，升级生命的一半会增加到护盾值上 所有兵组每次升级+4护盾 魔法学派单位每个时代升级次数+1',
      },
      d: {
        name: '水灵',
        region: 'harbor',
        des: '没有物理伤害，所有物理伤害转化为等量元素伤害 无法研究奇迹学派和生物变异学派 所有单位没有护盾和护甲数据只有生命值 升级护盾护甲会双倍增加到生命值上 所有兵组每次升级+8生命 魔法学派单位每个时代升级次数+1',
      },
      e: {
        name: '雷灵',
        region: 'academy',
        des: '没有物理伤害，所有物理伤害转化为等量元素伤害 无法研究交流学派和生物变异学派 所有单位没有生命数据，升级生命的一半会增加到护盾值上 近战攻击的敌人会受到25%元素反伤 魔法学派单位每个时代升级次数+1',
      },
    },
  },
  // ── 巨人（暂未开放）
  // giant: {
  //   name: '巨人',
  //   image: 'assets/races/human.jpg',
  //   breeding: { food: 2 },
  //   region: 'pasture',
  //   found_terrain: BASE_CITY_TERRAINS,
  //   des: '2食物繁育；牧场特区；单位升级+4x时代生命且+4x时代护甲；每4种物产可增加1次每战斗回合使用卷轴或魔导器或药水的机会（限定一种）；可建造特殊建筑通天巨柱（可拥有额外的魔尘出产）',
  //   subraces: {
  //     a: {
  //       name: '风暴种',
  //       region: 'holy',
  //       des: '近战攻击自带25%额外随机元素伤害 斧专精+5 斧破甲+3 奇迹学派单位每个时代升级次数+1',
  //     },
  //     b: {
  //       name: '始源种',
  //       region: 'academy',
  //       des: '法术自带20%额外回响效果 施法类单位秘法掌握+4 咒术学派单位每个时代升级次数+1',
  //     },
  //     c: {
  //       name: '星界种',
  //       region: 'trade',
  //       des: '魔导器锻造不需要消耗军事条目和魔石（但限制每回合1个） 使用魔导器每战斗回合+1次 魔导器效果增加20% 最大信条+1 魔法学派单位每个时代升级次数+1',
  //     },
  //     d: {
  //       name: '炼狱种',
  //       region: 'living',
  //       des: '死亡后自爆同等最大生命的三元伤害 招募人口消耗-1消耗回合-1（最小1） 格斗类反骑兵类单位多一个手臂 远程类施法类多一个头颅 斥候类角斗类多一双腿 变异学派单位每个时代升级次数+1',
  //     },
  //     e: {
  //       name: '构装种',
  //       region: 'industry',
  //       des: '不消耗食物转为消耗2矿石增加人口 所有单位视为机械单位 无法研究变异学派 研究机械学派可以得到特殊的治疗技能 所有单位没有生命数据，升级生命的等量增加到护甲值上 机械学派主动技能效果翻倍 所有兵组每次升级+4护甲 不能混血但是可以研究机械学派可以升级改装 机械学派单位每个时代升级次数+1',
  //     },
  //   },
  // },
  ancient: {
    name: '复苏古人',
    image: 'assets/races/human.jpg',
    breeding: { food: 1, culture: 1 },
    region: 'academy',
    found_terrain: BASE_CITY_TERRAINS,
    des: '1食物1文化繁育；学院特区；可以用条目征集魔石，消耗矿石兑换魔石；全单位升级+3x每时代仙缘掌握；开局解锁炼丹；可建造特殊建筑山门（取代栅栏）；灵田取代普通农田；灵脉取代矿场；可建造特殊建筑风水宝鼎',
    subraces: {
      a: {
        name: '灵宗',
        region: 'holy',
        des: '可消耗魔石强化伤害，1颗强化50%可叠加5层，每1层增加10%爆体而亡的概率 灵脉灵田出产魔石+1 施法类单位识海掌握+3x每时代 斥候类远程类可装备饰品数量+1 格斗类不可装备盾牌，但是增加额外3x饰品等级的伤害免疫 仙缘学派单位每个时代升级次数+2',
      },
      b: {
        name: '武宗',
        region: 'military',
        des: '可选择本命武器（非远程），本命武器每次升级+3真实伤害 骑兵类可将本命武器作为坐骑（视为轻型坐骑） 灵田出产食物+3 灵脉出产矿石+3 风水宝鼎出产额外3文化 格斗类骑兵类单位每次升级+3x时代体修掌握，不装备武器的单位可以将四肢头颅男性生殖器作为武器炼化升级',
      },
      c: {
        name: '药宗',
        region: 'farm',
        des: '初始拥有3级炼丹炉10份随机材料2种丹方，奇遇结束总是能得到1种丹方 炼丹数量+1且需要材料种类或数量-1 免疫丹毒 灵田农作物槽位+3 牧场畜牧槽位+1 采集材料数量+2 每个回合免费采集次数+1 斥候类单位可装备特殊武器（药葫芦，远程类武器攻击附带里面装药的效果） 仙缘学派每个时代升级次数+1',
      },
      d: {
        name: '器宗',
        region: 'living',
        des: '拥有取代居住区的特色区域灵器坊 加工品质量+1 主城区加工品槽位+2 锻造武器饰品魔典成功率+10% 锻造魔导器不需要卷轴 释放魔导器和道具效果+100% 商店购物减免20% 玩家间交易非物产无需商路 加工品最高等级大于时代2级',
      },
      e: {
        name: '兽宗',
        region: 'pasture',
        des: '拥有取代牧场的特色区域万兽穴 可建造特殊建筑风水宝鼎 畜牧质量+1 风水宝鼎拥有额外的2畜牧槽位 野兽类单位主动技能槽位+1法力值+1 斥候类单位可装备特殊武器（御兽鞭，可以提高指定野兽的攻击力或者减低顺位） 畜牧物产最高等级大于时代2级 野兽类单位升级+3x时代攻击',
      },
    },
  },
  voidwalker: {
    name: '虚海渡人',
    image: 'assets/races/voidwalker.jpg',
    breeding: { food: 1, culture: 1 },
    region: 'academy',
    found_terrain: BASE_CITY_TERRAINS,
    des: '1食物1文化繁育；学院特区；可以用条目征集魔石，用生物材料兑换魔石；施法单位升级+3x时代魍魉掌握；开局解锁炼金；可建造特殊建筑骨墙（取代栅栏）；血池取代牧场；养尸地取代矿场',
    subraces: {
      a: {
        name: '合欢宗',
        region: 'entertainment',
        des: '拥有特殊建筑炉鼎大床 增加大量的仓库俘虏容量 奇遇探索副本时可以抓捕遇到的人形生物为炉鼎，无需材料可以消耗俘虏练出同等级的丹药 施法单位魍魉掌握+3x单位等级 繁育每个人口时增加2x时代的文化 人形生物奴隶畜牧质量+1 主城区畜牧槽位+2',
      },
      b: {
        name: '幽冥宗',
        region: 'mine',
        des: '拥有特殊建筑万魂幡 每杀死1组单位+1文化输出 可将亡灵生物视作畜牧和野兽，亡灵畜牧质量+2 材料亡灵材料数量+2 远程类单位升级+4灵魂x时代 杀死每种单位有概率得到一种骰子随亡灵机畜牧物种 血池出产额外的3食物 养尸地出产额外的1材料',
      },
      c: {
        name: '天魔宗',
        region: 'pasture',
        des: '拥有特殊建筑天魔鼎，投入物产可以得到10倍资源和十份材料 可以直接吞噬物产来强化武器，等同于同等级的辉晶石 探索资源必然成功且质量+1，且斥候可以探索两次资源，但是无法探索奇遇 召唤单位数量+1 召唤宽度+3 格斗单位反骑兵单位自带特殊被动（天魔解体大法），其他种族无法学习，混血也不行 血池增加额外免费维持费用',
      },
      d: {
        name: '蛊妖宗',
        region: 'holy',
        des: '拥有特殊建筑虿盆 10虫类畜牧槽位，不需要探索每个回合自动生成1种（需要骰子） 斥候类远程类施法类灵蛊掌握+3x时代 可装备特殊武器（蛊盆，类似药葫芦，不过只有负面效果） 野兽类单位如果是虫类可以变成特兵本命蛊，每个施法单位携带1本命蛊不占用战场宽度 血池畜牧槽位+2 己方单位死亡后有概率爆出随机蛊虫物产',
      },
      e: {
        name: '万妖宗',
        region: 'harbor',
        des: '拥有特殊建筑海魔宫 每个海魔宫增加召唤生物战场宽度+1 召唤生物技能等级+1（最多+3） 施法单位可装备特殊武器万妖幡，使用后自动召唤1种弱小召唤生物（不占用宽度的），不消耗法力值 血池变成更强大的妖穴（牧+矿），每个妖穴额外出产1个妖穴内的物产生物或矿物材料',
      },
    },
  },
};

// ── 建城地形查询 ─────────────────────────────────────

/**
 * 返回某个种族（及子种族）允许建立主城的地形 key 列表。
 * 种族没有写 found_terrain 时，按基础陆地处理。
 */
export function getCityTerrains(raceKey, subRaceKey) {
  const race = RACES[raceKey];
  const list = new Set(race?.found_terrain ?? BASE_CITY_TERRAINS);
  const extra = race?.subraces?.[subRaceKey]?.found_terrain_extra;
  if (Array.isArray(extra)) extra.forEach(t => list.add(t));
  return [...list];
}

/** 该种族（及子种族）能否在 terrainKey 这种地形上建立主城 */
export function canFoundCityOn(terrainKey, raceKey, subRaceKey) {
  return getCityTerrains(raceKey, subRaceKey).includes(terrainKey);
}

/** 建城地形的中文说明，例如 "平原、丘陵、沙漠、森林"，用于提示文字 */
export function getCityTerrainText(raceKey, subRaceKey) {
  return getCityTerrains(raceKey, subRaceKey)
    .filter(t => TERRAIN[t])   // terrain.js 里没有的地形（如目前地图没有的沙漠）不显示
    .map(t => TERRAIN[t].name)
    .join('、');
}

// ── 成本修正：应用入口 ───────────────────────────────

/** 收集某种族（及子种族）在指定钩子下的全部规则：种族规则在前，子种族规则在后 */
export function getRaceCostRules(hook, raceKey, subRaceKey) {
  const race = RACES[raceKey];
  if (!race) return [];
  const sub = race.subraces?.[subRaceKey];
  return [
    ...(race.cost_mods?.[hook] ?? []),
    ...(sub?.cost_mods?.[hook] ?? []),
  ];
}

/**
 * 应用种族成本修正，返回 { cost, applied }：
 *   cost    修正后的成本（值 <= 0 的项会被去掉）
 *   applied 真正改变了成本的规则列表 [{ label, before, after }]，用于在界面上标注来源
 * opts.round 默认 true：每项成本向上取整（繁育单价这类允许小数的场景传 false）
 */
export function applyRaceCostModsDetailed(hook, cost, raceKey, subRaceKey, ctx = {}, opts = {}) {
  const round = opts.round !== false;
  let current = { ...(cost ?? {}) };
  const applied = [];
  for (const rule of getRaceCostRules(hook, raceKey, subRaceKey)) {
    if (typeof rule?.apply !== 'function') continue;
    const before = current;
    const after = rule.apply(before, ctx) ?? before;
    if (JSON.stringify(after) !== JSON.stringify(before)) {
      applied.push({ label: rule.label ?? '', before, after });
    }
    current = { ...after };
  }
  const result = {};
  for (const [k, v] of Object.entries(current)) {
    const n = round ? Math.ceil(v - 1e-9) : v;
    if (n > 0) result[k] = n;
  }
  return { cost: result, applied };
}

/** 只要修正后的成本时用这个 */
export function applyRaceCostMods(hook, cost, raceKey, subRaceKey, ctx = {}, opts = {}) {
  return applyRaceCostModsDetailed(hook, cost, raceKey, subRaceKey, ctx, opts).cost;
}