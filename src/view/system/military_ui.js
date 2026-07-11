import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import { saveSystem } from '../../system/saveSystem.js';
import { MILITARY } from '../../data/military.js';
import { MILITARY_UNIT } from '../../data/military_unit.js';
import { get } from '../../system/i18n.js';
import { MilitaryUnitViewer } from './militaryUnitView.js';
import { MAPS } from '../../data/map/EWland/map.js';

export class MilitarySystem {
  constructor(scene, saveData) {
    this.scene = scene;
    this.saveData = saveData;

    // 配置参数
    this.config = {
      sidePadding: 80,
      topPadding: 120,
      bottomPadding: 50,
      cardWidth: 250,
      cardHeight: 150,
      cardSpacing: 30,
      scrollBarWidth: 10
    };

    this.create();
  }

  create() {
    const { width, height } = this.scene.scale;

    // 1. 主容器
    this.mainContainer = this.scene.add.container(0, 0).setDepth(1000);

    // 半透明黑色背景
    const bg = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x2a2a2a, 0.95);
    bg.setInteractive();
    this.mainContainer.add(bg);

    // 标题
    const titleText = this.scene.add.text(width / 2, 50, '军事行动', {
      fontSize: '36px',
      color: '#ffd700',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
      padding: { top: 2 },
    }).setOrigin(0.5);
    this.mainContainer.add(titleText);

    // 2. 初始化滚动区域
    this.createScrollableContent();

    // 3. 创建关闭按钮
    this.createCloseButton();

    // 4. 注册全局滚轮事件
    this.scene.input.on('wheel', this.onMouseWheel, this);
  }

  /**
   * 创建可滚动的卡片区域
   */
  createScrollableContent() {
    const { width, height } = this.scene.scale;
    const { sidePadding, topPadding, bottomPadding, cardWidth, cardHeight, cardSpacing } = this.config;

    const availableWidth = width - (sidePadding * 2);
    let cardsPerRow = Math.floor((availableWidth + cardSpacing) / (cardWidth + cardSpacing));
    if (cardsPerRow < 1) cardsPerRow = 1;

    const totalRowWidth = cardsPerRow * cardWidth + (cardsPerRow - 1) * cardSpacing;
    const startX = sidePadding + (availableWidth - totalRowWidth) / 2 + cardWidth / 2;

    const mapGrids  = MAPS.grids  || {};
    const saveGrids = this.saveData.map?.grids || {};
    const actions = Object.entries(MILITARY);

    this.scrollContainer = this.scene.add.container(0, 0);
    this.mainContainer.add(this.scrollContainer);

    let lastY = 0;
    actions.forEach(([actionId, action], index) => {
      const row = Math.floor(index / cardsPerRow);
      const col = index % cardsPerRow;

      const x = startX + col * (cardWidth + cardSpacing);
      const y = topPadding + row * (cardHeight + cardSpacing) + cardHeight / 2;

      const isAvailable = this.checkActionAvailable(action, mapGrids, saveGrids);
      this.createActionCard(actionId, action, x, y, isAvailable);
      lastY = y + cardHeight / 2;
    });

    this.contentHeight = lastY + bottomPadding;
    this.viewportHeight = height;
    this.maxScroll = Math.max(0, this.contentHeight - this.viewportHeight);
    this.currentScrollY = 0;

    const maskShape = this.scene.make.graphics();
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(0, topPadding - 10, width, height - topPadding + 10);
    const mask = maskShape.createGeometryMask();
    this.scrollContainer.setMask(mask);

    if (this.maxScroll > 0) {
      this.createScrollBar();
    }
  }

  createScrollBar() {
    const { width, height } = this.scene.scale;
    const { topPadding, bottomPadding, scrollBarWidth } = this.config;

    const trackHeight = height - topPadding - bottomPadding;
    const trackX = width - 20;
    const trackY = topPadding;

    this.scrollTrack = this.scene.add.rectangle(trackX, trackY + trackHeight / 2, scrollBarWidth, trackHeight, 0x000000, 0.3);
    this.mainContainer.add(this.scrollTrack);

    let thumbHeight = (this.viewportHeight / this.contentHeight) * trackHeight;
    thumbHeight = Math.max(thumbHeight, 50);

    this.scrollThumbHeight = thumbHeight;
    this.scrollTrackHeight = trackHeight;
    this.scrollTrackY = trackY;

    this.scrollThumb = this.scene.add.rectangle(trackX, trackY + thumbHeight / 2, scrollBarWidth, thumbHeight, 0x888888, 1);
    this.scrollThumb.setInteractive({ useHandCursor: true, draggable: true });
    this.mainContainer.add(this.scrollThumb);

    this.scene.input.setDraggable(this.scrollThumb);
    this.scrollThumb.on('drag', (pointer, dragX, dragY) => {
      const minY = this.scrollTrackY + this.scrollThumbHeight / 2;
      const maxY = this.scrollTrackY + this.scrollTrackHeight - this.scrollThumbHeight / 2;
      const clampedY = Phaser.Math.Clamp(dragY, minY, maxY);

      this.scrollThumb.y = clampedY;

      const scrollRatio = (clampedY - minY) / (maxY - minY);
      this.currentScrollY = scrollRatio * this.maxScroll;
      this.scrollContainer.y = -this.currentScrollY;
    });
  }

  onMouseWheel(pointer, gameObjects, deltaX, deltaY, deltaZ) {
    if (this.maxScroll <= 0) return;
    const scrollSpeed = 0.5;
    this.currentScrollY += deltaY * scrollSpeed;
    this.currentScrollY = Phaser.Math.Clamp(this.currentScrollY, 0, this.maxScroll);
    this.updateScrollPosition();
  }

  updateScrollPosition() {
    this.scrollContainer.y = -this.currentScrollY;
    if (this.scrollThumb) {
      const minY = this.scrollTrackY + this.scrollThumbHeight / 2;
      const maxY = this.scrollTrackY + this.scrollTrackHeight - this.scrollThumbHeight / 2;
      const ratio = this.currentScrollY / this.maxScroll;
      this.scrollThumb.y = minY + (maxY - minY) * ratio;
    }
  }

  checkActionAvailable(action, mapGrids, saveGrids) {
    // action.filter 接收 { saveGrids, mapGrids, mapView }：
    //   saveGrids — 存档格点，gn.isMain / gn.hasMain 判断主城/附属关系
    //   mapGrids  — MAP 配置表格点，gn.type 为地形类型
    //   mapView   — MapView 实例，可调用 getGridNeighbors 获取邻格
    if (!action.filter || typeof action.filter !== 'function') return true;
    try {
      return action.filter({ saveGrids, mapGrids, mapView: this.scene?.mapView });
    } catch (error) {
      return false;
    }
  }

  createActionCard(actionId, action, x, y, isAvailable) {
    const { cardWidth, cardHeight } = this.config;
    const cardContainer = this.scene.add.container(x, y);

    // 判断是否正在执行中
    const isExecuting = this.saveData.actionList?.military && this.saveData.actionList.military[actionId];

    // 确定颜色逻辑
    let bgColor = 0x2a2a2a;      // 默认不可用颜色
    let borderColor = 0x666666;  // 默认边框颜色
    let statusMsg = '不可用';
    let statusColor = '#ff0000';
    let canInteract = false;

    if (isExecuting) {
      // 执行中状态优先级最高
      bgColor = 0x2a3a4a;        // 略带蓝色的背景
      borderColor = 0x00ccff;    // 蓝色边框
      statusMsg = '执行中';
      statusColor = '#00ccff';
      canInteract = false;       // 执行中不可再次点击
    } else if (isAvailable) {
      // 可用状态
      bgColor = 0x4a4a4a;
      borderColor = 0xffd700;
      statusMsg = '可执行';
      statusColor = '#00ff00';
      canInteract = true;
    }

    const bg = this.scene.add.rectangle(0, 0, cardWidth, cardHeight, bgColor, 0.9);
    cardContainer.add(bg);

    const border = this.scene.add.rectangle(0, 0, cardWidth, cardHeight).setStrokeStyle(3, borderColor, 1);
    cardContainer.add(border);

    const nameColor = (isAvailable || isExecuting) ? '#ffffff' : '#666666';
    const nameText = this.scene.add.text(0, -20, action.name, {
      fontSize: '24px',
      color: nameColor,
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: cardWidth - 20 },
      padding: { top: 2 }
    }).setOrigin(0.5);
    cardContainer.add(nameText);

    const statusText = this.scene.add.text(0, 30, statusMsg, {
      fontSize: '16px',
      color: statusColor,
      fontStyle: 'italic',
      padding: { top: 2 }
    }).setOrigin(0.5);
    cardContainer.add(statusText);

    // 交互处理
    if (canInteract) {
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => {
        bg.setFillStyle(0x5a5a5a, 0.9);
        border.setStrokeStyle(4, 0xffff00, 1);
        cardContainer.setScale(1.05);
      });
      bg.on('pointerout', () => {
        bg.setFillStyle(0x4a4a4a, 0.9);
        border.setStrokeStyle(3, 0xffd700, 1);
        cardContainer.setScale(1);
      });
      bg.on('pointerdown', () => {
        this.onActionClick(actionId, action);
      });
    } else {
      // 不可交互时略微变暗
      cardContainer.setAlpha(isExecuting ? 0.9 : 0.6);
    }

    this.scrollContainer.add(cardContainer);
  }

  onActionClick(actionId, action) {
    console.log('执行:', actionId);

    if (actionId === 'soldier_check') {
      if (this.scene.closeCurrentSystem) this.scene.closeCurrentSystem();
      else this.destroy();
      new MilitaryUnitViewer(this.scene, this.saveData, action.name);
      return;
    }

    // 征集物资
    else if (actionId === 'get_resource') {
      new SoldierSelector(this.scene, this.saveData, {
        actionId: actionId,
        title: `选择${action.name}单位`,
        filter: (soldier) => {
          const unitData = MILITARY_UNIT[soldier.name];
          return (soldier.type === 'scout') || (unitData && unitData.type === 'scout');
        },
        onSelect: (id, soldier) => {
          new ResourceSelector(this.scene, this.saveData, {
            onSelect: (resourceName) => {
              if (!this.saveData.actionList.military) this.saveData.actionList.military = {};

              const actionKey = `${actionId}_${Date.now()}`;

              this.saveData.actionList.civil[actionKey] = {
                soldier: id,
                resource: resourceName
              };
              this.saveData.military[id].currentStatus = actionKey;

              // 存档
              saveSystem.save();

              // 立刻刷新当前军事行动界面
              this.refreshUI();
            }
          });
        }
      });
      return;
    }

    // 地形侦查或其他需要选择士兵的任务
    else if (actionId === 'explore_terrain') {
      new SoldierSelector(this.scene, this.saveData, {
        actionId: actionId,
        title: `选择${action.name}单位`,
        requiredAbility: actionId,
        onSelect: (id, soldier) => {
          // 更新数据
          if (!this.saveData.actionList.military) this.saveData.actionList.military = {};

          this.saveData.actionList.military[actionId] = {
            soldier: id,
          };
          this.saveData.military[id].currentStatus = actionId;

          // 存档
          saveSystem.save();

          // 立刻刷新当前军事行动界面
          this.refreshUI();
        }
      });
      return;
    }
  }

  createCloseButton() {
    const { width } = this.scene.scale;
    const closeBtn = this.scene.add.container(width - 50, 50);
    const closeBg = this.scene.add.circle(0, 0, 25, 0xff0000, 0.8);
    const closeText = this.scene.add.text(0, 0, '×', {
      fontSize: '36px', color: '#ffffff', fontStyle: 'bold', padding: { top: 2 }
    }).setOrigin(0.5);

    closeBtn.add([closeBg, closeText]);
    closeBg.setInteractive({ useHandCursor: true });
    closeBg.on('pointerover', () => { closeBg.setFillStyle(0xff3333, 1); closeBtn.setScale(1.1); });
    closeBg.on('pointerout', () => { closeBg.setFillStyle(0xff0000, 0.8); closeBtn.setScale(1.0); });
    closeBg.on('pointerdown', () => {
      // 如果场景有统一的关闭方法则调用，否则自己销毁
      if (this.scene.closeCurrentSystem) {
        this.scene.closeCurrentSystem();
      } else {
        this.destroy();
      }
    });
    this.mainContainer.add(closeBtn);
  }

  /**
   * 刷新界面：清理并重建滚动区域
   */
  refreshUI() {
    // 销毁旧的滚动容器
    if (this.scrollContainer) {
      this.scrollContainer.destroy();
      this.scrollContainer = null;
    }

    // 销毁旧的滚动条组件
    if (this.scrollTrack) {
      this.scrollTrack.destroy();
      this.scrollTrack = null;
    }
    if (this.scrollThumb) {
      this.scrollThumb.destroy();
      this.scrollThumb = null;
    }

    // 重新创建内容（读取最新的saveData）
    this.createScrollableContent();

    // 保持之前的滚动位置，避免跳回顶部
    this.updateScrollPosition();
  }

  destroy() {
    this.scene.input.off('wheel', this.onMouseWheel, this);
    if (this.mainContainer) {
      this.mainContainer.destroy();
      this.mainContainer = null;
    }
  }
}

/**
 * 士兵选择器
 * 用于列出特定任务可用的士兵
 */
export class SoldierSelector {
  constructor(scene, saveData, config) {
    this.scene = scene;
    this.saveData = saveData;

    // 配置
    this.config = {
      title: config.title || '选择单位',
      requiredAbility: config.requiredAbility || '',
      filter: config.filter || null,
      onSelect: config.onSelect || null,

      // UI 参数
      width: 600,
      height: 500,
      cardHeight: 80, // 列表项高度
      cardSpacing: 10,
      themeColor: 0xffd700
    };

    // 绑定上下文，防止事件丢失
    this.onMouseWheel = this.onMouseWheel.bind(this);

    this.create();
  }

  create() {
    const { width, height } = this.scene.scale;
    const boxW = this.config.width;
    const boxH = this.config.height;

    // --- 1. 创建全屏遮罩 ---
    // 放在最底层 (depth 1199)，颜色黑色半透明
    this.overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
    this.overlay.setDepth(1199);
    // 关键：设置为可交互，这样点击事件会被它“吃掉”，不会传给游戏底层的地图
    this.overlay.setInteractive();

    // --- 2. 主容器 ---
    this.mainContainer = this.scene.add.container(width / 2, height / 2).setDepth(1200);

    // 背景
    const bg = this.scene.add.rectangle(0, 0, boxW, boxH, 0x1a1a1a, 1);
    const border = this.scene.add.rectangle(0, 0, boxW, boxH).setStrokeStyle(2, this.config.themeColor);

    // 窗口背景也设为交互，防止穿透
    bg.setInteractive();
    this.mainContainer.add([bg, border]);

    // --- 3. 标题 ---
    const titleText = this.scene.add.text(0, -boxH / 2 + 30, this.config.title, {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
      padding: { top: 2 }
    }).setOrigin(0.5);
    this.mainContainer.add(titleText);

    // --- 4. 关闭按钮 ---
    // 增加一个透明的点击区域 circle
    const closeBtnContainer = this.scene.add.container(boxW / 2 - 25, -boxH / 2 + 25);

    const closeHitArea = this.scene.add.circle(0, 0, 20, 0xff0000, 0); // 透明圆
    closeHitArea.setInteractive({ useHandCursor: true });

    const closeText = this.scene.add.text(0, 0, '×', {
      fontSize: '32px', color: '#ff4444', fontStyle: 'bold',padding: { top: 2 }
    }).setOrigin(0.5);

    closeBtnContainer.add([closeHitArea, closeText]);
    this.mainContainer.add(closeBtnContainer);

    // 事件处理
    closeHitArea.on('pointerover', () => closeText.setColor('#ffaaaa'));
    closeHitArea.on('pointerout', () => closeText.setColor('#ff4444'));
    closeHitArea.on('pointerdown', () => {
      this.destroy();
    });

    // --- 5. 创建列表 ---
    this.createSoldierList(boxW, boxH);
  }

  createSoldierList(boxW, boxH) {
    // 筛选符合条件的士兵
    const validSoldiers = this.getAvailableSoldiers();

    const listW = boxW - 40;
    const listH = boxH - 80; // 减去标题高度
    const startY = -boxH / 2 + 70; // 列表起始Y

    // 1. 创建遮罩
    const maskShape = this.scene.make.graphics();
    // 遮罩使用的是世界坐标，需要计算
    const absX = this.mainContainer.x - listW / 2;
    const absY = this.mainContainer.y + startY;

    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(absX, absY, listW, listH);
    const mask = maskShape.createGeometryMask();

    // 2. 列表容器
    this.listContainer = this.scene.add.container(0, startY);
    this.listContainer.setMask(mask);
    this.mainContainer.add(this.listContainer);

    // 3. 如果没有数据
    if (validSoldiers.length === 0) {
      const noDataText = this.scene.add.text(0, 50, '无可执行任务的单位', {
        fontSize: '18px', color: '#999',padding: { top: 2 }
      }).setOrigin(0.5);
      this.listContainer.add(noDataText);
      return;
    }

    // 4. 生成卡片
    let currentY = 0;
    validSoldiers.forEach((item, index) => {
      const card = this.createSoldierRow(item.id, item.data, listW, currentY);
      this.listContainer.add(card);
      currentY += this.config.cardHeight + this.config.cardSpacing;
    });

    // 5. 滚动逻辑
    this.listContentHeight = currentY;
    this.listViewportHeight = listH;
    this.currentScrollY = 0;
    this.maxScroll = Math.max(0, this.listContentHeight - this.listViewportHeight);

    // 注册滚轮事件
    this.scene.input.on('wheel', this.onMouseWheel);
  }

  /**
   * 滚轮事件处理
   */
  onMouseWheel(pointer, gameObjects, deltaX, deltaY, deltaZ) {
    // 只有当最大滚动距离大于0时才滚动
    if (this.maxScroll <= 0) return;

    // 只有当鼠标在列表范围内才滚动 (可选优化，目前全屏滚动体验也好)
    this.currentScrollY += deltaY * 0.5;
    this.currentScrollY = Phaser.Math.Clamp(this.currentScrollY, 0, this.maxScroll);

    // 更新容器位置
    this.listContainer.y = (-this.config.height / 2 + 70) - this.currentScrollY;
  }

  getAvailableSoldiers() {
    if (!this.saveData || !this.saveData.military) return [];

    const result = [];
    const required = this.config.requiredAbility;

    for (const [id, soldier] of Object.entries(this.saveData.military)) {
      if (soldier.currentStatus) continue;

      if (this.config.filter) {
        if (this.config.filter(soldier)) {
          result.push({ id, data: soldier });
        }
        continue;
      }

      let hasAbility = false;
      if (soldier.ability) {
        if (Array.isArray(soldier.ability)) {
          hasAbility = soldier.ability.includes(required);
        } else if (typeof soldier.ability === 'object') {
          hasAbility = soldier.ability[required];
        }
      }
      if (hasAbility) result.push({ id, data: soldier });
    }
    return result;
  }

  createSoldierRow(id, soldier, width, y) {
    const rowHeight = this.config.cardHeight;
    const container = this.scene.add.container(0, y + rowHeight / 2);

    const bg = this.scene.add.rectangle(0, 0, width, rowHeight, 0x333333).setInteractive({ useHandCursor: true });
    const border = this.scene.add.rectangle(0, 0, width, rowHeight).setStrokeStyle(1, 0x666666);

    bg.on('pointerover', () => { bg.setFillStyle(0x444444); border.setStrokeStyle(2, 0xffff00); });
    bg.on('pointerout', () => { bg.setFillStyle(0x333333); border.setStrokeStyle(1, 0x666666); });

    bg.on('pointerdown', () => {
      // ToDo: 执行任务
      if (this.config.onSelect) {
        this.config.onSelect(id, soldier);
      }
      // 选择后关闭
      this.destroy();
    });

    const nameText = this.scene.add.text(-width / 2 + 20, 0, MILITARY_UNIT[soldier.name].name, {
      fontSize: '20px', color: '#fff', fontStyle: 'bold',padding: { top: 2 }
    }).setOrigin(0, 0.5);

    // 属性显示
    let statsStr = "";
    if (soldier.stats) {
      const s = soldier.stats;
      statsStr = `攻:${s.physical_attack || 0} 魔:${s.mana || 0} 体:${s.hp || 0}`;
    }

    const statsText = this.scene.add.text(0, 0, statsStr, {
      fontSize: '14px', color: '#aaaaaa',padding: { top: 2 }
    }).setOrigin(0.5);

    const selectBtn = this.scene.add.text(width / 2 - 20, 0, '选择', {
      fontSize: '16px', color: '#00ff00',padding: { top: 2 }
    }).setOrigin(1, 0.5);

    container.add([bg, border, nameText, statsText, selectBtn]);
    return container;
  }

  /**
   * 销毁组件，清理资源
   */
  destroy() {
    // 1. 移除全局事件监听 (必须！)
    this.scene.input.off('wheel', this.onMouseWheel);

    // 2. 销毁遮罩
    if (this.overlay) {
      this.overlay.destroy();
      this.overlay = null;
    }

    // 3. 销毁主容器
    if (this.mainContainer) {
      this.mainContainer.destroy();
      this.mainContainer = null;
    }
  }
}

/**
 * 资源选择器
 * 用于选择征集物资的类型
 */
export class ResourceSelector {
  constructor(scene, saveData, config) {
    this.scene = scene;
    this.saveData = saveData;
    this.config = {
      title: '选择征集的物资',
      width: 500,
      height: 350,
      themeColor: 0xffd700,
      onSelect: config.onSelect || null
    };

    this.create();
  }

  create() {
    const { width, height } = this.scene.scale;
    const boxW = this.config.width;
    const boxH = this.config.height;

    // 比 SoldierSelector 层级高
    this.overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
    this.overlay.setDepth(1299);
    this.overlay.setInteractive();

    this.mainContainer = this.scene.add.container(width / 2, height / 2).setDepth(1300);

    const bg = this.scene.add.rectangle(0, 0, boxW, boxH, 0x1a1a1a, 1);
    const border = this.scene.add.rectangle(0, 0, boxW, boxH).setStrokeStyle(2, this.config.themeColor);

    bg.setInteractive();
    this.mainContainer.add([bg, border]);

    const titleText = this.scene.add.text(0, -boxH / 2 + 30, this.config.title, {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
      padding: { top: 2 }
    }).setOrigin(0.5);
    this.mainContainer.add(titleText);

    const closeBtnContainer = this.scene.add.container(boxW / 2 - 25, -boxH / 2 + 25);
    const closeHitArea = this.scene.add.circle(0, 0, 20, 0xff0000, 0);
    closeHitArea.setInteractive({ useHandCursor: true });

    const closeText = this.scene.add.text(0, 0, '×', {
      fontSize: '32px', color: '#ff4444', fontStyle: 'bold',padding: { top: 2 }
    }).setOrigin(0.5);

    closeBtnContainer.add([closeHitArea, closeText]);
    this.mainContainer.add(closeBtnContainer);

    closeHitArea.on('pointerover', () => closeText.setColor('#ffaaaa'));
    closeHitArea.on('pointerout', () => closeText.setColor('#ff4444'));
    closeHitArea.on('pointerdown', () => this.destroy());

    this.createResourceCards();
  }

  createResourceCards() {
    const resources = ['food', 'culture', 'mine'];
    const cardW = 120;
    const cardH = 160;
    const spacing = 30;

    // 居中计算起点的 x
    const startX = -((cardW * 3 + spacing * 2) / 2) + cardW / 2;

    resources.forEach((res, index) => {
      const x = startX + index * (cardW + spacing);
      const y = 20;

      const card = this.scene.add.container(x, y);

      const cardBg = this.scene.add.rectangle(0, 0, cardW, cardH, 0x333333).setInteractive({ useHandCursor: true });
      const cardBorder = this.scene.add.rectangle(0, 0, cardW, cardH).setStrokeStyle(2, 0x666666);

      cardBg.on('pointerover', () => { cardBg.setFillStyle(0x444444); cardBorder.setStrokeStyle(2, 0xffff00); card.setScale(1.05); });
      cardBg.on('pointerout', () => { cardBg.setFillStyle(0x333333); cardBorder.setStrokeStyle(2, 0x666666); card.setScale(1); });

      cardBg.on('pointerdown', () => {
        if (this.config.onSelect) {
          this.config.onSelect(res);
        }
        this.destroy();
      });

      const icon = this.scene.add.image(0, -20, 'icon_' + res);
      icon.setDisplaySize(80, 80);

      const resName = this.scene.add.text(0, 50, get.translation(res), {
        fontSize: '20px', color: '#fff', fontStyle: 'bold',padding: { top: 2 }
      }).setOrigin(0.5);

      card.add([cardBg, cardBorder, icon, resName]);
      this.mainContainer.add(card);
    });
  }

  destroy() {
    if (this.overlay) {
      this.overlay.destroy();
      this.overlay = null;
    }
    if (this.mainContainer) {
      this.mainContainer.destroy();
      this.mainContainer = null;
    }
  }
}