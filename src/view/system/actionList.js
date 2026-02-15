/**
 * 行动列表系统
 * 显示三类行动：军事、民事、其他
 */
import { MILITARY } from '../../data/military.js';
import { MILITARY_UNIT } from '../../data/military_unit.js';

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

    // 标题区域
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

    // 关闭按钮
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

    // 内容区域起始位置
    const contentY = panelY + titleHeight + 10;
    const contentHeight = panelHeight - titleHeight - 20;
    const sectionHeight = contentHeight / 3;
    const sectionWidth = panelWidth - 40;
    const sectionX = centerX;

    // 获取行动列表数据
    const actionList = this.saveData.actionList || {
      military: {},
      civil: {},
      others: {}
    };

    // 创建三个区域
    this.createSection(
      sectionX,
      contentY,
      sectionWidth,
      sectionHeight,
      '军事行动',
      actionList.military,
      0xe74c3c
    );

    this.createSection(
      sectionX,
      contentY + sectionHeight,
      sectionWidth,
      sectionHeight,
      '民事行动',
      actionList.civil,
      0x3498db
    );

    this.createSection(
      sectionX,
      contentY + sectionHeight * 2,
      sectionWidth,
      sectionHeight,
      '其他行动',
      actionList.others,
      0x95a5a6
    );
  }

  /**
   * 创建单个分类区域
   */
  createSection(x, y, width, height, title, data, color) {
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
        color
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
  createActionList(x, y, width, height, data, color) {
    const itemHeight = 50;
    const itemSpacing = 10;
    let currentY = y;

    // 创建滚动容器
    const keys = Object.keys(data);
    const maxVisibleItems = Math.floor(height / (itemHeight + itemSpacing));

    // 显示前几个项目
    keys.slice(0, maxVisibleItems).forEach((key, index) => {
      const actionData = data[key];
      this.createActionItem(
        x,
        currentY,
        width,
        itemHeight,
        key,
        actionData,
        color
      );
      currentY += itemHeight + itemSpacing;
    });

    // 如果有更多项目，显示提示
    if (keys.length > maxVisibleItems) {
      const moreText = this.scene.add.text(
        x,
        currentY + 10,
        `... 还有 ${keys.length - maxVisibleItems} 项`,
        {
          fontSize: '14px',
          fontFamily: 'Arial, sans-serif',
          color: '#888888',
          fontStyle: 'italic'
        }
      );
      moreText.setOrigin(0.5, 0);
      this.container.add(moreText);
    }
  }

  /**
   * 创建单个行动项
   */
  createActionItem(x, y, width, height, key, actionData, color) {
    let intro = MILITARY[key].intro;
    const replacements = [];

    // 构建替换内容
    if (actionData.soldier) {
      var detail = this.saveData.military[actionData.soldier];
      const unitName = MILITARY_UNIT[detail.name]?.name || actionData.soldier;
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
    this.container.add(itemBg);

    // 解析 markedIntro 并创建彩色文本组
    this.renderColoredText(x - width / 2 + 15, y + height / 2, markedIntro, this.container);

  }

  /**
   * 辅助方法：将带标记的字符串解析并渲染为多色文本
   * @param {number} startX 起始X
   * @param {number} centerY 中心Y
   * @param {string} text 带 {{}} 标记的文本
   * @param {Phaser.GameObjects.Container} container 放入的容器
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
        this.scene.closeCurrentSystem();
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