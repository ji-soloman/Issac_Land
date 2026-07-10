import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import { WONDER } from '../data/wonder.js';
import { REGION } from '../data/region.js';

// 区域颜色映射（与 GridPanel / CreateRegion 保持一致）
// key 对应 REGION[x].color，value 为 Phaser 十六进制颜色
const REGION_COLOR_MAP = {
  living:        0xF2D8A7,
  farm:          0x6DBE45,
  mine:          0x7A7A7A,
  harbor:        0x2E86C1,
  pasture:       0xA3B83A,
  military:      0xB03A2E,
  academy:       0x4B6CB7,
  holy:          0xE8C547,
  trade:         0xE67E22,
  entertainment: 0xC65DFF,
  industry:      0xA04000,
  special:       0x7D3C98,
};

export class MapView {
  constructor(scene, mapConfig, saveData) {
    this.scene = scene;
    this.mapConfig = mapConfig; // MAPS 中的配置
    this.saveData = saveData; // 存档中的地图数据

    // --- 地图尺寸配置 ---
    this.MAP_WIDTH = 3280;
    this.MAP_HEIGHT = 3280 * 9 / 16;

    // --- 六边形尺寸配置 ---
    // 原始中心到边的距离
    this.HEX_APOTHEM = 120;
    // 原始外接圆半径
    this.HEX_RADIUS = this.HEX_APOTHEM / 0.866025;

    // --- 3D 倾斜配置 ---
    // 决定倾斜程度，数值越小，看起来倾斜角度越大。
    this.TILT_FACTOR = 0.45;

    // --- 缩放配置 ---
    this.minZoom = 0.3;
    this.maxZoom = 0.66;
    this.currentZoom = 0.4;
    this.zoomStep = 0.02;

    // --- 拖拽状态 ---
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;

    // --- 回调 ---
    this.onGridClick = null;
    this.interactionEnabled = true;

    // --- 当前选中（高亮）的格子编号，再次点击同一个格子时用于判断是否需要取消选中 ---
    this.selectedGridId = null;

    // --- 编辑模式 / 选点面板状态 ---
    // active: 是否处于编辑模式；tempGrids: 编辑模式下临时创建出来的“之前不显示”的格子；
    // onChoose: 调用 choosePanel 时传入的外部回调，点击任意格子都会触发
    // active:    是否处于选点模式���choosePanel 激活期间为 true���
    // isDevMode: true = 由开发工具调用���外部可据此显示“地形排布开发工具”等 dev UI���
    //            false = 由游戏流程调用���如 initGame 选城���，不显示 dev UI
    // tempGrids: 临时发光格子
    // onChoose:  点击任意格子后的外部回调
    // selectedGridId: 选点模式下，当前被点击选中并保持高亮的格子编号（悬浮之外的持久高亮）
    this.editMode = {
      active:    false,
      isDevMode: false,
      tempGrids: {},
      onChoose:  null,
      selectedGridId: null,
    };

    this.create();
    this.setupEditMode();
  }

  create() {
    if (this.scene && this.scene.input) {
      this.scene.input.setDefaultCursor('default');
    }
    // 1. 创建地图容器
    this.container = this.scene.add.container(0, 0);

    // 2. 加载地图背景
    this.mapBg = this.scene.add.image(0, 0, 'map_bg').setOrigin(0);
    // this.mapBg.setDisplaySize(this.MAP_WIDTH, this.MAP_HEIGHT);

    // --- 动态计算 8K 或任何分辨率资产的缩放系数 ---
    const baseWidth = 3280; // 以你最初设计的 3280 宽度为基准
    this.MAP_WIDTH = this.mapBg.width;   // 自动获取 8K 图片实际宽度 (7680)
    this.MAP_HEIGHT = this.mapBg.height; // 自动获取 8K 图片实际高度 (4320)

    // 计算当前图片相对原设计的放大倍数
    const resolutionScale = this.MAP_WIDTH / baseWidth;
    // ----------------------------------------------------

    this.mapBg.setPipeline('TextureTintPipeline');
    this.mapBg.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.container.add(this.mapBg);

    // 3. 创建格子容器
    this.gridsContainer = this.scene.add.container(0, 0);
    this.container.add(this.gridsContainer);

    // 4. 根据地图实际尺寸，自动生成铺满全图的六边形网格布局
    //    网格数量只取决于地图底图的像素尺寸（this.MAP_WIDTH / this.MAP_HEIGHT），
    //    与运行设备的屏幕/窗口尺寸无关，因此任何设备上的格子总数都是一致的。
    this.buildGridLayout();

    // 5. 绘制格子（只绘制存档中存在的格子编号）
    this.gridObjects = {};
    this.drawGrids();

    // 6. 初始居中
    this.centerMap();

    // 7. 绑定事件
    this.setupInteraction();
  }

  /**
   * 自动生成铺满整张地图的六边形网格布局。
   *
   * - 网格编号从 g1 开始，按行优先顺序自动递增（g1, g2, g3...）。
   * - 网格的总行数/总列数只由地图底图的像素尺寸决定，与设备屏幕尺寸无关，
   *   因此同一张地图在任何设备上生成的格子数量、编号、坐标都完全一致。
   * - 数据表（mapConfig.grids）中原有的 coord 字段不再用于定位，
   *   格子的实际像素坐标统一由本方法计算得出。
   * - 同时建立 offset 坐标 (col, row) <-> axial 坐标 (q, r) 的映射，
   *   用于后续 getGridNeighbors() 快速查找某个格子周边的六个相邻格子。
   */
  buildGridLayout() {
    // 同一行内，相邻格子中心点的水平距离 = sqrt(3) * 半径 = 2 * 内切圆半径(APOTHEM)
    const colSpacing = this.HEX_APOTHEM * 2;
    // 相邻两行格子中心点的垂直距离，本应是 1.5 * 半径，
    // 由于绘制时对 Y 轴做了 TILT_FACTOR 压扁（3D 倾斜效果），这里也要同步压扁，
    // 否则网格的视觉间距会和实际渲染的六边形对不上。
    const rowSpacing = this.HEX_RADIUS * 1.5 * this.TILT_FACTOR;

    // --- 边距：保证格子完整显示在地图图片内 ---
    // 六边形水平方向半宽 = HEX_APOTHEM（顶点 x 坐标的最大绝对值）
    // 六边形垂直方向半高 = HEX_RADIUS * TILT_FACTOR（压扁后顶点 y 坐标的最大绝对值）
    // 如果没有这个边距，格子中心点贴着地图边缘时，六边形会有一半被裁切在图片外面。
    const offsetX = this.HEX_APOTHEM;
    const offsetY = this.HEX_RADIUS * this.TILT_FACTOR;

    // 奇数行会整体右移半格（colSpacing / 2），所以预留这部分宽度，
    // 确保奇数行最右侧的格子也完整落在地图宽度范围内。
    const usableWidthForCols = this.MAP_WIDTH - offsetX * 2 - colSpacing / 2;
    const usableHeight = this.MAP_HEIGHT - offsetY * 2;

    this.totalCols = Math.max(1, Math.floor(usableWidthForCols / colSpacing) + 1);
    this.totalRows = Math.max(1, Math.floor(usableHeight / rowSpacing) + 1);

    this.gridLayout = {};   // gridId -> { col, row, q, r, x, y }
    this.coordToId = {};    // "col,row" -> gridId，用于邻格反查

    let index = 1;
    for (let row = 0; row < this.totalRows; row++) {
      // 奇数行整体向右偏移半格，形成蜂窝式交错排列（odd-r 偏移布局）
      const rowOffset = (row % 2 === 1) ? colSpacing / 2 : 0;

      for (let col = 0; col < this.totalCols; col++) {
        const gridId = 'g' + index;

        const x = offsetX + col * colSpacing + rowOffset;
        const y = offsetY + row * rowSpacing;

        // offset 坐标 (col, row) -> axial 坐标 (q, r)，标准 odd-r 转换公式
        const q = col - (row - (row & 1)) / 2;
        const r = row;

        this.gridLayout[gridId] = { col, row, q, r, x, y };
        this.coordToId[`${col},${row}`] = gridId;

        index++;
      }
    }
  }

  /**
   * 根据格子编号查找其周边的六个相邻格子编号。
   * 返回的数组固定长度为 6，按六个边的方向顺序排列；
   * 如果某个方向上没有相邻格子（超出地图网格范围），对应位置为 null。
   *
   * 注意：返回的是“地图网格拓扑”上存在的相邻格子编号，
   * 不代表该格子在存档中一定存在/会被渲染，调用方可自行结合 saveData 过滤。
   *
   * @param {string} gridId 例如 'g123'
   * @returns {(string|null)[]} 长度为 6 的相邻格子编号数组
   */
  getGridNeighbors(gridId) {
    const layout = this.gridLayout?.[gridId];
    if (!layout) return [null, null, null, null, null, null];

    const { q, r } = layout;

    // pointy-top 六边形的标准 6 个轴向方向
    const directions = [
      { dq: 1, dr: 0 },
      { dq: 1, dr: -1 },
      { dq: 0, dr: -1 },
      { dq: -1, dr: 0 },
      { dq: -1, dr: 1 },
      { dq: 0, dr: 1 },
    ];

    return directions.map(({ dq, dr }) => {
      const nq = q + dq;
      const nr = r + dr;

      // axial 坐标 -> offset 坐标 (col, row)
      const nRow = nr;
      const nCol = nq + (nr - (nr & 1)) / 2;

      return this.coordToId[`${nCol},${nRow}`] || null;
    });
  }

  /**
   * 初始化编辑模式（选点面板）相关功能。
   * 对外暴露 this.editMode.choosePanel() 和 this.editMode.closeChoosePanel() 两个方法：
   *
   * - choosePanel(onChoose?)：把所有“当前存档里不存在、因此没有被绘制出来”的格子也临时显示出来，
   *   用持续发光的样式区分；同时整张地图进入编辑模式——
   *   此时点击任意一个格子（无论是之前就显示的，还是新显示出来的）都只会在控制台
   *   输出该格子的编号（gn），不会触发原本的 onGridClick 回调。
   *   可选传入一个回调函数 onChoose(gridId)，点击任意格子时会被调用，外部即可拿到选中的格子编号。
   *
   * - closeChoosePanel()：退出编辑模式，销毁所有临时显示的发光格子，并清空上面传入的回调，
   *   地图恢复成进入编辑模式之前的样子（已有格子的点击行为也恢复成原本的 onGridClick）。
   */
  setupEditMode() {
    this.editMode.choosePanel = (onChoose, { devMode = false } = {}) => {
      if (this.editMode.active) {
        console.log('已经处于选点模式，无需重复进入');
        return;
      }
      this.editMode.active = true;
      this.editMode.isDevMode = devMode;
      this.editMode.tempGrids = {};
      this.editMode.selectedGridId = null;
      // 外部传入的回调：点击任意格子（已存在的 / 临时发光的）都会触发，参数为格子编号(gn)
      this.editMode.onChoose = typeof onChoose === 'function' ? onChoose : null;

      Object.keys(this.gridLayout).forEach((gridId) => {
        // 存档里已经存在、已经绘制出来的格子跳过，不重复创建
        if (this.gridObjects[gridId]) return;

        const layout = this.gridLayout[gridId];
        this.editMode.tempGrids[gridId] = this.createGlowHexagon(gridId, layout);
      });

      console.log(`已进入选点模式，新增显示 ${Object.keys(this.editMode.tempGrids).length} 个格子`);
    };

    this.editMode.closeChoosePanel = () => {
      if (!this.editMode.active) {
        console.log('当前不在选点模式');
        return;
      }

      // 已存在的真实格子如果处于选中高亮状态，退出选点模式前要先还原；
      // 临时发光格子会被整体销毁，不需要单独处理。
      if (this.editMode.selectedGridId) {
        this._setEditModeGridSelected(this.editMode.selectedGridId, false);
      }
      this.editMode.selectedGridId = null;

      Object.values(this.editMode.tempGrids || {}).forEach(({ cellContainer, glowTween }) => {
        if (glowTween) glowTween.stop();
        if (cellContainer) cellContainer.destroy(true);
      });

      this.editMode.tempGrids = {};
      this.editMode.onChoose = null;
      this.editMode.isDevMode = false;
      this.editMode.active = false;
      if (this.scene && this.scene.input) {
        this.scene.input.setDefaultCursor('default');
      }
      console.log('已退出选点模式，地图已还原');
    };
  }

  /**
   * 设置（或取消）选点模式下某个格子的持久高亮状态。
   * 格子对象可能来自 gridObjects（已存在于存档的真实格子）或 editMode.tempGrids（临时发光格子）。
   * @param {string} gridId
   * @param {boolean} selected
   */
  _setEditModeGridSelected(gridId, selected) {
    const handle = this.gridObjects[gridId] || this.editMode.tempGrids[gridId];
    if (handle && typeof handle.setSelected === 'function') {
      handle.setSelected(selected);
    }
  }

  /**
   * 选点模式下点击某个格子时的统一处理：
   * - 点击一个新格子 -> 取消上一个选中格子的高亮，高亮这个新格子；
   * - 再次点击当前已高亮的格子 -> 取消选中；
   * 高亮效果会一直保持，直到满足上述两种情况之一（而不仅仅是鼠标悬浮）。
   * @param {string} gridId
   */
  _handleEditModeGridClick(gridId) {
    if (this.editMode.selectedGridId === gridId) {
      this._setEditModeGridSelected(gridId, false);
      this.editMode.selectedGridId = null;
      return;
    }

    if (this.editMode.selectedGridId) {
      this._setEditModeGridSelected(this.editMode.selectedGridId, false);
    }
    this.editMode.selectedGridId = gridId;
    this._setEditModeGridSelected(gridId, true);
  }

  /**
   * 创建一个“持续发光”的临时格子（用于编辑模式下展示存档中不存在的格子）。
   * 点击后只在控制台输出格子编号，不会触发 this.onGridClick。
   *
   * @param {string} gridId
   * @param {{x:number, y:number}} layout
   * @returns {{cellContainer: Phaser.GameObjects.Container, graphics: Phaser.GameObjects.Graphics, glowTween: Phaser.Tweens.Tween}}
   */
  createGlowHexagon(gridId, layout) {
    const { x, y } = layout;

    const cellContainer = this.scene.add.container(x, y);
    this.gridsContainer.add(cellContainer);

    const graphics = this.scene.add.graphics();
    const hexPoints = this.getHexagonPoints(this.HEX_RADIUS);

    // 发光样式：用青色半透明填充 + 高亮描边，和正常格子的样式区分开
    const glowColor = 0x00ffff;
    const drawGlowBase = () => {
      graphics.clear();
      graphics.fillStyle(glowColor, 0.25);
      graphics.fillPoints(hexPoints, true);
      graphics.lineStyle(3, glowColor, 1);
      graphics.strokePoints(hexPoints, true);
    };
    drawGlowBase();

    cellContainer.add(graphics);

    // 持续发光动画：透明度在高低之间来回过渡，循环播放
    const glowTween = this.scene.tweens.add({
      targets: graphics,
      alpha: { from: 0.35, to: 1 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 悬浮/选中高亮：使用独立的图层叠加显示，不去暂停/修改底层 graphics 及其发光动画。
    // 之前的实现是暂停 glowTween 并手动 setAlpha(1)，移出后再 resume——
    // 但 resume 只会从暂停时的进度继续，并不会补偿被暂停掉的这段时间，
    // 导致这个格子的发光节奏和其它没被悬浮过的格子错开，看起来“变色”/样式不同步。
    // 改为叠加一层独立高亮图形，底层发光格全程不受影响。
    // 该图层同时承担两种高亮：临时的悬浮高亮（白色），和持久的选中高亮（青色，
    // 与真实格子 createHexagon 里选中态使用的颜色保持一致），选中态优先于悬浮态显示。
    let isSelected = false;
    const highlightGraphics = this.scene.add.graphics();
    const drawHighlight = () => {
      highlightGraphics.clear();
      if (isSelected) {
        highlightGraphics.fillStyle(0x00e5ff, 0.35);
        highlightGraphics.fillPoints(hexPoints, true);
        highlightGraphics.lineStyle(5, 0x00e5ff, 1);
        highlightGraphics.strokePoints(hexPoints, true);
      } else {
        highlightGraphics.fillStyle(0xffffff, 0.5);
        highlightGraphics.fillPoints(hexPoints, true);
        highlightGraphics.lineStyle(3, 0xffffff, 0.9);
        highlightGraphics.strokePoints(hexPoints, true);
      }
    };
    drawHighlight();
    highlightGraphics.setVisible(false);
    cellContainer.add(highlightGraphics);

    const hitArea = new Phaser.Geom.Polygon(hexPoints);
    graphics.setInteractive(hitArea, Phaser.Geom.Polygon.Contains);

    graphics.on('pointerdown', () => {
      if (this.isDragging) return;
      console.log(gridId);
      // 切换该格子的持久选中高亮（选中/取消选中），再触发外部选点回调
      this._handleEditModeGridClick(gridId);
      if (typeof this.editMode.onChoose === 'function') {
        this.editMode.onChoose(gridId);
      }
    });

    // 悬浮时：若格子未处于选中态，按悬浮白色样式显示；已选中的格子悬浮时保持选中样式不变
    graphics.on('pointerover', () => {
      if (!isSelected) {
        drawHighlight();
      }
      highlightGraphics.setVisible(true);
      this.scene.input.setDefaultCursor('pointer');
    });

    // 离开时：未选中的格子隐藏高亮图层；已选中的格子保持青色持久高亮，直到被再次点击或选中其它格子
    graphics.on('pointerout', () => {
      if (isSelected) {
        drawHighlight();
      } else {
        highlightGraphics.setVisible(false);
      }
      this.scene.input.setDefaultCursor('default');
    });

    // 供外部（MapView._setEditModeGridSelected）调用，切换持久选中高亮状态
    const setSelected = (selected) => {
      isSelected = !!selected;
      drawHighlight();
      highlightGraphics.setVisible(isSelected);
    };

    return { cellContainer, graphics, glowTween, highlightGraphics, setSelected };
  }

  drawGrids() {
    // 只绘制存档（saveData.grids）中存在的格子编号，数据表（mapConfig.grids）
    // 仅用于提供 wonder 等附加信息，不再提供坐标（主城判定改为 saveGridData.isMain）
    const savedGrids = this.saveData.grids || {};
    const templates = this.mapConfig.grids || {};

    Object.keys(savedGrids).forEach((gridId) => {
      const layout = this.gridLayout?.[gridId];
      if (!layout) {
        // 存档中的格子编号超出了自动生成的网格范围，跳过并提示
        console.warn(`格子 ${gridId} 不在自动生成的网格范围内，已跳过绘制`);
        return;
      }

      const gridTemplate = templates[gridId] || {};
      const saveGridData = savedGrids[gridId] || {};

      // 坐标统一来自自动生成的网格布局，数据表中原有的 coord 字段不再生效
      const gridData = {
        ...gridTemplate,
        ...saveGridData,
        x: layout.x,
        y: layout.y,
      };

      const hex = this.createHexagon(gridId, gridData);
      this.gridObjects[gridId] = hex;
    });
  }

  createHexagon(gridId, gridData) {
    // 主城判定：只看 isMain 字段（由 InitGame 建城时写入），不再使用 locked 判定"已解锁"样式
    const { x, y, isMain = false, wonder, region = null } = gridData || {};

    // 凡出现在 saveData.map.grids 里的格子都已解锁（未解锁的根本不会被绘制），
    // 无需额外字段判断，所有格子统一响应 hover / pointer 效果

    // 非主城格子：如果该格子有已建造完成的区域（region 为非空字符串），
    // 用区域 colorMap 的颜色覆盖默认灰色；透明度保持和普通非主城格子一致
    let fillColor = isMain ? 0xff0000 : 0x808080;
    if (!isMain && region) {
      const regionConfig = REGION?.[region];
      if (regionConfig?.color && REGION_COLOR_MAP[regionConfig.color] !== undefined) {
        fillColor = REGION_COLOR_MAP[regionConfig.color];
      }
    }

    let fillAlpha  = isMain ? 0.8 : 0.5;
    let strokeColor = isMain ? 0xffff00 : 0x606060;
    let strokeWidth = isMain ? 3 : 2;

    // 创建格子容器和图形对象
    const cellContainer = this.scene.add.container(x, y);
    this.gridsContainer.add(cellContainer);

    const graphics = this.scene.add.graphics();
    const hexPoints = this.getHexagonPoints(this.HEX_RADIUS);

    // 提前检查当前格子是否有奇观显示
    const hasWonder = wonder && WONDER[wonder] && WONDER[wonder].image;

    // 是否被选中（点击后高亮，再次点击取消），由外部通过 setSelected() 控制
    let isSelected = false;

    const drawBase = (isHover = false) => {
      graphics.clear();

      // 计算最终使用的填充透明度和边框透明度
      let currentFillAlpha = isHover ? 0.9 : fillAlpha;
      let currentStrokeAlpha = 1.0;

      // 如果有奇观，且鼠标没有悬浮在格子上，将格子和边框的透明度降为 0.1
      if (hasWonder && !isHover) {
        currentFillAlpha = 0.1;
        currentStrokeAlpha = 0.1;
      }

      graphics.fillStyle(fillColor, currentFillAlpha);
      graphics.fillPoints(hexPoints, true);

      // 选中态描边：用醒目的青色粗描边覆盖普通描边，用来和其它格子区分；
      // hover 态的白色描边优先级更高（悬浮时依然按原本的悬浮样式显示）
      const useSelectedStroke = isSelected && !isHover;
      const finalStrokeColor = isHover ? 0xffffff : (useSelectedStroke ? 0x00e5ff : strokeColor);
      const finalStrokeWidth = isHover ? 4 : (useSelectedStroke ? 5 : strokeWidth);
      graphics.lineStyle(finalStrokeWidth, finalStrokeColor, currentStrokeAlpha);
      graphics.strokePoints(hexPoints, true);

      // 如果处于高光状态且有奇观，绘制一个包含图片范围的组合框
      if (isHover && wonderImage) {
        const bounds = wonderImage.getBounds();
        // 转换全局坐标为容器本地坐标
        const localX = bounds.x - cellContainer.x;
        const localY = bounds.y - cellContainer.y;
        graphics.lineStyle(2, 0xffffff, 0.8);
        graphics.strokeRect(localX, localY, bounds.width, bounds.height);
      }
    };

    cellContainer.add(graphics);

    // 处理奇观图片
    let wonderImage = null;
    if (hasWonder) {
      const imageKey = 'wonder_' + wonder;
      wonderImage = this.scene.add.image(0, 0, imageKey); // 相对容器 0,0

      const targetDisplayWidth = this.HEX_RADIUS * 2;
      let scaleFactor = Math.min(1, targetDisplayWidth / wonderImage.width);
      wonderImage.setScale(scaleFactor);
      wonderImage.setOrigin(0.5, 1.0);

      // 调整位置使其站立在六边形底部
      const verticalOffset = (this.HEX_APOTHEM * this.TILT_FACTOR) * 1.2;
      wonderImage.y = verticalOffset;

      cellContainer.add(wonderImage);
      wonderImage.setInteractive({
        pixelPerfect: true,
        alphaTolerance: 1,
        useHandCursor: true
      });;
    }

    drawBase(false);

    // --- 点击事件：所有格子统一绑定 ---
    // 普通点击逻辑保持不变（仅触发 this.onGridClick）；
    // 但如果当前处于编辑模式（this.editMode.active），点击后只在控制台输出格子编号，
    // 不会触发原有的 onGridClick 回调。退出编辑模式后自动恢复原有点击行为。
    const hitArea = new Phaser.Geom.Polygon(hexPoints);
    graphics.setInteractive(hitArea, Phaser.Geom.Polygon.Contains);
    if (wonderImage) {
      wonderImage.setInteractive();
    }

    const onClick = () => {
      if (this.isDragging) return;
      if (this.editMode && this.editMode.active) {
        console.log(gridId);
        // 切换该格子的持久选中高亮（选中/取消选中），再触发外部选点回调
        this._handleEditModeGridClick(gridId);
        if (typeof this.editMode.onChoose === 'function') {
          this.editMode.onChoose(gridId);
        }
        return;
      }
      if (this.onGridClick) {
        this.onGridClick(gridId);
      }
    };

    [graphics, wonderImage].forEach(obj => {
      if (!obj) return;
      obj.on('pointerdown', onClick);
    });

    // --- 悬浮高亮效果 ---
    // 编辑模式下：任意格子悬浮都会变成半透明实心高亮 + pointer 光标，用于和未选中的格子区分。
    // 非编辑模式下：显示样式保持不变，仍然只有主城（isMain）格子才有 hover 反馈。
    const drawEditHover = (isHover) => {
      if (isHover) {
        graphics.clear();
        graphics.fillStyle(0xffffff, 0.5);
        graphics.fillPoints(hexPoints, true);
        graphics.lineStyle(3, 0xffffff, 0.9);
        graphics.strokePoints(hexPoints, true);
      } else {
        // 退出 hover，恢复成原本（非编辑模式下）的基础显示样式
        drawBase(false);
      }
    };

    const onOver = () => {
      if (this.editMode && this.editMode.active) {
        drawEditHover(true);
        this.scene.input.setDefaultCursor('pointer');
        return;
      }
      drawBase(true);
      if (wonderImage) wonderImage.setAlpha(0.85);
      this.scene.input.setDefaultCursor('pointer');
    };

    const onOut = () => {
      if (this.editMode && this.editMode.active) {
        drawEditHover(false);
        this.scene.input.setDefaultCursor('default');
        return;
      }
      drawBase(false);
      if (wonderImage) wonderImage.setAlpha(1.0);
      this.scene.input.setDefaultCursor('default');
    };

    [graphics, wonderImage].forEach(obj => {
      if (!obj) return;
      obj.on('pointerover', onOver);
      obj.on('pointerout', onOut);
    });

    // 供外部（MapView.setSelectedGrid / clearSelectedGrid）调用，切换选中高亮状态
    const setSelected = (selected) => {
      isSelected = !!selected;
      // 用非 hover 状态重绘一次，让选中/取消选中立即生效
      drawBase(false);
    };

    return { graphics, setSelected };
  }

  // --- 计算带有立体倾斜效果的六边形顶点 ---
  getHexagonPoints(radius) {
    const points = [];
    for (let i = 0; i < 6; i++) {
      // 1. 使用标准的尖顶角度: -30, 30, 90...
      const angleDeg = 60 * i - 30;
      const angleRad = Phaser.Math.DegToRad(angleDeg);

      // 2. 计算原始坐标
      let px = radius * Math.cos(angleRad);
      let py = radius * Math.sin(angleRad);

      // --- 应用 3D 倾斜 ---
      // 通过乘以 tiltFactor 压扁 Y 轴，创造向后倒的透视感。
      py = py * this.TILT_FACTOR;

      points.push({ x: px, y: py });
    }
    return points;
  }

  setupInteraction() {
    // 滚轮缩放
    this.scene.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
      if (!this.interactionEnabled) return;
      const oldZoom = this.currentZoom;
      if (deltaY < 0) this.currentZoom += this.zoomStep;
      else this.currentZoom -= this.zoomStep;

      this.currentZoom = Phaser.Math.Clamp(this.currentZoom, this.minZoom, this.maxZoom);

      if (oldZoom !== this.currentZoom) {
        console.log(`当前缩放比例: ${this.currentZoom.toFixed(3)} (范围: ${this.minZoom} ~ ${this.maxZoom})`);
        const worldX = (pointer.x - this.container.x) / oldZoom;
        const worldY = (pointer.y - this.container.y) / oldZoom;

        this.container.setScale(this.currentZoom);

        this.container.x = pointer.x - worldX * this.currentZoom;
        this.container.y = pointer.y - worldY * this.currentZoom;

        this.constrainMapPosition();
      }
    });

    // 拖拽逻辑
    this.scene.input.on('pointerdown', (pointer) => {
      if (!this.interactionEnabled) return;
      if (pointer.leftButtonDown()) {
        this.isDragging = false;
        this.dragStartX = pointer.x;
        this.dragStartY = pointer.y;
        this.containerStartX = this.container.x;
        this.containerStartY = this.container.y;
      }
    });

    this.scene.input.on('pointermove', (pointer) => {
      if (!this.interactionEnabled) return;
      if (pointer.leftButtonDown()) {
        const dx = pointer.x - this.dragStartX;
        const dy = pointer.y - this.dragStartY;

        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          this.isDragging = true;
          this.container.x = this.containerStartX + dx;
          this.container.y = this.containerStartY + dy;
          this.constrainMapPosition();
        }
      }
    });
  }

  centerMap() {
    const { width, height } = this.scene.scale;

    // 使用背景图的实际宽度和高度来居中，而不是写死的 MAP_WIDTH
    const bgWidth = this.mapBg.width || this.MAP_WIDTH;
    const bgHeight = this.mapBg.height || this.MAP_HEIGHT;

    this.container.x = (width - bgWidth * this.currentZoom) / 2;
    this.container.y = (height - bgHeight * this.currentZoom) / 2;
    this.container.setScale(this.currentZoom);
  }

  constrainMapPosition() {
    const { width, height } = this.scene.scale;

    const bgWidth = this.mapBg.width || this.MAP_WIDTH;
    const bgHeight = this.mapBg.height || this.MAP_HEIGHT;

    // === 根据当前屏幕尺寸与底图动态计算绝对安全的最小缩放 ===
    const minZoomX = width / bgWidth;
    const minZoomY = height / bgHeight;

    this.minZoom = Math.max(0.3, minZoomX, minZoomY);

    // 如果当前的缩放值因某种原因小于最新的安全线，强制修正并同步缩放
    if (this.currentZoom < this.minZoom) {
      this.currentZoom = this.minZoom;
      this.container.setScale(this.currentZoom);
    }
    // ===================================================================

    const mapW = bgWidth * this.currentZoom;
    const mapH = bgHeight * this.currentZoom;

    const minX = width - mapW;
    const maxX = 0;
    const minY = height - mapH;
    const maxY = 0;

    if (mapW < width) this.container.x = (width - mapW) / 2;
    else this.container.x = Phaser.Math.Clamp(this.container.x, minX, maxX);

    if (mapH < height) this.container.y = (height - mapH) / 2;
    else this.container.y = Phaser.Math.Clamp(this.container.y, minY, maxY);
  }

  enableInteraction() {
    this.interactionEnabled = true;
  }

  /**
   * 刷新地图和格子信息，保持当前视角和缩放不变
   * @param {Object} [newSaveData] - 可选，如果有新的存档数据（仅Map部分）可以传入并更新
   */
  refreshMap(newData) {
    if (newData) {
      this.saveData = newData;
    }
    if (this.gridsContainer) {
      this.gridsContainer.removeAll(true);
    }
    this.gridObjects = {};
    this.drawGrids();

    // 重绘会产生全新的格子对象，之前记录的选中格子需要重新应用高亮
    if (this.selectedGridId && this.gridObjects[this.selectedGridId]) {
      this.gridObjects[this.selectedGridId].setSelected(true);
    }
  }

  // 禁用地图交互
  disableInteraction() {
    this.interactionEnabled = false;
    this.isDragging = false; // 重置拖拽状态
  }

  /**
   * 选中指定格子（高亮显示）。如果之前有其它格子处于选中状态，会先取消其高亮。
   * 同一个格子重复调用是安全的（幂等）。
   * @param {string} gridId
   */
  setSelectedGrid(gridId) {
    if (this.selectedGridId && this.selectedGridId !== gridId) {
      this.gridObjects[this.selectedGridId]?.setSelected?.(false);
    }
    this.selectedGridId = gridId;
    this.gridObjects[gridId]?.setSelected?.(true);
  }

  /**
   * 取消当前选中格子的高亮（不传参数时清除全部选中状态）。
   */
  clearSelectedGrid() {
    if (this.selectedGridId) {
      this.gridObjects[this.selectedGridId]?.setSelected?.(false);
    }
    this.selectedGridId = null;
  }
}