import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import { SaveSystem } from '../system/saveSystem.js';

export class SaveSelectScene extends Phaser.Scene {
  constructor() {
    super('SaveSelect');
  }

  async create() {
    // 任意 Scene 的 create()
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
    this.add.text(40, 20, '存档选择', {
      fontSize: '32px',
      color: '#ffffff'
    });

    // 新建存档按钮
    this.add.text(40, 80, '【新建存档】', {
      fontSize: '24px',
      color: '#00ff00'
    })
    .setInteractive({ useHandCursor: true })
    .on('pointerdown', () => {
      this.scene.start('SaveCreate');
    });

    // 已有存档列表
    const saves = await SaveSystem.list();

    this.add.text(40, 140, '已有存档：', {
      fontSize: '24px',
      color: '#ffffff'
    });

    saves.forEach((save, index) => {
      this.add.text(60, 180 + index * 40, `▶ ${save.meta.name}`, {
        fontSize: '22px',
        color: '#ffffff'
      })
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', async () => {
        const fullSave = await SaveSystem.load(save.id);
        this.scene.start('World', {
          world: fullSave.world,
          slot: save.id
        });
      });
    });
  }
}
