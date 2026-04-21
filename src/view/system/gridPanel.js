// src/view/system/GridPanel.js
import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import { get } from '../../system/i18n.js';
import { terrain } from '../../data/terrain.js';
import { REGION } from '../../data/region.js';
import { MAPS } from '../../data/map.js';

const colorMap = {
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
  special: 0x7D3C98
};

export class GridPanel {
  constructor(scene, gridId, data) {
    this.scene = scene;
    this.gridId = gridId;
    this.gridData = data.map.grids[gridId];
    this.data = data;
    this.isAnimating = false;
    this.terrainInfo = MAPS[data.map_type].grids[gridId];

    this.currentTab = null;

    this.create();
  }

  create() {
    const { width, height } = this.scene.scale;

    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(1000);

    // ====== 面板参数 ======
    this.panelWidth = width * 0.25;
    this.panelHeight = height;
    this.rightX = width;
    this.panelStartX = this.rightX - this.panelWidth;

    // ====== 地形背景图片 ======
    const terrainType = this.terrainInfo.type || 'land';
    const terrainConfig = terrain[terrainType];
    const terrainImageKey = `terrain_${terrainType}`;

    const terrainBg = this.scene.add.image(this.panelStartX + this.panelWidth / 2, this.panelHeight / 2, terrainImageKey);
    terrainBg.setOrigin(0.5);

    const coverScale = Math.max(
      this.panelWidth / terrainBg.width,
      this.panelHeight / terrainBg.height
    );
    terrainBg.setScale(coverScale);

    const bgMaskShape = this.scene.make.graphics();
    bgMaskShape.fillStyle(0xffffff);
    bgMaskShape.fillRect(this.panelStartX, 0, this.panelWidth, this.panelHeight);
    const bgMask = bgMaskShape.createGeometryMask();
    terrainBg.setMask(bgMask);

    this.container.add(terrainBg);

    // ====== 背景矩形 ======
    const bg = this.scene.add.rectangle(this.panelStartX, 0, this.panelWidth, this.panelHeight, 0xf4f0e6, 0.9);
    bg.setOrigin(0, 0);
    bg.setInteractive();

    bg.on('wheel', (pointer, dx, dy, dz, event) => {
      this.scrollContent(dy);
    });
    this.container.add(bg);

    // ====== 标题 ======
    const titleY = 30;
    const titleText = this.scene.add.text(this.panelStartX + this.panelWidth / 2, titleY, this.getGridName(this.gridId, this.data), {
      fontSize: '32px',
      color: '#2c3e50',
      fontStyle: 'bold',
      padding: { top: 5 },
      shadow: { offsetX: 1, offsetY: 1, color: '#ffffff', fill: true }
    }).setOrigin(0.5, 0);
    this.container.add(titleText);

    // ====== 关闭按钮 ======
    const closeBtnX = this.rightX - 25;
    const closeBtnY = 25;

    const closeBg = this.scene.add.circle(closeBtnX, closeBtnY, 18, 0xd32f2f, 0.9);
    closeBg.setInteractive({ useHandCursor: true });
    const closeText = this.scene.add.text(closeBtnX, closeBtnY, '×', {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
      padding: { top: 5 },
    }).setOrigin(0.5);

    this.container.add([closeBg, closeText]);

    closeBg.on('pointerover', () => {
      closeBg.setFillStyle(0xff5252, 1);
      this.scene.input.setDefaultCursor('pointer');
    });
    closeBg.on('pointerout', () => {
      closeBg.setFillStyle(0xd32f2f, 0.9);
      this.scene.input.setDefaultCursor('default');
    });
    closeBg.on('pointerdown', () => {
      if (this.isAnimating) return;
      this.close();
    });

    // ====== 顶部标签页 ======
    this.tabsStartY = titleY + 60;
    this.createTabs();

    // ====== 滚动内容区域 ======
    this.contentStartY = this.tabsStartY + 50;
    this.contentHeightArea = this.panelHeight - this.contentStartY;

    this.contentContainer = this.scene.add.container(0, 0);
    this.container.add(this.contentContainer);

    const maskShape = this.scene.make.graphics();
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(this.panelStartX, this.contentStartY, this.panelWidth, this.contentHeightArea);
    const mask = maskShape.createGeometryMask();
    this.contentContainer.setMask(mask);

    // ====== Tooltip 悬浮窗 ======
    // 背景透明度修改为 0.8
    this.ttBg = this.scene.add.rectangle(0, 0, 100, 30, 0xffffff, 0.8);
    this.ttBg.setStrokeStyle(2, 0x1976D2);
    this.ttText = this.scene.add.text(0, 0, '', {
      fontSize: '14px',
      color: '#1976D2',
      fontStyle: 'bold',
      align: 'left', // 左对齐以便加成列表显示美观
      lineSpacing: 4,
      padding: { top: 5 },
    }).setOrigin(0.5);

    this.tooltipContainer = this.scene.add.container(0, 0, [this.ttBg, this.ttText]);
    this.tooltipContainer.setDepth(2000);
    this.tooltipContainer.setVisible(false);
    this.container.add(this.tooltipContainer);

    // ====== 进入动画 ======
    this.playEnterAnimation();

    // 默认打开“建设”页签
    this.switchTab('build');
  }

  createTabs() {
    const tabNames = [
      { id: 'build', name: '建设' },
      { id: 'product', name: '物产' },
      { id: 'wonder', name: '奇迹' }
    ];

    const tabWidth = (this.panelWidth - 40) / 3;
    const tabHeight = 40;
    let startX = this.panelStartX + 20;

    this.tabButtons = {};

    tabNames.forEach((tab, index) => {
      const tabX = startX + index * tabWidth + tabWidth / 2;

      const bg = this.scene.add.rectangle(tabX, this.tabsStartY, tabWidth - 5, tabHeight, 0xbdc3c7, 1);
      bg.setInteractive({ useHandCursor: true });
      bg.setStrokeStyle(2, 0x95a5a6);

      const text = this.scene.add.text(tabX, this.tabsStartY, tab.name, {
        fontSize: '18px',
        color: '#333333',
        fontStyle: 'bold',
        padding: { top: 5 },
      }).setOrigin(0.5);

      bg.on('pointerdown', () => {
        if (this.currentTab === tab.id) return;
        this.switchTab(tab.id);
      });

      this.tabButtons[tab.id] = { bg, text };
      this.container.add([bg, text]);
    });
  }

  switchTab(tabId) {
    this.currentTab = tabId;
    this.contentContainer.y = 0;
    this.tooltipContainer.setVisible(false);

    Object.keys(this.tabButtons).forEach(key => {
      const btn = this.tabButtons[key];
      if (key === tabId) {
        btn.bg.setFillStyle(0x3498db, 1);
        btn.bg.setStrokeStyle(2, 0x2980b9);
        btn.text.setColor('#ffffff');
      } else {
        btn.bg.setFillStyle(0xbdc3c7, 1);
        btn.bg.setStrokeStyle(2, 0x95a5a6);
        btn.text.setColor('#333333');
      }
    });

    this.contentContainer.removeAll(true);
    this.contentMaxHeight = 0;

    if (tabId === 'build') {
      this.renderBuildTab();
    } else if (tabId === 'wonder') {
      this.renderWonderTab();
    } else if (tabId === 'product') {
      this.renderProductTab();
    }
  }

  renderBuildTab() {
    let currentY = this.contentStartY + 20;
    const centerX = this.panelStartX + this.panelWidth / 2;
    const btnWidth = this.panelWidth * 0.8;
    const btnHeight = 45;

    const rData = this.gridData.region;
    const hasBuiltRegion = rData !== undefined && rData !== null && rData !== '';

    // --- 1. 创建地区按钮 ---
    this.createActionButton('创建地区', centerX, currentY, btnWidth, btnHeight, 0x4caf50, true, () => {
      this.scene.events.emit('create_region_btn', this.gridId);
    });
    currentY += btnHeight + 15;

    // --- 2. 升级地区按钮 ---
    this.createActionButton('升级地区', centerX, currentY, btnWidth, btnHeight, 0x2196f3, hasBuiltRegion, () => {
      this.scene.events.emit('upgrade_region_btn', this.gridId);
    });
    currentY += btnHeight + 15;

    // --- 3. 创建建筑按钮 ---
    this.createActionButton('创建建筑', centerX, currentY, btnWidth, btnHeight, 0x9c27b0, hasBuiltRegion, () => {
      this.scene.events.emit('create_building_btn', this.gridId);
    });
    currentY += btnHeight + 30;

    // --- 4. 展示区域 (传递完整 rObj 用于弹窗解析) ---
    if (this.gridData.region !== undefined && this.gridData.region !== null) {
      const rId = this.gridData.region;
      const rObj = REGION[rId];
      const bColor = colorMap[rObj.color];
      this.createListItem(rObj.name, null, currentY, bColor, rObj);
      currentY += 40;
    } else if (this.gridData.createRegion) {
      const rId = this.gridData.createRegion.targetRegion;
      const rObj = REGION[rId];
      const bColor = colorMap[rObj.color];
      this.createListItem(rObj.name, this.gridData.createRegion.num, currentY, bColor, rObj);
      currentY += 40;
    }

    // 分隔线
    if (currentY > this.contentStartY + 200) {
      const line = this.scene.add.rectangle(centerX, currentY - 10, this.panelWidth * 0.9, 2, 0xcccccc);
      this.contentContainer.add(line);
      currentY += 10;
    }

    // --- 5. 展示建筑 ---
    if (this.gridData.buildings && this.gridData.buildings.length > 0) {
      this.gridData.buildings.forEach(bId => {
        this.createListItem(get.translation(bId), null, currentY);
        currentY += 40;
      });
    }

    if (this.gridData.createBuilding) {
      this.createListItem(get.translation(this.gridData.createBuilding.targetBuilding), this.gridData.createBuilding.num, currentY);
      currentY += 40;
    }

    this.contentMaxHeight = currentY - this.contentStartY + 20;
  }

  renderWonderTab() {
    let currentY = this.contentStartY + 20;
    const centerX = this.panelStartX + this.panelWidth / 2;
    const btnWidth = this.panelWidth * 0.8;
    const btnHeight = 45;

    this.createActionButton('创建奇迹', centerX, currentY, btnWidth, btnHeight, 0xffa500, true, () => {
      this.scene.events.emit('create_wonder_btn', this.gridId);
    });

    this.contentMaxHeight = btnHeight + 40;
  }

  renderProductTab() {
    let currentY = this.contentStartY + 20;
    const centerX = this.panelStartX + this.panelWidth / 2;

    if (this.gridData.products && this.gridData.products.length > 0) {
      this.gridData.products.forEach(pId => {
        this.createListItem(get.translation(pId), null, currentY);
        currentY += 40;
      });
    } else {
      const text = this.scene.add.text(centerX, currentY, get.translation('none'), {
        fontSize: '18px', color: '#666666', padding: { top: 5 },
      }).setOrigin(0.5);
      this.contentContainer.add(text);
      currentY += 40;
    }
    this.contentMaxHeight = currentY - this.contentStartY + 20;
  }

  createActionButton(textStr, x, y, width, height, color, isEnabled, callback) {
    const bg = this.scene.add.rectangle(x, y, width, height, color, 1);
    const text = this.scene.add.text(x, y, textStr, {
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold',
      padding: { top: 5 },
      shadow: { offsetX: 1, offsetY: 1, color: '#000', fill: true }
    }).setOrigin(0.5);

    if (isEnabled) {
      bg.setInteractive({ useHandCursor: true });
      bg.setStrokeStyle(2, 0xffffff);

      bg.on('pointerover', () => bg.setAlpha(0.8));
      bg.on('pointerout', () => bg.setAlpha(1));
      bg.on('pointerdown', () => {
        if (this.isAnimating) return;
        this.scene.tweens.add({
          targets: [bg, text], scaleX: 0.95, scaleY: 0.95, duration: 50, yoyo: true,
          onComplete: callback
        });
      });
    } else {
      bg.setFillStyle(0x7f8c8d, 1);
      bg.setStrokeStyle(2, 0x95a5a6);
      text.setColor('#bdc3c7');
    }

    this.contentContainer.add([bg, text]);
  }

  // 统一的悬浮窗计算展示方法
  showTooltip(textStr, targetCenterX, targetCenterY, objWidth, objHeight) {
    this.ttText.setText(textStr);
    const tw = this.ttText.width + 16;
    const th = this.ttText.height + 12;
    this.ttBg.setSize(tw, th);

    let targetX = targetCenterX;
    let targetY = targetCenterY - objHeight / 2 - th / 2 - 5; // 默认展示在上方

    // 右侧贴边保护
    if (targetX + tw / 2 > this.rightX) {
      targetX = this.rightX - tw / 2 - 5;
    }
    // 左侧边界保护
    if (targetX - tw / 2 < 0) {
      targetX = tw / 2 + 5;
    }
    // 上方空间不够放则展示在下方
    if (targetY - th / 2 < 0) {
      targetY = targetCenterY + objHeight / 2 + th / 2 + 5;
    }

    this.tooltipContainer.setPosition(targetX, targetY);
    this.tooltipContainer.setVisible(true);
  }

  // 修改了入参，增加 tooltipData 用于接收区域特有数据
  createListItem(nameStr, countdown, y, borderColor, tooltipData) {
    const leftX = this.panelStartX + 20;
    const rightX = this.panelStartX + this.panelWidth - 20;
    const centerX = this.panelStartX + this.panelWidth / 2;

    const bg = this.scene.add.rectangle(centerX, y, this.panelWidth * 0.9, 36, 0xffffff, 0.5);
    bg.setStrokeStyle(borderColor ? 2 : 1, borderColor || 0xcccccc);

    const nameText = this.scene.add.text(leftX + 10, y, nameStr, {
      fontSize: '18px', color: '#333333', fontStyle: 'bold', padding: { top: 5 },
    }).setOrigin(0, 0.5);

    this.contentContainer.add([bg, nameText]);

    // ====== 区域文字悬浮窗逻辑 ======
    if (tooltipData) {
      nameText.setInteractive({ useHandCursor: true });

      nameText.on('pointerover', () => {
        let ttStr = `${tooltipData.name}\n`;
        if (tooltipData.special_info) {
          ttStr += `${tooltipData.special_info}\n`;
        }
        if (tooltipData.effect_info) {
          ttStr += `加成：\n`;
          // 支持全角冒号及半角冒号切分
          const effects = tooltipData.effect_info.split(/；|;/);
          effects.forEach(eff => {
            if (eff.trim() !== '') {
              ttStr += `· ${eff.trim()}\n`;
            }
          });
        }

        // 计算全局绝对坐标 (此时 nameText 的 x 是绝对横坐标)
        const globalX = nameText.x + nameText.width / 2;
        const globalY = y + this.contentContainer.y;

        this.showTooltip(ttStr.trim(), globalX, globalY, nameText.width, nameText.height);
      });

      nameText.on('pointerout', () => {
        this.tooltipContainer.setVisible(false);
      });
    }

    // ====== 倒计时与沙漏悬浮窗逻辑 ======
    if (countdown !== null && countdown !== undefined) {
      const cdText = this.scene.add.text(rightX - 10, y, countdown.toString(), {
        fontSize: '18px', color: '#d35400', fontStyle: 'bold',
      }).setOrigin(1, 0.5);

      const iconHeight = 24;
      const scale = iconHeight / 72;

      const iconX = rightX - 10 - cdText.width - 5;
      const icon = this.scene.add.image(iconX, y, 'hourglass_icon');
      icon.setScale(scale);
      icon.setOrigin(1, 0.5);

      icon.setInteractive({ pixelPerfect: true });

      icon.on('pointerover', () => {
        // iconX 也是绝对横坐标 (rightX 推导得出)
        const globalX = icon.x - (icon.width * scale) / 2;
        const globalY = y + this.contentContainer.y;

        this.showTooltip(`剩余${countdown}回合`, globalX, globalY, icon.width * scale, icon.height * scale);
      });

      icon.on('pointerout', () => {
        this.tooltipContainer.setVisible(false);
      });

      this.contentContainer.add([cdText, icon]);
    }
  }

  scrollContent(deltaY) {
    if (this.contentMaxHeight <= this.contentHeightArea) return;

    const speed = 0.5;
    let newY = this.contentContainer.y - deltaY * speed;

    const minY = -(this.contentMaxHeight - this.contentHeightArea);
    const maxY = 0;

    if (newY < minY) newY = minY;
    if (newY > maxY) newY = maxY;

    this.contentContainer.y = newY;

    // 滚动时隐藏 Tooltip 以免发生错位或脱节
    this.tooltipContainer.setVisible(false);
  }

  playEnterAnimation() {
    this.container.x = this.panelWidth;
    this.isAnimating = true;

    this.scene.tweens.add({
      targets: this.container,
      x: 0,
      duration: 350,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.isAnimating = false;
      }
    });
  }

  playExitAnimation(onComplete) {
    this.isAnimating = true;

    this.scene.tweens.add({
      targets: this.container,
      x: this.panelWidth,
      duration: 350,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.isAnimating = false;
        if (onComplete) {
          onComplete();
        }
      }
    });
  }

  close() {
    this.playExitAnimation(() => {
      if (this.scene.closeGridPanel) {
        this.scene.closeGridPanel();
      }
    });
  }

  getGridName(gridId, data) {
    if (gridId === 'g1') {
      return data.capital;
    }
    const num = parseInt(gridId.replace('g', ''));
    const areaNum = num - 1;
    return `${areaNum}区`;
  }

  destroy() {
    if (this.container) {
      this.container.destroy();
      this.container = null;
    }
  }
}