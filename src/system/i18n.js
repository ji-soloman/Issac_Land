import { translation } from '../data/translate.js';
import { MILITARY_TRANSLATE } from '../data/military_translate.js';
import { ERA } from '../data/era.js';
import { REGION } from '../data/region.js';

export const get = {
  translation(key) {
    return translation[key] ?? key;
  },
  militaryTranslation(key) {
    return MILITARY_TRANSLATE[key] ?? key;
  },
  actionNum(data) {
    const result = {
      civil: 0,
      military: 0,
      others: Infinity
    };

    if (!data?.process?.era) return result;

    const era = data.process.era;
    const eraConfig = ERA?.[era]?.action;

    if (!eraConfig) return result;

    let civil = eraConfig.civil || 0;
    let military = eraConfig.military || 0;

    const grids = data?.map?.grids;
    if (grids) {
      let extraMilitary = 0;

      for (const key in grids) {
        if (extraMilitary >= 3) break;

        const gn = grids[key];
        const region = gn?.region;

        if (
          region &&
          REGION?.[region]?.category?.military === true
        ) {
          extraMilitary++;
        }
      }

      military += extraMilitary;
    }

    result.civil = civil;
    result.military = military;

    return result;
  },
};
