import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this.add.text(100, 100, 'Phaser 已启动', {
      fontSize: '32px',
      color: '#ffffff'
    });
  }
}
