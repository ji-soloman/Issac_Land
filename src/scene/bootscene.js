import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import { saveSystem } from '../system/saveSystem.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  async create() {
    const bg = this.add.image(0, 0, 'main_bg').setOrigin(0);

    const resizeBg = () => {
      const scaleX = this.scale.width / bg.width;
      const scaleY = this.scale.height / bg.height;
      const scale = Math.max(scaleX, scaleY);
      bg.setScale(scale);
    };

    resizeBg();
    this.scale.on('resize', resizeBg);

    var saves = await saveSystem.listSaves();
    saves=Object.keys(saves)

    if (saves.length === 0) {
      // 没有任何存档 → 创建新存档
      this.scene.start('SaveCreate');
    } else {
      // 有存档 → 进入存档选择
      this.scene.start('SaveSelect');
    }
  }

  preload() {
    this.load.image('main_bg', 'assets/background/main_bg.jpg');
  }

}

