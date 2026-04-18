import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';

import { MILITARY } from '../../data/military.js';
import { MILITARY_UNIT } from '../../data/military_unit.js';
import { ERA } from '../../data/era.js';
import { REGION } from '../../data/region.js';

export class ActionListSystem {
  constructor(scene, saveData) {
    this.scene = scene;
    this.saveData = saveData;
    this.container = scene.add.container(0, 0);
    this.container.setDepth(1000);

    this.createPanel();
    this.playEnterAnimation();
  }

  createPanel() {
    const { width, height } = this.scene.scale;
    const centerX = width / 2;
    const centerY = height / 2;

    // 面板尺寸
    const panelWidth = 900;
    const panelHeight = 700;
    const panelX = centerX - panelWidth / 2;
    const panelY = centerY - panelHeight / 2;

    // 主背景
    this.bg = this.scene.add.rectangle(
      centerX,
      centerY,
      panelWidth,
      panelHeight,
      0x1a1a1a,
      0.95
    );
    this.bg.setStrokeStyle(2, 0x4a4a4a);
    this.container.add(this.bg);

    // --- 标题区域 ---
    const titleHeight = 60;
    const titleBg = this.scene.add.rectangle(
      centerX,
      panelY + titleHeight / 2,
      panelWidth,
      titleHeight,
      0x2a2a2a
    );
    this.container.add(titleBg);

    // 标题文字
    const titleText = this.scene.add.text(
      centerX,
      panelY + titleHeight / 2,
      '行动列表',
      {
        fontSize: '28px',
        fontFamily: 'Arial, sans-serif',
        color: '#ffffff',
        fontStyle: 'bold'
      }
    );
    titleText.setOrigin(0.5);
    this.container.add(titleText);

    // --- 回合与时代信息---
    const currentTurn = (this.saveData.process?.turn) || 1;
    const currentEra = ERA[this.saveData.process?.era].name || '未知时代';

    const infoTextStr = `${currentEra} | 第 ${currentTurn} 回合`;
    const infoText = this.scene.add.text(
      panelX + 20,
      panelY + titleHeight / 2,
      infoTextStr,
      {
        fontSize: '18px',
        fontFamily: 'Arial, sans-serif',
        color: '#ffd700',
        fontStyle: 'bold'
      }
    );
    infoText.setOrigin(0, 0.5);
    this.container.add(infoText);


    // --- 关闭按钮 ---
    const closeBtn = this.scene.add.text(
      panelX + panelWidth - 30,
      panelY + titleHeight / 2,
      '✕',
      {
        fontSize: '24px',
        color: '#ffffff'
      }
    );
    closeBtn.setOrigin(0.5);
    closeBtn.setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => {
      this.playExitAnimation();
    });
    closeBtn.on('pointerover', () => {
      closeBtn.setColor('#ff6666');
    });
    closeBtn.on('pointerout', () => {
      closeBtn.setColor('#ffffff');
    });
    this.container.add(closeBtn);

    // --- 底部按钮区域高度预留 ---
    const footerHeight = 80;

    // --- 内容区域计算 ---
    const contentY = panelY + titleHeight + 10;
    // 总高度减去标题栏、底部按钮区和一些间距
    const contentHeight = panelHeight - titleHeight - footerHeight - 20;
    const sectionHeight = contentHeight / 3;
    const sectionWidth = panelWidth - 40;
    const sectionX = centerX;

    // 获取行动列表数据
    const actionList = this.saveData.actionList || {
      military: {},
      civil: {},
      others: {}
    };

    // 创建三个区域，新增 type 参数以区分逻辑
    this.createSection(
      sectionX,
      contentY,
      sectionWidth,
      sectionHeight,
      '军事行动',
      actionList.military,
      0xe74c3c,
      'military'
    );

    this.createSection(
      sectionX,
      contentY + sectionHeight,
      sectionWidth,
      sectionHeight,
      '民生行动',
      actionList.civil,
      0x3498db,
      'civil'
    );

    this.createSection(
      sectionX,
      contentY + sectionHeight * 2,
      sectionWidth,
      sectionHeight,
      '其他行动',
      actionList.others,
      0x95a5a6,
      'others'
    );

    // --- 底部下一回合按钮 ---
    const btnY = panelY + panelHeight - footerHeight / 2;
    this.createNextTurnBtn(centerX, btnY, 200, 50, actionList);
  }

  /**
   * 创建下一回合按钮
   */
  createNextTurnBtn(x, y, width, height, actionList) {
    // 检查是否有任何行动
    const mCount = Object.keys(actionList.military || {}).length;
    const cCount = Object.keys(actionList.civil || {}).length;
    const oCount = Object.keys(actionList.others || {}).length;
    const hasActions = (mCount + cCount + oCount) > 0;

    // 按钮样式配置
    const btnColor = hasActions ? 0x27ae60 : 0x555555; // 绿色 vs 灰色
    const btnStroke = hasActions ? 0x2ecc71 : 0x777777;
    const txtColor = hasActions ? '#ffffff' : '#aaaaaa';

    // 按钮背景容器
    const btnContainer = this.scene.add.container(x, y);
    this.container.add(btnContainer);

    const bg = this.scene.add.rectangle(0, 0, width, height, btnColor, 1);
    bg.setStrokeStyle(2, btnStroke);
    // 圆角矩形效果
    btnContainer.add(bg);

    const text = this.scene.add.text(0, 0, '下一回合', {
      fontSize: '22px',
      fontFamily: 'Arial, sans-serif',
      color: txtColor,
      fontStyle: 'bold'
    });
    text.setOrigin(0.5);
    btnContainer.add(text);

    // 交互逻辑
    if (hasActions) {
      bg.setInteractive({ useHandCursor: true });

      bg.on('pointerover', () => {
        bg.setFillStyle(0x2ecc71); // 悬停变亮
        btnContainer.setScale(1.05);
      });

      bg.on('pointerout', () => {
        bg.setFillStyle(0x27ae60); // 恢复
        btnContainer.setScale(1);
      });

      bg.on('pointerdown', () => {
        // 点击效果
        btnContainer.setScale(0.95);
        this.scene.tweens.add({
          targets: btnContainer,
          scale: 1,
          duration: 100,
          onComplete: () => {
            this.onNextTurn();
          }
        });
      });
    }
  }

  /**
   * 点击下一回合触发的逻辑
   */
  onNextTurn() {
    this.playExitAnimation();
    this.scene.events.emit('END_TURN');
    //new TurnSystem(this.scene, this.saveData);
  }

  /**
   * 创建单个分类区域
   */
  createSection(x, y, width, height, title, data, color, type) {
    // 区域背景
    const sectionBg = this.scene.add.rectangle(
      x,
      y + height / 2,
      width,
      height - 10,
      0x2a2a2a,
      0.5
    );
    sectionBg.setStrokeStyle(1, color);
    this.container.add(sectionBg);

    // 标题栏
    const headerHeight = 40;
    const headerBg = this.scene.add.rectangle(
      x,
      y + headerHeight / 2,
      width,
      headerHeight,
      color,
      0.3
    );
    this.container.add(headerBg);

    // 标题文字
    const headerText = this.scene.add.text(
      x - width / 2 + 20,
      y + headerHeight / 2,
      title,
      {
        fontSize: '20px',
        fontFamily: 'Arial, sans-serif',
        color: '#ffffff',
        fontStyle: 'bold'
      }
    );
    headerText.setOrigin(0, 0.5);
    this.container.add(headerText);

    // 数量标签
    const count = Object.keys(data).length;
    const countText = this.scene.add.text(
      x + width / 2 - 20,
      y + headerHeight / 2,
      `(${count})`,
      {
        fontSize: '18px',
        fontFamily: 'Arial, sans-serif',
        color: '#aaaaaa'
      }
    );
    countText.setOrigin(1, 0.5);
    this.container.add(countText);

    // 内容区域
    const contentY = y + headerHeight + 10;
    const contentHeight = height - headerHeight - 20;
    const contentWidth = width - 40;

    // 如果有数据，显示列表
    if (count > 0) {
      this.createActionList(
        x,
        contentY,
        contentWidth,
        contentHeight,
        data,
        color,
        type
      );
    } else {
      // 无数据提示
      const emptyText = this.scene.add.text(
        x,
        contentY + contentHeight / 2,
        '暂无行动',
        {
          fontSize: '16px',
          fontFamily: 'Arial, sans-serif',
          color: '#666666',
          fontStyle: 'italic'
        }
      );
      emptyText.setOrigin(0.5);
      this.container.add(emptyText);
    }
  }

  /**
   * 创建行动列表
   */
  createActionList(x, y, width, height, data, color, type) {
    const itemHeight = 50;
    const itemSpacing = 10;
    const keys = Object.keys(data);

    // 计算项目实际所需的总高度
    const totalHeight = keys.length * (itemHeight + itemSpacing) - itemSpacing;

    // 用于捕获滚轮事件的不可见点击区
    const hitArea = this.scene.add.rectangle(x, y + height / 2, width, height, 0x000000, 0);
    hitArea.setInteractive();
    this.container.add(hitArea);

    // 创建内容存放的内部容器
    const listContainer = this.scene.add.container(0, 0);
    this.container.add(listContainer);
    listContainer.y = 0;
    const baseListY = listContainer.y;

    // 创建遮罩区域
    const maskGraphics = this.scene.add.graphics();
    maskGraphics.fillStyle(0xffffff);
    maskGraphics.fillRect(x - width / 2, y, width, height);

    const mask = maskGraphics.createGeometryMask();
    maskGraphics.setVisible(false);

    this.container.add(maskGraphics);
    listContainer.setMask(mask);

    // 判断是否需要滚动条，如果需要则将列表宽度稍作收缩
    const needsScroll = totalHeight > height;
    const contentWidth = needsScroll ? width - 15 : width;
    let currentY = y;

    // 渲染所有的项目，并将其添加到内部滚动容器中
    keys.forEach((key) => {
      const actionData = data[key];
      // 计算每个元素的绘制 x 坐标，给滚动条让出空间
      const drawX = x - (needsScroll ? 7.5 : 0);

      if (type === 'military') {
        this.createMilitaryActionItem(listContainer, drawX, currentY, contentWidth, itemHeight, key, actionData, color);
      } else if (type === 'civil') {
        this.createCivilActionItem(listContainer, drawX, currentY, contentWidth, itemHeight, key, actionData, color);
      } else if (type === 'others') {
        this.createOtherActionItem(listContainer, drawX, currentY, contentWidth, itemHeight, key, actionData, color);
      }
      currentY += itemHeight + itemSpacing;
    });

    // 增加滚动条与滚动逻辑
    if (needsScroll) {
      const scrollbarWidth = 6;
      const trackX = x + width / 2 - scrollbarWidth / 2;
      const trackY = y + height / 2;

      // 滚动条轨道
      const track = this.scene.add.rectangle(trackX, trackY, scrollbarWidth, height, 0x1a1a1a, 0.8);
      track.setStrokeStyle(1, 0x4a4a4a);
      this.container.add(track);

      // 滚动条滑块
      const thumbHeight = Math.max(20, (height / totalHeight) * height);
      const minThumbY = y + thumbHeight / 2;
      const maxThumbY = y + height - thumbHeight / 2;

      const thumb = this.scene.add.rectangle(trackX, minThumbY, scrollbarWidth - 2, thumbHeight, color, 1);
      thumb.setInteractive({ draggable: true, useHandCursor: true });
      this.container.add(thumb);

      const maxScrollY = totalHeight - height;
      const maxThumbMove = maxThumbY - minThumbY;

      // 更新列表Y轴的闭包函数
      const updateScroll = () => {
        const scrollPercent = (thumb.y - minThumbY) / maxThumbMove;
        listContainer.y = baseListY - scrollPercent * maxScrollY;
      };

      // 绑定滚轮交互
      hitArea.on('wheel', (pointer, deltaX, deltaY, deltaZ) => {
        let newThumbY = thumb.y + deltaY * 0.5; // 控制滚轮灵敏度
        thumb.y = Phaser.Math.Clamp(newThumbY, minThumbY, maxThumbY);
        updateScroll();
      });

      // 绑定拖拽交互
      this.scene.input.setDraggable(thumb);
      thumb.on('drag', (pointer, dragX, dragY) => {
        const localY = pointer.y;
        thumb.y = Phaser.Math.Clamp(localY, minThumbY, maxThumbY);
        updateScroll();
      });
    }
  }

  /**
   * 创建单个军事行动项
   */
  createMilitaryActionItem(parentContainer, x, y, width, height, key, actionData, color) {
    let intro = MILITARY[key]?.intro || key;
    const replacements = [];

    // 构建替换内容
    if (actionData.soldier) {
      var detail = this.saveData.military[actionData.soldier];
      const unitName = MILITARY_UNIT[detail?.name]?.name || detail?.name || actionData.soldier;
      replacements.push(unitName);
    }

    // 依次替换 "XX" 为带有特殊标记的字符串
    // 标记格式为： {{内容}}
    let markedIntro = intro;
    replacements.forEach(val => {
      markedIntro = markedIntro.replace("XX", `{{${val}}}`);
    });

    // 3. UI 背景绘制
    const itemBg = this.scene.add.rectangle(x, y + height / 2, width, height, 0x3a3a3a, 0.8);
    itemBg.setStrokeStyle(1, color, 0.5);
    parentContainer.add(itemBg);

    // 解析 markedIntro 并创建彩色文本组
    this.renderColoredText(x - width / 2 + 15, y + height / 2, markedIntro, parentContainer);
  }

  /**
   * 创建单个民事行动项
   */
  createCivilActionItem(parentContainer, x, y, width, height, key, actionData, color) {
    let markedIntro = key;

    if (markedIntro.startsWith('build_region')) {
      markedIntro = '在' + this.getGridName(actionData.gridId) + '建造特区【' + REGION[actionData.regionKey].name + '】';
    }
    else if (markedIntro.startsWith('research_tech_')) {
      markedIntro = '启发了科技【' + actionData.name + '】';
    }

    // UI 背景绘制
    const itemBg = this.scene.add.rectangle(x, y + height / 2, width, height, 0x3a3a3a, 0.8);
    itemBg.setStrokeStyle(1, color, 0.5);
    parentContainer.add(itemBg);

    // 解析 markedIntro 并创建彩色文本组
    this.renderColoredText(x - width / 2 + 15, y + height / 2, markedIntro, parentContainer);
  }

  /**
   * 创建单个其他行动项
   */
  createOtherActionItem(parentContainer, x, y, width, height, key, actionData, color) {
    let markedIntro = key;

    // UI 背景绘制
    const itemBg = this.scene.add.rectangle(x, y + height / 2, width, height, 0x3a3a3a, 0.8);
    itemBg.setStrokeStyle(1, color, 0.5);
    parentContainer.add(itemBg);

    // 解析 markedIntro 并创建彩色文本组
    this.renderColoredText(x - width / 2 + 15, y + height / 2, markedIntro, parentContainer);
  }

  /**
   * 将带标记的字符串解析并渲染为多色文本
   */
  renderColoredText(startX, centerY, text, container) {
    // 正则匹配：拆分出普通文本和 {{标记文本}}
    const parts = text.split(/({{.*?}})/g);
    let currentX = startX;

    parts.forEach(part => {
      if (!part) return;

      let isHighlight = part.startsWith('{{') && part.endsWith('}}');
      let content = isHighlight ? part.slice(2, -2) : part;
      let textColor = isHighlight ? '#ffd700' : '#ffffff'; // 高亮部分为黄色

      const txt = this.scene.add.text(currentX, centerY, content, {
        fontSize: '16px',
        fontFamily: 'Arial, sans-serif',
        color: textColor,
        fontStyle: isHighlight ? 'bold' : 'normal'
      }).setOrigin(0, 0.5);

      container.add(txt);
      currentX += txt.width; // 动态计算下一个片段的起始位置
    });
  }

  getGridName(gridId) {
    if (gridId === 'g1') {
      return '主城';
    }

    const num = parseInt(gridId.replace('g', ''));
    const areaNum = num - 1;

    return `${areaNum}区`;
  }

  /**
   * 进入动画
   */
  playEnterAnimation() {
    this.container.setAlpha(0);
    this.container.setScale(0.9);

    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      scale: 1,
      duration: 300,
      ease: 'Back.easeOut'
    });
  }

  /**
   * 退出动画
   */
  playExitAnimation() {
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      scale: 0.9,
      duration: 200,
      ease: 'Back.easeIn',
      onComplete: () => {
        if (this.scene.closeCurrentSystem) {
          this.scene.closeCurrentSystem();
        } else {
          this.destroy();
        }
      }
    });
  }

  /**
   * 销毁面板
   */
  destroy() {
    if (this.container) {
      this.container.destroy();
    }
  }
}