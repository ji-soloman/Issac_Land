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
    image: "assets/military/soliders/centaur_scout.jpg",
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
    image: "assets/military/soliders/devil_scout.jpg",
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
    image: 'assets/military/soliders/migration_ship.jpg',
    quality: 'rare',
    equipments: {},
    basic_stats: {},
    special_ability: {
      migration: true,
    },
    training: {
      cost: {
        population: 4,
        wealth: 10,
        magic: 20,
        food: 50,
      },
      round: 3,
    },
    filter: {
      tech: {
        convey_1: true,
      }
    }
  },
  warrior: {
    name: "勇士",
    type: "fighting",
    image: "assets/military/soliders/warrior.jpg",
    quality: 'good',
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
    image: "assets/military/soliders/pitcher.jpg",
    quality: 'good',
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
      mutation_devil_lv3_1: true,
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
    quality: 'good',
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
        population: 2,
        mine: 2,
        wealth: 1,
      },
      round: 1,
    },
    filter: {
      tech: {
        boating_1: true,
      }
    }
  },
  Axeman: {
    name: "巨斧手",
    type: "fighting",
    image: "assets/military/soliders/Axeman.jpg",
    quality: 'good',
    equipments: {},
    basic_stats: {
      physical_attack: 6,
      spell_attack: 0,
      hp: 25,
      armor: 5,
      mana: 3,
      military_order: 4,
    },
    special_ability: {
      nomad_fight_lv1_1: true,
    },
    training: {
      cost: {
        population: 1,
      },
      round: 2,
    },
  },
  Inquisition: {
    name: "宗教审判官",
    type: "ranged",
    image: "assets/military/soliders/Inquisition.jpg",
    quality: 'epic',
    equipments: {},
    basic_stats: {
      physical_attack: 4,
      spell_attack: 14,
      hp: 34,
      armor: 4,
      mana: 4,
      military_order: 2,
    },
    special_ability: {
      Inquisition_dark: true,
    },
    training: {
      cost: {
        population: 1,
      },
      round: 4,
    },
  },
};
