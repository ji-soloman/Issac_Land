import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';

import { get } from '../../system/i18n.js';
import { BUILDING } from '../../data/building.js';

export class CreateBuilding {
  constructor(scene, gridId, data) {
    this.scene = scene;
    this.gridId = gridId;
    this.data = data;

    this.selectedBuildingKey = null;
    this.viewedBuildingKey = null;

    this.buildingItems = {};

    this.scrollY = 0;
    this.maxScrollY = 0;

    this.detailScrollY = 0;
    this.maxDetailScrollY = 0;

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

    this.leftWidth = width * 0.15;
    this.rightWidth = width * 0.85;

    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(2000);

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

    const title = this.scene.add.text(width / 2, 40, "建造建筑", {
      fontSize: '36px', color: '#ffd700', fontStyle: 'bold', padding: { top: 4 },
    }).setOrigin(0.5);
    this.container.add(title);

    this.listAreaY = 100;
    this.bottomAreaHeight = 100;
    this.listAreaHeight = height - this.listAreaY - 40;
    const scrollBarX = this.leftWidth - 10;

    this.scrollContainer = this.scene.add.container(0, this.listAreaY);
    this.container.add(this.scrollContainer);

    const shape = this.scene.make.graphics();
    shape.fillStyle(0xffffff);
    shape.fillRect(0, this.listAreaY, this.leftWidth, this.listAreaHeight);
    const mask = shape.createGeometryMask();
    this.scrollContainer.setMask(mask);

    this.detailPanel = this.scene.add.container(this.leftWidth, this.listAreaY);

    const detailBg = this.scene.add.rectangle(0, 0, this.rightWidth, this.listAreaHeight, 0x111111, 0.6).setOrigin(0, 0).setStrokeStyle(1, 0x333333);
    this.preventEventPenetration(detailBg, 'right');

    this.detailScrollContainer = this.scene.add.container(0, 0);
    this.detailContent = this.scene.add.container(0, 0);
    this.detailScrollContainer.add(this.detailContent);

    const detailShape = this.scene.make.graphics();
    detailShape.fillStyle(0xffffff);
    detailShape.fillRect(this.leftWidth, this.listAreaY, this.rightWidth, this.listAreaHeight - this.bottomAreaHeight);
    const detailMask = detailShape.createGeometryMask();
    this.detailScrollContainer.setMask(detailMask);

    const detailScrollBarX = this.rightWidth - 12;
    this.detailTrack = this.scene.add.rectangle(detailScrollBarX, 0, 8, this.listAreaHeight - this.bottomAreaHeight, 0x333333).setOrigin(0, 0);
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

    this.renderBuildingList(this.leftWidth, this.listAreaHeight);

    if (this.maxScrollY > 0) {
      const track = this.scene.add.rectangle(scrollBarX, this.listAreaY, 6, this.listAreaHeight, 0x333333).setOrigin(0, 0);
      this.container.add(track);

      this.scrollHandleHeight = Math.max(30, (this.listAreaHeight / (this.listAreaHeight + this.maxScrollY)) * this.listAreaHeight);
      this.scrollHandle = this.scene.add.rectangle(scrollBarX, this.listAreaY, 6, this.scrollHandleHeight, 0xffd700).setOrigin(0, 0);
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

    this.createConfirmButton();
    this.createCloseButton(width);

    this.container.alpha = 0;
    this.scene.tweens.add({ targets: this.container, alpha: 1, duration: 250 });
  }

  renderBuildingList(areaWidth, listAreaHeight) {
    const itemWidth = areaWidth * 0.85;
    const itemHeight = 60;
    const startX = areaWidth / 2 - 5;
    const rowSpacing = itemHeight + 10;

    let index = 0;
    for (const [key, config] of Object.entries(BUILDING)) {
      let isBuildable = true;

      try {
        if (config.require_region && !config.require_region(this.data.region_category || {})) isBuildable = false;
        if (config.require_tech && !config.require_tech(this.data.tech_tree.unlocked)) isBuildable = false;
        if (config.require_race && !config.require_race(this.data.race)) isBuildable = false;
      } catch (e) {
        isBuildable = false;
      }

      const itemContainer = this.scene.add.container(startX, 40 + index * rowSpacing);
      const itemBg = this.scene.add.rectangle(0, 0, itemWidth, itemHeight, isBuildable ? 0x222222 : 0x111111, 1)
        .setStrokeStyle(2, 0x555555)
        .setInteractive({ useHandCursor: true });

      this.preventEventPenetration(itemBg, 'left');

      const nameText = this.scene.add.text(0, 0, config.name, {
        fontSize: '18px',
        color: isBuildable ? '#ffffff' : '#888888',
        padding: { top: 4 },
      }).setOrigin(0.5);

      itemContainer.add([itemBg, nameText]);

      if (!isBuildable) {
        const lockOverlay = this.scene.add.rectangle(0, 0, itemWidth, itemHeight, 0x000000, 0.45);
        itemContainer.add([lockOverlay]);
      }

      itemBg.on('pointerdown', () => this.selectBuilding(key));
      this.buildingItems[key] = { bg: itemBg, isBuildable, config };
      this.scrollContainer.add(itemContainer);
      index++;
    }

    const contentHeight = 40 + index * rowSpacing;
    this.maxScrollY = Math.max(0, contentHeight - listAreaHeight);
  }

  renderBuildingDetail(key) {
    this.detailContent.removeAll(true);
    if (!key || !BUILDING[key]) return;

    const config = BUILDING[key];
    const centerX = this.rightWidth / 2;
    const textWrapWidth = this.rightWidth * 0.8;
    let currentY = 40;

    const textureKey = `building_${key}`;
    if (this.scene.textures.exists(textureKey)) {
      const img = this.scene.add.image(centerX, currentY, textureKey);
      img.setOrigin(0.5, 0);
      img.setScale(Math.min((this.rightWidth * 0.4) / img.width, 140 / img.height));
      this.detailContent.add(img);
      currentY += (img.height * img.scaleY) + 20;
    }

    const nameText = this.scene.add.text(centerX, currentY, config.name, {
      fontSize: '32px', color: '#ffd700', fontStyle: 'bold', padding: { top: 4 },
      wordWrap: { width: textWrapWidth, useAdvancedWrap: true }
    }).setOrigin(0.5, 0);
    this.detailContent.add(nameText);
    currentY += nameText.height + 20;

    if (config.round != null) {
      const timeText = this.scene.add.text(centerX, currentY, `建造时间: ${config.round} 回合`, {
        fontSize: '20px', color: '#ffffff', padding: { top: 4 }
      }).setOrigin(0.5, 0);
      this.detailContent.add(timeText);
      currentY += timeText.height + 16;
    }

    const regionStr = config.region_info || '无限制';
    const regionText = this.scene.add.text(centerX, currentY, `区域要求: ${regionStr}`, {
      fontSize: '18px', color: '#aaddff', align: 'center', padding: { top: 2 },
      wordWrap: { width: textWrapWidth, useAdvancedWrap: true }
    }).setOrigin(0.5, 0);
    this.detailContent.add(regionText);
    currentY += regionText.height + 16;

    const effectStr = config.effect_info || '暂无效果';
    const effectText = this.scene.add.text(centerX, currentY, `建筑效果:\n${effectStr}`, {
      fontSize: '18px', color: '#aaffaa', align: 'center', lineSpacing: 8, padding: { top: 2 },
      wordWrap: { width: textWrapWidth, useAdvancedWrap: true }
    }).setOrigin(0.5, 0);
    this.detailContent.add(effectText);
    currentY += effectText.height + 16;

    const techStr = config.tech_info || '无';
    const techText = this.scene.add.text(centerX, currentY, `科技要求:\n${techStr}`, {
      fontSize: '18px', color: '#bbbbbb', align: 'center', lineSpacing: 8, padding: { top: 2 },
      wordWrap: { width: textWrapWidth, useAdvancedWrap: true }
    }).setOrigin(0.5, 0);
    this.detailContent.add(techText);
    currentY += techText.height + 16;

    if (config.cost) {
      let costStr = Object.entries(config.cost).map(([k, v]) => `${get.translation(k)}: ${v}`).join('  ');
      const costText = this.scene.add.text(centerX, currentY, `建造消耗:\n${costStr}`, {
        fontSize: '18px', color: '#ffaaaa', align: 'center', lineSpacing: 8, padding: { top: 2 },
        wordWrap: { width: textWrapWidth, useAdvancedWrap: true }
      }).setOrigin(0.5, 0);
      this.detailContent.add(costText);
      currentY += costText.height + 30;
    }

    const contentHeight = currentY + 20;
    const viewableHeight = this.listAreaHeight - this.bottomAreaHeight;
    this.maxDetailScrollY = Math.max(0, contentHeight - viewableHeight);
    this.detailScrollY = 0;
    this.detailContent.y = 0;

    if (this.maxDetailScrollY > 0) {
      this.detailTrack.setVisible(true);
      this.detailScrollHandle.setVisible(true);
      this.detailScrollHandleHeight = Math.max(30, (viewableHeight / contentHeight) * viewableHeight);
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
    const availableTrack = (this.listAreaHeight - this.bottomAreaHeight) - this.detailScrollHandleHeight;
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
      const availableTrack = (this.listAreaHeight - this.bottomAreaHeight) - this.detailScrollHandleHeight;
      this.detailScrollHandle.y = scrollPercent * availableTrack;
    }
  }

  selectBuilding(key) {
    const itemData = this.buildingItems[key];
    this.viewedBuildingKey = key;

    if (itemData.isBuildable) {
      this.selectedBuildingKey = (this.selectedBuildingKey === key) ? null : key;
    } else {
      this.selectedBuildingKey = null;
    }

    for (const [k, item] of Object.entries(this.buildingItems)) {
      const isSel = k === this.selectedBuildingKey;
      const isViewed = k === this.viewedBuildingKey;

      if (isSel) {
        item.bg.setStrokeStyle(4, 0x00ff00);
      } else if (isViewed && !item.isBuildable) {
        item.bg.setStrokeStyle(3, 0xaa0000);
      } else {
        item.bg.setStrokeStyle(2, 0x555555);
      }
    }

    this.renderBuildingDetail(this.viewedBuildingKey);
    this.updateConfirmButton();
  }

  createConfirmButton() {
    this.confirmBtnGroup = this.scene.add.container(
      this.rightWidth / 2,
      this.listAreaHeight - this.bottomAreaHeight / 2
    );
    this.confirmBtnBg = this.scene.add.rectangle(0, 0, 260, 60, 0x444444, 1)
      .setStrokeStyle(2, 0x666666)
      .setInteractive({ useHandCursor: false });

    this.preventEventPenetration(this.confirmBtnBg, 'right');

    this.confirmBtnText = this.scene.add.text(0, 0, '请选择建筑', {
      fontSize: '24px', color: '#888888', padding: { top: 2, bottom: 2 },
    }).setOrigin(0.5);

    this.confirmBtnGroup.add([this.confirmBtnBg, this.confirmBtnText]);
    this.detailPanel.add(this.confirmBtnGroup);

    this.confirmBtnBg.on('pointerdown', () => this.selectedBuildingKey && this.executeBuild());
  }

  updateConfirmButton() {
    if (this.selectedBuildingKey) {
      this.confirmBtnBg.setFillStyle(0xffa500, 1).setStrokeStyle(2, 0xffffff);
      this.confirmBtnBg.input.cursor = 'pointer';
      this.confirmBtnText.setText('开始建造').setColor('#ffffff');
    } else if (this.viewedBuildingKey && !this.buildingItems[this.viewedBuildingKey].isBuildable) {
      this.confirmBtnBg.setFillStyle(0x333333, 1).setStrokeStyle(2, 0x555555);
      this.confirmBtnBg.input.cursor = 'default';
      this.confirmBtnText.setText('条件不足').setColor('#aa0000');
    } else {
      this.confirmBtnBg.setFillStyle(0x444444, 1).setStrokeStyle(2, 0x666666);
      this.confirmBtnBg.input.cursor = 'default';
      this.confirmBtnText.setText('请选择建筑').setColor('#888888');
    }
  }

  createCloseButton(width) {
    const closeBtn = this.scene.add.text(width - 60, 40, '✕', {
      fontSize: '44px', color: '#ffffff', padding: { top: 4 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.preventEventPenetration(closeBtn);
    closeBtn.on('pointerdown', () => this.close());
    this.container.add(closeBtn);
  }

  executeBuild() {
    this.scene.events.emit('build_building', { gridId: this.gridId, buildingKey: this.selectedBuildingKey });
    this.close();
  }

  close() {
    this.scene.tweens.add({
      targets: this.container, alpha: 0, duration: 200,
      onComplete: () => this.container.destroy(),
    });
  }
}