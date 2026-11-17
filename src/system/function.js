import { get } from '../system/i18n.js';
import { saveSystem } from '../system/saveSystem.js';
import { REGION } from '../data/region.js';
import { BUILDING } from '../data/building.js';
import { RACES, applyRaceCostMods } from '../data/race.js';

// ═══════════════════════════════════════════════════
// 驻扎人口
// ═══════════════════════════════════════════════════
// 区域 / 建筑可以声明：
//   garrison       驻扎人口数（数值）。建造前：所在城池【空闲人口】必须多于该数值；
//                  确认建造（进入行动列表）后这部分人口就被锁定：不能用于训练士兵等其他消耗，也不能再给其他驻扎区域/建筑用，
//                  依旧占城池总人数（住房、繁衍照常算），但不再产生人头税。
//   garrison_cost  （可选）每个驻扎人口每回合的【额外】资源消耗，写法同 cost，如 { magic: 1 }。
// 每回合结算（gameScene 第 3.8 步）：每个已建成的驻扎区域/建筑要支付
//   驻扎人数 × （种族繁育单价 + garrison_cost）的资源（繁育单价 = race.breeding 经种族 breed 修正后的单价，
//   例如人类 1 食物、巨人 2 食物），付不起（资源不足）就整体失效：该区域/建筑本回合的
//   effect.turn（回合资源）、以及非永久类的 effect.normal（额外行动条、科技研究 / 训练回合减少、科技文化消耗减免……）全部不生效。
//   永久类（已解锁就是解锁了）不受影响：住房、各类槽位（*_slot，如额外学派 school_slot）、各兵种人口上限。
// 结果记录在 saveData.garrison_status：{ [gridId]: { region: boolean, buildings: { [key]: boolean } } }，缺省 = 生效。
const UNIT_POP_KEYS = ['scout', 'fighting', 'ranged', 'boat', 'cavalry', 'infantry', 'beast', 'special_type'];
export function isPermanentNormalKey(key) {
  return key === 'housing' || key.endsWith('_slot') || UNIT_POP_KEYS.includes(key);
}

export const game = {
  addAction(type, name, config, callbacks = {}) {
    const saveData = saveSystem.currentSaveData;

    if (!saveData.actionList) saveData.actionList = {};
    if (!saveData.actionList[type]) saveData.actionList[type] = {};

    const actionNum = get.actionNum(saveData)[type];
    const currentNum = Object.keys(saveData.actionList[type]).length;

    if (actionNum <= currentNum) {
      callbacks.onFail?.({
        type,
        name,
        config,
        reason: 'limit'
      });
      callbacks.onComplete?.(false);
      return false;
    }

    saveData.actionList[type][name] = config;

    saveSystem.save().then(() => {
      callbacks.onSuccess?.({
        type,
        name,
        config
      });
    });

    callbacks.onComplete?.(true);
    return true;
  },
  //   game.addAction('civil', 'build_region_1', data, {
  //   onSuccess() {
  //     console.log('添加成功');
  //   },
  //   onFail(info) {
  //     console.log('失败原因:', info.reason);
  //   },
  //   onComplete(ok) {
  //     console.log('结束:', ok);
  //   }
  // });
  /**
   * 检测某种行动类型是否还有可用行动条（剩余数量 > 0）
   * @param {'military'|'civil'|'others'} type
   * @returns {boolean}
   *
   * 用法示例：
   *   game.hasAvailableAction('military')  // 是否还有军事行动条
   */
  hasAvailableAction(type) {
    return this.remainingActions(type) > 0;
  },

  /**
   * 返回某种行动类型的剩余可用行动条数量
   * @param {'military'|'civil'|'others'} type
   * @returns {number}  剩余数量（上限 - 已使用；others 无上限返回 Infinity）
   *
   * 用法示例：
   *   game.remainingActions('military')  // 军事行动剩余条数
   */
  remainingActions(type) {
    const saveData = saveSystem.currentSaveData;
    if (!saveData) return 0;
    const limit = get.actionNum(saveData)[type];
    if (limit === Infinity) return Infinity;
    const current = Object.keys(saveData.actionList?.[type] ?? {}).length;
    return Math.max(0, limit - current);
  },

  /**
   * 汇总全部已建成区域（grid.region）的 effect.normal[key]（全局，不分城市）。
   * 用于“科技研究回合数-1”“训练回合数-1”“科技文化消耗-5”这类全局数值加成（王城特区使用）。
   * 值支持数值，或 ({ grid }) => 数值 的函数写法；建造中的区域（createRegion）不计入。
   * @returns {{ total: number, parts: Array<{ source: string, value: number }> }}
   */
  getRegionNormalSum(saveData, key) {
    const parts = [];
    let total = 0;
    for (const [gid, g] of Object.entries(saveData?.map?.grids ?? {})) {
      const cfg = g?.region ? REGION[g.region] : null;
      // 驻扎消耗付不起的区域：只保留永久类效果（住房 / 槽位 / 兵种人口上限），其余增益本回合失效
      if (!isPermanentNormalKey(key) && !this.isGarrisonActive(saveData, gid, 'region')) continue;
      const v = cfg?.effect?.normal?.[key];
      const n = typeof v === 'function' ? v({ grid: g }) : v;
      if (typeof n === 'number' && !Number.isNaN(n) && n !== 0) {
        total += n;
        parts.push({ source: cfg.name, value: n });
      }
    }
    return { total, parts };
  },

  /**
   * 返回某个格点所属城市的主城格点 id：
   *   主城自己 → 自己的 gridId；分城格点 → hasMain（所属主城）；野地/未知格点 → null
   */
  getCityId(grids, gridId) {
    const g = grids?.[gridId];
    if (!g) return null;
    if (g.isMain) return gridId;
    return g.hasMain ?? null;
  },

  /**
   * 城市总住房量：该城（主城 + 全部分城格点）所有已建成区域、已建成建筑的 effect.normal.housing 之和。
   * 主城默认的 2 点住房写在 REGION.main.effect.normal.housing 里（主城格点的 region 就是 main）。
   * housing 支持数值，或 ({ grid }) => 数值 的函数写法。建造中的区域/建筑不计入。
   * @returns {{ total: number, parts: Array<{ source: string, value: number }> }}
   */
  getCityHousing(saveData, gridId) {
    const grids = saveData?.map?.grids ?? {};
    const cityId = this.getCityId(grids, gridId);
    const parts = [];
    let total = 0;
    if (!cityId) return { total, parts };

    const calc = (cfg, grid) => {
      const v = cfg?.effect?.normal?.housing;
      const n = typeof v === 'function' ? v({ grid }) : v;
      return typeof n === 'number' && !Number.isNaN(n) ? n : 0;
    };

    for (const [gid, g] of Object.entries(grids)) {
      if (this.getCityId(grids, gid) !== cityId) continue;
      if (g.region && REGION[g.region]) {
        const n = calc(REGION[g.region], g);
        if (n) { total += n; parts.push({ source: REGION[g.region].name, value: n }); }
      }
      for (const [bKey, built] of Object.entries(g.buildings ?? {})) {
        if (!built || !BUILDING[bKey]) continue;
        const n = calc(BUILDING[bKey], g);
        if (n) { total += n; parts.push({ source: BUILDING[bKey].name, value: n }); }
      }
    }
    return { total, parts };
  },

  /**
   * 【城市唯一】建筑查重：在 gridId 所属城市（主城 + 其全部分城格点）里，
   * 查找建筑 buildingKey 是否已建成 / 正在建造 / 已在本回合民生行动里排队。
   * 不同城市互不影响，各自最多一座。
   * @returns {{ gridId: string, status: 'built'|'building' } | null}  找到则返回所在格点和状态
   */
  findUniqueBuildingInCity(saveData, gridId, buildingKey) {
    const grids = saveData?.map?.grids ?? {};
    const cityId = this.getCityId(grids, gridId);
    if (!cityId) return null;

    const civil = saveData?.actionList?.civil ?? {};
    let building = null;
    for (const [gid, g] of Object.entries(grids)) {
      if (this.getCityId(grids, gid) !== cityId) continue;
      if (g.buildings?.[buildingKey]) return { gridId: gid, status: 'built' };
      if (!building && (g.createBuilding?.[buildingKey] || civil[`build_building_${gid}_${buildingKey}`])) {
        building = { gridId: gid, status: 'building' };
      }
    }
    return building;
  },

  // ── 驻扎人口 ──────────────────────────────────────

  /** 区域 / 建筑配置的驻扎人口数（没有 = 0） */
  getGarrisonCount(cfg) {
    const n = Math.floor(Number(cfg?.garrison) || 0);
    return n > 0 ? n : 0;
  },

  /**
   * 某城池（gridId 所属主城）被锁定的驻扎人口：
   *   已建成 / 建造中 / （opts.pending !== false 时）还在本回合行动列表里的 区域、建筑 的 garrison 之和。
   * 回合结算内部调用时传 { pending: false }：此时行动已经落到 createRegion / createBuilding，不能重复计算。
   * @returns {{ total: number, parts: Array<{ source: string, count: number }> }}
   */
  getGarrisonLocked(saveData, gridId, opts = {}) {
    const grids = saveData?.map?.grids ?? {};
    const cityId = this.getCityId(grids, gridId);
    const parts = [];
    let total = 0;
    if (!cityId) return { total, parts };
    const add = (source, n) => {
      if (n > 0) { total += n; parts.push({ source, count: n }); }
    };
    const regionOf = (key, suffix = '') => add((REGION[key]?.name ?? key) + suffix, this.getGarrisonCount(REGION[key]));
    const buildingOf = (key, suffix = '') => add((BUILDING[key]?.name ?? key) + suffix, this.getGarrisonCount(BUILDING[key]));

    for (const [gid, g] of Object.entries(grids)) {
      if (this.getCityId(grids, gid) !== cityId) continue;
      if (g.region) regionOf(g.region);
      if (g.createRegion?.targetRegion) regionOf(g.createRegion.targetRegion, '（建造中）');
      for (const [bKey, built] of Object.entries(g.buildings ?? {})) {
        if (built) buildingOf(bKey);
      }
      for (const bKey of Object.keys(g.createBuilding ?? {})) buildingOf(bKey, '（建造中）');
    }

    if (opts.pending !== false) {
      for (const [k, v] of Object.entries(saveData?.actionList?.civil ?? {})) {
        if (!v || this.getCityId(grids, v.gridId) !== cityId) continue;
        if (k.startsWith('build_region_') || k.startsWith('upgrade_region_')) regionOf(v.regionKey, '（待建造）');
        else if (k.startsWith('build_building_')) buildingOf(v.buildingKey, '（待建造）');
      }
    }
    return { total, parts };
  },

  /** 城池当前总人口（人口记在主城格点的 population 上） */
  getCityPopulation(saveData, gridId) {
    const grids = saveData?.map?.grids ?? {};
    const cityId = this.getCityId(grids, gridId);
    return cityId ? (grids[cityId]?.population ?? 0) : 0;
  },

  /** 城池空闲人口 = 总人口 − 被锁定的驻扎人口（训练士兵等只能用空闲人口；人头税也只按空闲人口算） */
  getCityFreePopulation(saveData, gridId, opts = {}) {
    const locked = this.getGarrisonLocked(saveData, gridId, opts).total;
    return Math.max(0, this.getCityPopulation(saveData, gridId) - locked);
  },

  /**
   * 在 gridId 所在城池建造 / 升级成 cfg（REGION 或 BUILDING 的配置）时，驻扎人口是否满足。
   * 规则：空闲人口必须【多于】驻扎人数。
   * @returns {string|null} null = 满足（或不需要驻扎）；否则返回不能建造的原因
   */
  getGarrisonBlockReason(saveData, gridId, cfg) {
    const need = this.getGarrisonCount(cfg);
    if (!need) return null;
    const free = this.getCityFreePopulation(saveData, gridId);
    if (free <= need) return `空闲人口不足：需要多于 ${need}（当前空闲 ${free}）`;
    return null;
  },

  /** 种族繁育单价（race.breeding 经种族 breed 修正，允许小数），如人类 { food: 1 }、巨人 { food: 2 } */
  getBreedUnitCost(saveData, gridId) {
    const base = { ...(RACES[saveData?.race]?.breeding ?? {}) };
    return applyRaceCostMods(
      'breed', base, saveData?.race, saveData?.subRace,
      { data: saveData, gridId }, { round: false }
    );
  },

  /**
   * 驻扎每回合的资源消耗 = 驻扎人数 × （种族繁育单价 + garrison_cost），每项向上取整。
   * @returns {Object} 如 { food: 4 }
   */
  getGarrisonUpkeep(saveData, gridId, cfg) {
    const n = this.getGarrisonCount(cfg);
    if (!n) return {};
    const unit = this.getBreedUnitCost(saveData, gridId);
    const extra = cfg?.garrison_cost ?? {};
    const cost = {};
    for (const res of new Set([...Object.keys(unit), ...Object.keys(extra)])) {
      const v = Math.ceil(n * ((unit[res] ?? 0) + (extra[res] ?? 0)) - 1e-9);
      if (v > 0) cost[res] = v;
    }
    return cost;
  },

  /**
   * 全部已建成驻扎区域 / 建筑的每回合驻扎消耗汇总（按资源），和 settleGarrison 支付的是同一份 getGarrisonUpkeep。
   * 用于顶栏资源悬浮窗显示“回合消耗”；是满额应付数（不看本回合有没有付得起）。
   * @returns {{ total: Object, parts: Array<{ source: string, cost: Object }> }}  total 如 { food: 8 }
   */
  getGarrisonUpkeepTotal(saveData) {
    const total = {};
    const parts = [];
    const add = (gridId, cfg) => {
      if (!this.getGarrisonCount(cfg)) return;
      const cost = this.getGarrisonUpkeep(saveData, gridId, cfg);
      if (!Object.keys(cost).length) return;
      for (const [r, v] of Object.entries(cost)) total[r] = (total[r] ?? 0) + v;
      parts.push({ source: cfg.name, cost });
    };
    for (const [gid, g] of Object.entries(saveData?.map?.grids ?? {})) {
      if (g.region && REGION[g.region]) add(gid, REGION[g.region]);
      for (const [bKey, built] of Object.entries(g.buildings ?? {})) {
        if (built && BUILDING[bKey]) add(gid, BUILDING[bKey]);
      }
    }
    return { total, parts };
  },

  /** 某区域 / 建筑本回合是否生效（驻扎消耗付得起；没有驻扎、或还没结算过 = 生效） */
  isGarrisonActive(saveData, gridId, kind, key) {
    const st = saveData?.garrison_status?.[gridId];
    if (!st) return true;
    return kind === 'region' ? st.region !== false : st.buildings?.[key] !== false;
  },

  /**
   * 回合结算：依次让每个已建成的驻扎区域 / 建筑支付驻扎消耗（从当前资源里扣，付不起就整体失效、不扣），
   * 结果写入 saveData.garrison_status，并返回报告。每回合调用一次（gameScene 第 3.8 步，在计算下回合收益之前）。
   * @returns {Array<{ gridId: string, source: string, cost: Object, ok: boolean }>}
   */
  settleGarrison(saveData) {
    saveData.garrison_status = {};
    saveData.resource ??= {};
    const res = saveData.resource;
    const report = [];

    const pay = (gridId, kind, key, cfg) => {
      if (!this.getGarrisonCount(cfg)) return;
      const cost = this.getGarrisonUpkeep(saveData, gridId, cfg);
      const ok = Object.entries(cost).every(([r, v]) => (res[r] ?? 0) >= v);
      if (ok) for (const [r, v] of Object.entries(cost)) res[r] = (res[r] ?? 0) - v;
      const st = (saveData.garrison_status[gridId] ??= {});
      if (kind === 'region') st.region = ok;
      else (st.buildings ??= {})[key] = ok;
      report.push({ gridId, source: cfg.name ?? key, cost, ok });
    };

    for (const [gid, g] of Object.entries(saveData?.map?.grids ?? {})) {
      if (g.region && REGION[g.region]) pay(gid, 'region', g.region, REGION[g.region]);
      for (const [bKey, built] of Object.entries(g.buildings ?? {})) {
        if (built && BUILDING[bKey]) pay(gid, 'building', bKey, BUILDING[bKey]);
      }
    }
    return report;
  },

  showTips(scene, tip) {
    const { width, height } = scene.scale;
    const x = width / 2;
    const y = height * 0.18;

    const text = scene.add.text(x, y, tip, {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.7)',
      padding: { x: 12, y: 6 },
      align: 'center'
    })
      .setOrigin(0.5)
      .setDepth(99999); // 保证在最上层

    scene.time.delayedCall(1200, () => {
      scene.tweens.add({
        targets: text,
        y: y - 50,      // 向上移动
        alpha: 0,       // 淡出
        duration: 1200,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          text.destroy();
        }
      });
    });
  },
};