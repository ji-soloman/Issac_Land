import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import { get } from '../system/i18n.js';

export class LeftSideBar {
  constructor(scene) {
    this.scene = scene;
    this.onTechTreeClick = null;
    this.onMilitaryClick = null;
    this.create();
  }

  create() {
    const { width, height } = this.scene.scale;

    // ====== 布局参数调整 ======
    const barWidth = Math.min(width * 0.12, 120);
    const barHeight = height * 0.7;
    const paddingLeft = 15;
    const buttonSpacing = 20;
    
    const barX = 0;
    const barY = height * 0.15;

    this.container = this.scene.add.container(barX, barY);
    this.container.setDepth(1000); 

    const systems = [
      {
        key: 'tech_tree',
        image: 'tech_tree_btn',
        textKey: 'techTreeBtn',
        callback: () => { if (this.onTechTreeClick) this.onTechTreeClick(); }
      },
      {
        key: 'military',
        image: 'military_btn',
        textKey: 'militaryBtn',
        callback: () => { if (this.onMilitaryClick) this.onMilitaryClick(); }
      },
      {
        key: 'action_list',
        image: 'action_btn',
        textKey: 'actionListBtn',
        callback: () => { if (this.onMilitaryClick) this.onActionListClick(); }
      }
    ];

    let currentY = barHeight;

    systems.forEach((system) => {
      const btn = this.scene.add.image(0, 0, system.image);

      const availableWidth = barWidth - paddingLeft - 10; 
      const scale = availableWidth / btn.width;
      btn.setScale(scale);
      btn.setOrigin(0, 0);

      const btnHeight = btn.height * scale;
      currentY -= (btnHeight + buttonSpacing);
      
      btn.setPosition(paddingLeft, currentY);

      btn.setInteractive({ 
        pixelPerfect: true, 
        alphaTolerance: 1,
        useHandCursor: true 
      });

      const labelText = this.scene.add.text(
        paddingLeft + availableWidth / 2, 
        currentY + (btnHeight * 0.75),
        get.translation(system.textKey), 
        {
          fontSize: '14px',
          color: '#ffffff',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 3
        }
      ).setOrigin(0.5);

      btn.on('pointerover', () => {
        btn.setTint(0xcccccc);
        labelText.setTint(0xffff00);
      });

      btn.on('pointerout', () => {
        btn.clearTint();
        labelText.clearTint();
      });

      btn.on('pointerdown', (pointer, localX, localY, event) => {
        if (event) event.stopPropagation();
        if (!this.isDisabled && system.callback) {
          system.callback();
        }
      });

      this.container.add([btn, labelText]);
      btn.relatedText = labelText;
      
      btn.customData = { availableWidth, paddingLeft, btnHeight, buttonSpacing };
    });

    this.isDisabled = false;
    this.scene.scale.on('resize', this.handleResize, this);
  }

  handleResize(gameSize) {
    const { width, height } = gameSize;
    const barWidth = Math.min(width * 0.12, 120);
    const barHeight = height * 0.7;
    const paddingLeft = 15;
    const buttonSpacing = 20;

    this.container.y = height * 0.15;

    let currentY = barHeight;

    this.container.list.forEach((obj) => {
      if (obj instanceof Phaser.GameObjects.Image) {
        const availableWidth = barWidth - paddingLeft - 10;
        const scale = availableWidth / (obj.width);
        obj.setScale(scale);
        
        const btnHeight = obj.height * scale;
        currentY -= (btnHeight + buttonSpacing);
        
        obj.setPosition(paddingLeft, currentY);

        if (obj.relatedText) {
          obj.relatedText.setPosition(paddingLeft + availableWidth / 2, currentY + (btnHeight * 0.75));
        }
      }
    });
  }

  destroy() {
    this.scene.scale.off('resize', this.handleResize, this);
    if (this.container) {
      this.container.destroy();
      this.container = null;
    }
  }
}