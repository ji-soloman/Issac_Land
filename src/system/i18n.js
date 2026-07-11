import { translation } from '../data/translate.js';
import { MILITARY_TRANSLATE } from '../data/military_translate.js';
import { REGION } from '../data/region.js';

export const get = {
  translation(key) {
    return translation[key] ?? key;
  },
  militaryTranslation(key) {
    return MILITARY_TRANSLATE[key] ?? key;
  },
  actionNum(data) {
    // civil / military 基础上限各为 2，后续可通过建筑、政策等方式叠加
    const result = {
      civil: 2,
      military: 2,
      others: Infinity,
    };

    // 军事区每个 +1 military 上限，最多叠加 3 个
    const grids = data?.map?.grids;
    if (grids) {
      let extraMilitary = 0;
      for (const key in grids) {
        if (extraMilitary >= 3) break;
        const region = grids[key]?.region;
        if (region && REGION?.[region]?.category?.military === true) {
          extraMilitary++;
        }
      }
      result.military += extraMilitary;
    }

    return result;
  },
};