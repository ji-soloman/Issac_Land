// src/view/system/GridPanel.js
import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import { get } from '../../system/i18n.js';
import { terrain } from '../../data/terrain.js';
import { REGION } from '../../data/region.js';
import { MAPS } from '../../data/map/EWland/map.js';
import { game } from '../../system/function.js';
import { BUILDING } from '../../data/building.js';
import { RACES } from '../../data/race.js';

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
    // 地形信息统一来自 MAP 配置表（MAPS.grids），而不是存档格点自己存储的字段，
    // 保证和 InitGame / MapView 里对同一张地图地形的读取方式一致
    this.terrainInfo = MAPS.grids?.[gridId];

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
    const terrainType = this.terrainInfo?.type || 'land';
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
    let bgOpacity = 0.9;
    if (this.data && this.data.settings && typeof this.data.settings.grid_opacity === 'number') {
      const op = this.data.settings.grid_opacity;
      if (op > 0 && op < 1) {
        bgOpacity = op;
      }
    }
    const bg = this.scene.add.rectangle(this.panelStartX, 0, this.panelWidth, this.panelHeight, 0xf4f0e6, bgOpacity);
    bg.setOrigin(0, 0);
    bg.setInteractive();

    bg.on('wheel', (pointer, dx, dy, dz, event) => {
      this.scrollContent(dy);
    });
    this.container.add(bg);

    // ====== 标题 ======
    const titleY = 25;
    const titleText = this.scene.add.text(this.panelStartX + this.panelWidth / 2, titleY, this.getGridName(this.gridId, this.data), {
      fontSize: '32px',
      color: '#2c3e50',
      fontStyle: 'bold',
      padding: { top: 5 },
      shadow: { offsetX: 1, offsetY: 1, color: '#ffffff', fill: true }
    }).setOrigin(0.5, 0);
    this.container.add(titleText);

    // ====== 地形文字 ======
    let terrainName = '';
    if (this.terrainInfo && this.terrainInfo.type && terrain && terrain[this.terrainInfo.type]) {
      const tInfo = terrain[this.terrainInfo.type];
      terrainName = tInfo.name ? tInfo.name : (typeof tInfo === 'string' ? tInfo : '');
    }
    const terrainY = titleY + 45; // 放在区名下方，给区名留出足够空间
    const terrainText = this.scene.add.text(this.panelStartX + this.panelWidth / 2, terrainY, terrainName, {
      fontSize: '18px',
      color: '#555555',
      fontStyle: 'bold',
      padding: { top: 5 },
      shadow: { offsetX: 1, offsetY: 1, color: '#ffffff', fill: true }
    }).setOrigin(0.5, 0);
    this.container.add(terrainText);

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
    this.tabsStartY = terrainY + 50; // 向下平移，完全避开上方地形文字的范围
    this.createTabs();

    // ====== 滚动内容区域 ======
    this.contentStartY = this.tabsStartY + 35; // 避开标签按钮的下边缘
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
    const isMain = !!this.gridData.isMain;

    // 检查是否存在"移除区域"待处理行动
    const isPendingRemove = !!(this.data.actionList?.civil?.['remove_region_' + this.gridId]);

    // --- 1. 主城：繁衍人口按钮；非主城：创建区域 / 移除区域 ---
    if (isMain) {
      // 检查本回合该主城是否已繁育过：key格式为"{cityName}繁育了x个人口_{gridId}"
      const breedTag = '_breed_' + this.gridId;
      const hasBreed = Object.keys(this.data.actionList?.others ?? {}).some(k => k.endsWith(breedTag));

      this.createActionButton('繁衍人口', centerX, currentY, btnWidth, btnHeight, 0x7b5ea7, !hasBreed, () => {
        this._showBreedPanel();
      });
      currentY += btnHeight + 15;

      this.createActionButton('创建建筑', centerX, currentY, btnWidth, btnHeight, 0x9c27b0, true, () => {
        this.scene.events.emit('create_building_btn', this.gridId);
      });
      currentY += btnHeight + 15;

      this.createActionButton('其他功能', centerX, currentY, btnWidth, btnHeight, 0x607d8b, true, () => {
        this.scene.events.emit('main_other_func_btn', this.gridId);
      });
      currentY += btnHeight + 30;
    } else {
      if (hasBuiltRegion) {
        this.createActionButton('移除区域', centerX, currentY, btnWidth, btnHeight, 0xc62828, !isPendingRemove, () => {
          this._showRemoveRegionConfirm();
        }, '#ffeb3b');
      } else {
        this.createActionButton('创建区域', centerX, currentY, btnWidth, btnHeight, 0x4caf50, true, () => {
          this.scene.events.emit('create_region_btn', this.gridId);
        });
      }
      currentY += btnHeight + 15;

      // --- 2. 升级区域按钮（待移除时同步置灰）---
      this.createActionButton('升级区域', centerX, currentY, btnWidth, btnHeight, 0x2196f3, hasBuiltRegion && !isPendingRemove, () => {
        this.scene.events.emit('upgrade_region_btn', this.gridId);
      });
      currentY += btnHeight + 15;

      // --- 3. 创建建筑按钮（待移除时同步置灰）---
      this.createActionButton('创建建筑', centerX, currentY, btnWidth, btnHeight, 0x9c27b0, hasBuiltRegion && !isPendingRemove, () => {
        this.scene.events.emit('create_building_btn', this.gridId);
      });
      currentY += btnHeight + 30;
    }

    // --- 4. 展示区域 ---
    if (hasBuiltRegion) {
      const rId = this.gridData.region;
      const rObj = REGION[rId];
      const bColor = rObj ? colorMap[rObj.color] : 0xcccccc;
      // 待移除时显示"被拆除"标签 + 灰色蒙版
      this.createListItem(rObj ? rObj.name : rId, null, currentY, bColor, rObj, isPendingRemove ? 'removing' : null);
      currentY += 40;
    } else if (this.gridData.createRegion) {
      const rId = this.gridData.createRegion.targetRegion;
      const rObj = REGION[rId];
      const bColor = rObj ? colorMap[rObj.color] : 0xcccccc;
      this.createListItem(rObj ? rObj.name : rId, this.gridData.createRegion.num, currentY, bColor, rObj);
      currentY += 40;
    } else if (this.data.actionList?.civil?.['build_region_' + this.gridId]?.regionKey) {
      const rId = this.data.actionList.civil['build_region_' + this.gridId].regionKey;
      const rObj = REGION[rId];
      const bColor = rObj ? colorMap[rObj.color] : 0xcccccc;
      this.createListItem(rObj ? rObj.name : rId, 'pending', currentY, bColor, rObj);
      currentY += 40;
    }

    // 分隔线
    if (currentY > this.contentStartY + 200) {
      const line = this.scene.add.rectangle(centerX, currentY - 10, this.panelWidth * 0.9, 2, 0xcccccc);
      this.contentContainer.add(line);
      currentY += 10;
    }

    // --- 5. 展示建筑（显示逻辑和区域完全相同，包括建造中和待处理状态）---
    const buildings = this.gridData.buildings;
    if (buildings && typeof buildings === 'object') {
      for (const bKey of Object.keys(buildings)) {
        const bObj = BUILDING?.[bKey];
        this.createListItem(bObj?.name ?? bKey, null, currentY, null, bObj, isPendingRemove ? 'removing' : null);
        currentY += 40;
      }
    }

    // 建造中的建筑（createBuilding 是 {key: {num}} 对象）
    if (this.gridData.createBuilding) {
      for (const [bKey, bInfo] of Object.entries(this.gridData.createBuilding)) {
        const bObj = BUILDING?.[bKey];
        this.createListItem(bObj?.name ?? bKey, bInfo.num, currentY, null, bObj, isPendingRemove ? 'removing' : null);
        currentY += 40;
      }
    }

    // 已加入行动列表但尚未开始建造的建筑（pending 状态，和区域的 pending 逻辑完全一致）
    const civilActions = this.data.actionList?.civil ?? {};
    const prefix = 'build_building_' + this.gridId + '_';
    for (const [key, param] of Object.entries(civilActions)) {
      if (!key.startsWith(prefix)) continue;
      const bKey = param.buildingKey;
      const bObj = BUILDING?.[bKey];
      this.createListItem(bObj?.name ?? bKey, 'pending', currentY, null, bObj, isPendingRemove ? 'removing' : null);
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

  createActionButton(textStr, x, y, width, height, color, isEnabled, callback, textColor = '#ffffff') {
    const bg = this.scene.add.rectangle(x, y, width, height, color, 1);
    const text = this.scene.add.text(x, y, textStr, {
      fontSize: '20px',
      color: textColor,
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

  // 修改了入参，增加 tooltipData 用于接收区域特有数据，status='removing' 时显示拆除状态
  createListItem(nameStr, countdown, y, borderColor, tooltipData, status) {
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

    // ====== removing 状态：右侧"被拆除"红字 + 整行浅灰蒙版 ======
    if (status === 'removing') {
      const removingText = this.scene.add.text(rightX - 10, y, '被拆除', {
        fontSize: '15px', color: '#e53935', fontStyle: 'bold', padding: { top: 3 },
      }).setOrigin(1, 0.5);
      // 浅灰色蒙版叠在行上，不影响下方元素的交互（tooltip 等）
      const dimOverlay = this.scene.add.rectangle(centerX, y, this.panelWidth * 0.9, 36, 0x888888, 0.35);
      this.contentContainer.add([removingText, dimOverlay]);
    }

    // ====== 倒计时与沙漏悬浮窗逻辑（removing 状态下不显示）======
    if (countdown !== null && countdown !== undefined && status !== 'removing') {
      const isPending = (countdown === 'pending');
      const cdTextStr = isPending ? '' : countdown.toString();

      const cdText = this.scene.add.text(rightX - 10, y, cdTextStr, {
        fontSize: '18px', color: '#d35400', fontStyle: 'bold',
      }).setOrigin(1, 0.5);

      const iconHeight = 24;
      const scale = iconHeight / 72;

      const iconX = rightX - 10 - (isPending ? 0 : cdText.width + 5);
      const icon = this.scene.add.image(iconX, y, 'hourglass_icon');
      icon.setScale(scale);
      icon.setOrigin(1, 0.5);

      icon.setInteractive({ pixelPerfect: true });

      icon.on('pointerover', () => {
        // iconX 也是绝对横坐标 (rightX 推导得出)
        const globalX = icon.x - (icon.width * scale) / 2;
        const globalY = y + this.contentContainer.y;

        const ttStr = isPending ? '准备建造中...' : `剩余${countdown}回合`;
        this.showTooltip(ttStr, globalX, globalY, icon.width * scale, icon.height * scale);
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

  _showBreedPanel() {
    const { width, height } = this.scene.scale;
    const W = 380, H = 280;
    const cx = width / 2, cy = height / 2;
    const DEPTH = 3000;

    const race = this.data.race;
    const raceConfig = RACES[race];
    // 基础单元资源消耗（每个人口的单价）
    const baseBreeding = { ...(raceConfig?.breeding ?? { food: 1 }) };

    // ── 收集该城池所有已建成建筑和区域的 onBreed trigger ──────────────
    // trigger 可返回：
    //   { flatDelta: { res: n } }  → 对总消耗的固定修正（不受人口数量缩放）
    //   { unitDelta: { res: n } }  → 对单元消耗的修正（乘以 baseScale 后影响总量）
    const breedModifiers = [];  // [{ source, flatDelta?, unitDelta? }]

    const allGrids = this.data.map?.grids ?? {};
    const cityGridIds = [this.gridId, ...Object.keys(allGrids).filter(
      gn => allGrids[gn]?.hasMain === this.gridId
    )];

    for (const gn of cityGridIds) {
      const gnData = allGrids[gn];
      if (!gnData) continue;

      const buildings = gnData.buildings ?? {};
      for (const [bKey, built] of Object.entries(buildings)) {
        if (!built) continue;
        const trigger = BUILDING[bKey]?.effect?.trigger?.onBreed;
        if (typeof trigger !== 'function') continue;
        const result = trigger({ breeding: baseBreeding, gridData: gnData, data: this.data });
        if (result && (result.flatDelta || result.unitDelta)) {
          breedModifiers.push({ source: BUILDING[bKey].name, ...result });
        }
      }

      const rKey = gnData.region;
      if (rKey) {
        const trigger = REGION[rKey]?.effect?.trigger?.onBreed;
        if (typeof trigger === 'function') {
          const result = trigger({ breeding: baseBreeding, gridData: gnData, data: this.data });
          if (result && (result.flatDelta || result.unitDelta)) {
            breedModifiers.push({ source: REGION[rKey].name, ...result });
          }
        }
      }
    }

    // 汇总单元修正 → effectiveBreeding（影响每人口的单价）
    const effectiveBreeding = { ...baseBreeding };
    for (const { unitDelta } of breedModifiers) {
      if (!unitDelta) continue;
      for (const [res, d] of Object.entries(unitDelta)) {
        if (effectiveBreeding[res] !== undefined) {
          effectiveBreeding[res] = Math.max(0, (effectiveBreeding[res] ?? 0) + d);
        }
      }
    }

    // 按资源汇总固定修正，同名建筑来源合并
    const flatSummary = {};  // { res: { total, parts: [{source, d}] } }
    for (const { source, flatDelta } of breedModifiers) {
      if (!flatDelta) continue;
      for (const [res, d] of Object.entries(flatDelta)) {
        if (!flatSummary[res]) flatSummary[res] = { total: 0, parts: [] };
        flatSummary[res].total += d;
        // 同名来源合并
        const existing = flatSummary[res].parts.find(p => p.source === source);
        if (existing) existing.d += d;
        else flatSummary[res].parts.push({ source, d });
      }
    }

    const curPop = this.gridData.population ?? 0;

    // 按叠加规则逐人口计算总消耗：
    // 第 k 个新人口（k=1..n）的消耗 = max(0, (curPop+k-1)*unit + flatDelta) per resource
    const calcCost = (n) => {
      if (n <= 0) return {};
      const cost = {};
      for (let k = 1; k <= n; k++) {
        const pop = curPop + k;
        for (const [res, unit] of Object.entries(effectiveBreeding)) {
          if (unit <= 0) continue;
          cost[res] = (cost[res] ?? 0) + pop * unit;
        }
        for (const [res, summary] of Object.entries(flatSummary)) {
          cost[res] = Math.max(0, (cost[res] ?? 0) + summary.total);
        }
      }
      for (const res of Object.keys(cost)) {
        if (cost[res] === 0) delete cost[res];
      }
      return cost;
    };

    const buildCostDisplay = (n) => {
      if (n <= 0) return '本次消耗：无';
      const parts = [];
      const baseTotals = {};
      const effectiveTotals = {};

      for (let k = 1; k <= n; k++) {
        const pop = curPop + k;
        for (const [res, baseUnit] of Object.entries(baseBreeding)) {
          if (baseUnit <= 0) continue;
          baseTotals[res] = (baseTotals[res] ?? 0) + pop * baseUnit;
          const flat = flatSummary[res]?.total ?? 0;
          effectiveTotals[res] = (effectiveTotals[res] ?? 0) + Math.max(0, pop * baseUnit + flat);
        }
      }

      for (const [res, baseTotal] of Object.entries(baseTotals)) {
        let str = `${get.translation(res)} ×${baseTotal}`;
        if (flatSummary[res] && flatSummary[res].total !== 0) {
          const detail = flatSummary[res].parts
            .map(p => `${p.source}${p.d * n > 0 ? '+' : ''}${p.d * n}`)
            .join('，');
          str += `（${detail}）`;
        }
        parts.push(str);
      }
      return '本次消耗：' + parts.join('，');
    };

    const canAfford = (n) => {
      if (n <= 0) return true;
      const cost = calcCost(n);
      for (const [res, val] of Object.entries(cost)) {
        const cur = this.data.resource?.[res] ?? 0;
        // 当前资源为负数时不可继续消耗；否则检查是否足够支付
        if (cur < 0 || cur < val) return false;
      }
      return true;
    };

    const overlay = this.scene.add.rectangle(cx, cy, width, height, 0x000000, 0.55)
      .setDepth(DEPTH).setInteractive();
    const modal = this.scene.add.container(cx, cy).setDepth(DEPTH + 1);

    const bg = this.scene.add.rectangle(0, 0, W, H, 0x12111e, 0.97)
      .setStrokeStyle(1.5, 0x7a6050, 1);
    modal.add(bg);

    // 标题
    const title = this.scene.add.text(0, -H / 2 + 22, '繁衍人口', {
      fontFamily: 'sans-serif', fontSize: '18px', color: '#ffeb3b', fontStyle: 'bold',
    }).setOrigin(0.5);
    modal.add(title);

    // 当前人口
    const popLabel = this.scene.add.text(0, -H / 2 + 56, `当前人口：${curPop}`, {
      fontFamily: 'sans-serif', fontSize: '16px', color: '#f5e6c8',
    }).setOrigin(0.5);
    modal.add(popLabel);

    // 数量选择器
    let breedCount = 0;

    const minusBtn = this.scene.add.text(-60, -H / 2 + 100, '－', {
      fontFamily: 'sans-serif', fontSize: '26px', color: '#ffffff',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    const countText = this.scene.add.text(0, -H / 2 + 100, '0', {
      fontFamily: 'sans-serif', fontSize: '26px', color: '#ffe082', fontStyle: 'bold',
    }).setOrigin(0.5);

    const plusBtn = this.scene.add.text(60, -H / 2 + 100, '＋', {
      fontFamily: 'sans-serif', fontSize: '26px', color: '#ffffff',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    modal.add([minusBtn, countText, plusBtn]);

    // 消耗预览
    const costText = this.scene.add.text(0, -H / 2 + 148, '本次消耗：无', {
      fontFamily: 'sans-serif', fontSize: '15px', color: '#aaaaaa', align: 'center',
    }).setOrigin(0.5);
    modal.add(costText);

    // 资源不足提示
    const warnText = this.scene.add.text(0, -H / 2 + 172, '', {
      fontFamily: 'sans-serif', fontSize: '14px', color: '#f44336', align: 'center',
    }).setOrigin(0.5);
    modal.add(warnText);

    const updateDisplay = () => {
      countText.setText(String(breedCount));
      if (breedCount === 0) {
        costText.setText('本次消耗：无');
        warnText.setText('');
        return;
      }
      costText.setText(buildCostDisplay(breedCount));
      warnText.setText(canAfford(breedCount) ? '' : '资源不足');
    };

    minusBtn.on('pointerdown', () => { if (breedCount > 0) { breedCount--; updateDisplay(); } });
    plusBtn.on('pointerdown', () => { breedCount++; updateDisplay(); });

    const destroy = () => { modal.destroy(true); overlay.destroy(); };

    const addBtn = (x, y, label, textureKey, onClick) => {
      const BW = 120, BH = 38;
      const btnBg = this.scene.add.image(x, y, textureKey).setDisplaySize(BW, BH);
      const btnTxt = this.scene.add.text(x, y, label, {
        fontFamily: 'sans-serif', fontSize: '17px', color: '#ffffff',
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5);
      btnBg.setInteractive({ useHandCursor: true });
      btnBg.on('pointerover', () => btnBg.setAlpha(0.8));
      btnBg.on('pointerout', () => btnBg.setAlpha(1));
      btnBg.on('pointerdown', () => btnBg.setAlpha(0.6));
      btnBg.on('pointerup', () => { btnBg.setAlpha(1); onClick(); });
      modal.add([btnBg, btnTxt]);
    };

    const breedTag = '_breed_' + this.gridId;
    const hasBreed = Object.keys(this.data.actionList?.others ?? {}).some(k => k.endsWith(breedTag));

    // 确认：立即扣资源，emit繁衍行动
    addBtn(-70, H / 2 - 36, '确认', 'common_btn_green', () => {
      if (breedCount <= 0) { destroy(); return; }
      if (!canAfford(breedCount)) {
        warnText.setText('资源不足，无法繁衍');
        return;
      }

      // 同一主城本回合已繁育过，直接拒绝
      if (hasBreed) {
        warnText.setText('本回合已繁衍过一次');
        return;
      }

      const cost = calcCost(breedCount);
      const cityName = this.gridData.name || this.gridId;
      // key 直接用描述文字，actionList 里展示时无需额外解析
      const actionKey = `${cityName}繁育了${breedCount}个人口${breedTag}`;

      game.addAction('others', actionKey, {
        gridId: this.gridId,
        count: breedCount,
      }, {
        onSuccess: () => {
          // 立即扣除资源
          for (const [res, val] of Object.entries(cost)) {
            this.data.resource[res] = (this.data.resource[res] ?? 0) - val;
          }
          // 扣资源后立即刷新顶部资源栏
          this.scene.topInfoBar?.refresh();
          // 人口增加在回合结算末尾进行
          this.scene.events.emit('breed_population', { gridId: this.gridId, count: breedCount });
          // 刷新面板，让繁衍按钮立即变灰
          this.switchTab(this.currentTab);
          destroy();
        },
        onFail: (info) => {
          if (info.reason === 'limit') game.showTips(this.scene, '行动数量超过上限');
        },
      });
    });

    addBtn(70, H / 2 - 36, '取消', 'common_btn', () => destroy());

    modal.setAlpha(0); overlay.setAlpha(0);
    this.scene.tweens.add({ targets: [modal, overlay], alpha: 1, duration: 180 });
  }

  _showRemoveRegionConfirm() {
    const { width, height } = this.scene.scale;
    const W = 360, H = 210;
    const cx = width / 2, cy = height / 2;
    const DEPTH = 3000;

    // 半透明遮罩，阻止点击穿透
    const overlay = this.scene.add.rectangle(cx, cy, width, height, 0x000000, 0.55)
      .setDepth(DEPTH).setInteractive();

    const modal = this.scene.add.container(cx, cy).setDepth(DEPTH + 1);

    const bg = this.scene.add.rectangle(0, 0, W, H, 0x12111e, 0.97)
      .setStrokeStyle(1.5, 0x7a6050, 1);
    modal.add(bg);

    // 标题：黄色，位于浮窗顶部居中
    const title = this.scene.add.text(0, -H / 2 + 22, '移除区域', {
      fontFamily: 'sans-serif', fontSize: '18px', color: '#ffeb3b',
      fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5);
    modal.add(title);

    // 正文：与标题、按钮间距对齐
    const msg = this.scene.add.text(0, -18,
      '将移除区域并摧毁区域内全部建筑，\n是否继续？',
      {
        fontFamily: 'sans-serif', fontSize: '17px', color: '#f5e6c8',
        align: 'center', wordWrap: { width: W - 40 },
      }
    ).setOrigin(0.5);
    modal.add(msg);

    const destroy = () => {
      modal.destroy(true);
      overlay.destroy();
    };

    // 图片按钮辅助函数（与 initGame._addCardButton 保持一致）
    const addBtn = (x, y, label, textureKey, onClick) => {
      const BW = 120, BH = 38;
      const btnBg = this.scene.add.image(x, y, textureKey).setDisplaySize(BW, BH);
      const btnTxt = this.scene.add.text(x, y, label, {
        fontFamily: 'sans-serif', fontSize: '17px', color: '#ffffff',
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5);
      btnBg.setInteractive({ useHandCursor: true });
      btnBg.on('pointerover', () => btnBg.setAlpha(0.8));
      btnBg.on('pointerout', () => btnBg.setAlpha(1));
      btnBg.on('pointerdown', () => btnBg.setAlpha(0.6));
      btnBg.on('pointerup', () => { btnBg.setAlpha(1); onClick(); });
      modal.add([btnBg, btnTxt]);
    };

    // 确认：common_btn_red
    addBtn(-70, H / 2 - 36, '确认', 'common_btn_red', () => {
      const regionKey = this.gridData.region;
      const regionName = REGION[regionKey]?.name ?? regionKey;
      game.addAction('civil', 'remove_region_' + this.gridId, {
        gridId: this.gridId,
        desc: `移除${regionName}`,
      }, {
        onFail: (info) => {
          if (info.reason === 'limit') game.showTips(this.scene, '行动数量超过上限');
        },
        onSuccess: () => {
          // 行动加入成功后立即刷新 build tab，让按钮置灰和拆除蒙版生效
          this.switchTab('build');
        },
      });
      destroy();
    });

    // 取消：common_btn
    addBtn(70, H / 2 - 36, '取消', 'common_btn', () => destroy());

    modal.setAlpha(0);
    overlay.setAlpha(0);
    this.scene.tweens.add({ targets: [modal, overlay], alpha: 1, duration: 180 });
  }

  getGridName(gridId, data) {
    const gn = data.map.grids[gridId];

    // 主城格子：直接显示格点自身存储的 name（建城时写入的 saveData.capital）
    if (gn?.isMain) {
      return gn.name || data.capital || '主城';
    }

    // 附属格子：hasMain 指向拥有该格子的主城格点编号，从那里取 name
    if (gn?.hasMain) {
      const mainGn = data.map.grids[gn.hasMain];
      return mainGn?.name || gn.hasMain;
    }

    // 格点自身有 name（非主城、非附属，但有命名）
    if (gn?.name) {
      return gn.name;
    }

    // 既没有 hasMain 也没有 name，显示空地
    return '空地';
  }

  destroy() {
    if (this.container) {
      this.container.destroy();
      this.container = null;
    }
  }
}