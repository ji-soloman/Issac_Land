// src/world/createInitialWorld.js

export function createInitialWorld(options) {
  const {
    civilizationName,
    capitalName,
    raceId,
    tarotId,
    developmentChoices
  } = options;

  return {
    timeline: {
      turn: 1,
      phase: 'primitive',     // 原始人
      government: 'tribal',   // 酋邦
      era: 'primitive'        // 原始时代
    },

    civilization: {
      name: civilizationName,
      capitalName,
      race: raceId,
      tarot: tarotId,
      developmentChoices: {
        district: !!developmentChoices.district,
        trait: !!developmentChoices.trait,
        troop: !!developmentChoices.troop
      }
    },

    resources: {
      food: 0,
      culture: 0,
      wealth: 0,
      mana: 0
    },

    map: {
      abstractionLevel: 'region',
      size: {
        width: 3,
        height: 3
      },
      buildings: {}
    },

    systems: {
      actions: {
        civilianUsed: 0,
        militaryUsed: 0,
        operationUsed: 0
      },

      tech: {
        unlocked: []
      },

      policies: {
        owned: [],
        active: []
      }
    }
  };
}
