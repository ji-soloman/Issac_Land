import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import { get } from '../system/i18n.js';
import { ERA, getNextEraMissions } from '../data/era.js';

import { Settings } from '../view/settings.js';

export class TopInfoBar {
  constructor(scene) {
    this.scene = scene;
    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(1000);
    this.container.setScrollFactor(0);

    this.resources = ['wealth', 'culture', 'food', 'mine', 'magic', 'population'];
    this.resourceTexts = {};

    this.initTooltip();
    this.initUI();
    this.refresh();
  }

  // 初始化悬浮窗
  initTooltip() {
    this.tooltip = this.scene.add.container(0, 0);
    this.tooltip.setDepth(1001);
    this.tooltip.setScrollFactor(0);
    this.tooltip.setVisible(false);

    // 悬浮窗背景
    this.tooltipBg = this.scene.add.rectangle(0, 0, 180, 60, 0x222222, 0.9).setOrigin(0, 0.5);
    this.tooltipBg.setStrokeStyle(2, 0x555555);

    // 左侧图标
    this.tooltipIcon = this.scene.add.image(30, 0, 'icon_culture');

    // 右上方名字
    this.tooltipTitle = this.scene.add.text(60, -18, '名称', {
      fontSize: '16px', color: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold'
    }).setOrigin(0, 0);

    // 右下方实际数量
    this.tooltipValue = this.scene.add.text(60, 4, '当前数量：0', {
      fontSize: '14px', color: '#aaaaaa', fontFamily: 'Arial'
    }).setOrigin(0, 0);

    // 新增：回合收入
    this.tooltipIncome = this.scene.add.text(60, 24, '回合收入：0', {
      fontSize: '14px', color: '#aaaaaa', fontFamily: 'Arial'
    }).setOrigin(0, 0);

    this.tooltip.add([this.tooltipBg, this.tooltipIcon, this.tooltipTitle, this.tooltipValue, this.tooltipIncome]);
  }

  initUI() {
    const startY = 20;
    const startX = 25;   // 第一个图标的中心点 X 坐标
    const spacing = 110; // 每个资源板块占用的总宽度

    // 获取屏幕宽度
    const screenWidth = this.scene.scale.width;

    // 半透明黑色背景条
    const bg = this.scene.add.rectangle(
      0,
      startY,
      screenWidth,
      40,
      0x000000,
      0.5
    ).setOrigin(0, 0.5);
    this.container.add(bg);

    // ================== 左侧资源 ==================
    this.resources.forEach((res, index) => {
      const currentX = startX + (index * spacing);

      // 添加图标
      const icon = this.scene.add.image(currentX, startY, `icon_${res}`);
      icon.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      const maxDim = Math.max(icon.width, icon.height) || 1;
      icon.setScale(26 / maxDim);

      // 给图标绑定交互事件
      icon.setInteractive({ useHandCursor: true });
      icon.on('pointerover', (pointer) => this.showTooltip(res, pointer));
      icon.on('pointermove', (pointer) => this.moveTooltip(pointer));
      icon.on('pointerout', () => this.hideTooltip());

      this.container.add(icon);

      // 添加文本
      const textCenterX = currentX + (spacing / 2) - 5;

      const text = this.scene.add.text(textCenterX, startY, '0', {
        fontSize: '18px',
        color: '#ffffff',
        fontFamily: 'Arial',
        fontStyle: 'bold'
      }).setOrigin(0.5, 0.5);

      this.container.add(text);
      this.resourceTexts[res] = text;
    });

    // ================== 右侧 ==================

    // 时代文本
    this.eraText = this.scene.add.text(0, startY, '', {
      fontSize: '18px',
      color: '#ffd700',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(1, 0.5);

    // 轮次数值
    this.turnValueText = this.scene.add.text(0, startY, '1', {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      fixedWidth: 45,
      align: 'center'
    }).setOrigin(0.5, 0.5);

    // 回合标签文本
    this.turnLabelText = this.scene.add.text(0, startY, '回合', {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(1, 0.5);

    // 新增：设置按钮
    this.settingsBtn = this.scene.add.image(0, startY, 'settings_btn').setOrigin(1, 0.5);
    // 确保点击事件只发生在非透明部分 (pixelPerfect)
    this.settingsBtn.setInteractive({ useHandCursor: true, pixelPerfect: true });
    this.settingsBtn.on('pointerdown', (p, lx, ly, e) => {
      if (e) e.stopPropagation();
      new Settings(this.scene); // 打开设置界面
    });

    this.container.add([this.eraText, this.turnValueText, this.turnLabelText, this.settingsBtn]);

    this.initMissionPanel();
  }

  // ================== 时代任务面板 ==================
  // 位于顶部条的右下角（屏幕右上方，紧贴顶部条下沿）：黑色半透明方板，四角均为圆角，
  // 显示"进入下一个时代"需要完成的任务。面板大小固定，最多同时显示 3 条任务，
  // 超过 3 条时鼠标移到面板上用滚轮滚动查看（一次滚一条）。
  // 未完成的任务是灰白色文字，完成的是绿色。
  // 面板内容【只在回合结算时】更新（gameScene 的 TURN_FINALISED 里，先更新面板、再结算
  // 时代晋升），所以平时 refresh() 不会重新判断任务；只有第一次显示时会初始化一次。
  initMissionPanel() {
    const screenWidth = this.scene.scale.width;
    const W = 270;
    const HEADER_H = 32;
    const ROW_H = 26;
    const VISIBLE_ROWS = 3;
    const PAD_BOTTOM = 8;
    const H = HEADER_H + ROW_H * VISIBLE_ROWS + PAD_BOTTOM;
    const x0 = screenWidth - W;
    const y0 = 40; // 顶部条的下沿

    this.missionLayout = { W, H, x0, y0, HEADER_H, ROW_H, VISIBLE_ROWS };
    this.missionData = [];   // [{ info, done }]
    this.missionScroll = 0;  // 当前显示的第一条任务的下标
    this.missionRowTexts = [];
    this._missionInited = false;

    // 背景：四个角都是圆角
    const panelBg = this.scene.add.graphics();
    panelBg.fillStyle(0x000000, 0.5);
    panelBg.fillRoundedRect(x0, y0, W, H, 12);
    this.container.add(panelBg);

    // 标题（进入哪个时代）
    this.missionTitle = this.scene.add.text(x0 + W / 2, y0 + HEADER_H / 2 + 2, '', {
      fontSize: '14px', color: '#d4af6a', fontFamily: 'Arial', fontStyle: 'bold', padding: { top: 2 },
    }).setOrigin(0.5, 0.5);
    this.container.add(this.missionTitle);

    // 滚动条（任务超过 3 条时才显示）
    const trackY = y0 + HEADER_H;
    const trackH = ROW_H * VISIBLE_ROWS;
    this.missionTrack = this.scene.add.rectangle(screenWidth - 7, trackY, 4, trackH, 0xffffff, 0.15).setOrigin(0.5, 0);
    this.missionThumb = this.scene.add.rectangle(screenWidth - 7, trackY, 4, 20, 0xffffff, 0.6).setOrigin(0.5, 0);
    this.missionTrack.setVisible(false);
    this.missionThumb.setVisible(false);
    this.container.add([this.missionTrack, this.missionThumb]);

    // 面板命中区：鼠标在面板上时挡住地图的滚轮缩放/拖拽，让滚轮只用来滚动任务
    const hit = this.scene.add.rectangle(x0, y0, W, H, 0xffffff, 0).setOrigin(0, 0).setInteractive();
    hit.on('pointerover', () => {
      const mv = this.scene.mapView;
      if (mv && mv.interactionEnabled) {
        mv.disableInteraction();
        this._missionMapLocked = true;
      }
    });
    hit.on('pointerout', () => this._releaseMissionMapLock());
    this.container.add(hit);

    this._onMissionWheel = (pointer, gameObjects, dx, dy) => {
      const { x0, y0, W, H } = this.missionLayout;
      if (pointer.x < x0 || pointer.x > x0 + W || pointer.y < y0 || pointer.y > y0 + H) return;
      this.scrollMission(dy > 0 ? 1 : -1);
    };
    this.scene.input.on('wheel', this._onMissionWheel);
  }

  /** 鼠标离开面板后，恢复被面板临时关掉的地图交互 */
  _releaseMissionMapLock() {
    if (!this._missionMapLocked) return;
    this._missionMapLocked = false;
    this.scene.mapView?.enableInteraction();
  }

  /**
   * 重新读取"下一个时代"的任务完成情况并刷新面板（和回合末晋升判断用的是同一个
   * getNextEraMissions，保证面板显示和实际晋升条件一致）。
   */
  refreshMissionPanel() {
    const saveData = this.scene.saveData;
    if (!saveData || !this.missionLayout) return;
    this._missionInited = true;

    const info = getNextEraMissions(saveData, this.scene);
    if (!info) {
      this.missionTitle.setText('已是最后一个时代');
      this.missionData = [];
    } else if (info.missions.length === 0) {
      this.missionTitle.setText(`进入【${info.nextEra.name}】`);
      this.missionData = [];
    } else {
      this.missionTitle.setText(`进入【${info.nextEra.name}】`);
      this.missionData = info.missions;
    }
    this.missionScroll = 0;
    this.renderMissionRows();
  }

  scrollMission(step) {
    const next = Phaser.Math.Clamp(this.missionScroll + step, 0, this.missionMaxScroll ?? 0);
    if (next === this.missionScroll) return;
    this.missionScroll = next;
    this.renderMissionRows();
  }

  /**
   * 手动按像素宽度给文字换行（Phaser 的 wordWrap 不会在中文字符之间断行）。
   * 避头：下一个字符是句号、逗号、右括号这类标点时不在它前面断开。
   */
  _wrapMissionText(text, maxW, style, tail = '') {
    const NO_HEAD = '，。、；：！？）》」』】”’,.;:!?)]}…—·～~';
    const NO_TAIL = '（《「『【“‘([{';
    if (!this._missionMeasure) {
      this._missionMeasure = this.scene.add.text(0, 0, '', style).setVisible(false);
    }
    const m = this._missionMeasure;
    const lines = [];
    let line = '';
    for (const ch of text) {
      const candidate = line + ch;
      m.setText(candidate);
      if (line !== '' && m.width > maxW && !NO_HEAD.includes(ch)) {
        // 避尾：行尾不能是左括号之类，连同它一起挪到下一行
        if (NO_TAIL.includes(line[line.length - 1]) && line.length > 1) {
          lines.push(line.slice(0, -1));
          line = line[line.length - 1] + ch;
        } else {
          lines.push(line);
          line = ch;
        }
      } else {
        line = candidate;
      }
    }
    // 末尾的完成度（x/y）作为整体：当前行放得下就跟在后面，放不下就单独占一行，不拆开
    if (tail) {
      m.setText(line + tail);
      if (line !== '' && m.width > maxW) {
        lines.push(line);
        line = tail;
      } else {
        line += tail;
      }
    }
    if (line !== '') lines.push(line);
    return lines;
  }

  /**
   * 计算每条任务换行后的高度，并算出最大可滚动位置。所有任务文字大小统一，
   * 过长的任务自动换行；面板总大小不变，换行多的任务会占掉更多可视高度。
   * 滚动单位是"一条任务"。
   */
  _layoutMissions() {
    const { W, ROW_H, VISIBLE_ROWS } = this.missionLayout;
    const areaH = ROW_H * VISIBLE_ROWS;
    const style = { fontSize: '14px', fontFamily: 'Arial', padding: { top: 2 } };
    const LINE_H = 18, GAP = 8;

    const build = (maxW) => this.missionData.map((m, idx) => {
      const lines = this._wrapMissionText(`${idx + 1}. ${m.info}`, maxW, style, `（${m.current}/${m.target}）`);
      return { m, lines, h: lines.length * LINE_H + GAP };
    });

    // 先按没有滚动条的宽度排版，装不下再按有滚动条的宽度重排
    let blocks = build(W - 20 - 16);
    let needBar = blocks.reduce((a, b) => a + b.h, 0) > areaH;
    if (needBar) blocks = build(W - 20 - 22);

    // 最大滚动位置：从第 s 条开始往后的任务刚好能全部装进可视区域的最小 s
    let maxScroll = blocks.length;
    let acc = 0;
    for (let i = blocks.length - 1; i >= 0; i--) {
      acc += blocks[i].h;
      if (acc > areaH) break;
      maxScroll = i;
    }
    if (!needBar) maxScroll = 0;
    maxScroll = Math.min(maxScroll, Math.max(0, blocks.length - 1));

    this.missionBlocks = blocks;
    this.missionNeedBar = needBar;
    this.missionMaxScroll = maxScroll;
    this.missionTotalH = blocks.reduce((a, b) => a + b.h, 0);
    this.missionLineH = LINE_H;
    this.missionTextStyle = style;
  }

  /** 按当前滚动位置画出任务：从第 missionScroll 条开始往下排，放不下就停（不用遮罩，只创建可见的行） */
  renderMissionRows() {
    const { x0, y0, HEADER_H, ROW_H, VISIBLE_ROWS } = this.missionLayout;
    this.missionRowTexts.forEach(t => t.destroy());
    this.missionRowTexts = [];

    this._layoutMissions();
    this.missionScroll = Math.min(this.missionScroll, this.missionMaxScroll);

    const areaH = ROW_H * VISIBLE_ROWS;
    const areaTop = y0 + HEADER_H;

    if (this.missionBlocks.length === 0) {
      const empty = this.scene.add.text(x0 + 20, areaTop + 4, '暂无任务', {
        fontSize: '14px', color: '#9a9a9a', fontFamily: 'Arial', padding: { top: 2 },
      }).setOrigin(0, 0);
      this.container.add(empty);
      this.missionRowTexts.push(empty);
    }

    let cursor = 0;
    for (let i = this.missionScroll; i < this.missionBlocks.length; i++) {
      const { m, lines, h } = this.missionBlocks[i];
      // 第一条无论多高都显示；之后放不下的就不显示了
      if (i > this.missionScroll && cursor + h > areaH) break;
      const t = this.scene.add.text(x0 + 20, areaTop + cursor + 3, lines.join('\n'), {
        ...this.missionTextStyle,
        color: m.done ? '#4cd964' : '#c8c8c8',   // 完成：绿色；未完成：灰白色
        lineSpacing: this.missionLineH - 14 - 2,
      }).setOrigin(0, 0);
      this.container.add(t);
      this.missionRowTexts.push(t);
      cursor += h;
    }

    // 滚动条
    const needBar = this.missionNeedBar;
    this.missionTrack.setVisible(needBar);
    this.missionThumb.setVisible(needBar);
    if (needBar) {
      const thumbH = Math.max(16, areaH * areaH / this.missionTotalH);
      const ratio = this.missionMaxScroll > 0 ? this.missionScroll / this.missionMaxScroll : 0;
      this.missionThumb.setScale(1, thumbH / 20); // 初始高度 20，用缩放调整滑块高度
      this.missionThumb.y = areaTop + (areaH - thumbH) * ratio;
    }
  }

  formatDisplayValue(val) {
    return val > 999 ? '999+' : val.toString();
  }

  getResourceValue(key) {
    if (!this.scene.saveData) return 0;

    // 人口：汇总地图上所有格点的 gn.population 之和
    if (key === 'population') {
      const grids = this.scene.saveData.map?.grids;
      if (!grids) return 0;
      return Object.values(grids).reduce((sum, gn) => sum + (gn.population || 0), 0);
    }

    return this.scene.saveData.resource?.[key] || 0;
  }

  getProcessData() {
    if (!this.scene.saveData || !this.scene.saveData.process) {
      return { era: 'primitive', turn: 1 };
    }
    return this.scene.saveData.process;
  }

  refresh() {
    // 刷新左侧资源数值
    this.resources.forEach(res => {
      if (this.resourceTexts[res]) {
        const actualValue = this.getResourceValue(res);
        this.resourceTexts[res].setText(this.formatDisplayValue(actualValue));

        if (this.tooltip.visible && this.currentHoverRes === res) {
          this.updateTooltipContent(res, actualValue);
        }
      }
    });

    // 刷新右侧时代和回合
    const processData = this.getProcessData();
    const currentEraStr = ERA[processData.era].name;
    const currentTurn = processData.turn || 1;

    // 设置文字
    this.eraText.setText(currentEraStr);
    this.turnValueText.setText(currentTurn.toString());

    const screenWidth = this.scene.scale.width;

    // 时代文本贴住右侧留白
    this.eraText.setX(screenWidth - 20);

    // 时代文本的左边缘坐标
    const eraLeftEdge = this.eraText.x - this.eraText.width;

    // 回合
    const turnValueCenter = eraLeftEdge - 15 - (45 / 2);
    this.turnValueText.setX(turnValueCenter);

    const turnLabelRightEdge = turnValueCenter - (45 / 2) - 5;
    this.turnLabelText.setX(turnLabelRightEdge);

    // 新增：计算设置按钮的位置（贴在“回合”文本的左侧）
    const turnLabelLeftEdge = this.turnLabelText.x - this.turnLabelText.width;
    this.settingsBtn.setX(turnLabelLeftEdge - 20); // 间隔 20px

    // 新增：自动等比例缩放按钮，让其最高不要超过 30px，适配背景条的 40px 高度
    if (this.settingsBtn.texture.key !== '__DEFAULT') {
      const maxDim = Math.max(this.settingsBtn.width, this.settingsBtn.height) || 1;
      this.settingsBtn.setScale(28 / maxDim);
    }

    // 时代任务面板：第一次拿到存档数据时初始化一次；之后只在回合结算时更新（见 refreshMissionPanel）
    if (!this._missionInited && this.scene.saveData) {
      this.refreshMissionPanel();
    }
  }

  updateTooltipContent(resKey, actualValue) {
    this.tooltipIcon.setTexture(`icon_${resKey}`);
    const maxDim = Math.max(this.tooltipIcon.width, this.tooltipIcon.height) || 1;
    this.tooltipIcon.setScale(32 / maxDim);

    this.tooltipTitle.setText(get.translation(resKey));
    this.tooltipValue.setText(`当前数量：${actualValue}`);

    let maxTextWidth = Math.max(this.tooltipTitle.width, this.tooltipValue.width);
    let bgHeight = 60;

    // 判断是否为人口，人口不显示回合收入
    if (resKey === 'population') {
      this.tooltipIncome.setVisible(false);
      this.tooltipTitle.setY(-18);
      this.tooltipValue.setY(4);
      bgHeight = 60;
    } else {
      const incomeValue = this.getResourceValue(resKey + '_income');
      this.tooltipIncome.setText(`回合收入：${incomeValue}`);
      this.tooltipIncome.setVisible(true);

      // 调整Y轴布局，让三行字整体居中显示
      this.tooltipTitle.setY(-26);
      this.tooltipValue.setY(-4);
      this.tooltipIncome.setY(16);
      bgHeight = 68; // 加大背景高度以容纳新的一行

      maxTextWidth = Math.max(maxTextWidth, this.tooltipIncome.width);
    }

    // 动态计算悬浮窗宽度
    const calculatedWidth = 60 + maxTextWidth + 20;
    const finalWidth = Math.max(180, calculatedWidth);

    // 让边框跟随新长度和高度
    this.tooltipBg.width = finalWidth;
    this.tooltipBg.height = bgHeight;
    if (this.tooltipBg.geom) {
      this.tooltipBg.geom.width = finalWidth;
      this.tooltipBg.geom.height = bgHeight;
      this.tooltipBg.updateData();
    }
  }

  showTooltip(resKey, pointer) {
    this.currentHoverRes = resKey;
    const actualValue = this.getResourceValue(resKey);

    this.updateTooltipContent(resKey, actualValue);

    this.tooltip.setVisible(true);
    this.moveTooltip(pointer);
  }

  moveTooltip(pointer) {
    this.tooltip.setPosition(pointer.x + 20, pointer.y + 20);
  }

  hideTooltip() {
    this.currentHoverRes = null;
    this.tooltip.setVisible(false);
  }

  destroy() {
    if (this._onMissionWheel) this.scene.input.off('wheel', this._onMissionWheel);
    this._releaseMissionMapLock();
    if (this._missionMeasure) this._missionMeasure.destroy();
    this.container.destroy();
    this.tooltip.destroy();
  }
}