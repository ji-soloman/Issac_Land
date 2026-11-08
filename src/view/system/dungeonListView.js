import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import { DUNGEON } from '../../data/dungeon.js';
import { DungeonSelector } from './dungeonSelector.js';

const DEPTH = 1800;
const BG_COLOR    = 0x0d0d1a;
const THEME_COLOR = 0xb8963e;

/**
 * DungeonListView —— 副本关卡选择界面
 *
 * 从"军事行动"面板点击"副本"卡片后打开的独立界面：按 DUNGEON 数据表列出所有关卡，
 * 每个关卡渲染成一张"缩略图（固定宽3:高4）+ 关卡名"的关卡按钮，点击后关闭本界面、
 * 打开该关卡对应的 DungeonSelector（选兵出战面板），流程和 military_ui.js 里原来
 * 直接 new DungeonSelector(scene, saveData, '1') 的效果一致，只是中间插入了选关这一步。
 *
 * 目前 DUNGEON 里只登记了第一关，所以这个界面此刻只会展示一个关卡按钮——这是
 * Object.entries(DUNGEON) 天然的结果，不是这里写死的；以后往 data/dungeon.js
 * 的 DUNGEON 里继续加新关卡条目，这个界面不需要再改动，会自动多出新的按钮。
 */
export class DungeonListView {
  constructor(scene, saveData) {
    this.scene = scene;
    this.saveData = saveData;
    this._loadAndBuild();
  }

  /**
   * 关卡缩略图（DUNGEON[id].image）不在游戏启动时的静态预加载列表里，需要运行时
   * 按需加载——做法比照 battleSystem.js 的 _loadAssetsAndBuild：先收集所有还没
   * 加载过的贴图 key，全部加载完成后再真正构建界面；一张都不缺的话就跳过加载
   * 直接构建。缩略图的贴图 key 用 `dungeon_select_${id}` 命名，和boss单位贴图
   * （`soldier_xxx`）的命名空间区分开，避免任何可能的冲突。
   */
  _loadAndBuild() {
    const entries = Object.entries(DUNGEON);
    const keysToLoad = [];
    const pathMap = {};

    entries.forEach(([id, data]) => {
      if (!data.image) return;
      const key = `dungeon_select_${id}`;
      if (!this.scene.textures.exists(key)) {
        keysToLoad.push(key);
        pathMap[key] = data.image;
      }
    });

    if (keysToLoad.length === 0) {
      this._build();
      return;
    }

    const { width, height } = this.scene.scale;
    const overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75)
      .setDepth(DEPTH + 100).setInteractive();
    const barW = 320, barH = 16;
    const barBg = this.scene.add.rectangle(width / 2, height / 2 + 20, barW, barH, 0x333333, 1).setDepth(DEPTH + 101);
    const barFg = this.scene.add.rectangle(width / 2 - barW / 2, height / 2 + 20, 0, barH, THEME_COLOR, 1)
      .setOrigin(0, 0.5).setDepth(DEPTH + 102);
    const loadTxt = this.scene.add.text(width / 2, height / 2 - 10, '加载中...', {
      fontSize: '18px', color: '#f0e6cc', padding: { top: 4 },
    }).setOrigin(0.5).setDepth(DEPTH + 101);

    const destroyLoader = () => { overlay.destroy(); barBg.destroy(); barFg.destroy(); loadTxt.destroy(); };

    let loaded = 0;
    const onDone = () => {
      loaded++;
      barFg.setDisplaySize(barW * (loaded / keysToLoad.length), barH);
      if (loaded >= keysToLoad.length) {
        this.scene.load.off('filecomplete', onDone);
        this.scene.load.off('loaderror', onDone);
        destroyLoader();
        this._build();
      }
    };
    this.scene.load.on('filecomplete', onDone);
    this.scene.load.on('loaderror', onDone); // 加载失败也继续，不卡死

    keysToLoad.forEach(k => this.scene.load.image(k, pathMap[k]));
    this.scene.load.start();
  }

  _build() {
    const { width, height } = this.scene.scale;

    this.overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.85)
      .setDepth(DEPTH).setInteractive();
    this.root = this.scene.add.container(0, 0).setDepth(DEPTH + 1);

    const bg = this.scene.add.rectangle(width / 2, height / 2, width, height, BG_COLOR, 0.97);
    this.root.add(bg);

    this.root.add(this.scene.add.text(width / 2, 34, '副本 · 选择关卡', {
      fontSize: '24px', color: '#f0e6cc', fontStyle: 'bold', fontFamily: 'serif', padding: { top: 4 },
    }).setOrigin(0.5));

    // 关闭按钮
    const closeHit = this.scene.add.circle(width - 44, 34, 20, 0, 0)
      .setInteractive({ useHandCursor: true });
    const closeTxt = this.scene.add.text(width - 44, 34, '✕', {
      fontSize: '26px', color: '#ff4444', fontStyle: 'bold', padding: { top: 4 },
    }).setOrigin(0.5);
    closeHit.on('pointerdown', () => this.destroy());
    this.root.add([closeHit, closeTxt]);

    this._buildLevelGrid(width, height);
  }

  /**
   * 关卡按钮网格——布局方式和 dungeonSelector.js 的 _buildTroopGrid 一致
   * （按可用宽度自动换行居中），只是每个格子的内容换成"缩略图 + 关卡名"。
   */
  _buildLevelGrid(width, height) {
    const entries = Object.entries(DUNGEON);

    // 缩略图固定按"宽3:高4"的比例显示
    const imgW = 150, imgH = imgW / 3 * 4;
    const labelH = 40; // 图片下方关卡名文字预留的高度
    const cardW = imgW + 16, cardH = imgH + labelH;
    const gap = 24;

    const cols  = Math.max(1, Math.floor((width - 100) / (cardW + gap)));
    const startX = (width - (cols * cardW + (cols - 1) * gap)) / 2 + cardW / 2;
    const startY = 120;

    entries.forEach(([id, data], i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cardW + gap);
      const y = startY + row * (cardH + gap) + cardH / 2;

      this._buildLevelButton(id, data, x, y, cardW, cardH, imgW, imgH, labelH);
    });
  }

  /**
   * 单个关卡按钮：缩略图（固定3:4比例区域，图片本身按等比"contain"缩放放进去，
   * 不裁切不拉伸）+ 下方关卡名，整张卡片可点击，点击后进入该关卡。
   */
  _buildLevelButton(id, data, x, y, cardW, cardH, imgW, imgH, labelH) {
    const container = this.scene.add.container(x, y);

    const cardBg = this.scene.add.rectangle(0, 0, cardW, cardH, 0x1e1d2e, 0.95)
      .setStrokeStyle(2, 0x555544, 0.8)
      .setInteractive({ useHandCursor: true });
    container.add(cardBg);

    const imgY = -cardH / 2 + imgH / 2 + 8;
    const imgKey = `dungeon_select_${id}`;
    if (this.scene.textures.exists(imgKey)) {
      const img = this.scene.add.image(0, imgY, imgKey);
      const scale = Math.min(imgW / img.width, imgH / img.height);
      img.setScale(scale).setOrigin(0.5);
      container.add(img);
    } else {
      // 没有配置缩略图或加载失败时，退回纯文字占位，不影响点击进入关卡
      container.add(this.scene.add.rectangle(0, imgY, imgW, imgH, 0x333333, 1));
      container.add(this.scene.add.text(0, imgY, data.name, {
        fontSize: '13px', color: '#8a7a5a', align: 'center', padding: { top: 4 },
        wordWrap: { width: imgW - 12 },
      }).setOrigin(0.5));
    }

    container.add(this.scene.add.text(0, cardH / 2 - labelH / 2, data.name, {
      fontSize: '16px', color: '#f0e6cc', fontStyle: 'bold', padding: { top: 4 },
      wordWrap: { width: cardW - 12 },
    }).setOrigin(0.5));

    cardBg.on('pointerover', () => cardBg.setStrokeStyle(2, 0xffd700, 1));
    cardBg.on('pointerout',  () => cardBg.setStrokeStyle(2, 0x555544, 0.8));
    cardBg.on('pointerdown', () => this._enterLevel(id));

    this.root.add(container);
  }

  _enterLevel(dungeonId) {
    this.destroy();
    new DungeonSelector(this.scene, this.saveData, dungeonId);
  }

  destroy() {
    this.root?.destroy(true);
    this.overlay?.destroy();
  }
}