import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import BootScene from '../scene/bootscene.js';
import { SaveSelectScene } from '../scene/SaveSelectScene.js';
import { SaveCreateScene } from '../scene/SaveCreateScene.js';
import { GameScene } from '../scene/gameScene.js';

export const GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container', // <--- 必须添加这一行，指定一个 HTML 元素的 ID
  width: window.innerWidth,
  height: window.innerHeight,
  resolution: window.devicePixelRatio,
  pixelArt: false,
  antialias: true,
  antialiasGL: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    autoRound: true
  },
  render: {
    pixelArt: false,
    antialias: true,
    antialiasGL: true,
    roundPixels: false
  },
  dom: {
    createContainer: true
  },
  scene: [
    BootScene,
    SaveSelectScene,
    SaveCreateScene,
    GameScene,
  ]
};
