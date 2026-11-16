import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import { WONDER } from '../data/wonder.js';
import { REGION } from '../data/region.js';

// 区域颜色映射（与 GridPanel / CreateRegion 保持一致）
// key 对应 REGION[x].color，value 为 Phaser 十六进制颜色
const REGION_COLOR_MAP = {
  living: 0xF2D8A7,
  farm: 0x6DBE45,
  mine: 0x7A7A7A,
  harbor: 0x2E86C1,
  pasture: 0xA3B83A,
  military: 0xB03A2E,
  academy: 0x4B6CB7,
  holy: 0xE8C547,
  trade: 0xE67E22,
  entertainment: 0xC65DFF,
  industry: 0xA04000,
  special: 0x7D3C98,
};

// 区域立绘（都城图片）鼠标悬浮时的透明度
const REGION_IMAGE_HOVER_ALPHA = 0.5;

/**
 * 为大尺寸素材生成"带 mipmap 的 2 的幂次尺寸纹理"，解决大图缩小显示时的锯齿 / 发糊。
 * 原因：WebGL1 只有 2 的幂次尺寸的纹理才能用 mipmap，而 Phaser 默认又只用 LINEAR 过滤，
 *       1258px 的图缩到 ~170px（缩小 7 倍以上）时，双线性采样只会取到相邻 4 个像素，必然出现锯齿 / 闪烁。
 * 做法：先用 canvas 逐级对半缩小到 ≤ maxW 的 2 的幂次尺寸（用 high 质量平滑），
 *       再把纹理的缩小过滤改成 LINEAR_MIPMAP_LINEAR（三线性过滤）。
 * 返回 { key, srcW, srcH, texW, texH }；不支持（Canvas 渲染 / 纹理不存在）时返回 null，调用方继续用原图。
 */
function ensureMipmapTexture(scene, srcKey, maxW = 1024) {
  const textures = scene.textures;
  if (!textures.exists(srcKey)) return null;
  const mipKey = `${srcKey}__mip`;
  const srcImg = textures.get(srcKey).getSourceImage();
  const srcW = srcImg.width;
  const srcH = srcImg.height;
  if (!srcW || !srcH) return null;

  const pow2Floor = (n) => Math.pow(2, Math.floor(Math.log2(Math.max(1, n))));
  const pow2Round = (n) => Math.pow(2, Math.round(Math.log2(Math.max(1, n))));
  const texW = Math.min(maxW, pow2Floor(srcW));
  const texH = Math.max(16, Math.min(maxW, pow2Round(srcH * texW / srcW)));
  const info = { key: mipKey, srcW, srcH, texW, texH };

  if (textures.exists(mipKey)) return info;

  const renderer = scene.game && scene.game.renderer;
  const gl = renderer && renderer.gl;
  if (!gl) return null; // Canvas 渲染没有 mipmap，直接用原图

  // 逐级对半缩小，避免一步缩太多时 drawImage 丢像素
  let cur = srcImg, cw = srcW, ch = srcH;
  const drawTo = (img, w, h) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, w, h);
    return c;
  };
  while (cw > texW * 2 || ch > texH * 2) {
    const nw = Math.max(texW, Math.round(cw / 2));
    const nh = Math.max(texH, Math.round(ch / 2));
    cur = drawTo(cur, nw, nh);
    cw = nw; ch = nh;
  }
  const finalCanvas = drawTo(cur, texW, texH);
  const tex = textures.addCanvas(mipKey, finalCanvas);
  if (!tex) return null;

  // Phaser 对 2 的幂次尺寸的纹理已经 generateMipmap 了，只是缩小过滤默认是 LINEAR（用不上），这里改成三线性
  const wrapper = tex.source[0] && tex.source[0].glTexture;
  if (wrapper && wrapper.webGLTexture) {
    gl.activeTexture(gl.TEXTURE0);
    const prev = gl.getParameter(gl.TEXTURE_BINDING_2D);
    gl.bindTexture(gl.TEXTURE_2D, wrapper.webGLTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // 有的显卡支持各向异性过滤，倾斜缩小时更清晰（不支持就忽略）
    const ext = gl.getExtension('EXT_texture_filter_anisotropic');
    if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(4, gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    wrapper.minFilter = gl.LINEAR_MIPMAP_LINEAR;
    wrapper.magFilter = gl.LINEAR;
    if (prev) gl.bindTexture(gl.TEXTURE_2D, prev);
  }
  return info;
}

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
    this.maxZoom = 1.2; // 原来是 0.66；大地图在所有模式下都能进一步放大
    this.currentZoom = 0.4;
    // 每格滚轮的缩放倍率（按比例缩放：放大后每格的绝对步长也随之变大，0.3 → 1.2 大约 24 格）
    this.zoomFactor = 1.06;

    // --- 拖拽状态 ---
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;

    // --- 区域立绘（都城图片）微调 ---
    // regionImageAdjust: { 区域key: { scale, x, y } }，初始值来自 REGION[key].map_image，GM 调整模式里可以实时修改；
    // regionImages: 当前地图上所有立绘 { key, image, cell, ... }（refreshMap 时重建）；
    // regionImageEditing: 是否处于 GM【调整都城图片】模式（可拖动 / 滚轮缩放）
    this.regionImageAdjust = {};
    this.regionImages = [];
    this.regionImageEditing = false;
    this.selectedRegionImageKey = null;
    this.touchedRegionImageKeys = new Set();
    this.onRegionImageChange = null;

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
      active: false,
      isDevMode: false,
      tempGrids: {},
      onChoose: null,
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
    // 底图是大图（缩小显示），用 LINEAR 双线性过滤；原来的 NEAREST（最近邻）缩小时会有明显锯齿 / 闪烁
    this.mapBg.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
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
    this.editMode.choosePanel = (onChoose, { devMode = false, allowedGridIds = null } = {}) => {
      if (this.editMode.active) {
        console.log('已经处于选点模式，无需重复进入');
        return;
      }
      this.editMode.active = true;
      this.editMode.isDevMode = devMode;
      this.editMode.tempGrids = {};
      this.editMode.selectedGridId = null;
      this.editMode.onChoose = typeof onChoose === 'function' ? onChoose : null;

      // allowedSet：若指定，只有在该集合内的格点才能被选中（包括已绘制格点）
      const allowedSet = allowedGridIds ? new Set(allowedGridIds) : null;
      this.editMode.allowedSet = allowedSet;

      Object.keys(this.gridLayout).forEach((gridId) => {
        if (this.gridObjects[gridId]) return;
        if (allowedSet && !allowedSet.has(gridId)) return;

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
      this.editMode.allowedSet = null;
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
    this.regionImages = [];
    // 只绘制存档（saveData.grids）中存在的格子编号，数据表（mapConfig.grids）
    // 仅用于提供 wonder 等附加信息，不再提供坐标（主城判定改为 saveGridData.isMain）
    const savedGrids = this.saveData.grids || {};
    const templates = this.mapConfig.grids || {};

    // 按格子的 y 坐标从上到下依次创建（同一行按 x），这样下面的格子永远盖在上面的格子之前面——
    // 带立绘的区域/奇观会向上超出六边形，必须用这个顺序才能正确遮挡
    const sortedIds = Object.keys(savedGrids).sort((a, b) => {
      const la = this.gridLayout?.[a], lb = this.gridLayout?.[b];
      if (!la || !lb) return 0;
      return la.y - lb.y || la.x - lb.x;
    });

    sortedIds.forEach((gridId) => {
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

    let fillAlpha = isMain ? 0.8 : 0.5;
    let strokeColor = isMain ? 0xffff00 : 0x606060;
    let strokeWidth = isMain ? 3 : 2;

    // 创建格子容器和图形对象
    const cellContainer = this.scene.add.container(x, y);
    this.gridsContainer.add(cellContainer);

    const graphics = this.scene.add.graphics();
    const hexPoints = this.getHexagonPoints(this.HEX_RADIUS);

    // 提前检查当前格子是否有奇观显示
    const hasWonder = wonder && WONDER[wonder] && WONDER[wonder].image;

    // 区域立绘（都城图片）：纹理 key 为 region_map_<区域key>，由 gameScene 预加载；
    // 没有对应纹理的区域不受影响
    const regionImageKey = region ? `region_map_${region}` : null;
    const hasRegionImage = !!(regionImageKey && this.scene.textures.exists(regionImageKey));

    // 是否被选中（点击后高亮，再次点击取消），由外部通过 setSelected() 控制
    let isSelected = false;

    const drawBase = (isHover = false) => {
      graphics.clear();

      // 计算最终使用的填充透明度和边框透明度
      let currentFillAlpha = isHover ? 0.9 : fillAlpha;
      let currentStrokeAlpha = 1.0;

      // 如果有奇观或区域立绘，且鼠标没有悬浮在格子上，将格子和边框的透明度降为 0.1
      if ((hasWonder || hasRegionImage) && !isHover) {
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

    // 区域立绘（都城图片）：
    //   · 素材的底边顶点、左右两侧边与六边形严丝合缝，所以宽度缩放到六边形宽度（2 × APOTHEM），
    //     底边中心对齐六边形下顶点（y = 半高）；上方高度随素材不同自动向上延伸。
    //   · 图片本身不可交互——点击/悬浮的有效区域始终是下面的纯色六边形，图片不会挡住点击。
    //   · 鼠标悬浮在六边形上，或者悬浮在图片的不透明像素上时，图片变半透明（见 regionImageHover）。
    let regionImage = null;
    let hexHovered = false;
    let imageHovered = false;
    const applyRegionImageFade = () => {
      if (regionImage) {
        // 调整模式下始终完全不透明，方便对着六边形调
        regionImage.setAlpha((!this.regionImageEditing && (hexHovered || imageHovered)) ? REGION_IMAGE_HOVER_ALPHA : 1);
      }
    };
    if (hasRegionImage) {
      // 显示用"带 mipmap 的 2 的幂次尺寸纹理"（缩小不锯齿），点击 / 像素透明度判定仍然用原图（regionImageKey）
      const mip = ensureMipmapTexture(this.scene, regionImageKey);
      regionImage = this.scene.add.image(0, this.HEX_RADIUS * this.TILT_FACTOR, mip ? mip.key : regionImageKey);
      if (mip) regionImage.setData('mip', mip);
      regionImage.setOrigin(0.5, 1.0);
      cellContainer.add(regionImage);

      // 登记到立绘注册表，并按微调参数（缩放 / 偏移）摆放
      const entry = { key: region, baseKey: region, image: regionImage, cell: cellContainer, hexPoints, outline: null, handlers: null };
      this.regionImages.push(entry);
      this._layoutRegionImage(entry);
      this._applyRegionImageClip(entry);
      regionImage.once('destroy', () => {
        this._detachRegionImageEdit(entry);
        this.regionImages = this.regionImages.filter(e => e !== entry);
      });
      if (this.regionImageEditing) this._attachRegionImageEdit(entry);

      // 悬浮在图片（超出六边形的部分）上时也半透明：图片不是交互对象，所以用全局 pointermove
      // 自己判断鼠标下的图片像素是否不透明（和 pixelPerfect 的做法一致）
      const onPointerMove = (pointer) => {
        if (!regionImage || !regionImage.active) return;
        let over = false;
        // 被遮罩切掉的部分（六边形左 / 右 / 左下 / 右下边之外）不显示，也不触发悬浮半透明
        const inClip = this.interactionEnabled && this._pointInRegionImageClip(cellContainer, pointer.worldX, pointer.worldY);
        if (inClip) {
          const p = regionImage.getWorldTransformMatrix().applyInverse(pointer.worldX, pointer.worldY);
          const m = regionImage.getData('mip');
          const kx = m ? m.srcW / m.texW : 1;
          const ky = m ? m.srcH / m.texH : 1;
          const px = Math.floor((p.x + regionImage.displayOriginX) * kx);
          const py = Math.floor((p.y + regionImage.displayOriginY) * ky);
          const srcW = m ? m.srcW : regionImage.width;
          const srcH = m ? m.srcH : regionImage.height;
          if (px >= 0 && py >= 0 && px < srcW && py < srcH) {
            over = this.scene.textures.getPixelAlpha(px, py, `region_map_${entry.key}`) > 20;
          }
        }
        if (over !== imageHovered) {
          imageHovered = over;
          applyRegionImageFade();
        }
      };
      this.scene.input.on('pointermove', onPointerMove);
      // refreshMap 会销毁整个格子容器，图片销毁时顺带移除监听，避免越积越多
      regionImage.once('destroy', () => this.scene.input.off('pointermove', onPointerMove));
    }

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
        // 有白名单时，已绘制格点不在白名单内则不响应
        if (this.editMode.allowedSet && !this.editMode.allowedSet.has(gridId)) return;
        console.log(gridId);
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
      hexHovered = true;
      applyRegionImageFade();
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
      hexHovered = false;
      applyRegionImageFade();
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

  // ════════════════════════════════════════════════
  // 区域立绘（都城图片）微调：GM【调整都城图片】使用
  // ════════════════════════════════════════════════

  /** 取（并惰性初始化）某区域立绘的微调参数 { scale, x, y }，初始值来自 REGION[key].map_image */
  getRegionImageAdjust(key) {
    if (!this.regionImageAdjust[key]) {
      const cfg = REGION?.[key]?.map_image;
      const c = (cfg && typeof cfg === 'object') ? cfg : {};
      this.regionImageAdjust[key] = { scale: c.scale ?? 1, x: c.x ?? 0, y: c.y ?? 0 };
    }
    return this.regionImageAdjust[key];
  }

  /** 按微调参数摆放立绘：基础缩放让图片宽度 = 六边形宽度，底边中心对齐六边形下顶点，再叠加 scale / x / y */
  _layoutRegionImage(entry) {
    const adj = this.getRegionImageAdjust(entry.key);
    const img = entry.image;
    if (!img || !img.active) return;
    const dispW = this.HEX_APOTHEM * 2 * adj.scale;
    const m = img.getData('mip');
    if (m) {
      // mip 纹理是 2 的幂次尺寸（比例被拉伸过），X / Y 分开缩放，还原成原图比例
      img.setScale(dispW / m.texW, (dispW * m.srcH / m.srcW) / m.texH);
    } else {
      img.setScale(dispW / img.width);
    }
    img.setPosition(adj.x, this.HEX_RADIUS * this.TILT_FACTOR + adj.y);
    this._drawRegionImageOutline(entry);
  }

  /** 调整模式下的辅助框：品红色六边形（目标范围）+ 图片边界框（选中的是黄色，其它是青色） */
  _drawRegionImageOutline(entry) {
    if (!entry.outline) return;
    const g = entry.outline;
    const img = entry.image;
    g.clear();
    g.lineStyle(2, 0xff00ff, 1);
    g.strokePoints(entry.hexPoints, true);
    const selected = entry.key === this.selectedRegionImageKey;
    g.lineStyle(selected ? 3 : 1, selected ? 0xffff00 : 0x00ffff, 1);
    g.strokeRect(img.x - img.displayWidth / 2, img.y - img.displayHeight, img.displayWidth, img.displayHeight);
  }

  _notifyRegionImageChange() {
    if (typeof this.onRegionImageChange === 'function') {
      const key = this.selectedRegionImageKey;
      this.onRegionImageChange(key, key ? this.getRegionImageAdjust(key) : null);
    }
  }

  /** 修改某区域的微调参数（会同步到地图上所有该区域的立绘） */
  adjustRegionImage(key, patch) {
    if (!key) return;
    const adj = this.getRegionImageAdjust(key);
    if (patch.scale != null) adj.scale = Math.max(0.1, Math.round(patch.scale * 1000) / 1000);
    if (patch.x != null) adj.x = Math.round(patch.x * 10) / 10;
    if (patch.y != null) adj.y = Math.round(patch.y * 10) / 10;
    this.touchedRegionImageKeys.add(key);
    this.regionImages.filter(e => e.key === key).forEach(e => this._layoutRegionImage(e));
    this._notifyRegionImageChange();
  }

  /** 把某个区域的当前参数复制给地图上所有出现过立绘的区域（想一次调好所有都城时用） */
  applyRegionImageAdjustToAll(key) {
    const src = this.getRegionImageAdjust(key);
    const keys = new Set(this.regionImages.map(e => e.key));
    keys.forEach(k => {
      Object.assign(this.getRegionImageAdjust(k), { scale: src.scale, x: src.x, y: src.y });
      this.touchedRegionImageKeys.add(k);
    });
    this.regionImages.forEach(e => this._layoutRegionImage(e));
    this._notifyRegionImageChange();
  }

  /** 恢复某区域的参数到 region.js 里的初始值 */
  resetRegionImageAdjust(key) {
    delete this.regionImageAdjust[key];
    this.touchedRegionImageKeys.delete(key);
    this.regionImages.filter(e => e.key === key).forEach(e => this._layoutRegionImage(e));
    this._notifyRegionImageChange();
  }

  /**
   * 立绘的显示范围（相对格子中心）：六边形的 左边、左下边、右边、右下边 是硬边界，超出部分被切掉；
   * 只有上方两条边不限制，图片可以向上延伸出去。形状 = 往上无限延伸的"五边形"（两条竖边 + 底部 V 形）。
   */
  _regionImageClipPoints(top = 6000) {
    const A = this.HEX_APOTHEM;
    const RT = this.HEX_RADIUS * this.TILT_FACTOR;
    return [
      { x: -A, y: -top },
      { x: A, y: -top },
      { x: A, y: RT * 0.5 },   // 右边下端 = 六边形右下顶点
      { x: 0, y: RT },         // 底部顶点
      { x: -A, y: RT * 0.5 },  // 左下顶点
    ];
  }

  /** 世界坐标的点是否落在立绘的有效显示范围内（cell = 格子容器） */
  _pointInRegionImageClip(cell, worldX, worldY) {
    if (!cell || !cell.active) return false;
    const p = cell.getWorldTransformMatrix().applyInverse(worldX, worldY);
    const A = this.HEX_APOTHEM;
    const RT = this.HEX_RADIUS * this.TILT_FACTOR;
    if (Math.abs(p.x) > A) return false;
    // 底部 V 形：y ≤ RT − |x| × (RT / 2) / A
    return p.y <= RT - Math.abs(p.x) * (RT * 0.5) / A;
  }

  /**
   * 给立绘加几何遮罩（见 _regionImageClipPoints）。
   * 遮罩图形不在显示列表里，不会跟着容器（地图缩放 / 拖动）一起变换，所以每帧按格子容器的世界变换同步一次位置和缩放。
   */
  _applyRegionImageClip(entry) {
    const scene = this.scene;
    const img = entry.image;
    if (!img || !img.active) return;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff, 1);
    g.fillPoints(this._regionImageClipPoints(), true);
    img.setMask(g.createGeometryMask());

    const m = new Phaser.GameObjects.Components.TransformMatrix();
    const pm = new Phaser.GameObjects.Components.TransformMatrix();
    const sync = () => {
      if (!entry.cell || !entry.cell.active || !g.scene) return;
      entry.cell.getWorldTransformMatrix(m, pm);
      g.setPosition(m.tx, m.ty);
      g.setScale(m.scaleX, m.scaleY);
    };
    sync();
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, sync);
    img.once('destroy', () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, sync);
      g.destroy();
    });
  }

  /** 可用于预览切换的立绘 key 列表（REGION 里配置了 map_image 且素材已加载的区域，即四个都城） */
  getRegionImagePreviewKeys() {
    return Object.keys(REGION).filter(k => REGION[k]?.map_image && this.scene.textures.exists(`region_map_${k}`));
  }

  /** 把某个立绘实例换成另一个区域的立绘（仅预览显示，不改存档；refreshMap / 退出调整模式会还原） */
  _setRegionImageArt(entry, artKey) {
    const srcKey = `region_map_${artKey}`;
    if (!entry.image?.active || !this.scene.textures.exists(srcKey)) return;
    const mip = ensureMipmapTexture(this.scene, srcKey);
    entry.key = artKey;
    entry.image.setTexture(mip ? mip.key : srcKey);
    entry.image.setData('mip', mip || null);
    this._layoutRegionImage(entry);
  }

  /**
   * GM 预览：把当前选中的那个立绘，在四个都城立绘之间手动轮流切换。
   * @param {number} step 1 = 下一张，-1 = 上一张
   */
  cycleRegionImagePreview(step = 1) {
    const entry = this.regionImages.find(e => e.key === this.selectedRegionImageKey) || this.regionImages[0];
    const keys = this.getRegionImagePreviewKeys();
    if (!entry || keys.length < 2) return;
    const i = keys.indexOf(entry.key);
    const next = keys[(i + step + keys.length * 2) % keys.length];
    this._setRegionImageArt(entry, next);
    this.selectedRegionImageKey = next;
    this.regionImages.forEach(e => this._drawRegionImageOutline(e));
    this._notifyRegionImageChange();
  }

  selectRegionImage(key) {
    this.selectedRegionImageKey = key;
    this.regionImages.forEach(e => this._drawRegionImageOutline(e));
    this._notifyRegionImageChange();
  }

  /** 可复制的参数文本：粘贴到 region.js 对应区域的 map_image 即可（只输出调整过的；一个都没调就输出当前选中的） */
  getRegionImageParamsText() {
    const keys = this.touchedRegionImageKeys.size > 0
      ? [...this.touchedRegionImageKeys]
      : (this.selectedRegionImageKey ? [this.selectedRegionImageKey] : []);
    return keys.map(k => {
      const a = this.getRegionImageAdjust(k);
      return `// ${k}\nmap_image: { scale: ${a.scale}, x: ${a.x}, y: ${a.y} },`;
    }).join('\n');
  }

  /**
   * 开 / 关调整模式：
   *   · 拖动图片 = 改偏移；鼠标悬浮在图片上滚轮 = 改缩放（此时地图的拖动 / 滚轮缩放被临时锁住）；
   *   · 图片完全不透明，并显示辅助框（品红六边形 = 目标范围，黄 / 青框 = 图片边界）。
   * @param {boolean} enabled
   * @param {(key:string|null, adj:{scale:number,x:number,y:number}|null)=>void} [onChange] 参数变化 / 选中变化回调
   */
  setRegionImageEditMode(enabled, onChange) {
    this.regionImageEditing = !!enabled;
    this.onRegionImageChange = enabled ? (onChange ?? null) : null;
    if (enabled) {
      if (!this.selectedRegionImageKey || !this.regionImages.some(e => e.key === this.selectedRegionImageKey)) {
        this.selectedRegionImageKey = this.regionImages[0]?.key ?? null;
      }
      this.regionImages.forEach(e => this._attachRegionImageEdit(e));
      this._notifyRegionImageChange();
    } else {
      this.regionImages.forEach(e => this._detachRegionImageEdit(e));
      // 还原预览切换过的立绘
      this.regionImages.forEach(e => { if (e.key !== e.baseKey) this._setRegionImageArt(e, e.baseKey); });
      if (this.selectedRegionImageKey && !this.regionImages.some(e => e.key === this.selectedRegionImageKey)) {
        this.selectedRegionImageKey = this.regionImages[0]?.key ?? null;
      }
      if (this._regionEditMapLocked) { this._regionEditMapLocked = false; this.enableInteraction(); }
    }
    this.regionImages.forEach(e => e.image.setAlpha(1));
  }

  _attachRegionImageEdit(entry) {
    if (entry.handlers || !entry.image?.active) return;
    const img = entry.image;
    const scene = this.scene;
    img.setInteractive({ useHandCursor: true });

    entry.outline = scene.add.graphics();
    entry.cell.add(entry.outline);
    this._drawRegionImageOutline(entry);

    let drag = null;
    const lock = () => {
      if (this.interactionEnabled) { this.disableInteraction(); this._regionEditMapLocked = true; }
    };
    const unlock = () => {
      if (this._regionEditMapLocked && !drag) { this._regionEditMapLocked = false; this.enableInteraction(); }
    };
    const onOver = () => lock();
    const onOut = () => unlock();
    const onDown = (pointer) => {
      lock();
      this.selectRegionImage(entry.key);
      const a = this.getRegionImageAdjust(entry.key);
      drag = { px: pointer.x, py: pointer.y, ox: a.x, oy: a.y };
    };
    const onMove = (pointer) => {
      if (!drag) return;
      // 容器只有“地图缩放”这一层缩放，屏幕像素 / 缩放 = 地图坐标
      this.adjustRegionImage(entry.key, {
        x: drag.ox + (pointer.x - drag.px) / this.currentZoom,
        y: drag.oy + (pointer.y - drag.py) / this.currentZoom,
      });
    };
    const onUp = () => { drag = null; };
    const onWheel = (pointer, over, dx, dy) => {
      if (!over || !over.includes(img)) return;
      this.selectRegionImage(entry.key);
      const a = this.getRegionImageAdjust(entry.key);
      this.adjustRegionImage(entry.key, { scale: a.scale + (dy < 0 ? 0.01 : -0.01) });
    };

    img.on('pointerover', onOver);
    img.on('pointerout', onOut);
    img.on('pointerdown', onDown);
    scene.input.on('pointermove', onMove);
    scene.input.on('pointerup', onUp);
    scene.input.on('wheel', onWheel);
    entry.handlers = { onOver, onOut, onDown, onMove, onUp, onWheel };
  }

  _detachRegionImageEdit(entry) {
    const h = entry.handlers;
    if (!h) return;
    const img = entry.image;
    const scene = this.scene;
    scene.input.off('pointermove', h.onMove);
    scene.input.off('pointerup', h.onUp);
    scene.input.off('wheel', h.onWheel);
    if (img && img.active) {
      img.off('pointerover', h.onOver);
      img.off('pointerout', h.onOut);
      img.off('pointerdown', h.onDown);
      img.disableInteractive();
    }
    if (entry.outline) { entry.outline.destroy(); entry.outline = null; }
    entry.handlers = null;
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
      if (deltaY < 0) this.currentZoom *= this.zoomFactor;
      else this.currentZoom /= this.zoomFactor;

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