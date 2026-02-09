export const RACES = {
  human: {
    name: '人类',
    image: 'assets/races/human.jpg',
    base: {
      food: 1
    },
    district: 'farm',
    subraces: {
      a: {
        name: '平原种',
        district: 'trade',
        des: '剑专精+2 格斗类单位只需要食物维护 农田食物物产+1 每时代全学派升级+1',

      },
      b: {
        name: '高原种',
        district: 'mine',
        des: '斧专精+2 斧破甲+2 矿场矿物物产+1 每时代游牧学派升级+1',

      },
      c: {
        name: '海岛种',
        district: 'harbor',
        des: '弩专精+2 船只维护费-2每组 港口海产+1 每时代全学派升级+1',

      },
      d: {
        name: '沼泽种',
        district: 'academy',
        des: '灵能掌握+2 投矛投斧+2灵魂伤害 牧场畜牧+1 每时代咒术学派升级+1',

      },
      e: {
        name: '沙漠种',
        district: 'holy',
        des: '弓专精+2 骑兵攻击+d2  贸易区贸易路线+1 每时代全学派升级+1',

      }
    }
  },
  elf: {
    name: '精灵',
    district: 'academy',
    image: 'assets/races/elf.jpg',
    base: {
      food: 1,
      civil: 1,
    },
    subraces: {
      a: {
        name: '魔能种',
        district: 'entertainment',
        des: '',

      },
      b: {
        name: '咒能种',
        district: 'holy',
        des: '',

      },
      c: {
        name: '森林种',
        district: 'farm',
        des: '',

      },
      d: {
        name: '幽泉种',
        district: 'pasture',
        des: '',

      },
      e: {
        name: '潮汐种',
        district: 'harbor',
        des: '',

      },
      f: {
        name: '业火种',
        district: 'living',
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
    district: 'military',
    subraces: {
      a: {
        name: '邪刃种',
        district: 'holy',
        des: '',

      },
      b: {
        name: '霜狼种',
        district: 'pasture',
        des: '',

      },
      c: {
        name: '黑手种',
        district: 'mine',
        des: '',

      },
      d: {
        name: '战歌种',
        district: 'entertainment',
        des: '',

      },
      e: {
        name: '暗眼种',
        district: 'farm',
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
    district: 'military',
    subraces: {
      a: {
        name: '邪刃种',
        district: 'holy',
        des: '',

      },
      b: {
        name: '霜狼种',
        district: 'pasture',
        des: '',

      },
      c: {
        name: '黑手种',
        district: 'mine',
        des: '',

      },
      d: {
        name: '战歌种',
        district: 'entertainment',
        des: '',

      },
      e: {
        name: '暗眼种',
        district: 'farm',
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
    district: 'military',
    subraces: {
      a: {
        name: '邪刃种',
        district: 'holy',
        des: '',

      },
      b: {
        name: '霜狼种',
        district: 'pasture',
        des: '',

      },
      c: {
        name: '黑手种',
        district: 'mine',
        des: '',

      },
      d: {
        name: '战歌种',
        district: 'entertainment',
        des: '',

      },
      e: {
        name: '暗眼种',
        district: 'farm',
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
    district: 'military',
    subraces: {
      a: {
        name: '邪刃种',
        district: 'holy',
        des: '',

      },
      b: {
        name: '霜狼种',
        district: 'pasture',
        des: '',

      },
      c: {
        name: '黑手种',
        district: 'mine',
        des: '',

      },
      d: {
        name: '战歌种',
        district: 'entertainment',
        des: '',

      },
      e: {
        name: '暗眼种',
        district: 'farm',
        des: '',

      }
    }
  }, // Beastkin
  centaur: {
    name: '半人马',
    image: 'assets/races/human.jpg',
    base: {
      food: 1
    },
    district: 'military',
    subraces: {
      a: {
        name: '邪刃种',
        district: 'holy',
        des: '',

      },
      b: {
        name: '霜狼种',
        district: 'pasture',
        des: '',

      },
      c: {
        name: '黑手种',
        district: 'mine',
        des: '',

      },
      d: {
        name: '战歌种',
        district: 'entertainment',
        des: '',

      },
      e: {
        name: '暗眼种',
        district: 'farm',
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
    district: 'military',
    subraces: {
      a: {
        name: '邪刃种',
        district: 'holy',
        des: '',

      },
      b: {
        name: '霜狼种',
        district: 'pasture',
        des: '',

      },
      c: {
        name: '黑手种',
        district: 'mine',
        des: '',

      },
      d: {
        name: '战歌种',
        district: 'entertainment',
        des: '',

      },
      e: {
        name: '暗眼种',
        district: 'farm',
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
    district: 'military',
    subraces: {
      a: {
        name: '邪刃种',
        district: 'holy',
        des: '',

      },
      b: {
        name: '霜狼种',
        district: 'pasture',
        des: '',

      },
      c: {
        name: '黑手种',
        district: 'mine',
        des: '',

      },
      d: {
        name: '战歌种',
        district: 'entertainment',
        des: '',

      },
      e: {
        name: '暗眼种',
        district: 'farm',
        des: '',

      }
    }
  }, // Merfolk
  corvidian: {
    name: '鸦人',
    image: 'assets/races/human.jpg',
    base: {
      food: 1
    },
    district: 'military',
    subraces: {
      a: {
        name: '邪刃种',
        district: 'holy',
        des: '',

      },
      b: {
        name: '霜狼种',
        district: 'pasture',
        des: '',

      },
      c: {
        name: '黑手种',
        district: 'mine',
        des: '',

      },
      d: {
        name: '战歌种',
        district: 'entertainment',
        des: '',

      },
      e: {
        name: '暗眼种',
        district: 'farm',
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
    district: 'military',
    subraces: {
      a: {
        name: '邪刃种',
        district: 'holy',
        des: '',

      },
      b: {
        name: '霜狼种',
        district: 'pasture',
        des: '',

      },
      c: {
        name: '黑手种',
        district: 'mine',
        des: '',

      },
      d: {
        name: '战歌种',
        district: 'entertainment',
        des: '',

      },
      e: {
        name: '暗眼种',
        district: 'farm',
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
    district: 'military',
    subraces: {
      a: {
        name: '邪刃种',
        district: 'holy',
        des: '',

      },
      b: {
        name: '霜狼种',
        district: 'pasture',
        des: '',

      },
      c: {
        name: '黑手种',
        district: 'mine',
        des: '',

      },
      d: {
        name: '战歌种',
        district: 'entertainment',
        des: '',

      },
      e: {
        name: '暗眼种',
        district: 'farm',
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
    district: 'military',
    subraces: {
      a: {
        name: '邪刃种',
        district: 'holy',
        des: '',

      },
      b: {
        name: '霜狼种',
        district: 'pasture',
        des: '',

      },
      c: {
        name: '黑手种',
        district: 'mine',
        des: '',

      },
      d: {
        name: '战歌种',
        district: 'entertainment',
        des: '',

      },
      e: {
        name: '暗眼种',
        district: 'farm',
        des: '',

      }
    }
  }, // Undead
  primordial: {
    name: '元灵',
    image: 'assets/races/human.jpg',
    base: {
      food: 1
    },
    district: 'military',
    subraces: {
      a: {
        name: '邪刃种',
        district: 'holy',
        des: '',

      },
      b: {
        name: '霜狼种',
        district: 'pasture',
        des: '',

      },
      c: {
        name: '黑手种',
        district: 'mine',
        des: '',

      },
      d: {
        name: '战歌种',
        district: 'entertainment',
        des: '',

      },
      e: {
        name: '暗眼种',
        district: 'farm',
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
    district: 'military',
    subraces: {
      a: {
        name: '邪刃种',
        district: 'holy',
        des: '',

      },
      b: {
        name: '霜狼种',
        district: 'pasture',
        des: '',

      },
      c: {
        name: '黑手种',
        district: 'mine',
        des: '',

      },
      d: {
        name: '战歌种',
        district: 'entertainment',
        des: '',

      },
      e: {
        name: '暗眼种',
        district: 'farm',
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
    district: 'military',
    subraces: {
      a: {
        name: '邪刃种',
        district: 'holy',
        des: '',

      },
      b: {
        name: '霜狼种',
        district: 'pasture',
        des: '',

      },
      c: {
        name: '黑手种',
        district: 'mine',
        des: '',

      },
      d: {
        name: '战歌种',
        district: 'entertainment',
        des: '',

      },
      e: {
        name: '暗眼种',
        district: 'farm',
        des: '',

      }
    }
  }, // Ancient Revenant
  voidwalker: {
    name: '虚海渡人',
    image: 'assets/races/human.jpg',
    base: {
      food: 1
    },
    district: 'military',
    subraces: {
      a: {
        name: '邪刃种',
        district: 'holy',
        des: '',

      },
      b: {
        name: '霜狼种',
        district: 'pasture',
        des: '',

      },
      c: {
        name: '黑手种',
        district: 'mine',
        des: '',

      },
      d: {
        name: '战歌种',
        district: 'entertainment',
        des: '',

      },
      e: {
        name: '暗眼种',
        district: 'farm',
        des: '',

      }
    }
  } // Voidwalker

};
