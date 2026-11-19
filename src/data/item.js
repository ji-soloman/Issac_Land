/**
 * ITEM — 物品定义表（key 为物品编号）。
 * 玩家背包存在 saveData.item = { [物品编号]: 数量 }（新存档初始为 {}，见 saveSystem.js）。
 *   name     — 物品名称
 *   image    — 物品图标路径（assets/item/{编号}.png），统一在这里声明，方便以后素材复用
 *   info     — 物品说明
 *   ref      — 获取途径（可选）
 *   category — 物品分类：coin 货币类 / material 材料类
 */
export const ITEM = {
  11: {
    name: '远古遗物', // 副本积分
    image: 'assets/item/11.png',
    info: '可以在【副本商店】兑换道具',
    category: 'coin',
  },
  101: {
    name: '祭祀符文',
    image: 'assets/item/101.png',
    info: '',
    ref: '战胜【玛雅侍女】和【玛雅祭祀】获得',
    category: 'material',
  },
  102: {
    name: '古代石核',
    image: 'assets/item/102.png',
    info: '',
    ref: '战胜【石傀儡】获得',
    category: 'material',
  },
  103: {
    name: '守卫徽记',
    image: 'assets/item/103.png',
    info: '',
    ref: '战胜【祭祀守卫】获得',
    category: 'material',
  },
  104: {
    name: '羽蛇之羽',
    image: 'assets/item/104.png',
    info: '',
    ref: '战胜【羽蛇神】获得',
    category: 'material',
  },
  105: {
    name: '羽蛇神鳞',
    image: 'assets/item/105.png',
    info: '',
    ref: '战胜【羽蛇神】获得',
    category: 'material',
  },
  106: {
    name: '雨神面具',
    image: 'assets/item/106.png',
    info: '',
    ref: '战胜【雨神祭祀】获得',
    category: 'material',
  },
  107: {
    name: '巨像核心',
    image: 'assets/item/107.png',
    info: '',
    ref: '战胜【雨神祭祀】获得',
    category: 'material',
  },
  108: {
    name: '远古石甲',
    image: 'assets/item/108.png',
    info: '',
    ref: '战胜【远古巨像】获得',
    category: 'material',
  },
  109: {
    name: '冥界神核',
    image: 'assets/item/109.png',
    info: '',
    ref: '战胜【冥界死神】获得',
    category: 'material',
  },
  110: {
    name: '冥界契约',
    image: 'assets/item/110.png',
    info: '',
    ref: '战胜【冥界死神】获得',
    category: 'material',
  },
};