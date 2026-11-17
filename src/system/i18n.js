import { translation } from '../data/translate.js';
import { MILITARY_TRANSLATE } from '../data/military_translate.js';
import { REGION } from '../data/region.js';
import { BUILDING } from '../data/building.js';

export const get = {
  translation(key) {
    return translation[key] ?? key;
  },
  militaryTranslation(key) {
    return MILITARY_TRANSLATE[key] ?? key;
  },
  actionNum(data) {
    // civil（民生行动）/ military（军事行动）基础上限各为 2，后续可通过建筑、政策等方式叠加
    const result = {
      civil: 2,
      military: 2,
      others: Infinity,
    };

    // 军事区每个 +1 military 上限，最多叠加 3 个
    const grids = data?.map?.grids;
    if (grids) {
      // 驻扎消耗付不起的区域 / 建筑（见 function.js settleGarrison 写入的 data.garrison_status）本回合不提供行动条
      // （这里不能 import function.js —— 它反过来依赖本文件，所以直接读状态）
      const garrisonOff = (gridId, kind, key) => {
        const st = data?.garrison_status?.[gridId];
        if (!st) return false;
        return kind === 'region' ? st.region === false : st.buildings?.[key] === false;
      };
      let extraMilitary = 0;
      for (const key in grids) {
        if (extraMilitary >= 3) break;
        const region = grids[key]?.region;
        if (garrisonOff(key, 'region')) continue;
        if (region && REGION?.[region]?.category?.military === true) {
          extraMilitary++;
        }
      }
      result.military += extraMilitary;

      // 已建成的区域：effect.normal.civil_action / military_action 同样直接叠加（不受上面“最多3个”限制，
      // 例如铁血要塞的“军事改革额外+1”）
      for (const [gid, grid] of Object.entries(grids)) {
        const normal = grid?.region ? REGION?.[grid.region]?.effect?.normal : null;
        if (!normal) continue;
        if (garrisonOff(gid, 'region')) continue;
        if (typeof normal.civil_action === 'number') result.civil += normal.civil_action;
        if (typeof normal.military_action === 'number') result.military += normal.military_action;
      }

      // 已建成的建筑：effect.normal.civil_action / military_action 直接叠加到对应行动上限
      // （建造中的建筑不计入；同一建筑每建成一座生效一次）
      for (const [gid, grid] of Object.entries(grids)) {
        for (const [buildingKey, built] of Object.entries(grid?.buildings ?? {})) {
          if (!built) continue;
          const normal = BUILDING?.[buildingKey]?.effect?.normal;
          if (!normal) continue;
          if (garrisonOff(gid, 'building', buildingKey)) continue;
          if (typeof normal.civil_action === 'number') result.civil += normal.civil_action;
          if (typeof normal.military_action === 'number') result.military += normal.military_action;
        }
      }
    }

    return result;
  },
};