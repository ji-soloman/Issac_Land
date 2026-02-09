// src/system/saveSystem.js
import * as db from '../util/db.js';

// 默认存档模板
const DEFAULT_SAVE_TEMPLATE = {
  name: '',
  capital: '',
  trait: false,
  troop: false,
  district: false,
  race: '',
  subRace: '',
  tarot: '',
  map_type: '',
  resource: {
    food: 0,
    culture: 0,
    wealth: 0,
    magic: 0
  },
  process: {
    era: '原始',
    gov: '酋邦',
    turn: 0,
    move: {
      military: 2,
    }
  },
  map: {
    grids: {}
  },
  buff: {},
  meta: {
    version: '1.0.0',
    createdAt: null,
    updatedAt: null,
    lastPlayedAt: null
  }
};

class SaveSystem {
  constructor() {
    this.currentSaveId = null;
    this.currentSaveData = null;
    this.isDirty = false;
    this.MAX_SAVES = 3;
  }

  /**
   * 初始化存档系统
   */
  async init() {
    try {
      await db.initDB();
      console.log('存档系统初始化成功');
      return true;
    } catch (error) {
      console.error('存档系统初始化失败:', error);
      return false;
    }
  }

  /**
   * 创建新存档
   * @param {Object} initialData - 初始数据
   * @returns {Promise<string>} saveId
   */
  async createNewSave(initialData = {}) {
    // 检查存档数量限制
    const existingSaves = await this.listSaves();
    if (existingSaves.length >= this.MAX_SAVES) {
      throw new Error(`存档数量已达上限（${this.MAX_SAVES}个）`);
    }

    // 1. 生成 saveId
    const saveId = `save_${Date.now()}`;

    // 2. 填充数据和 meta 信息
    const now = new Date().toISOString();
    const saveData = {
      id: saveId,
      ...JSON.parse(JSON.stringify(DEFAULT_SAVE_TEMPLATE)), // 深拷贝模板
      ...initialData,
      meta: {
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
        lastPlayedAt: now
      }
    };

    // 3. 写入 IndexedDB
    await db.put(saveData);

    // 4. 设置为 currentSave
    this.currentSaveId = saveId;
    this.currentSaveData = saveData;
    this.isDirty = false;

    console.log(`新存档创建成功: ${saveId}`);

    // 5. 返回 saveId
    return saveId;
  }

  /**
   * 加载存档
   * @param {string} saveId - 存档 ID
   * @returns {Promise<Object>} saveData
   */
  async loadSave(saveId) {
    // 1. 从 DB 读取完整存档
    const saveData = await db.get(saveId);

    if (!saveData) {
      throw new Error(`存档不存在: ${saveId}`);
    }

    // 2. 数据校验
    if (!this._validateSaveData(saveData)) {
      throw new Error(`存档数据格式错误: ${saveId}`);
    }

    // 版本兼容处理（如果需要）
    const migratedData = this._migrateSaveData(saveData);

    // 更新最后游玩时间
    migratedData.meta.lastPlayedAt = new Date().toISOString();
    await db.put(migratedData);

    // 3. 设置 currentSaveId / currentSaveData
    this.currentSaveId = saveId;
    this.currentSaveData = migratedData;
    this.isDirty = false;

    console.log(`存档加载成功: ${saveId}`);

    // 4. 返回 saveData
    return migratedData;
  }

  /**
   * 保存当前存档
   * @returns {Promise<boolean>}
   */
  async save() {
    // 如果没有当前存档，返回
    if (!this.currentSaveId || !this.currentSaveData) {
      console.warn('没有当前存档，无法保存');
      return false;
    }

    // 更新时间戳
    this.currentSaveData.meta.updatedAt = new Date().toISOString();
    this.currentSaveData.meta.lastPlayedAt = new Date().toISOString();

    // 整份 saveData put 进 DB
    await db.put(this.currentSaveData);

    // 清除脏标记
    this.isDirty = false;

    console.log(`存档保存成功: ${this.currentSaveId}`);
    return true;
  }

  /**
   * 列出所有存档（简化信息）
   * @returns {Promise<Array>}
   */
  async listSaves() {
    const allSaves = await db.getAll();

    // 返回精简信息
    return allSaves.map(save => ({
      id: save.id,
      name: save.name || '全新文明',
      capital: save.capital || '首都',
      race: save.race,
      subRace: save.subRace,
      tarot: save.tarot,
      era: save.process?.era || '原始',
      gov: save.process?.gov || '酋邦',
      turn: save.process?.turn || 0,
      createdAt: save.meta?.createdAt,
      updatedAt: save.meta?.updatedAt,
      lastPlayedAt: save.meta?.lastPlayedAt
    }))
    .sort((a, b) => new Date(b.lastPlayedAt) - new Date(a.lastPlayedAt)); // 按最后游玩时间排序
  }

  /**
   * 删除存档
   * @param {string} saveId - 存档 ID
   * @returns {Promise<boolean>}
   */
  async deleteSave(saveId) {
    // 删除 DB 中的存档
    await db.remove(saveId);

    // 如果删除的是当前存档，清空 currentSave
    if (this.currentSaveId === saveId) {
      this.currentSaveId = null;
      this.currentSaveData = null;
      this.isDirty = false;
      console.log('当前存档已删除，已清空 currentSave');
    }

    console.log(`存档删除成功: ${saveId}`);
    return true;
  }

  /**
   * 更新当前存档数据（标记为脏）
   * @param {Object} updates - 要更新的数据
   */
  updateCurrentSave(updates) {
    if (!this.currentSaveData) {
      throw new Error('没有当前存档，无法更新');
    }

    // 深度合并更新
    this._deepMerge(this.currentSaveData, updates);

    // 标记为脏
    this.isDirty = true;
  }

  /**
   * 获取当前存档的某个字段
   * @param {string} path - 字段路径，如 'resource.food'
   * @returns {*}
   */
  getCurrentSaveValue(path) {
    if (!this.currentSaveData) return null;

    const keys = path.split('.');
    let value = this.currentSaveData;

    for (const key of keys) {
      value = value?.[key];
      if (value === undefined) return null;
    }

    return value;
  }

  /**
   * 检查是否有未保存的修改
   * @returns {boolean}
   */
  hasUnsavedChanges() {
    return this.isDirty;
  }

  /**
   * 获取当前存档摘要
   * @returns {Object|null}
   */
  getCurrentSaveSummary() {
    if (!this.currentSaveData) return null;

    return {
      id: this.currentSaveId,
      name: this.currentSaveData.name,
      capital: this.currentSaveData.capital,
      era: this.currentSaveData.process?.era,
      turn: this.currentSaveData.process?.turn
    };
  }

  /**
   * 验证存档数据格式
   * @private
   */
  _validateSaveData(saveData) {
    // 基础字段检查
    if (!saveData.id) return false;
    if (!saveData.meta) return false;
    if (!saveData.resource) return false;
    if (!saveData.process) return false;

    return true;
  }

  /**
   * 存档数据版本迁移
   * @private
   */
  _migrateSaveData(saveData) {
    const currentVersion = saveData.meta?.version || '1.0.0';

    // 如果已是最新版本，直接返回
    if (currentVersion === '1.0.0') {
      return saveData;
    }

    // 版本迁移逻辑（未来扩展）
    // if (currentVersion === '0.9.0') {
    //   saveData = migrate_0_9_to_1_0(saveData);
    // }

    return saveData;
  }

  /**
   * 深度合并对象
   * @private
   */
  _deepMerge(target, source) {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {};
        this._deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  }

  /**
   * 清空所有存档
   */
  async clearAllSaves() {
    await db.clear();
    this.currentSaveId = null;
    this.currentSaveData = null;
    this.isDirty = false;
    console.log('所有存档已清空');
  }
}

// 导出单例
export const saveSystem = new SaveSystem();