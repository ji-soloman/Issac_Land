import { MILITARY_UNIT } from '../data/military_unit.js';
import { saveSystem } from './saveSystem.js';

/**
 * military — 军事系统工具
 *
 * 提供 addSoldier() 方法向 saveData.military 添加新兵组。
 * 兵组 key 格式为 "s{网络时间戳}"，使用联网国际时间保证唯一性，
 * 同时连续调用时自动错开时间戳，避免 key 冲突。
 */

// 上次使用的时间戳，用于防止同时添加多个兵组时出现重复 key
let _lastTimestamp = 0;

/**
 * 依次尝试多个可靠的网络时间源，全部失败则回退到本地时间并打印警告。
 * 使用多个备用源是因为单一来源（如 worldtimeapi.org）可能停服或被屏蔽。
 */
async function _getNetworkTimestamp() {
  const sources = [
    // timeapi.io — worldtimeapi.org 的官方继任者，同一团队维护
    async () => {
      const r = await fetch('https://timeapi.io/api/time/current/zone?timeZone=UTC', { cache: 'no-store' });
      if (!r.ok) throw new Error('timeapi.io failed');
      const d = await r.json();
      // dateTime 格式: "2025-07-25T12:34:56.789"
      return new Date(d.dateTime + 'Z').getTime();
    },
    // worldtimeapi.org 替代服务（Cloudflare Workers，兼容原接口）
    async () => {
      const r = await fetch('https://timeapi.world/api/timezone/Etc/UTC', { cache: 'no-store' });
      if (!r.ok) throw new Error('timeapi.world failed');
      const d = await r.json();
      return d.unixtime * 1000;
    },
    // Cloudflare 的 trace 接口，包含服务器端时间
    async () => {
      const r = await fetch('https://cloudflare.com/cdn-cgi/trace', { cache: 'no-store' });
      if (!r.ok) throw new Error('cloudflare failed');
      const text = await r.text();
      const match = text.match(/ts=([0-9.]+)/);
      if (!match) throw new Error('cloudflare ts not found');
      return Math.round(parseFloat(match[1]) * 1000);
    },
  ];

  for (const source of sources) {
    try {
      return await source();
    } catch (e) {
      console.warn('military: 时间源失败，尝试下一个', e.message);
    }
  }

  // 全部失败：回退到本地时间，打印警告但不阻断流程
  console.warn('military: 所有网络时间源均不可用，使用本地时间作为兜底');
  return Date.now();
}

/**
 * 确保时间戳唯一：若和上次相同则 +1（毫秒），保证连续调用的 key 不重复。
 */
function _uniqueTimestamp(ts) {
  if (ts <= _lastTimestamp) {
    ts = _lastTimestamp + 1;
  }
  _lastTimestamp = ts;
  return ts;
}

export const military = {
  /**
   * 向 saveData.military 添加一个新兵组。
   *
   * @param {string}   unitKey    兵组名（对应 MILITARY_UNIT 的 key，如 'scout'）
   * @param {Object}   saveData   当前存档对象
   * @param {Phaser.Scene} scene  场景引用（用于显示错误提示）
   * @param {Function} [onSuccess] 添加成功后的回调，参数为 (soldierId, soldierData)
   */
  async addSoldier(unitKey, saveData, scene, onSuccess) {
    const unit = MILITARY_UNIT[unitKey];
    if (!unit) {
      console.error(`military.addSoldier: 找不到兵组配置 "${unitKey}"`);
      return;
    }

    // ── 创建遮罩，隔绝下层点击 ────────────────────
    const { width, height } = scene.scale;
    const mask = scene.add.container(0, 0).setDepth(9999);

    const maskBg = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6)
      .setInteractive(); // 拦截所有点击穿透

    const maskText = scene.add.text(width / 2, height / 2, '兵力创建中...', {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
      padding: { top: 4 },
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    mask.add([maskBg, maskText]);

    const destroyMask = () => {
      if (mask && mask.active) mask.destroy(true);
    };

    // 获取网络时间戳（多备用源，全部失败时回退本地时间）
    const ts = _uniqueTimestamp(await _getNetworkTimestamp());

    const soldierId = `s${ts}`;
    const soldierData = {
      name: unitKey,
      stats: { ...(unit.basic_stats ?? {}) },
      equipments: { ...(unit.equipments ?? {}) },
      ability: { ...(unit.special_ability ?? {}) },
      level: 1,
    };

    if (!saveData.military) saveData.military = {};
    saveData.military[soldierId] = soldierData;

    await saveSystem.save();
    console.log(`military.addSoldier: 已添加 ${soldierId} (${unit.name})`);

    destroyMask();

    if (typeof onSuccess === 'function') {
      onSuccess(soldierId, soldierData);
    }
  },
};