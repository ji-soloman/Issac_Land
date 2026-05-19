import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import { GREAT_PEOPLE } from '../../data/great_people.js';
import { GREAT_PEOPLE_MAP } from '../../data/great_people_map.js';

export class GreatPeopleSystem {
  constructor(scene) {
    this.scene = scene;

    // 滚动参数
    this.scrollX = 0;
    this.maxScrollX = 0;

    this.create();
  }

  // 核心事件屏蔽方法
  preventEventPenetration(element, isScrollArea = false) {
    if (!element.input) {
      element.setInteractive();
    }
    element.on('pointerdown', (p, lx, ly, e) => { if (e) e.stopPropagation(); });
    element.on('pointerup', (p, lx, ly, e) => { if (e) e.stopPropagation(); });
    element.on('pointermove', (p, lx, ly, e) => { if (e) e.stopPropagation(); });
    element.on('wheel', (p, dx, dy, dz, e) => {
      if (e) e.stopPropagation();
      // 支持鼠标滚轮进行横向滚动
      if (isScrollArea) {
        const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
        this.handleScroll(delta);
      }
    });
  }

  create() {
    const { width, height } = this.scene.scale;

    // 主容器
    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(2000);

    // 1. 全屏黑色半透明遮罩 (完全阻挡下层点击)
    const fullBg = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0.85);
    fullBg.setOrigin(0, 0);
    this.preventEventPenetration(fullBg, true);
    this.container.add(fullBg);

    // 2. 顶部标题
    const title = this.scene.add.text(width / 2, 60, "名人", {
      fontSize: '40px', color: '#ffd700', fontStyle: 'bold', padding: { top: 4 }
    }).setOrigin(0.5);
    this.container.add(title);

    // 关闭按钮
    const closeBtn = this.scene.add.text(width - 60, 60, '✕', {
      fontSize: '44px', color: '#ffffff', padding: { top: 4 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.preventEventPenetration(closeBtn);
    closeBtn.on('pointerdown', () => this.close());
    this.container.add(closeBtn);

    // 布局参数配置
    this.listAreaX = width * 0.1;       // 列表区域起始 X
    this.listAreaY = 150;               // 列表区域起始 Y
    this.listAreaWidth = width * 0.8;   // 列表可视宽度
    this.listAreaHeight = height * 0.6; // 列表可视高度

    // 图片 3:4 比例尺寸
    const itemWidth = 240;
    const itemHeight = 320;
    const spacing = 60; // 每个人物之间的间距

    // 3. 创建滚动容器和遮罩
    this.scrollContainer = this.scene.add.container(this.listAreaX, this.listAreaY);
    this.container.add(this.scrollContainer);

    const maskGraphics = this.scene.add.graphics();
    maskGraphics.fillStyle(0xffffff);
    maskGraphics.fillRect(this.listAreaX, this.listAreaY - 20, this.listAreaWidth, this.listAreaHeight + 40);

    const mask = maskGraphics.createGeometryMask();
    maskGraphics.setVisible(false); // 隐藏绘制出的白色矩形

    this.container.add(maskGraphics);
    this.scrollContainer.setMask(mask);

    // 4. 渲染人物列表
    let currentX = 0;

    for (const [key, config] of Object.entries(GREAT_PEOPLE)) {
      const itemGroup = this.scene.add.container(currentX, 0);

      // 图片预加载的 key 格式
      const textureKey = `great_people_${key}`;
      let img;

      if (this.scene.textures.exists(textureKey)) {
        img = this.scene.add.image(itemWidth / 2, itemHeight / 2, textureKey);
        // 强制缩放为宽3高4
        img.setDisplaySize(itemWidth, itemHeight);
      } else {
        img = this.scene.add.rectangle(itemWidth / 2, itemHeight / 2, itemWidth, itemHeight, 0x333333).setStrokeStyle(2, 0x555555);
      }

      // 名字文本
      const nameText = this.scene.add.text(itemWidth / 2, itemHeight + 20, config.name, {
        fontSize: '24px', color: '#ffffff', fontStyle: 'bold', padding: { top: 4 }
      }).setOrigin(0.5, 0);

      img.setInteractive({ useHandCursor: true });
      img.on('pointerdown', (p, lx, ly, e) => {
        if (e) e.stopPropagation();
        console.log(`点击了名人: ${config.name}`);

        // 根据 config.map 的配置动态拉起地图界面
        if (config.map && GREAT_PEOPLE_MAP[config.map]) {
          this.loadAndOpenMap(config.map);
        }
      });

      itemGroup.add([img, nameText]);
      this.scrollContainer.add(itemGroup);

      currentX += itemWidth + spacing;
    }

    // 计算总内容宽度并处理滚动条
    const totalContentWidth = currentX > 0 ? currentX - spacing : 0;
    this.maxScrollX = Math.max(0, totalContentWidth - this.listAreaWidth);

    // 5. 生成底部横向滚动条
    this.createScrollBar(totalContentWidth);

    // 登场动画
    this.container.alpha = 0;
    this.scene.tweens.add({ targets: this.container, alpha: 1, duration: 250 });
  }

  // 动态加载并打开对应地图
  loadAndOpenMap(mapId) {
    const mapData = GREAT_PEOPLE_MAP[mapId];
    if (!mapData) return;

    // 关闭之前的名人界面
    this.close();

    const { width, height } = this.scene.scale;
    // 添加过渡时期的加载文字提示
    const loadingText = this.scene.add.text(width / 2, height / 2, '正在加载区域...', {
      fontSize: '32px', color: '#ffffff'
    }).setOrigin(0.5).setDepth(3000);

    let needLoad = false;

    // 检查并加载主背景图
    const bgKey = `map_bg_${mapId}`;
    if (!this.scene.textures.exists(bgKey) && mapData.url) {
      this.scene.load.image(bgKey, mapData.url);
      needLoad = true;
    }

    // 检查并加载所有的 event 图片
    if (mapData.events) {
      for (const [evtKey, evtData] of Object.entries(mapData.events)) {
        const eventImgKey = `map_event_${mapId}_${evtKey}`;
        if (evtData.image && !this.scene.textures.exists(eventImgKey)) {
          this.scene.load.image(eventImgKey, evtData.image);
          needLoad = true;
        }
      }
    }

    const startMapSystem = () => {
      if (loadingText) loadingText.destroy();
      new GreatPeopleMapSystem(this.scene, mapData, mapId);
    };

    if (needLoad) {
      this.scene.load.once('complete', startMapSystem);
      this.scene.load.start(); // 立即触发动态加载
    } else {
      startMapSystem(); // 如果都已经加载过了直接显示
    }
  }

  createScrollBar(totalContentWidth) {
    if (this.maxScrollX <= 0) return;

    const scrollBarY = this.listAreaY + this.listAreaHeight + 50;

    // 滚动槽
    this.trackX = this.listAreaX;
    this.trackWidth = this.listAreaWidth;
    const track = this.scene.add.rectangle(this.trackX, scrollBarY, this.trackWidth, 10, 0x333333).setOrigin(0, 0.5);
    this.container.add(track);

    // 滚动滑块
    this.scrollHandleWidth = Math.max(50, (this.listAreaWidth / totalContentWidth) * this.trackWidth);
    this.scrollHandle = this.scene.add.rectangle(this.trackX, scrollBarY, this.scrollHandleWidth, 20, 0xffd700).setOrigin(0, 0.5);
    this.container.add(this.scrollHandle);

    this.scrollHandle.setInteractive({ draggable: true, useHandCursor: true });
    this.preventEventPenetration(this.scrollHandle);

    this.scrollHandle.on('drag', (pointer, dragX, dragY) => {
      const localX = dragX - this.trackX;
      this.updateScrollByHandle(localX);
    });
  }

  updateScrollByHandle(localX) {
    const availableTrack = this.trackWidth - this.scrollHandleWidth;
    const clampedX = Phaser.Math.Clamp(localX, 0, availableTrack);
    const scrollPercent = clampedX / availableTrack;

    this.scrollX = -(scrollPercent * this.maxScrollX);
    this.scrollContainer.x = this.listAreaX + this.scrollX;
    this.scrollHandle.x = this.trackX + clampedX;
  }

  handleScroll(delta) {
    if (this.maxScrollX <= 0) return;

    this.scrollX -= delta * 0.8;
    this.scrollX = Phaser.Math.Clamp(this.scrollX, -this.maxScrollX, 0);

    this.scrollContainer.x = this.listAreaX + this.scrollX;

    if (this.scrollHandle) {
      const scrollPercent = this.scrollX / (-this.maxScrollX);
      const availableTrack = this.trackWidth - this.scrollHandleWidth;
      const targetHandleX = scrollPercent * availableTrack;
      this.scrollHandle.x = this.trackX + targetHandleX;
    }
  }

  close() {
    if (this.isClosing) return;
    this.isClosing = true;

    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        if (this.scene.closeCurrentSystem) {
          this.scene.closeCurrentSystem();
        } else {
          if (this.container) {
            this.container.destroy();
          }
        }
      },
    });
  }
}

// ============== 地图系统类 ================
export class GreatPeopleMapSystem {
  constructor(scene, mapData, mapId) {
    this.scene = scene;
    this.mapData = mapData;
    this.mapId = mapId;

    // 开发者调试工具相关的状态记录
    this.currentDebugImg = null;
    this.currentDebugData = null;
    this.currentCoverScale = 1;

    this.create();
  }

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
    this.container.setDepth(2000);

    // 全屏纯黑打底遮罩
    const fullBg = this.scene.add.rectangle(0, 0, width, height, 0x000000, 1);
    fullBg.setOrigin(0, 0);
    this.preventEventPenetration(fullBg);
    this.container.add(fullBg);

    // 1. 渲染大地图，并应用 background-size: cover 逻辑
    const bgKey = `map_bg_${this.mapId}`;
    const mapImg = this.scene.add.image(width / 2, height / 2, bgKey);

    // 获取原图大小以计算比例
    const imgW = mapImg.width || 1;
    const imgH = mapImg.height || 1;

    const scaleX = width / imgW;
    const scaleY = height / imgH;

    // 取宽高中最大的那个进行等比缩放 (实现 cover 效果)
    const coverScale = Math.max(scaleX, scaleY);
    this.currentCoverScale = coverScale; // 存入实例供调试工具使用
    mapImg.setScale(coverScale);
    this.container.add(mapImg);

    // --- 新增：在正上方加上 map.name ---
    if (this.mapData.name) {
      const mapTitleText = this.scene.add.text(width / 2, 50, this.mapData.name, {
        fontSize: '48px', color: '#ffffff', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 6,
        shadow: { offsetX: 2, offsetY: 2, color: '#000000', blur: 4, fill: true }
      }).setOrigin(0.5);
      this.container.add(mapTitleText);
    }

    // 创建开发者调试UI (默认隐藏)
    this.createDebugPanel();

    // 2. 根据记录的地图缩放比例渲染事件图片
    if (this.mapData.events) {
      for (const [evtKey, evtData] of Object.entries(this.mapData.events)) {
        if (!evtData.image || !evtData.location) continue; // 如果没有图片或坐标数据则跳过

        const loc = evtData.location;

        // 公式：页面宽度 * 百分比x[0] + 偏移量x[1]
        const posX = width * (loc.x[0] || 0) + (loc.x[1] || 0);
        const posY = height * (loc.y[0] || 0) + (loc.y[1] || 0);

        const eventImgKey = `map_event_${this.mapId}_${evtKey}`;
        const eventImg = this.scene.add.image(posX, posY, eventImgKey);

        // 初始化缺失的参数，防止调试报错
        if (loc.scale === undefined) loc.scale = 1;
        if (loc.x[1] === undefined) loc.x[1] = 0;
        if (loc.y[1] === undefined) loc.y[1] = 0;

        // 实际缩放比例 = 之前记录的地图缩放比例 * 自身配置的scale
        const finalScale = coverScale * loc.scale;
        eventImg.setScale(finalScale);

        // --- 开发/正式 切换区 --- 
        // 开启了 draggable: true 支持拖拽
        eventImg.setInteractive({ useHandCursor: true, draggable: true });
        this.preventEventPenetration(eventImg);

        // 点击事件：当前为触发调试小窗。正式版将这部分注释掉，解开下方的 function 触发
        eventImg.on('pointerdown', (p, lx, ly, e) => {
          if (e) e.stopPropagation();

          // ===【正式版解开这里的注释，同时注释掉下方的 openDebugPanel】===
          // if (typeof evtData.function === 'function') {
          //   evtData.function({ scene: this.scene, mapSystem: this, eventData: evtData });
          // }

          // ===【调试期使用】===
          this.openDebugPanel(eventImg, evtData);
        });

        // 拖拽事件：仅调试期需要，正式版可整段注释
        eventImg.on('drag', (pointer, dragX, dragY) => {
          eventImg.x = dragX;
          eventImg.y = dragY;

          // 重新计算百分比（精确到两位小数）并反向推算产生的小幅像素偏差，保证强适配性
          const newPercentX = Math.round((dragX / width) * 100) / 100;
          const newPercentY = Math.round((dragY / height) * 100) / 100;

          loc.x[0] = newPercentX;
          loc.x[1] = Math.round(dragX - width * newPercentX);

          loc.y[0] = newPercentY;
          loc.y[1] = Math.round(dragY - height * newPercentY);

          // 如果调试面板刚好打开了这个对象，实时刷新参数
          if (this.currentDebugImg === eventImg) {
            this.updateDebugText();
          }
        });

        this.container.add(eventImg);
      }
    }

    // 关闭地图按钮
    const closeBtn = this.scene.add.text(width - 60, 60, '✕', {
      fontSize: '44px', color: '#ffffff', padding: { top: 4 }, stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.preventEventPenetration(closeBtn);
    closeBtn.on('pointerdown', () => this.close());
    this.container.add(closeBtn);

    // 登场渐变
    this.container.alpha = 0;
    this.scene.tweens.add({ targets: this.container, alpha: 1, duration: 250 });
  }

  // ================= 开发者工具区域 =================
  createDebugPanel() {
    this.debugPanel = this.scene.add.container(20, 20);
    this.debugPanel.setDepth(3000);
    this.debugPanel.setVisible(false); // 默认隐藏

    // 黑色半透明背景框
    const bg = this.scene.add.rectangle(0, 0, 220, 220, 0x000000, 0.8).setOrigin(0, 0);
    bg.setStrokeStyle(2, 0xffd700);
    this.preventEventPenetration(bg);
    this.debugPanel.add(bg);

    // 快捷创建按钮方法
    const createBtn = (x, y, text, callback, w = 40, fontSize = '20px') => {
      const btnBg = this.scene.add.rectangle(x, y, w, 30, 0x555555).setOrigin(0, 0);
      const btnTxt = this.scene.add.text(x + w / 2, y + 15, text, {
        fontSize: fontSize, color: '#ffffff'
      }).setOrigin(0.5);

      btnBg.setInteractive({ useHandCursor: true });
      btnBg.on('pointerdown', (p, lx, ly, e) => {
        if (e) e.stopPropagation();
        callback();
      });
      this.debugPanel.add([btnBg, btnTxt]);
    };

    // 第一排：缩放和关闭
    createBtn(10, 10, '+', () => this.adjustScale(0.01));
    createBtn(60, 10, '-', () => this.adjustScale(-0.01));
    createBtn(170, 10, '×', () => this.debugPanel.setVisible(false));

    // 第二、三排：方向键十字排布
    createBtn(90, 50, '↑', () => this.adjustPos(0, -1));
    createBtn(40, 90, '←', () => this.adjustPos(-1, 0));
    createBtn(90, 90, '↓', () => this.adjustPos(0, 1));
    createBtn(140, 90, '→', () => this.adjustPos(1, 0));

    // 参数显示文本
    this.debugInfoText = this.scene.add.text(10, 130, '', {
      fontSize: '14px', color: '#00ff00', lineHeight: 1.5
    });
    this.debugPanel.add(this.debugInfoText);

    // 第四排：复制按钮
    createBtn(10, 180, '复制参数', () => this.copyDebugParams(), 90, '14px');

    this.container.add(this.debugPanel);
  }

  openDebugPanel(img, evtData) {
    this.currentDebugImg = img;
    this.currentDebugData = evtData;
    this.debugPanel.setVisible(true);
    this.updateDebugText();
  }

  adjustScale(delta) {
    if (!this.currentDebugData) return;
    const loc = this.currentDebugData.location;
    loc.scale += delta;
    // 解决浮点数精度问题，如 1.01000000001
    loc.scale = Math.round(loc.scale * 100) / 100;

    const finalScale = this.currentCoverScale * loc.scale;
    this.currentDebugImg.setScale(finalScale);
    this.updateDebugText();
  }

  adjustPos(dx, dy) {
    if (!this.currentDebugData) return;
    const loc = this.currentDebugData.location;
    loc.x[1] += dx;
    loc.y[1] += dy;

    this.currentDebugImg.x += dx;
    this.currentDebugImg.y += dy;
    this.updateDebugText();
  }

  updateDebugText() {
    if (!this.currentDebugData) return;
    const loc = this.currentDebugData.location;
    const text = `scale: ${loc.scale}\nx: [${loc.x[0]}, ${loc.x[1]}]\ny: [${loc.y[0]}, ${loc.y[1]}]`;
    this.debugInfoText.setText(text);
  }

  copyDebugParams() {
    if (!this.currentDebugData) return;
    const loc = this.currentDebugData.location;
    const str = `location: {\n  x: [${loc.x[0]}, ${loc.x[1]}],\n  y: [${loc.y[0]}, ${loc.y[1]}],\n  scale: ${loc.scale}\n}`;

    // 兼容剪贴板方法，如果当前环境不支持 navigator.clipboard，使用 fallback
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(str).then(() => this.showCopySuccess());
    } else {
      const el = document.createElement('textarea');
      el.value = str;
      // 防止唤起虚拟键盘
      el.setAttribute('readonly', '');
      el.style.position = 'absolute';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      this.showCopySuccess();
    }
  }

  showCopySuccess() {
    this.debugInfoText.setText('✔️ 已复制到剪贴板！');
    this.scene.time.delayedCall(1500, () => {
      // 延迟恢复显示参数
      if (this.debugPanel.visible) this.updateDebugText();
    });
  }
  // ================= 开发者工具区域结束 =================

  close() {
    if (this.isClosing) return;
    this.isClosing = true;

    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        this.container.destroy();
      },
    });
  }
}