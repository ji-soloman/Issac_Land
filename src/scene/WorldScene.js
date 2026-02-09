import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';

export default class WorldScene extends Phaser.Scene {
  constructor() {
    super('World');
  }

  init(data) {
    this.world = data.world;
  }

  create() {
    this.add.text(40, 40, `文明：${this.world.civilizationName}`, {
      fontSize: '24px',
      color: '#ffffff'
    });
  }
}
