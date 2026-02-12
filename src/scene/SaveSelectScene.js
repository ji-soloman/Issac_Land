import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import { saveSystem } from '../system/saveSystem.js';
import { ERA } from '../data/era.js';

export class SaveSelectScene extends Phaser.Scene {
  constructor() {
    super('SaveSelect');
  }

  async create() {
    const width = this.scale.width;
    const height = this.scale.height;

    // 背景
    const bg = this.add.image(0, 0, 'main_bg').setOrigin(0);

    const resizeBg = () => {
      const scaleX = this.scale.width / bg.width;
      const scaleY = this.scale.height / bg.height;
      const scale = Math.max(scaleX, scaleY);
      bg.setScale(scale);
    };

    resizeBg();
    this.scale.on('resize', resizeBg);

    // 标题
    this.add.text(width / 2, 50, '存档选择', {
      fontSize: '48px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
      fontStyle: 'bold',
      padding: { top: 10 },
    }).setOrigin(0.5);

    // 初始化存档系统
    await saveSystem.init();

    // 获取所有存档
    const saves = await saveSystem.listSaves();

    // 存档卡片起始位置
    const CARD_WIDTH = 400;
    const CARD_HEIGHT = 150;
    const CARD_SPACING = 30;
    const START_Y = 150;

    // 显示存档卡片（最多3个）
    for (let i = 0; i < 3; i++) {
      const cardY = START_Y + i * (CARD_HEIGHT + CARD_SPACING);
      const save = saves[i];

      if (save) {
        // 已有存档
        this.createSaveCard(width / 2, cardY, CARD_WIDTH, CARD_HEIGHT, save);
      } else {
        // 新建存档
        this.createNewSaveCard(width / 2, cardY, CARD_WIDTH, CARD_HEIGHT, i + 1);
      }
    }
  }

  /**
   * 创建存档卡片
   */
  createSaveCard(x, y, width, height, save) {
    const container = this.add.container(x, y);

    // 背景
    const bg = this.add.rectangle(0, 0, width, height, 0x333333, 0.8);
    const border = this.add.rectangle(0, 0, width, height)
      .setStrokeStyle(2, 0xffffff, 0.8);

    // 存档信息
    const nameText = this.add.text(-width / 2 + 20, -height / 2 + 15, save.name, {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
      padding: { top: 10 },
    }).setOrigin(0);

    const capitalText = this.add.text(-width / 2 + 20, -height / 2 + 50, `首都: ${save.capital}`, {
      fontSize: '18px',
      color: '#cccccc',
      padding: { top: 10 },
    }).setOrigin(0);

    const infoText = this.add.text(-width / 2 + 20, -height / 2 + 80,
      `${ERA[save.era].name} · 第${save.turn}回合`, {
      fontSize: '16px',
      color: '#aaaaaa',
      padding: { top: 10 },
    }).setOrigin(0);

    // 最后游玩时间
    const lastPlayed = new Date(save.lastPlayedAt).toLocaleString('zh-CN');
    const timeText = this.add.text(width / 2 - 20, height / 2 - 15, lastPlayed, {
      fontSize: '14px',
      color: '#888888',
      padding: { top: 10 },
    }).setOrigin(1);

    // 删除按钮
    const deleteBtn = this.add.text(width / 2 - 20, -height / 2 + 15, '删除', {
      fontSize: '16px',
      color: '#ff0000',
      stroke: '#000000',
      strokeThickness: 2,
      padding: { top: 10 },
    }).setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', async (pointer) => {
        if (confirm(`确定要删除存档"${save.name}"吗？`)) {
          await saveSystem.deleteSave(save.id);
          this.scene.restart();
        }
      })
      .on('pointerover', function () {
        this.setColor('#ff5555');
      })
      .on('pointerout', function () {
        this.setColor('#ff0000');
      });

    container.add([bg, border, nameText, capitalText, infoText, timeText, deleteBtn]);

    // 背景控制交互
    bg.setInteractive({ useHandCursor: true });

    bg.on('pointerover', () => {
      bg.setFillStyle(0x444444, 0.9);
      this.input.setDefaultCursor('pointer');
    });

    bg.on('pointerout', () => {
      bg.setFillStyle(0x333333, 0.8);
      this.input.setDefaultCursor('default');
    });

    bg.on('pointerdown', async () => {
      try {
        await saveSystem.loadSave(save.id);
        console.log('存档加载成功:', save.id);
        this.scene.start('GameScene');
      } catch (error) {
        console.error('加载存档失败:', error);
        alert('加载存档失败: ' + error.message);
      }
    });

    return container;
  }


  /**
   * 创建新建存档卡片
   */
  createNewSaveCard(x, y, width, height, slotNumber) {
    const container = this.add.container(x, y);

    // 背景
    const bg = this.add.rectangle(0, 0, width, height, 0x222222, 0.5);
    const border = this.add.rectangle(0, 0, width, height)
      .setStrokeStyle(2, 0x666666, 0.8);

    // 加号和文字
    const plusText = this.add.text(0, -20, '+', {
      fontSize: '64px',
      color: '#666666'
    }).setOrigin(0.5);

    const newText = this.add.text(0, 30, '新建存档', {
      fontSize: '24px',
      color: '#666666',
      padding: { top: 10 },
    }).setOrigin(0.5);

    container.add([bg, border, plusText, newText]);

    // 只让背景接管交互
    bg.setInteractive({ useHandCursor: true });

    bg.on('pointerover', () => {
      bg.setFillStyle(0x333333, 0.7);
      plusText.setColor('#00ff00');
      newText.setColor('#00ff00');
      this.input.setDefaultCursor('pointer');
    });

    bg.on('pointerout', () => {
      bg.setFillStyle(0x222222, 0.5);
      plusText.setColor('#666666');
      newText.setColor('#666666');
      this.input.setDefaultCursor('default');
    });

    bg.on('pointerdown', () => {
      this.scene.start('SaveCreate');
    });

    return container;
  }

}