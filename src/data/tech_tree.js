export const TECH_TREE = {
  farming_1: {
    name: '打猎',
    cost: { food: 50 },
    requires: [],
    effects: [
      { type: 'unlock_action', value: 'farm' },
      { type: 'buff', target: 'food', percent: 10 }
    ],
    era: 'primitive',
    color: 'green',
    icon: 'assets/tech_tree/icon/hunting.png',
  },

  farming_2: {
    name: '驯化',
    cost: { food: 120, wealth: 30 },
    requires: ['farming_1'],
    effects: [
      { type: 'buff', target: 'food', percent: 25 }
    ],
    era: 'primitive',
    color: 'green',
    icon: 'assets/tech_tree/icon/animal.png',
  },
  construction_1: {
    name: '开采',
    cost: {},
    requires: [],
    effect: [],
    era: 'primitive',
    color: 'green',
    icon: 'assets/tech_tree/icon/clay.png',
  },
  leadership_1: {
    name: '首领',
    cost: {},
    requires: [],
    effect: [],
    era: 'primitive',
    color: 'green',
    icon: 'assets/tech_tree/icon/leader.png',
  },
  construction_2: {
    name: '制陶业',
    cost: {},
    requires: ['construction_1'],
    effect: [],
    era: 'primitive',
    color: 'green',
    icon: 'assets/tech_tree/icon/clay.png',
  },
  leadership_2: {
    name: '军事化',
    cost: {},
    requires: [],
    effect: [],
    requires: ['leadership_1'],
    era: 'primitive',
    color: 'green',
    icon: 'assets/tech_tree/icon/military.png',
  },
  religion_1: {
    name: '信仰',
    cost: {},
    requires: [],
    effect: [],
    requires: ['leadership_1'],
    era: 'primitive',
    color: 'green',
    icon: 'assets/tech_tree/icon/belief.png',
  },
  religion_2: {
    name: '原始祈祷',
    cost: {},
    requires: [],
    effect: [],
    requires: ['religion_1'],
    era: 'primitive',
    color: 'blue',
    icon: 'assets/tech_tree/icon/pray.png',
  }
};
