/**
 * gridButtonImages — GridPanel 按钮图片配置表
 *
 * key:      按钮功能标识（与按钮文字解耦，方便国际化和重构）
 * texture:  Phaser 资源 key（对应 gameScene.preload 中 load 的 key）
 * path:     图片文件路径
 *
 * 使用方式：
 *   createActionButton('继续开拓', ..., GRID_BTN_IMG.migration)
 */
export const GRID_BTN_IMG = {
  // 主城建造类
  build_new_city: 'grid_btn_build_new_city',

  // 移民星舟相关（所有涉及移民星舟功能的按钮统一使用）
  migration: 'grid_btn_migration',
};

/**
 * 图片资源列表，供 gameScene.preload 批量加载
 * 格式：[key, path]
 */
export const GRID_BTN_ASSETS = [
  ['grid_btn_build_new_city', 'assets/ui_button_grid/build_new_city.jpg'],
  ['grid_btn_migration', 'assets/ui_button_grid/migration.jpg'],
];