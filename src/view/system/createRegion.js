import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import { REGION } from '../../data/region.js';

export class CreateRegion {
  constructor(scene, gridId, data) {
    this.scene = scene;
    this.gridId = gridId;
    this.data = data;

    // 区分选中建造目标和当前查看目标
    this.selectedRegionKey = null;
    this.viewedRegionKey = null;

    this.regionItems = {};

    // 左侧滚动参数
    this.scrollY = 0;
    this.maxScrollY = 0;

    // 右侧滚动参数
    this.detailScrollY = 0;
    this.maxDetailScrollY = 0;

    // 颜色配置映射
    this.colorMap = {
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

    this.create();
  }

  preventEventPenetration(element, scrollArea = null) {
    if (!element.input) {
      element.setInteractive();
    }
    element.on('pointerdown', (p, lx, ly, e) => { if (e) e.stopPropagation(); });
    element.on('pointerup', (p, lx, ly, e) => { if (e) e.stopPropagation(); });
    element.on('pointermove', (p, lx, ly, e) => { if (e) e.stopPropagation(); });
    element.on('wheel', (p, dx, dy, dz, e) => {
      if (e) e.stopPropagation();
      if (scrollArea === 'left') this.handleScroll(dy);
      if (scrollArea === 'right') this.handleDetailScroll(dy);
    });
  }

  create() {
    const { width, height } = this.scene.scale;

    // 区域宽度划分：左侧 75%，右侧 25%
    this.leftWidth = width * 0.75;
    this.rightWidth = width * 0.25;

    // 主容器
    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(2000);

    // 背景遮罩
    const fullBg = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0.75);
    fullBg.setOrigin(0, 0).setInteractive();

    fullBg.on('pointerdown', (p, lx, ly, e) => { if (e) e.stopPropagation(); });
    fullBg.on('pointerup', (p, lx, ly, e) => { if (e) e.stopPropagation(); });
    fullBg.on('pointermove', (p, lx, ly, e) => { if (e) e.stopPropagation(); });
    fullBg.on('wheel', (pointer, deltaX, deltaY, deltaZ, event) => {
      if (event) event.stopPropagation();
      if (pointer.x <= this.leftWidth) {
        this.handleScroll(deltaY);
      } else {
        this.handleDetailScroll(deltaY);
      }
    });
    this.container.add(fullBg);

    // 顶部固定标题
    const title = this.scene.add.text(width / 2, 60, "创建区域", {
      fontSize: '36px', color: '#ffd700', fontStyle: 'bold', padding: { top: 4 },
    }).setOrigin(0.5);
    this.container.add(title);

    // 滚动区域参数
    this.listAreaY = 150;
    this.bottomAreaHeight = 140;

    // 滚动区域只到按钮上方
    this.listAreaHeight =
      height - this.listAreaY - this.bottomAreaHeight;
    const scrollBarX = this.leftWidth - 20;

    // 左侧滚动容器与遮罩
    this.scrollContainer = this.scene.add.container(0, this.listAreaY);
    this.container.add(this.scrollContainer);

    const shape = this.scene.make.graphics();
    shape.fillStyle(0xffffff);
    shape.fillRect(0, this.listAreaY, this.leftWidth, this.listAreaHeight);
    const mask = shape.createGeometryMask();
    this.scrollContainer.setMask(mask);

    // 右侧详情容器及独立滚动区
    this.detailPanel = this.scene.add.container(this.leftWidth, this.listAreaY);

    const detailBg = this.scene.add.rectangle(0, 0, this.rightWidth, this.listAreaHeight, 0x111111, 0.6).setOrigin(0, 0).setStrokeStyle(1, 0x333333);
    this.preventEventPenetration(detailBg, 'right');

    // 右侧内容的滚动容器
    this.detailScrollContainer = this.scene.add.container(0, 0);
    this.detailContent = this.scene.add.container(0, 0);
    this.detailScrollContainer.add(this.detailContent);

    // 右侧内容遮罩
    const detailShape = this.scene.make.graphics();
    detailShape.fillStyle(0xffffff);
    detailShape.fillRect(this.leftWidth, this.listAreaY, this.rightWidth, this.listAreaHeight);
    const detailMask = detailShape.createGeometryMask();
    this.detailScrollContainer.setMask(detailMask);

    // 右侧滚动条
    const detailScrollBarX = this.rightWidth - 12;
    this.detailTrack = this.scene.add.rectangle(detailScrollBarX, 0, 8, this.listAreaHeight, 0x333333).setOrigin(0, 0);
    this.detailScrollHandle = this.scene.add.rectangle(detailScrollBarX, 0, 8, 30, 0xffd700).setOrigin(0, 0);
    this.detailTrack.setVisible(false);
    this.detailScrollHandle.setVisible(false);

    this.detailScrollHandle.setInteractive({ draggable: true, useHandCursor: true });
    this.preventEventPenetration(this.detailScrollHandle, 'right');
    this.detailScrollHandle.on('drag', (pointer, dragX, dragY) => {
      this.updateDetailScrollByHandle(dragY);
    });

    this.detailPanel.add([detailBg, this.detailScrollContainer, this.detailTrack, this.detailScrollHandle]);
    this.container.add(this.detailPanel);

    // 渲染列表
    this.renderRegionList(this.leftWidth, this.listAreaHeight);

    // 左侧滚动条
    if (this.maxScrollY > 0) {
      const track = this.scene.add.rectangle(scrollBarX, this.listAreaY, 8, this.listAreaHeight, 0x333333).setOrigin(0, 0);
      this.container.add(track);

      this.scrollHandleHeight = Math.max(30, (this.listAreaHeight / (this.listAreaHeight + this.maxScrollY)) * this.listAreaHeight);
      this.scrollHandle = this.scene.add.rectangle(scrollBarX, this.listAreaY, 8, this.scrollHandleHeight, 0xffd700).setOrigin(0, 0);
      this.container.add(this.scrollHandle);

      this.trackY = this.listAreaY;
      this.trackHeight = this.listAreaHeight;

      this.scrollHandle.setInteractive({ draggable: true, useHandCursor: true });
      this.preventEventPenetration(this.scrollHandle, 'left');

      this.scrollHandle.on('drag', (pointer, dragX, dragY) => {
        const localY = dragY - this.trackY;
        this.updateScrollByHandle(localY);
      });
    }

    // 底部按钮与关闭
    this.createConfirmButton(width, height);
    this.createCloseButton(width);

    this.container.alpha = 0;
    this.scene.tweens.add({ targets: this.container, alpha: 1, duration: 250 });
  }

  renderRegionList(areaWidth, listAreaHeight) {
    const startX = areaWidth * 0.12;
    const colSpacing = (areaWidth * 0.76) / 3;
    const rowSpacing = 200;
    const cols = 4;

    let index = 0;
    for (const [key, config] of Object.entries(REGION)) {
      const r = Math.floor(index / cols);
      const c = index % cols;

      // 根据 canBuild 以及 config.special 判断是否可建造
      let isBuildable = false;
      if (typeof config.canBuild === 'function') {
        try {
          var buildData = {
            tech: this.data.tech_tree.unlocked,
            grid: this.data.map.grids[this.gridId],
            race: this.data.race,
          };

          isBuildable = !!config.canBuild(buildData);

          // 额外判断 config.special
          if (isBuildable && typeof config.special === 'function') {
            isBuildable = !!config.special({ race: this.data.race });
          }

        } catch (e) {
          isBuildable = false;
        }
      }

      // 颜色逻辑
      const baseColor = this.colorMap[config.color] !== undefined ? this.colorMap[config.color] : (isBuildable ? 0x222222 : 0x111111);
      const strokeColor = config.color === 'special' ? 0xE8C547 : 0x555555;

      const itemContainer = this.scene.add.container(startX + c * colSpacing, 90 + r * rowSpacing);
      const itemBg = this.scene.add.rectangle(0, 0, 190, 160, baseColor, 1)
        .setStrokeStyle(2, strokeColor)
        .setInteractive({ useHandCursor: true });

      this.preventEventPenetration(itemBg, 'left');

      // 图标：这个再说了 后面可能删掉
      // let img;
      // const textureKey = `region_${key}`;
      // if (this.scene.textures.exists(textureKey)) {
      //   img = this.scene.add.image(0, -30, textureKey);
      //   img.setScale(Math.min(120 / img.width, 80 / img.height));
      // } else {
      //   // 占位圆形图标
      //   img = this.scene.add.circle(0, -30, 36, isBuildable ? 0x445544 : 0x333333);
      // }

      // if (!isBuildable) {
      //   if (img.setAlpha) img.setAlpha(0.4);
      //   if (img.setTint) img.setTint(0x888888);
      // }

      const nameText = this.scene.add.text(0, 5, config.name, {
        fontSize: '20px',
        // color: isBuildable ? '#ffffff' : '#888888',
        color: '#ffffff',
        padding: { top: 4 },
      }).setOrigin(0.5);

      itemContainer.add([itemBg/*, img*/, nameText]);

      if (config.special_info) {
        const specialText = this.scene.add.text(0, 42, config.special_info, {
          fontSize: '14px',
          color: '#aaaaaa',
          padding: { top: 2 },
        }).setOrigin(0.5);
        itemContainer.add([specialText]);
      }
      this.scrollContainer.add(itemContainer);

      if (!isBuildable) {
        const lockOverlay = this.scene.add.rectangle(
          0, 0, 190, 160,
          0x000000, 0.45
        );
        itemContainer.add([lockOverlay]);
      }

      const statusDot = this.scene.add.circle(
        -80, -65,
        6,
        isBuildable ? 0x00ff88 : 0xff4444
      );

      itemContainer.add(statusDot);

      itemBg.on('pointerdown', () => this.selectRegion(key));
      this.regionItems[key] = { bg: itemBg, isBuildable, config };
      index++;
    }

    const totalRows = Math.ceil(index / cols);
    const itemHeight = 160;
    const contentHeight =
      120 + (totalRows - 1) * rowSpacing + itemHeight / 2;
    this.maxScrollY = Math.max(0, contentHeight - listAreaHeight);
  }

  renderRegionDetail(key) {
    this.detailContent.removeAll(true);
    if (!key || !REGION[key]) return;

    const config = REGION[key];
    const centerX = this.rightWidth / 2;
    const textWrapWidth = this.rightWidth * 0.85;
    let currentY = 40;

    // 区域图标
    const textureKey = `region_${key}`;
    if (this.scene.textures.exists(textureKey)) {
      const img = this.scene.add.image(centerX, currentY, textureKey);
      img.setOrigin(0.5, 0);
      img.setScale(Math.min((this.rightWidth * 0.6) / img.width, 140 / img.height));
      this.detailContent.add(img);
      currentY += (img.height * img.scaleY) + 20;
    } else {
      const placeholder = this.scene.add.circle(centerX, currentY + 44, 44, 0x334433);
      this.detailContent.add(placeholder);
      currentY += 108;
    }

    // 区域名称
    const nameText = this.scene.add.text(centerX, currentY, config.name, {
      fontSize: '30px', color: '#ffd700', fontStyle: 'bold', padding: { top: 4 },
      wordWrap: { width: textWrapWidth, useAdvancedWrap: true }
    }).setOrigin(0.5, 0);
    this.detailContent.add(nameText);
    currentY += nameText.height + 16;

    // 如果有special_info，作为小字放在区域名下方
    if (config.special_info) {
      const specialInfoText = this.scene.add.text(centerX, currentY, config.special_info, {
        fontSize: '14px', color: '#cccccc', align: 'center', lineSpacing: 4,
        wordWrap: { width: textWrapWidth, useAdvancedWrap: true }, padding: { top: 2 },
      }).setOrigin(0.5, 0);
      this.detailContent.add(specialInfoText);
      currentY += specialInfoText.height + 16;
    }

    // 建造回合数
    if (config.round != null) {
      const timeText = this.scene.add.text(centerX, currentY, `建造时间: ${config.round} 回合`, {
        fontSize: '20px', color: '#ffffff', padding: { top: 4 },
        wordWrap: { width: textWrapWidth, useAdvancedWrap: true }
      }).setOrigin(0.5, 0);
      this.detailContent.add(timeText);
      currentY += timeText.height + 16;
    }

    // 地形要求
    const terrainStr = config.terrainInfo || '任意';
    const terrainText = this.scene.add.text(centerX, currentY, `适用地形:\n${terrainStr}`, {
      fontSize: '18px', color: '#aaddff', align: 'center', lineSpacing: 8,
      wordWrap: { width: textWrapWidth, useAdvancedWrap: true }, padding: { top: 4 },
    }).setOrigin(0.5, 0);
    this.detailContent.add(terrainText);
    currentY += terrainText.height + 16;

    // 建筑效果
    const effectStr = config.effect_info || '暂无';
    const effectText = this.scene.add.text(centerX, currentY, `建筑效果:\n${effectStr}`, {
      fontSize: '18px', color: '#aaffaa', align: 'center', lineSpacing: 8,
      wordWrap: { width: textWrapWidth, useAdvancedWrap: true }, padding: { top: 4 },
    }).setOrigin(0.5, 0);
    this.detailContent.add(effectText);
    currentY += effectText.height + 16;

    // 解锁条件
    const requireStr = config.requireInfo || '无';
    const reqText = this.scene.add.text(centerX, currentY, `解锁条件:\n${requireStr}`, {
      fontSize: '18px', color: '#bbbbbb', align: 'center', lineSpacing: 8,
      wordWrap: { width: textWrapWidth, useAdvancedWrap: true }, padding: { top: 4 },
    }).setOrigin(0.5, 0);
    this.detailContent.add(reqText);
    currentY += reqText.height + 30;

    const contentHeight = currentY + 20;
    this.maxDetailScrollY = Math.max(0, contentHeight - this.listAreaHeight);
    this.detailScrollY = 0;
    this.detailContent.y = 0;

    if (this.maxDetailScrollY > 0) {
      this.detailTrack.setVisible(true);
      this.detailScrollHandle.setVisible(true);
      this.detailScrollHandleHeight = Math.max(30, (this.listAreaHeight / contentHeight) * this.listAreaHeight);
      this.detailScrollHandle.setDisplaySize(8, this.detailScrollHandleHeight);
      this.detailScrollHandle.y = 0;
    } else {
      this.detailTrack.setVisible(false);
      this.detailScrollHandle.setVisible(false);
    }
  }

  updateScrollByHandle(localY) {
    const availableTrack = this.trackHeight - this.scrollHandleHeight;
    const clampedY = Phaser.Math.Clamp(localY, 0, availableTrack);
    const scrollPercent = clampedY / availableTrack;

    this.scrollY = -(scrollPercent * this.maxScrollY);
    this.scrollContainer.y = this.listAreaY + this.scrollY;
    this.scrollHandle.y = this.trackY + clampedY;
  }

  handleScroll(deltaY) {
    if (this.maxScrollY <= 0) return;

    this.scrollY -= deltaY * 0.8;
    this.scrollY = Phaser.Math.Clamp(this.scrollY, -this.maxScrollY, 0);

    this.scrollContainer.y = this.listAreaY + this.scrollY;

    if (this.scrollHandle) {
      const scrollPercent = this.scrollY / (-this.maxScrollY);
      const availableTrack = this.trackHeight - this.scrollHandleHeight;
      const targetHandleY = scrollPercent * availableTrack;
      this.scrollHandle.y = this.trackY + targetHandleY;
    }
  }

  updateDetailScrollByHandle(localY) {
    if (this.maxDetailScrollY <= 0) return;
    const availableTrack = this.listAreaHeight - this.detailScrollHandleHeight;
    const clampedY = Phaser.Math.Clamp(localY, 0, availableTrack);
    const scrollPercent = clampedY / availableTrack;

    this.detailScrollY = -(scrollPercent * this.maxDetailScrollY);
    this.detailContent.y = this.detailScrollY;
    this.detailScrollHandle.y = clampedY;
  }

  handleDetailScroll(deltaY) {
    if (this.maxDetailScrollY <= 0) return;

    this.detailScrollY -= deltaY * 0.8;
    this.detailScrollY = Phaser.Math.Clamp(this.detailScrollY, -this.maxDetailScrollY, 0);

    this.detailContent.y = this.detailScrollY;

    if (this.detailScrollHandle) {
      const scrollPercent = this.detailScrollY / (-this.maxDetailScrollY);
      const availableTrack = this.listAreaHeight - this.detailScrollHandleHeight;
      this.detailScrollHandle.y = scrollPercent * availableTrack;
    }
  }

  selectRegion(key) {
    const itemData = this.regionItems[key];

    // 更新右侧查看目标
    this.viewedRegionKey = key;

    // 如果可建造，则切换选中状态；否则清空选中状态
    if (itemData.isBuildable) {
      this.selectedRegionKey = (this.selectedRegionKey === key) ? null : key;
    } else {
      this.selectedRegionKey = null;
    }

    for (const [k, item] of Object.entries(this.regionItems)) {
      const isSel = k === this.selectedRegionKey;
      const isViewed = k === this.viewedRegionKey;
      const cfg = item.config;

      // 计算该项原始的基础颜色和描边颜色
      const originalBaseColor = this.colorMap[cfg.color] !== undefined ? this.colorMap[cfg.color] : (item.isBuildable ? 0x222222 : 0x111111);
      const originalStrokeColor = cfg.color === 'special' ? 0xE8C547 : 0x555555;

      if (isSel) {
        // 可建造且被选中：绿色描边
        item.bg.setStrokeStyle(4, 0x00ff00);
        item.bg.setFillStyle(originalBaseColor);
      } else if (isViewed && !item.isBuildable) {
        // 查看不可建造的区域：红色描边
        item.bg.setStrokeStyle(3, 0xaa0000);
        item.bg.setFillStyle(originalBaseColor);
      } else {
        // 默认状态：恢复到配置颜色和描边
        item.bg.setStrokeStyle(2, originalStrokeColor);
        item.bg.setFillStyle(originalBaseColor);
      }
    }

    this.renderRegionDetail(this.viewedRegionKey);
    this.updateConfirmButton();
  }

  createConfirmButton(width, height) {
    this.confirmBtnGroup = this.scene.add.container(
      width / 2,
      this.listAreaY + this.listAreaHeight + this.bottomAreaHeight / 2
    );
    this.confirmBtnBg = this.scene.add.rectangle(0, 0, 260, 60, 0x444444, 1)
      .setStrokeStyle(2, 0x666666)
      .setInteractive({ useHandCursor: false });

    this.preventEventPenetration(this.confirmBtnBg);

    this.confirmBtnText = this.scene.add.text(0, 0, '请选择区域', {
      fontSize: '24px', color: '#888888', padding: { top: 2, bottom: 2 },
    }).setOrigin(0.5);
    this.confirmBtnGroup.add([this.confirmBtnBg, this.confirmBtnText]);
    this.container.add(this.confirmBtnGroup);

    this.confirmBtnBg.on('pointerdown', () => this.selectedRegionKey && this.executeBuild());
  }

  updateConfirmButton() {
    if (this.selectedRegionKey) {
      // 已选中可建造区域
      this.confirmBtnBg.setFillStyle(0xffa500, 1).setStrokeStyle(2, 0xffffff);
      this.confirmBtnBg.input.cursor = 'pointer';
      this.confirmBtnText.setText('开始建造').setColor('#ffffff');
    } else if (this.viewedRegionKey && !this.regionItems[this.viewedRegionKey].isBuildable) {
      // 正在查看不可建造的区域
      this.confirmBtnBg.setFillStyle(0x333333, 1).setStrokeStyle(2, 0x555555);
      this.confirmBtnBg.input.cursor = 'default';
      this.confirmBtnText.setText('条件不足').setColor('#aa0000');
    } else {
      // 默认未选中状态
      this.confirmBtnBg.setFillStyle(0x444444, 1).setStrokeStyle(2, 0x666666);
      this.confirmBtnBg.input.cursor = 'default';
      this.confirmBtnText.setText('请选择区域').setColor('#888888');
    }
  }

  createCloseButton(width) {
    const closeBtn = this.scene.add.text(width - 60, 60, '✕', {
      fontSize: '44px', color: '#ffffff', padding: { top: 4 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.preventEventPenetration(closeBtn);
    closeBtn.on('pointerdown', () => this.close());
    this.container.add(closeBtn);
  }

  executeBuild() {
    this.scene.events.emit('build_region', { gridId: this.gridId, regionKey: this.selectedRegionKey });
    this.close();
  }

  close() {
    this.scene.tweens.add({
      targets: this.container, alpha: 0, duration: 200,
      onComplete: () => this.container.destroy(),
    });
  }
}