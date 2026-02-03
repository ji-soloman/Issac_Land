// src/scene/BottomBar.js
import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';

export class BottomBar {
  constructor(scene) {
    this.scene = scene;

    this.onPersonalClick = null;
    this.onPackageClick = null;

    this.MAX_HEIGHT = 120;

    this.create();
  }

  create() {
    const { width, height } = this.scene.scale;

    // ===== 底部容器=====
    this.container = this.scene.add.container(0, height);

    // ===== 背景图 =====
    this.barBg = this.scene.add.image(0, 0, 'btm_ui').setOrigin(0.5, 1);
    this.container.add(this.barBg);

    // ===== 高度 =====
    const targetHeight = Math.min(this.MAX_HEIGHT, height / 6);
    const scale = targetHeight / this.barBg.height;
    this.barBg.setScale(scale);

    // ===== 图片真实尺寸 =====
    const realBarWidth = this.barBg.displayWidth;
    const realBarHeight = this.barBg.displayHeight;

    // ===== 容器水平居中 =====
    this.container.x = width / 2;

    // ===== 按钮区域（40%）=====
    const btnAreaWidth = realBarWidth * 0.5;
    const btnY = -realBarHeight / 2;

    const leftBtnX = -realBarWidth / 2 + btnAreaWidth / 2;
    const rightBtnX = realBarWidth / 2 - btnAreaWidth / 2;

    // ===== 左侧文字 =====
    const personalText = this.scene.add.text(leftBtnX, btnY, '个人', {
      fontSize: '28px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
      fontStyle: 'bold',
      padding: { top: 10 },
    }).setOrigin(0.5);

    personalText.setInteractive({ useHandCursor: true });

    personalText.on('pointerover', () => {
      personalText.setColor('#ffff00');
    });

    personalText.on('pointerout', () => {
      personalText.setColor('#ffffff');
    });

    personalText.on('pointerdown', () => {
      this.onPersonalClick && this.onPersonalClick();
    });

    this.container.add(personalText);

    // ===== 右侧文字 =====
    const packageText = this.scene.add.text(rightBtnX, btnY, '仓库', {
      fontSize: '28px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
      fontStyle: 'bold',
      padding: { top: 10 },
    }).setOrigin(0.5);

    packageText.setInteractive({ useHandCursor: true });

    packageText.on('pointerover', () => {
      packageText.setColor('#ffff00');
    });

    packageText.on('pointerout', () => {
      packageText.setColor('#ffffff');
    });

    packageText.on('pointerdown', () => {
      this.onPackageClick && this.onPackageClick();
    });

    this.container.add(packageText);

    // resize
    this.scene.scale.on('resize', this.handleResize, this);
  }

  handleResize(gameSize) {
    const { width, height } = gameSize;

    // 贴底
    this.container.y = height;

    // 高度重新计算
    const targetHeight = Math.min(this.MAX_HEIGHT, height / 6);
    const scale = targetHeight / this.barBg.height;
    this.barBg.setScale(scale);

    const realBarWidth = this.barBg.displayWidth;
    const realBarHeight = this.barBg.displayHeight;

    // 水平居中
    this.container.x = width / 2;

    const btnAreaWidth = realBarWidth * 0.5;
    const btnY = -realBarHeight / 2;

    const leftBtnX = -realBarWidth / 2 + btnAreaWidth / 2;
    const rightBtnX = realBarWidth / 2 - btnAreaWidth / 2;

    const personalText = this.container.list[1];
    const packageText = this.container.list[2];

    personalText?.setPosition(leftBtnX, btnY);
    packageText?.setPosition(rightBtnX, btnY);
  }

  destroy() {
    this.scene.scale.off('resize', this.handleResize, this);
    this.container.destroy(true);
  }
}
