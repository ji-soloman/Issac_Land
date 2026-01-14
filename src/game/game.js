import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import { BootScene } from '../scene/bootscene.js';

export const GameConfig = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  scene: [BootScene]
};
