export const DUNGEON = {
  1: {
    name: '埃及侍女',
    image:'assets/dungeon/select/1.png',
    units: {
      1: {
        name: '埃及侍女',
        type: "ranged",
        image: "assets/dungeon/boss/1.png",
        equipments: {},
        basic_stats: {
          physical_attack: 4,
          spell_attack: 12,
          hp: 60,
          armor: 25,
          mana: 100,
          military_order: 3,
        },
        special_ability: {
          magic_fire_lv1_1: true,
          magic_fire_lv3_1: true,
          magic_ice_lv2_1: true,
        },
        init_buff:{
          16:true,
          15:true,
        }
      },
      2: {
        name: '低等女佣',
        type: "ranged",
        image: "assets/dungeon/boss/2.png",
        equipments: {},
        basic_stats: {
          physical_attack: 0,
          spell_attack: 6,
          hp: 30,
          armor: 12,
          mana: 10,
          military_order: 5,
        },
        special_ability: {
          magic_ice_lv2_1: true,
          magic_ice_lv1_1: true,
        },
        init_buff:{
          15:true,
          20:true,
        }
      },
    },
    team:['2','2','1','1'],
    position:'defend'
  }
}