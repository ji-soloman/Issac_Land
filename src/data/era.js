import { REGION } from './region.js';

// 时代配置表
//
// 时代晋升规则：
//   时代不再由某个建筑/区域直接触发。每个回合【所有结算完成之后】（见 gameScene.js 的
//   checkEraPromotion），检查"下一个时代"的 mission 是否全部完成，全部完成就晋升到该时代
//   （每回合最多晋升一个时代）。
//
// 字段说明：
//   name    时代名称
//   order   时代顺序
//   mission 进入该时代需要完成的要求：{ 序号: { info, filter } }
//           info    要求的文字说明
//           filter({ savedata, scene }) → boolean，返回 true 表示这条要求已完成
//           target  （可选）需要完成的数量，默认 1；显示为 (当前/target)，如 (0/1)
//           progress({ savedata, scene }) → number（可选）当前完成的数量。
//                   有数量要求（target > 1）的要求写这个：当前数量 >= target 视为完成，
//                   此时不再使用 filter；没写 progress 的要求按 filter 判断，
//                   完成显示 (target/target)，未完成显示 (0/target)。
//           没有 mission 的时代（或者 mission 里缺 filter 的要求）视为"暂时无法晋升进入"。

// ── 判断辅助 ─────────────────────────────────────────

/** 遍历所有格点：[gridId, gridData] */
function allGrids(savedata) {
  return Object.entries(savedata?.map?.grids ?? {});
}

/** 该格点是否已建成【圣地】类区域（REGION 里 category.holy 的区域，含元灵专属的圣地） */
function isHolyGrid(gn) {
  return !!(gn?.region && REGION[gn.region]?.category?.holy);
}

export const ERA = {
  primitive: {
    name: '原始时代',
    intro: '',
    order: 1,
  },
  slave: {
    name: '奴隶时代',
    intro: '',
    order: 2,
    mission: {
      1: {
        info: '建造1个区域【圣地】',
        filter({ savedata }) {
          return allGrids(savedata).some(([, gn]) => isHolyGrid(gn));
        },
      }
    }
  },
  asiaMinor: {
    name: '小亚细亚之战',
    intro: '',
    order: 3,
    mission: {
      1: {
        info: '在【圣地】建造1个建筑【神殿】',
        filter({ savedata }) {
          return allGrids(savedata).some(([, gn]) => isHolyGrid(gn) && !!gn.buildings?.temple);
        },
      }
    }
  },
  empire: {
    name: '帝国时代',
    intro: '',
    order: 4,
    mission: {
      1: {
        info: '解锁科技【王权】',
        filter: function () { },
      },
      2: {
        info: '将任意主城升级为任意首都王城',
        filter: function () { },
      }
    }
  },
  attila: {
    name: '阿提拉',
    intro: '',
    order: 5,
  },
  dark: {
    name: '黑暗时代',
    intro: '',
    order: 6,
  },
  plague: {
    name: '大瘟疫',
    intro: '',
    order: 7,
  },
  renaissance: {
    name: '文艺复兴',
    intro: '',
    order: 8,
  },
  voyage: {
    name: '大航海',
    intro: '',
    order: 9,
  },
  victoria: {
    name: '维多利亚时代',
    intro: '',
    order: 10,
  },
}

/**
 * 查询"进入下一个时代"的任务完成情况（顶部任务面板显示、回合末晋升判断共用同一份结果）。
 * @returns {{ nextKey: string, nextEra: object, missions: { info: string, done: boolean, current: number, target: number }[] } | null}
 *          已经是最后一个时代时返回 null；下一个时代没有配置 mission 时 missions 为空数组。
 */
export function getNextEraMissions(savedata, scene) {
  const currentKey = savedata?.process?.era ?? 'primitive';
  const currentOrder = ERA[currentKey]?.order;
  if (currentOrder == null) return null;

  const nextEntry = Object.entries(ERA).find(([, era]) => era.order === currentOrder + 1);
  if (!nextEntry) return null;
  const [nextKey, nextEra] = nextEntry;

  const missions = Object.values(nextEra.mission ?? {}).map(m => {
    const target = Math.max(1, Number(m?.target) || 1);
    const ctx = { savedata, scene };
    let current = 0;
    let done = false;
    // 没有 filter / progress 的要求视为未完成；判断函数抛错也按未完成处理
    try {
      if (typeof m?.progress === 'function') {
        current = Math.max(0, Math.min(target, Number(m.progress(ctx)) || 0));
        done = current >= target;
      } else if (typeof m?.filter === 'function') {
        done = !!m.filter(ctx);
        current = done ? target : 0;
      }
    } catch (err) {
      console.error(`时代要求判断出错 [${nextKey}] ${m?.info ?? ''}:`, err);
      current = 0;
      done = false;
    }
    return { info: m?.info ?? '', done, current, target };
  });
  return { nextKey, nextEra, missions };
}