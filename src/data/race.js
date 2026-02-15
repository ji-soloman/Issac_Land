export const RACES = {
  human: {
    name: '人类',
    image: 'assets/races/human.jpg',
    base: {
      food: 1
    },
    region: 'farm',
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
        des: '弓专精+2 骑兵攻击+d2  贸易区贸易路线+1 每时代全学派升级+1',

      }
    }
  },
  elf: {
    name: '精灵',
    region: 'academy',
    image: 'assets/races/elf.jpg',
    base: {
      food: 1,
      civil: 1,
    },
    subraces: {
      a: {
        name: '魔能种',
        region: 'entertainment',
        des: '',

      },
      b: {
        name: '咒能种',
        region: 'holy',
        des: '',

      },
      c: {
        name: '森林种',
        region: 'farm',
        des: '',

      },
      d: {
        name: '幽泉种',
        region: 'pasture',
        des: '',

      },
      e: {
        name: '潮汐种',
        region: 'harbor',
        des: '',

      },
      f: {
        name: '业火种',
        region: 'living',
        des: '',

      },
    }
  },
  orc: {
    name: '兽人',
    image: 'assets/races/orc.jpg',
    base: {
      food: 1
    },
    region: 'military',
    subraces: {
      a: {
        name: '邪刃种',
        region: 'holy',
        des: '',

      },
      b: {
        name: '霜狼种',
        region: 'pasture',
        des: '',

      },
      c: {
        name: '黑手种',
        region: 'mine',
        des: '',

      },
      d: {
        name: '战歌种',
        region: 'entertainment',
        des: '',

      },
      e: {
        name: '暗眼种',
        region: 'farm',
        des: '',

      }
    }
  },
  dwarf: {
    name: '矮人',
    image: 'assets/races/elf.jpg',
    base: {
      food: 1
    },
    region: 'military',
    subraces: {
      a: {
        name: '邪刃种',
        region: 'holy',
        des: '',

      },
      b: {
        name: '霜狼种',
        region: 'pasture',
        des: '',

      },
      c: {
        name: '黑手种',
        region: 'mine',
        des: '',

      },
      d: {
        name: '战歌种',
        region: 'entertainment',
        des: '',

      },
      e: {
        name: '暗眼种',
        region: 'farm',
        des: '',

      }
    }
  }, // Dwarf
  goblin: {
    name: '地精',
    image: 'assets/races/human.jpg',
    base: {
      food: 1
    },
    region: 'military',
    subraces: {
      a: {
        name: '邪刃种',
        region: 'holy',
        des: '',

      },
      b: {
        name: '霜狼种',
        region: 'pasture',
        des: '',

      },
      c: {
        name: '黑手种',
        region: 'mine',
        des: '',

      },
      d: {
        name: '战歌种',
        region: 'entertainment',
        des: '',

      },
      e: {
        name: '暗眼种',
        region: 'farm',
        des: '',

      }
    }
  }, // Goblin
  beastkin: {
    name: '兽耳人',
    image: 'assets/races/human.jpg',
    base: {
      food: 1
    },
    region: 'military',
    subraces: {
      a: {
        name: '邪刃种',
        region: 'holy',
        des: '',

      },
      b: {
        name: '霜狼种',
        region: 'pasture',
        des: '',

      },
      c: {
        name: '黑手种',
        region: 'mine',
        des: '',

      },
      d: {
        name: '战歌种',
        region: 'entertainment',
        des: '',

      },
      e: {
        name: '暗眼种',
        region: 'farm',
        des: '',

      }
    }
  }, // Beastkin
  centaur: {
    name: '半人马',
    image: 'assets/races/centaur.jpg',
    base: {
      food: 1
    },
    region: 'military',
    subraces: {
      a: {
        name: '邪刃种',
        region: 'holy',
        des: '',

      },
      b: {
        name: '霜狼种',
        region: 'pasture',
        des: '',

      },
      c: {
        name: '黑手种',
        region: 'mine',
        des: '',

      },
      d: {
        name: '战歌种',
        region: 'entertainment',
        des: '',

      },
      e: {
        name: '暗眼种',
        region: 'farm',
        des: '',

      }
    }
  }, // Centaur
  lizardfolk: {
    name: '蜥蜴人',
    image: 'assets/races/human.jpg',
    base: {
      food: 1
    },
    region: 'military',
    subraces: {
      a: {
        name: '邪刃种',
        region: 'holy',
        des: '',

      },
      b: {
        name: '霜狼种',
        region: 'pasture',
        des: '',

      },
      c: {
        name: '黑手种',
        region: 'mine',
        des: '',

      },
      d: {
        name: '战歌种',
        region: 'entertainment',
        des: '',

      },
      e: {
        name: '暗眼种',
        region: 'farm',
        des: '',

      }
    }
  }, // Lizardfolk
  merfolk: {
    name: '人鱼',
    image: 'assets/races/human.jpg',
    base: {
      food: 1
    },
    region: 'military',
    subraces: {
      a: {
        name: '邪刃种',
        region: 'holy',
        des: '',

      },
      b: {
        name: '霜狼种',
        region: 'pasture',
        des: '',

      },
      c: {
        name: '黑手种',
        region: 'mine',
        des: '',

      },
      d: {
        name: '战歌种',
        region: 'entertainment',
        des: '',

      },
      e: {
        name: '暗眼种',
        region: 'farm',
        des: '',

      }
    }
  }, // Merfolk
  corvidian: {
    name: '鸦人',
    image: 'assets/races/corvidian.jpg',
    base: {
      food: 1
    },
    region: 'military',
    subraces: {
      a: {
        name: '邪刃种',
        region: 'holy',
        des: '',

      },
      b: {
        name: '霜狼种',
        region: 'pasture',
        des: '',

      },
      c: {
        name: '黑手种',
        region: 'mine',
        des: '',

      },
      d: {
        name: '战歌种',
        region: 'entertainment',
        des: '',

      },
      e: {
        name: '暗眼种',
        region: 'farm',
        des: '',

      }
    }
  }, // Corvidian
  insectoid: {
    name: '虫人',
    image: 'assets/races/human.jpg',
    base: {
      food: 1
    },
    region: 'military',
    subraces: {
      a: {
        name: '邪刃种',
        region: 'holy',
        des: '',

      },
      b: {
        name: '霜狼种',
        region: 'pasture',
        des: '',

      },
      c: {
        name: '黑手种',
        region: 'mine',
        des: '',

      },
      d: {
        name: '战歌种',
        region: 'entertainment',
        des: '',

      },
      e: {
        name: '暗眼种',
        region: 'farm',
        des: '',

      }
    }
  }, // Insectoid
  plantfolk: {
    name: '植物',
    image: 'assets/races/human.jpg',
    base: {
      food: 1
    },
    region: 'military',
    subraces: {
      a: {
        name: '邪刃种',
        region: 'holy',
        des: '',

      },
      b: {
        name: '霜狼种',
        region: 'pasture',
        des: '',

      },
      c: {
        name: '黑手种',
        region: 'mine',
        des: '',

      },
      d: {
        name: '战歌种',
        region: 'entertainment',
        des: '',

      },
      e: {
        name: '暗眼种',
        region: 'farm',
        des: '',

      }
    }
  }, // Plantfolk
  undead: {
    name: '亡灵',
    image: 'assets/races/human.jpg',
    base: {
      food: 1
    },
    region: 'military',
    subraces: {
      a: {
        name: '邪刃种',
        region: 'holy',
        des: '',

      },
      b: {
        name: '霜狼种',
        region: 'pasture',
        des: '',

      },
      c: {
        name: '黑手种',
        region: 'mine',
        des: '',

      },
      d: {
        name: '战歌种',
        region: 'entertainment',
        des: '',

      },
      e: {
        name: '暗眼种',
        region: 'farm',
        des: '',

      }
    }
  }, // Undead
  primordial: {
    name: '元灵',
    image: 'assets/races/primordial.jpg',
    base: {
      food: 1
    },
    region: 'military',
    subraces: {
      a: {
        name: '邪刃种',
        region: 'holy',
        des: '',

      },
      b: {
        name: '霜狼种',
        region: 'pasture',
        des: '',

      },
      c: {
        name: '黑手种',
        region: 'mine',
        des: '',

      },
      d: {
        name: '战歌种',
        region: 'entertainment',
        des: '',

      },
      e: {
        name: '暗眼种',
        region: 'farm',
        des: '',

      }
    }
  }, // Primordial
  giant: {
    name: '巨人',
    image: 'assets/races/human.jpg',
    base: {
      food: 1
    },
    region: 'military',
    subraces: {
      a: {
        name: '邪刃种',
        region: 'holy',
        des: '',

      },
      b: {
        name: '霜狼种',
        region: 'pasture',
        des: '',

      },
      c: {
        name: '黑手种',
        region: 'mine',
        des: '',

      },
      d: {
        name: '战歌种',
        region: 'entertainment',
        des: '',

      },
      e: {
        name: '暗眼种',
        region: 'farm',
        des: '',

      }
    }
  }, // Giant
  ancient: {
    name: '复苏古人',
    image: 'assets/races/human.jpg',
    base: {
      food: 1
    },
    region: 'military',
    subraces: {
      a: {
        name: '邪刃种',
        region: 'holy',
        des: '',

      },
      b: {
        name: '霜狼种',
        region: 'pasture',
        des: '',

      },
      c: {
        name: '黑手种',
        region: 'mine',
        des: '',

      },
      d: {
        name: '战歌种',
        region: 'entertainment',
        des: '',

      },
      e: {
        name: '暗眼种',
        region: 'farm',
        des: '',

      }
    }
  }, // Ancient Revenant
  voidwalker: {
    name: '虚海渡人',
    image: 'assets/races/voidwalker.jpg',
    base: {
      food: 1
    },
    region: 'military',
    subraces: {
      a: {
        name: '邪刃种',
        region: 'holy',
        des: '',

      },
      b: {
        name: '霜狼种',
        region: 'pasture',
        des: '',

      },
      c: {
        name: '黑手种',
        region: 'mine',
        des: '',

      },
      d: {
        name: '战歌种',
        region: 'entertainment',
        des: '',

      },
      e: {
        name: '暗眼种',
        region: 'farm',
        des: '',

      }
    }
  } // Voidwalker

};
