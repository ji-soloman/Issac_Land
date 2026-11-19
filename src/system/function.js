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
    const add = (gridId, kind, key, cfg) => {
      if (!this.getGarrisonCount(cfg)) return;
      if (this.isGarrisonManualOff(saveData, gridId, kind, key)) return; // 手动关闭的不消耗
      const cost = this.getGarrisonUpkeep(saveData, gridId, cfg);
      if (!Object.keys(cost).length) return;
      for (const [r, v] of Object.entries(cost)) total[r] = (total[r] ?? 0) + v;
      parts.push({ source: cfg.name, cost });
    };
    for (const [gid, g] of Object.entries(saveData?.map?.grids ?? {})) {
      if (g.region && REGION[g.region]) add(gid, 'region', g.region, REGION[g.region]);
      for (const [bKey, built] of Object.entries(g.buildings ?? {})) {
        if (built && BUILDING[bKey]) add(gid, 'building', bKey, BUILDING[bKey]);
      }
    }
    return { total, parts };
  },

  // ── 驻扎手动开关（玩家在“驻扎管理”里关闭：不再消耗资源，收益 / buff 类效果同样关闭；不占用行动） ──
  // 存档：saveData.garrison_off = { [gridId]: { region: '<区域key>', buildings: { [建筑key]: true } } }
  // region 里记的是关闭时的区域 key：区域被拆除 / 升级成别的区域后，旧的“关闭”标记自动失效。

  /** 某已建成的区域 / 建筑是否被玩家手动关闭驻扎 */
  isGarrisonManualOff(saveData, gridId, kind, key) {
    const off = saveData?.garrison_off?.[gridId];
    if (!off) return false;
    if (kind === 'region') return !!off.region && off.region === saveData?.map?.grids?.[gridId]?.region;
    return !!off.buildings?.[key];
  },

  /** 设置手动开关（只改存档，调用方负责保存 / 刷新界面；记得再调 refreshTurnIncome 让收入立刻变化） */
  setGarrisonManualOff(saveData, gridId, kind, key, isOff) {
    saveData.garrison_off ??= {};
    const o = (saveData.garrison_off[gridId] ??= {});
    if (kind === 'region') {
      if (isOff) o.region = saveData.map?.grids?.[gridId]?.region;
      else delete o.region;
    } else {
      o.buildings ??= {};
      if (isOff) o.buildings[key] = true;
      else delete o.buildings[key];
    }
    if (!o.region && !Object.keys(o.buildings ?? {}).length) delete saveData.garrison_off[gridId];
  },

  /**
   * 是否建过首都（王城）——“驻扎管理”的永久解锁时间节点，全局生效（所有城、所有格点都支持）。
   * 和王城升级共用同一份存储 saveData.region_upgrade_used.capital（王城升级“永久限1次”的记录，
   * 升级行动结算开始时写入、之后拆除王城也不会清除），所以一旦建过就永久解锁。
   * 另外兜底：地图上现存任何首都区域（如 GM / 老存档直接放置的）也算已解锁。
   * gridId 参数保留只是为了兼容调用方，不再参与判断。
   */
  hasCapitalBuilt(saveData, gridId) {
    if (saveData?.region_upgrade_used?.capital) return true;
    return Object.values(saveData?.map?.grids ?? {}).some(g =>
      g?.region && REGION[g.region]?.category?.capital === true);
  },


  /**
   * gridId 这个格点自己的【已建成】且需要驻扎人口的区域 / 建筑（“驻扎管理”的列表）。
   * 每个格点只管理自己区域里的驻扎，同属一个主城的其它格点不算（主城也只管主城格点自己）。
   * @returns {Array<{ gridId, kind: 'region'|'building', key, cfg, count, cost, off }>}
   */
  getGridGarrisonObjects(saveData, gridId) {
    const grids = saveData?.map?.grids ?? {};
    const list = [];
    if (!grids[gridId]) return list;
    const push = (gid, kind, key, cfg) => {
      const count = this.getGarrisonCount(cfg);
      if (!count) return;
      list.push({
        gridId: gid, kind, key, cfg, count,
        cost: this.getGarrisonUpkeep(saveData, gid, cfg),
        off: this.isGarrisonManualOff(saveData, gid, kind, key),
      });
    };
    const g = grids[gridId];
    if (g.region && REGION[g.region]) push(gridId, 'region', g.region, REGION[g.region]);
    for (const [bKey, built] of Object.entries(g.buildings ?? {})) {
      if (built && BUILDING[bKey]) push(gridId, 'building', bKey, BUILDING[bKey]);
    }
    return list;
  },

  /** 某区域 / 建筑本回合是否生效（没被手动关闭，且驻扎消耗付得起；没有驻扎、或还没结算过 = 生效） */
  isGarrisonActive(saveData, gridId, kind, key) {
    if (this.isGarrisonManualOff(saveData, gridId, kind, key)) return false;
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
      // 玩家手动关闭的：不消耗，也不算“付不起”（不进报告、不弹提示）
      if (this.isGarrisonManualOff(saveData, gridId, kind, key)) return;
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

  /**
   * 计算“下回合收入”（回合结算第 4 步用；玩家手动开关驻扎后也会调用，让收入立刻反映）：
   * 已建成区域 / 建筑的 effect.turn（驻扎没付起 / 被手动关闭的跳过） + 空闲人口人头税。
   * @returns {{culture:number, food:number, magic:number, mine:number, wealth:number}}
   */
  computeTurnIncome(saveData) {
    const keys = ['culture', 'food', 'magic', 'mine', 'wealth'];
    const total = Object.fromEntries(keys.map(k => [k, 0]));
    const grids = saveData?.map?.grids ?? {};

    // 区域收入
    for (const [gridKey, grid] of Object.entries(grids)) {
      const region = grid.region;
      if (!region) continue;
      if (!this.isGarrisonActive(saveData, gridKey, 'region')) continue;
      const effect = REGION?.[region]?.effect?.turn;
      if (!effect) continue;
      for (const [res, value] of Object.entries(effect)) {
        if (!(res in total)) continue;
        const result = typeof value === 'function' ? value({ grid }) : value;
        if (typeof result !== 'number' || Number.isNaN(result)) continue;
        total[res] += result;
      }
    }

    // 建筑收入：已建成的建筑（grid.buildings = { [key]: true }）；建造中的不产出
    for (const [gridKey, grid] of Object.entries(grids)) {
      for (const [buildingKey, built] of Object.entries(grid.buildings ?? {})) {
        if (!built) continue;
        if (!this.isGarrisonActive(saveData, gridKey, 'building', buildingKey)) continue;
        const effect = BUILDING?.[buildingKey]?.effect?.turn;
        if (!effect) continue;
        for (const [res, value] of Object.entries(effect)) {
          if (!(res in total)) continue;
          let result;
          try {
            result = typeof value === 'function' ? value({ grid }) : value;
          } catch (err) {
            console.error(`building.effect.turn [${buildingKey}.${res}] 执行出错:`, err);
            continue;
          }
          if (typeof result !== 'number' || Number.isNaN(result)) continue;
          total[res] += result;
        }
      }
    }

    // 人口收入：每个【空闲】人口（总人口 − 被驻扎锁定的人口）产生 1 财富。
    // 驻扎人口依旧算城池总人口（住房、繁衍、荣耀之都按总人口加税等不受影响），只是自己不产生人头税。
    // pending:false —— 回合结算时行动已经落到 createRegion / createBuilding，不能再算一遍行动列表（手动开关时行动列表里的待建项也不该影响收入）。
    for (const [gridKey, grid] of Object.entries(grids)) {
      if (grid.population) {
        const locked = grid.isMain ? this.getGarrisonLocked(saveData, gridKey, { pending: false }).total : 0;
        total.wealth += Math.max(0, grid.population - locked);
      }
    }
    return total;
  },

  /** 重新计算并写入 saveData.resource.*_income（玩家手动开关驻扎后调用；回合结算有自己的写入流程） */
  refreshTurnIncome(saveData) {
    const total = this.computeTurnIncome(saveData);
    saveData.resource ??= {};
    for (const k of Object.keys(total)) saveData.resource[`${k}_income`] = total[k];
    return total;
  },

  // ── 大图缩小显示去锯齿（mipmap 纹理） ──────────────────────────────

  /**
   * 为大尺寸素材生成“带 mipmap 的 2 的幂次尺寸纹理”，解决大图缩小显示时的锯齿 / 发糊
   * （和 mapView.js 里都城立绘用的是同一个办法）。
   * 原因：WebGL1 只有 2 的幂次尺寸的纹理才能用 mipmap，Phaser 默认又只用 LINEAR 过滤，
   *       一张 1000+px 的图缩到 100~200px 时，双线性只会采到相邻 4 个像素，边缘必然出现锯齿 / 闪烁。
   * 做法：用 canvas 逐级对半缩小到“刚好够显示用”的 2 的幂次尺寸，再把纹理缩小过滤改成 LINEAR_MIPMAP_LINEAR（三线性）。
   * 只有真正缩小（显示尺寸 < 原图 80%）且 2 的幂次尺寸仍小于原图时才生成，否则返回 null，调用方继续用原图（放大 / 近 1:1 不需要）。
   * @returns {string|null} mip 纹理 key（按目标尺寸缓存，同一张图同一档尺寸只生成一次）
   */
  ensureMipTexture(scene, srcKey, dispW, dispH) {
    const textures = scene?.textures;
    if (!textures || !textures.exists(srcKey)) return null;
    const gl = scene.game?.renderer?.gl;
    if (!gl) return null; // Canvas 渲染没有 mipmap
    const srcImg = textures.get(srcKey).getSourceImage();
    const srcW = srcImg?.width, srcH = srcImg?.height;
    if (!srcW || !srcH || !(dispW > 0) || !(dispH > 0)) return null;
    if (dispW >= srcW * 0.8 && dispH >= srcH * 0.8) return null;

    const pow2Ceil = (n) => Math.pow(2, Math.ceil(Math.log2(Math.max(2, n))));
    const texW = Math.min(1024, pow2Ceil(dispW));
    const texH = Math.min(1024, pow2Ceil(dispH));
    if (texW >= srcW || texH >= srcH) return null;

    const mipKey = `${srcKey}__mip${texW}x${texH}`;
    if (textures.exists(mipKey)) return mipKey;

    // 逐级对半缩小，避免一步缩太多时 drawImage 丢像素
    const drawTo = (img, w, h) => {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, 0, w, h);
      return c;
    };
    let cur = srcImg, cw = srcW, ch = srcH;
    while (cw > texW * 2 || ch > texH * 2) {
      const nw = Math.max(texW, Math.round(cw / 2));
      const nh = Math.max(texH, Math.round(ch / 2));
      cur = drawTo(cur, nw, nh);
      cw = nw; ch = nh;
    }
    const tex = textures.addCanvas(mipKey, drawTo(cur, texW, texH));
    if (!tex) return null;

    const wrapper = tex.source?.[0]?.glTexture;
    if (wrapper?.webGLTexture) {
      gl.activeTexture(gl.TEXTURE0);
      const prev = gl.getParameter(gl.TEXTURE_BINDING_2D);
      gl.bindTexture(gl.TEXTURE_2D, wrapper.webGLTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      const ext = gl.getExtension('EXT_texture_filter_anisotropic');
      if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(4, gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
      wrapper.minFilter = gl.LINEAR_MIPMAP_LINEAR;
      wrapper.magFilter = gl.LINEAR;
      if (prev) gl.bindTexture(gl.TEXTURE_2D, prev);
    }
    return mipKey;
  },

  /**
   * 在 (x, y) 处放一张按 maxW × maxH 等比缩放“放进框里”的居中图片（Image，origin 0.5），缩小时自动用 mip 纹理去锯齿。
   * 用来替换原来的  scene.add.image(...) + setScale(Math.min(maxW / img.width, maxH / img.height))  写法。
   * 注意 mip 纹理是 2 的幂次尺寸（比例被拉伸过），所以用 setDisplaySize 按原图比例显示，不能再用 img.width / height 算缩放。
   * 纹理不存在时返回 null（调用方原本就先判断了 textures.exists）。
   * @returns {Phaser.GameObjects.Image|null}
   */
  addFittedImage(scene, x, y, srcKey, maxW, maxH) {
    if (!scene?.textures?.exists(srcKey)) return null;
    const src = scene.textures.get(srcKey).getSourceImage();
    const srcW = src?.width || 1, srcH = src?.height || 1;
    const s = Math.min(maxW / srcW, maxH / srcH);
    const dw = srcW * s, dh = srcH * s;
    const mipKey = this.ensureMipTexture(scene, srcKey, dw, dh);
    const img = scene.add.image(x, y, mipKey ?? srcKey).setOrigin(0.5);
    if (mipKey) img.setDisplaySize(dw, dh);
    else img.setScale(s);
    return img;
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