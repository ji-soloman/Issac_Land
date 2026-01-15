// src/scene/SaveCreateScene.js
import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import { SaveSystem } from '../system/saveSystem.js';
import { createInitialWorld } from '../world/createInitialWorld.js';
import { RACES } from '../data/race.js';
import { TAROT } from '../data/tarot.js';

export class SaveCreateScene extends Phaser.Scene {
  constructor() {
    super('SaveCreate');
  }

  preload() {
    this.load.image('input_box', '/assets/ui/input_box.png');
    this.load.image('btn_confirm', '/assets/ui/button_confirm.png');
    Object.entries(RACES).forEach(([id, race]) => {
      if (race.image) {
        this.load.image(`race_${id}`, `/${race.image}`);
      }
    });
  }

  create() {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
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


    // 输入框背景
    //this.add.image(cx, cy, 'input_box');

    // 提示文字
    this.add.text(cx, cy - 80, '输入文明名称', {
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(0.5);

    // HTML 输入框（最稳定方案）
    const input = document.createElement('input');
    input.type = 'text';
    input.style.position = 'absolute';
    input.style.left = `${cx - 150}px`;
    input.style.top = `${cy - 20}px`;
    input.style.width = '300px';
    document.body.appendChild(input);

    // 确认按钮
    this.add.image(cx, cy + 80, 'btn_confirm')
      .setInteractive()
      .on('pointerdown', () => {
        this.civName = input.value || '无名文明';
        input.remove();
        this.startRaceSelect();
      });
  }

  startRaceSelect() {
    this.children.removeAll();

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    let selected = null;

    Object.entries(RACES).forEach(([id, race], i) => {
      const img = this.add.image(
        cx - 200 + i * 200,
        cy,
        `race_${id}`   // ✅ 用 preload 时的 key
      )
        .setScale(0.5)
        .setInteractive();

      img.on('pointerdown', () => {
        selected = id;
        img.setTint(0x88ff88);
      });
    });

    this.add.text(cx, this.scale.height - 100, '确认', {
      fontSize: '24px',
      color: '#00ff00'
    })
      .setOrigin(0.5)
      .setInteractive()
      .on('pointerdown', () => {
        if (!selected) return;
        this.race = selected; // 存 id，不存对象
        this.startTarotSelect();
      });
  }


  startTarotSelect() {
    this.children.removeAll();

    const container = this.add.container(100, this.scale.height / 2);
    let selected = null;

    Object.entries(TAROT).forEach((t, i) => {
      const x = i * 220;

      const img = this.add.image(x, 0, t.image).setScale(0.4).setInteractive();
      const text = this.add.text(x, 120,
        `${t.name}\n${t.desc}\n${t.trait}\n${t.unit}`,
        { fontSize: '14px', color: '#ffffff', align: 'center' }
      ).setOrigin(0.5, 0);

      img.on('pointerdown', () => {
        selected = t;
        img.setTint(0x88ff88);
      });

      container.add([img, text]);
    });

    // 滚轮滚动
    this.input.on('wheel', (_, __, ___, deltaY) => {
      container.x -= deltaY * 0.5;
    });

    this.add.text(this.scale.width / 2, this.scale.height - 80, '确认', {
      fontSize: '24px',
      color: '#00ff00'
    })
      .setOrigin(0.5)
      .setInteractive()
      .on('pointerdown', () => {
        if (!selected) return;
        this.tarot = selected;
        this.startCapitalInput();
      });
  }

  startCapitalInput() {
    this.children.removeAll();

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    this.add.image(cx, cy, 'input_box');
    this.add.text(cx, cy - 80, '输入首都名称', {
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(0.5);

    const input = document.createElement('input');
    input.style.position = 'absolute';
    input.style.left = `${cx - 150}px`;
    input.style.top = `${cy - 20}px`;
    input.style.width = '300px';
    document.body.appendChild(input);

    this.add.image(cx, cy + 80, 'btn_confirm')
      .setInteractive()
      .on('pointerdown', async () => {
        this.capitalName = input.value || '首都';
        input.remove();
        await this.finishCreate();
      });
  }

  async finishCreate() {
    const world = createInitialWorld({
      civilizationName: this.civName,
      capitalName: this.capitalName,
      race: this.race.id,
      tarot: this.tarot.id
    });

    const id = `slot_${Date.now()}`;
    await SaveSystem.create(id, this.civName, world);

    this.scene.start('World', { world });
  }

}
