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
 * 从 WorldTimeAPI 获取当前 UTC 时间戳（毫秒）。
 * 没有联网时 reject，由调用方处理提示。
 */
async function _getNetworkTimestamp() {
  const res = await fetch('https://worldtimeapi.org/api/timezone/Etc/UTC', {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('network error');
  const data = await res.json();
  // unixtime 是秒，转为毫秒
  return data.unixtime * 1000;
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

    // 获取网络时间戳
    let ts;
    try {
      ts = await _getNetworkTimestamp();
    } catch (e) {
      console.error('military.addSoldier: 无法获取网络时间', e);
      destroyMask();
      const { game } = await import('./function.js');
      game.showTips(scene, '请检查网络连接');
      return;
    }

    // 确保时间戳唯一
    ts = _uniqueTimestamp(ts);

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