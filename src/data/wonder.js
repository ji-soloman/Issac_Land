export const WONDER = {
  pyramid: {
    name: '金字塔',
    image: 'assets/wonder/pyramid.png',
    time_cost: 5,
    every_turn_cost: {
      magic: 1,
      mine: 5,
    },
    filter: function ({ tech }) {
      return tech.construction_2;
    },
    filter_info: '已解锁科技【制陶业】',
  },
  sacred_tomb: {
    name: '圣墓',
    image: 'assets/wonder/sacred_tomb.png',
    time_cost: 5,
    every_turn_cost: {
      magic: 1,
      mine: 5,
    },
    filter: function ({ tech }) {
      return tech.religion_1 && tech.construction_3;
    },
    filter_info: '已解锁科技【信仰】和【石器】',
  },
  public_bath: {
    name: '大浴场',
    image: 'assets/wonder/public_bath.png',
    time_cost: 5,
    every_turn_cost: {
      magic: 4,
      mine: 20,
    },
    filter: function ({ tech }) {
      return tech.construction_2;
    },
    filter_info: '已解锁科技【医疗】',
  },
  oracle: {
    name: '神谕所',
    image: 'assets/wonder/oracle.png',
    time_cost: 5,
    every_turn_cost: {
      magic: 1,
      mine: 5,
    },
    filter: function ({ tech }) {
      return tech.occultism_2;
    },
    filter_info: '已解锁科技【占卜】',
  },
  colosseum: {
    name: '斗兽场',
    image: 'assets/wonder/colosseum.png',
    time_cost: 5,
    every_turn_cost: {
      magic: 5,
      mine: 30,
    },
    filter: function ({ tech }) {
      return tech.construction_2;
    },
    filter_info: '已解锁科技【制陶业】',
  },
  hanging_garden: {
    name: '空中花园',
    image: 'assets/wonder/hanging_garden.png',
    time_cost: 5,
    every_turn_cost: {
      magic: 4,
      mine: 20,
    },
    filter: function ({ tech }) {
      return tech.construction_2;
    },
    filter_info: '已解锁科技【栽培】',
  },
}