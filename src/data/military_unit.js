export const MILITARY_UNIT = {
  scout: {
    name: "斥候",
    type: "scout",
    image: "assets/military/soliders/scout.jpg",
    equipments: {},
    basic_stats: {
      physical_attack: 0,
      spell_attack: 0,
      hp: 15,
      armor: 0,
      mana: 0,
      military_order: 4,
    },
    special_ability: {
      explore_terrain: true,
      explore_resource: true,
    },
    training: {
      cost: {
        population: 1,
      },
      round: 1,
    },
  },
  centaur_scout: {
    name: "半人马斥候",
    type: "scout",
    image: "assets/military/soliders/scout.jpg",
    equipments: {},
    basic_stats: {
      physical_attack: 0,
      spell_attack: 0,
      hp: 15,
      armor: 0,
      mana: 0,
      military_order: 4,
    },
    special_ability: {
      explore_terrain: true,
      explore_resource: true,
    },
    training: {
      cost: {
        population: 1,
      },
      round: 1,
    },
  },
  devil_scout: {
    name: "魔教哨探",
    type: "scout",
    image: "assets/military/soliders/scout.jpg",
    equipments: {},
    basic_stats: {
      physical_attack: 0,
      spell_attack: 0,
      hp: 15,
      armor: 0,
      mana: 0,
      military_order: 4,
    },
    special_ability: {
      explore_terrain: true,
      explore_resource: true,
    },
    training: {
      cost: {
        population: 1,
      },
      round: 1,
    },
  },
  migration_ship: {
    name: '移民星舟',
    type: 'special_type',
    image: 'assets/military/soliders/boat.jpg',
    equipments: {},
    basic_stats: {},
    special_ability: {
      migration: true,
    },
    training: {
      cost: {
        population: 1,
      },
      round: 1,
    },
  },
  warrior: {
    name: "勇士",
    type: "fighting",
    image: "assets/military/soliders/fighting.jpg",
    equipments: {},
    basic_stats: {
      physical_attack: 4,
      spell_attack: 0,
      hp: 20,
      armor: 5,
      mana: 2,
      military_order: 5,
    },
    special_ability: {
      taunt: true,
    },
    training: {
      cost: {
        population: 1,
      },
      round: 1,
    },
  },
  pitcher: {
    name: "投石手",
    type: "ranged",
    image: "assets/military/soliders/ranged.jpg",
    equipments: {},
    basic_stats: {
      physical_attack: 4,
      spell_attack: 0,
      hp: 15,
      armor: 0,
      mana: 2,
      military_order: 3,
    },
    special_ability: {
      pitch: true,
    },
    training: {
      cost: {
        population: 1,
      },
      round: 1,
    },
    filter: {
      tech: {
        sports_2: true,
      }
    }
  },
  boat: {
    name: "划桨小船",
    type: "boat",
    image: "assets/military/soliders/boat.jpg",
    equipments: {},
    basic_stats: {
      physical_attack: 0,
      spell_attack: 0,
      hp: 30,
      armor: 10,
      mana: 2,
      military_order: 4,
    },
    special_ability: {
      pitch: true,
      sailing_lv1: true,
      convey_lv1: true,
    },
    training: {
      cost: {
        population: 1,
      },
      round: 1,
    },
    filter: {
      tech: {
        boating_1: true,
      }
    }
  },
};
