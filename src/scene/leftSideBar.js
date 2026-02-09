import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';

export class LeftSideBar {
  constructor(scene) {
    this.scene = scene;

    // 回调函数
    this.onTechTreeClick = null;
    // 可以添加更多系统的回调
    // this.onOtherSystemClick = null;

    this.create();
  }

  create() {
    const { width, height } = this.scene.scale;

    // ====== 计算侧边栏尺寸和位置 ======
    const barWidth = Math.min(width * 0.1, 100);
    const barHeight = height * 0.7;
    const barX = 0;
    const barY = height * 0.15;

    // 创建侧边栏容器
    this.container = this.scene.add.container(barX, barY);

    // ====== 系统按钮配置 ======
    const systems = [
      {
        key: 'tech_tree',
        image: 'tech_tree_btn',
        callback: () => {
          if (this.onTechTreeClick) {
            this.onTechTreeClick();
          }
        }
      }
      // 未来可以添加更多系统
      // {
      //   key: 'diplomacy',
      //   image: 'diplomacy_btn',
      //   callback: () => { ... }
      // }
    ];

    // ====== 从下往上排列按钮 ======
    const buttonSpacing = 5;
    let currentY = barHeight; // 从底部开始

    systems.forEach((system, index) => {
      // 创建按钮图片
      const btn = this.scene.add.image(barWidth / 2, 0, system.image);

      // 保持原始比例，适应侧边栏宽度
      const scale = barWidth / btn.width;
      btn.setScale(scale);

      // 计算按钮高度
      const btnHeight = btn.height * scale;

      // 从下往上定位
      currentY -= btnHeight;
      btn.setPosition(barWidth / 2, currentY);

      // 设置交互
      btn.setInteractive({ useHandCursor: true });

      btn.on('pointerover', () => {
        btn.setTint(0xcccccc);
        this.scene.input.setDefaultCursor('pointer');
      });

      btn.on('pointerout', () => {
        btn.clearTint();
        this.scene.input.setDefaultCursor('default');
      });

      btn.on('pointerdown', () => {
        if (!this.isDisabled && system.callback) {
          system.callback();
        }
      });

      this.container.add(btn);

      // 为下一个按钮预留间距
      currentY -= buttonSpacing;
    });

    // 禁用标志
    this.isDisabled = false;

    // 监听窗口大小变化
    this.scene.scale.on('resize', this.handleResize, this);
  }

  /**
   * 处理窗口大小变化
   */
  handleResize(gameSize) {
    const { width, height } = gameSize;

    const barWidth = Math.min(width * 0.1, 100);
    const barHeight = height * 0.7;
    const barY = height * 0.15;

    // 更新容器位置
    this.container.y = barY;

    // 重新计算按钮位置
    let currentY = barHeight;
    const buttonSpacing = 5;

    this.container.list.forEach((btn) => {
      const scale = barWidth / (btn.width / btn.scaleX);
      btn.setScale(scale);

      const btnHeight = btn.height * scale;
      currentY -= btnHeight;
      btn.setPosition(barWidth / 2, currentY);
      currentY -= buttonSpacing;
    });
  }

  /**
   * 销毁侧边栏
   */
  destroy() {
    this.scene.scale.off('resize', this.handleResize, this);
    if (this.container) {
      this.container.destroy();
      this.container = null;
    }
  }
}