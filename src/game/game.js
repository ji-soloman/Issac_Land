import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import BootScene from '../scene/bootscene.js';
import { SaveSelectScene } from '../scene/SaveSelectScene.js';
import { SaveCreateScene } from '../scene/SaveCreateScene.js';
import { GameScene } from '../scene/gameScene.js';

export const GameConfig = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  resolution: window.devicePixelRatio,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    autoRound: true
  },
  render: {
    pixelArt: false
  },
  scene: [
    BootScene,
    SaveSelectScene,
    SaveCreateScene,
    GameScene,
  ]
};
