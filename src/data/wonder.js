export const WONDER = {
  pyramid: {
    name: '金字塔',
    image: 'assets/wonder/pyramid.png',
    time_cost: 3,
    cost: {
      magic: 1,
      mine: 3,
    },
    effect_info: '每轮【农田区】粮仓食物+2',
    filter: function ({ tech }) {
      return tech.construction_2;
    },
    filter_info: '已解锁科技【制陶业】',
  },
  sacred_tomb: {
    name: '圣墓',
    image: 'assets/wonder/sacred_tomb.png',
    time_cost: 3,
    cost: {
      magic: 1,
      mine: 3,
    },
    effect_info: '每轮【圣地】和【圣殿】文化+3',
    filter: function ({ tech }) {
      return tech.religion_1 && tech.construction_3;
    },
    filter_info: '已解锁科技【信仰】和【石器】',
  },
  witch_circle: {
    name: '女巫法阵',
    image: 'assets/wonder/witch_circle.png',
    time_cost: 5,
    cost: {
      magic: 1,
      mine: 5,
    },
    effect_info: '每轮【学院特区】文化+2',
    filter: function ({ tech }) {
      return tech.religion_2;
    },
    filter_info: '已解锁科技【原始祈祷】',
  },
  public_bath: {
    name: '大浴场',
    image: 'assets/wonder/public_bath.png',
    time_cost: 5,
    cost: {
      magic: 2,
      mine: 10,
    },
    effect_info: '【娱乐区】的加工品槽位+1',
    filter: function ({ tech }) {
      return tech.construction_2;
    },
    filter_info: '已解锁科技【医疗】',
  },
  oracle: {
    name: '神谕所',
    image: 'assets/wonder/oracle.png',
    time_cost: 5,
    cost: {
      magic: 1,
      mine: 5,
    },
    effect_info: '每轮【学院区】和【图书馆】财富+2',
    filter: function ({ tech }) {
      return tech.occultism_2;
    },
    filter_info: '已解锁科技【占卜】',
  },
  colosseum: {
    name: '斗兽场',
    image: 'assets/wonder/colosseum.png',
    time_cost: 5,
    cost: {
      magic: 5,
      mine: 30,
    },
    effect_info: '每轮【娱乐区】文化+5；【娱乐区】住房+5，步兵人口+5',
    filter: function ({ tech }) {
      return tech.construction_2;
    },
    filter_info: '拥有3座【角斗场】',
  },
  hanging_garden: {
    name: '空中花园',
    image: 'assets/wonder/hanging_garden.png',
    time_cost: 5,
    cost: {
      magic: 3,
      mine: 10,
    },
    effect_info: '战场宽度+1',
    filter: function ({ tech }) {
      return tech.construction_2;
    },
    filter_info: '已解锁科技【栽培】',
  },
  shadowfell_rift: {
    name: '影界裂隙',
    image: 'assets/wonder/shadowfell_rift.png',
    unique: true,
    time_cost: 8,
    cost: {
      magic: 5,
      mine: 25,
    },
    effect_info: '唯一性，前往影界的唯一通道',
    filter: function ({ tech }) {
      return false;
    },
    filter_info: '暂无',
  },
}