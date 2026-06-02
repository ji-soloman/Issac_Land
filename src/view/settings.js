import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import { saveSystem } from '../system/saveSystem.js';

export class Settings {
  constructor(scene) {
    this.scene = scene;

    // 配置菜单列表
    this.menuList = ['显示'];
    this.currentMenu = this.menuList[0];

    // 垂直滚动参数
    this.scrollY = 0;
    this.maxScrollY = 0;

    this.create();
  }

  // 防止点击穿透到底层
  preventEventPenetration(element, isScrollArea = false) {
    if (!element.input) {
      element.setInteractive();
    }
    element.on('pointerdown', (p, lx, ly, e) => { if (e) e.stopPropagation(); });
    element.on('pointerup', (p, lx, ly, e) => { if (e) e.stopPropagation(); });
    element.on('pointermove', (p, lx, ly, e) => { if (e) e.stopPropagation(); });
    element.on('wheel', (p, dx, dy, dz, e) => {
      if (e) e.stopPropagation();
      // 在左侧列表区支持滚轮垂直滚动
      if (isScrollArea) {
        this.handleScroll(dy);
      }
    });
  }

  create() {
    const { width, height } = this.scene.scale;

    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(3000); // 设置一个较高的层级覆盖下方UI
    this.container.setScrollFactor(0); // 确保整个设置面板固定在屏幕上，不随地图相机滚动

    // 全屏纯黑打底半透明遮罩
    const fullBg = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0.7);
    fullBg.setOrigin(0, 0);
    this.preventEventPenetration(fullBg);
    this.container.add(fullBg);

    // 主面板区域宽高 (居中占 80%)
    const panelWidth = width * 0.8;
    const panelHeight = height * 0.8;
    const panelX = (width - panelWidth) / 2;
    const panelY = (height - panelHeight) / 2;

    // 主面板背景
    const mainPanel = this.scene.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0x1a1a1a);
    mainPanel.setOrigin(0, 0);
    mainPanel.setStrokeStyle(4, 0x555555);
    this.preventEventPenetration(mainPanel);
    this.container.add(mainPanel);

    // 顶部标题和关闭按钮
    const titleText = this.scene.add.text(panelX + 30, panelY + 20, '设置', {
      fontSize: '32px', color: '#ffffff', fontStyle: 'bold', padding: { top: 2 }
    });
    this.container.add(titleText);

    const closeBtn = this.scene.add.text(panelX + panelWidth - 40, panelY + 35, '✕', {
      fontSize: '36px', color: '#aaaaaa', fontStyle: 'bold'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', (p, lx, ly, e) => {
      if (e) e.stopPropagation();
      this.close();
    });
    closeBtn.on('pointerover', () => closeBtn.setColor('#ffffff'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#aaaaaa'));
    this.container.add(closeBtn);

    // 分割线 (Y起始点避开标题)
    const startContentY = panelY + 80;
    const contentHeight = panelHeight - 80;

    // 左边 30% 区域，右边 70% 区域
    const leftWidth = panelWidth * 0.3;
    const rightWidth = panelWidth * 0.7;

    const separator = this.scene.add.rectangle(panelX + leftWidth, startContentY, 2, contentHeight, 0x555555).setOrigin(0.5, 0);
    this.container.add(separator);

    // ================= 左侧导航菜单区 =================
    this.leftContainer = this.scene.add.container(panelX, startContentY);
    this.scrollContainer = this.scene.add.container(0, 0);
    this.leftContainer.add(this.scrollContainer);
    this.container.add(this.leftContainer);

    // 为左侧创建一个透明遮罩接收鼠标滚轮事件
    const leftHitArea = this.scene.add.rectangle(0, 0, leftWidth, contentHeight, 0x000000, 0).setOrigin(0, 0);
    this.preventEventPenetration(leftHitArea, true);
    this.leftContainer.add(leftHitArea);

    // 设置左侧显示遮罩 mask，超过部分将被隐藏
    const maskGraphics = this.scene.add.graphics();
    maskGraphics.setScrollFactor(0); // 确保遮罩图形的世界坐标固定，不随大地图相机滚动而漂移
    maskGraphics.fillStyle(0xffffff);
    maskGraphics.fillRect(panelX, startContentY, leftWidth, contentHeight);
    const mask = maskGraphics.createGeometryMask();
    maskGraphics.setVisible(false);
    this.leftContainer.setMask(mask);
    // 移除了原先的 this.container.add(maskGraphics); 
    // 几何遮罩的 Graphics 绝不能 add 到 Container 中，否则在 WebGL 下会导致 Stencil 状态机污染导致地图变黑。

    // 渲染左侧按钮
    this.renderLeftMenu(leftWidth);

    // ================= 右侧内容区 =================
    this.rightContainer = this.scene.add.container(panelX + leftWidth, startContentY);
    this.container.add(this.rightContainer);

    // 默认加载第一个菜单的功能内容
    this.switchMenu(this.currentMenu, rightWidth);

    // 打开面板的渐入动画
    this.container.alpha = 0;
    this.scene.tweens.add({ targets: this.container, alpha: 1, duration: 200 });
  }

  renderLeftMenu(leftWidth) {
    let currentY = 0;
    const itemHeight = 60;

    this.menuButtons = [];

    this.menuList.forEach((menuName) => {
      const btnGroup = this.scene.add.container(0, currentY);

      // 菜单按钮背景
      const btnBg = this.scene.add.rectangle(0, 0, leftWidth, itemHeight, 0x333333).setOrigin(0, 0);
      btnBg.setInteractive({ useHandCursor: true });

      const text = this.scene.add.text(leftWidth / 2, itemHeight / 2, menuName, {
        fontSize: '24px', color: '#ffffff', fontStyle: 'bold', padding: { top: 2 }
      }).setOrigin(0.5, 0.5);

      btnBg.on('pointerdown', (p, lx, ly, e) => {
        if (e) e.stopPropagation();
        this.switchMenu(menuName, leftWidth / 0.3 * 0.7);
      });

      // 保存引用用来高亮当前项
      this.menuButtons.push({ name: menuName, bg: btnBg, text: text });

      btnGroup.add([btnBg, text]);
      this.scrollContainer.add(btnGroup);

      currentY += itemHeight;
    });

    // 计算滚动的最大高度 (如果有更多按钮超过区域)
    const contentHeight = this.container.list[1].height - 80; // 面板高度 - 标题区
    this.maxScrollY = Math.max(0, currentY - contentHeight);
  }

  handleScroll(delta) {
    if (this.maxScrollY <= 0) return;

    this.scrollY -= delta;
    this.scrollY = Phaser.Math.Clamp(this.scrollY, -this.maxScrollY, 0);

    this.scrollContainer.y = this.scrollY;
  }

  switchMenu(menuName, rightWidth) {
    this.currentMenu = menuName;

    // 刷新左侧选中高亮
    this.menuButtons.forEach(btn => {
      if (btn.name === menuName) {
        btn.bg.setFillStyle(0x555555); // 选中颜色
        btn.text.setColor('#ffd700');
      } else {
        btn.bg.setFillStyle(0x333333); // 默认颜色
        btn.text.setColor('#ffffff');
      }
    });

    // 清空右侧现有内容
    this.rightContainer.removeAll(true);

    // 根据选中的项挂载对应 UI 模块
    if (menuName === '显示') {
      this.renderDisplaySettings(rightWidth);
    }
  }

  renderDisplaySettings(rightWidth) {
    const rowY = 40; // 第一行功能的 Y 轴偏移量

    // 左侧：文本说明（满足 padding 为 3.5 的特殊定制需求）
    const labelText = this.scene.add.text(40, rowY, '地形显示', {
      fontSize: '22px', color: '#ffffff', fontStyle: 'bold', padding: { top: 3.5 }
    }).setOrigin(0, 0.5);

    // 右侧：“编辑”按钮
    // 按钮靠右对齐：向左偏移 40 像素的间距
    const btnX = rightWidth - 40;

    const editBtnBg = this.scene.add.rectangle(btnX, rowY, 100, 44, 0x444444).setOrigin(1, 0.5);
    editBtnBg.setStrokeStyle(2, 0x888888);
    editBtnBg.setInteractive({ useHandCursor: true });

    const editBtnText = this.scene.add.text(btnX - 50, rowY, '编辑', {
      fontSize: '20px', color: '#ffffff', padding: { top: 2 }
    }).setOrigin(0.5, 0.5);

    editBtnBg.on('pointerdown', (p, lx, ly, e) => {
      if (e) e.stopPropagation();

      // 防止重复连续点击打开多个透明度编辑子界面
      if (this.scene.editOpacityInstance) return;

      // 实例化在同文件底部定义的编辑地形透明度新界面，且不关闭当前的设置界面
      this.scene.editOpacityInstance = new EditTerrainOpacity(this.scene);
    });

    editBtnBg.on('pointerover', () => editBtnBg.setFillStyle(0x666666));
    editBtnBg.on('pointerout', () => editBtnBg.setFillStyle(0x444444));

    this.rightContainer.add([labelText, editBtnBg, editBtnText]);
  }

  close() {
    if (this.isClosing) return;
    this.isClosing = true;

    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        // 【销毁时释放全局锁】确保下次能够正常再次打开设置
        if (this.scene.settingsInstance === this) {
          this.scene.settingsInstance = null;
        }
        this.container.destroy();
      }
    });
  }
}

// ==========================================
// 编辑地形透明度界面类
// ==========================================
class EditTerrainOpacity {
  constructor(scene) {
    this.scene = scene;

    // 读取当前透明度，不存在或者不合法则默认 0.9（合法范围 [0.5, 0.9]）
    let initialOpacity = 0.9;
    if (this.scene.saveData && this.scene.saveData.settings && typeof this.scene.saveData.settings.grid_opacity === 'number') {
      const val = this.scene.saveData.settings.grid_opacity;
      if (val >= 0.5 && val <= 0.9) {
        initialOpacity = val;
      }
    }
    this.currentOpacity = initialOpacity;

    this.create();
  }

  // 防止点击事件穿透到下层的设置面板
  preventEventPenetration(element) {
    if (!element.input) {
      element.setInteractive();
    }
    element.on('pointerdown', (p, lx, ly, e) => { if (e) e.stopPropagation(); });
    element.on('pointerup', (p, lx, ly, e) => { if (e) e.stopPropagation(); });
    element.on('pointermove', (p, lx, ly, e) => { if (e) e.stopPropagation(); });
    element.on('wheel', (p, dx, dy, dz, e) => { if (e) e.stopPropagation(); });
  }

  create() {
    const { width, height } = this.scene.scale;

    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(4000); // 确保在设置界面（3000）之上，以此不关闭之前的设置界面
    this.container.setScrollFactor(0); // 确保编辑地形透明度面板固定在屏幕上，不随地图相机滚动

    // 全屏半透明黑色背景层，用来锁定下层交互
    const fullBg = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0.6);
    fullBg.setOrigin(0, 0);
    this.preventEventPenetration(fullBg);
    this.container.add(fullBg);

    // 弹窗主面板大小及定位
    const panelWidth = 540;
    const panelHeight = 520;
    const panelX = (width - panelWidth) / 2;
    const panelY = (height - panelHeight) / 2;

    const mainPanel = this.scene.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0x222222);
    mainPanel.setOrigin(0, 0);
    mainPanel.setStrokeStyle(4, 0x666666);
    this.preventEventPenetration(mainPanel);
    this.container.add(mainPanel);

    // 界面标题
    const titleText = this.scene.add.text(panelX + panelWidth / 2, panelY + 30, '编辑地形透明度', {
      fontSize: '26px', color: '#ffffff', fontStyle: 'bold', padding: { top: 2 }
    }).setOrigin(0.5);
    this.container.add(titleText);

    // ================== 上方图片与遮罩区域 ==================
    const imgX = panelX + panelWidth / 2;
    const imgY = panelY + 180;

    // 底图 terrain_land
    const terrainImg = this.scene.add.image(imgX, imgY, 'terrain_land');
    // 约束展示尺寸，避免大图溢出
    const maxW = 440;
    const maxH = 200;
    const ratio = terrainImg.width / terrainImg.height;
    if (terrainImg.width > maxW || terrainImg.height > maxH) {
      if (ratio > maxW / maxH) {
        terrainImg.setDisplaySize(maxW, maxW / ratio);
      } else {
        terrainImg.setDisplaySize(maxH * ratio, maxH);
      }
    }
    this.container.add(terrainImg);

    // 图片上方覆盖的颜色为 0xf4f0e6 的遮罩，大小与底图一致
    const maskW = terrainImg.displayWidth;
    const maskH = terrainImg.displayHeight;
    this.maskRect = this.scene.add.rectangle(imgX, imgY, maskW, maskH, 0xf4f0e6, this.currentOpacity);
    this.container.add(this.maskRect);

    // 实时透明度状态显示文本
    this.valueIndicator = this.scene.add.text(panelX + panelWidth / 2, panelY + 300, `当前透明度: ${this.currentOpacity.toFixed(2)}`, {
      fontSize: '18px', color: '#ffd700', padding: { top: 2 }
    }).setOrigin(0.5);
    this.container.add(this.valueIndicator);

    // ================== 下方横向拉条区域 ==================
    const sliderY = panelY + 360;
    const sliderWidth = 340;
    const sliderLeftX = panelX + (panelWidth - sliderWidth) / 2;

    // 拉条底槽
    const sliderTrack = this.scene.add.rectangle(sliderLeftX, sliderY, sliderWidth, 8, 0x444444).setOrigin(0, 0.5);
    this.container.add(sliderTrack);

    // 计算圆形滑块初始位置映射 (将区间 [0.5, 0.9] 映射到拉条长度 [0, 1])
    const initialPercent = (this.currentOpacity - 0.5) / 0.4;
    const handleStartX = sliderLeftX + initialPercent * sliderWidth;

    // 圆形按钮滑块
    const handleCircle = this.scene.add.circle(handleStartX, sliderY, 14, 0xffd700);
    handleCircle.setStrokeStyle(2, 0xffffff);
    handleCircle.setInteractive({ draggable: true, useHandCursor: true });
    this.container.add(handleCircle);

    // 点击并拖拽事件绑定
    handleCircle.on('drag', (pointer, dragX, dragY) => {
      // 限制左右拖拽边界
      const clampedX = Phaser.Math.Clamp(dragX, sliderLeftX, sliderLeftX + sliderWidth);
      handleCircle.x = clampedX;

      // 换算百分比并映射到合法透明度范围 [0.5, 0.9]
      const currentPercent = (clampedX - sliderLeftX) / sliderWidth;
      const calculatedOpacity = 0.5 + currentPercent * 0.4;

      // 透明度精确到小数点后2位
      this.currentOpacity = Math.round(calculatedOpacity * 100) / 100;

      // 移动的同时上面的显示和遮罩实时同步更新
      this.maskRect.setAlpha(this.currentOpacity);
      this.valueIndicator.setText(`当前透明度: ${this.currentOpacity.toFixed(2)}`);
    });

    // ================== 最下方控制按钮 ==================
    const btnY = panelY + 450;

    // “取消”按钮
    const cancelBtnBg = this.scene.add.rectangle(panelX + 140, btnY, 110, 44, 0x444444).setOrigin(0.5);
    cancelBtnBg.setStrokeStyle(2, 0x888888);
    cancelBtnBg.setInteractive({ useHandCursor: true });
    const cancelBtnText = this.scene.add.text(panelX + 140, btnY, '取消', { fontSize: '20px', color: '#ffffff', padding: { top: 2 } }).setOrigin(0.5);

    cancelBtnBg.on('pointerdown', (p, lx, ly, e) => {
      if (e) e.stopPropagation();
      this.closeAndRelease(); // 调用统一的关闭释放逻辑
    });
    cancelBtnBg.on('pointerover', () => cancelBtnBg.setFillStyle(0x555555));
    cancelBtnBg.on('pointerout', () => cancelBtnBg.setFillStyle(0x444444));

    // “保存”按钮
    const saveBtnBg = this.scene.add.rectangle(panelX + panelWidth - 140, btnY, 110, 44, 0x554433).setOrigin(0.5);
    saveBtnBg.setStrokeStyle(2, 0xffd700);
    saveBtnBg.setInteractive({ useHandCursor: true });
    const saveBtnText = this.scene.add.text(panelX + panelWidth - 140, btnY, '保存', { fontSize: '20px', color: '#ffd700', fontStyle: 'bold', padding: { top: 2 } }).setOrigin(0.5);

    saveBtnBg.on('pointerdown', (p, lx, ly, e) => {
      if (e) e.stopPropagation();

      // 点击保存才会进行数值存储
      if (!this.scene.saveData) this.scene.saveData = {};
      if (!this.scene.saveData.settings) this.scene.saveData.settings = {};

      this.scene.saveData.settings.grid_opacity = this.currentOpacity;
      saveSystem.save().then(() => {
        console.log(`[存储完毕] 地形遮罩透明度已设为: ${this.currentOpacity}`);
        this.closeAndRelease();
      })
    });
    saveBtnBg.on('pointerover', () => saveBtnBg.setFillStyle(0x665544));
    saveBtnBg.on('pointerout', () => saveBtnBg.setFillStyle(0x554433));

    this.container.add([cancelBtnBg, cancelBtnText, saveBtnBg, saveBtnText]);

    // 缓动淡入显示
    this.container.alpha = 0;
    this.scene.tweens.add({ targets: this.container, alpha: 1, duration: 150 });
  }

  // 统一负责释放实例锁并销毁容器
  closeAndRelease() {
    if (this.scene.editOpacityInstance === this) {
      this.scene.editOpacityInstance = null;
    }
    this.container.destroy();
  }
}