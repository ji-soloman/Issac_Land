// src/scene/SaveCreateScene.js
import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import { SaveSystem } from '../system/saveSystem.js';
import { createInitialWorld } from '../world/createInitialWorld.js';
import { RACES } from '../data/race.js';
import { TAROT } from '../data/tarot.js';
import { REGION } from '../data/region.js';

export class SaveCreateScene extends Phaser.Scene {
  constructor() {
    super('SaveCreate');
  }

  preload() {
    this.load.image('input_box', '/assets/ui/input_box.png');
    this.load.image('btn_confirm', '/assets/ui/button_confirm.png');
    this.load.image('btn_back', '/assets/ui/input_box.png');
    Object.entries(RACES).forEach(([id, race]) => {
      if (race.image) {
        this.load.image(`race_${id}`, `/${race.image}`);
      }
    });
    Object.entries(TAROT).forEach(([id, tarot]) => {
      if (tarot.image) {
        this.load.image(`tarot_${id}`, `/${tarot.image}`);
      }
    });
  }

  createBackground() {
    const bg = this.add.image(0, 0, 'main_bg').setOrigin(0);

    const resizeBg = () => {
      const scaleX = this.scale.width / bg.width;
      const scaleY = this.scale.height / bg.height;
      const scale = Math.max(scaleX, scaleY);
      bg.setScale(scale);
    };

    resizeBg();
    this.scale.on('resize', resizeBg);
  }

  create() {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    // 任意 Scene 的 create()
    this.createBackground();


    // 输入框背景
    //this.add.image(cx, cy, 'input_box');

    // 提示文字
    this.add.text(cx, cy - 130, '输入文明名称', {
      fontSize: '60px',
      color: '#ffffff',
      padding: { top: 10 },
      stroke: 'black',
      strokeThickness: 3.5
    }).setOrigin(0.5, 0.8);

    // HTML 输入框（最稳定方案）
    const input = document.createElement('input');
    input.type = 'text';
    input.style.position = 'absolute';
    input.style.left = `${cx - 250}px`;
    input.style.top = `${cy - 10}px`;
    input.style.height = '80px';
    input.style.width = '500px';
    input.style.fontSize = '4rem';
    input.style.display = 'flex';
    input.style.textAlign = 'center';
    input.style.fontFamily = 'fangsong';
    input.style.alignItems = 'center';
    document.body.appendChild(input);

    // 确认按钮
    this.add.image(cx, cy + 220, 'btn_confirm')
      .setScale(0.3)
      .setInteractive()
      .on('pointerdown', () => {
        this.civName = input.value || '无名文明';
        input.remove();
        this.startRaceSelect();
      });
  }

  startRaceSelect() {
    this.children.removeAll();

    const width = this.scale.width;
    const height = this.scale.height;

    const CARD_WIDTH = 150;
    const races = Object.entries(RACES);

    let selectedRaceId = null;
    let currentHighlight = null;

    // ====== 横向容器 ======
    const container = this.add.container(0, 0);

    races.forEach(([id, race], index) => {
      const x = index * CARD_WIDTH;

      const card = this.add.container(
        x + CARD_WIDTH / 2,
        height / 2
      );

      // --- image ---
      const img = this.add.image(0, 0, `race_${id}`);

      const scale = Math.max(
        CARD_WIDTH / img.width,
        height / img.height
      );
      img.setScale(scale);

      // --- mask（⚠️ 关键：mask 需要在世界坐标系中，并跟随 card 位置） ---
      const maskShape = this.make.graphics();

      // --- highlight ---
      const highlight = this.add.rectangle(
        0, 0,
        CARD_WIDTH, height,
        0x00ff00, 0.18
      ).setVisible(false);

      // --- hit area ---
      const hit = this.add.rectangle(
        0, 0,
        CARD_WIDTH, height,
        0x000000, 0
      ).setInteractive();

      hit.on('pointerdown', () => {
        if (currentHighlight) {
          currentHighlight.setVisible(false);
        }
        highlight.setVisible(true);
        currentHighlight = highlight;
        selectedRaceId = id;
      });

      // --- text ---
      const nameText = this.add.text(0, 0, race.name, {
        fontSize: '24px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4
      }).setOrigin(0.5);

      // --- add ---
      card.add([img, highlight, hit, nameText]);
      container.add(card);

      // ⚠️ 在容器添加后，更新 mask 位置的函数
      const updateMask = () => {
        const worldX = card.x + container.x;
        const worldY = card.y + container.y;

        maskShape.clear();
        maskShape.fillStyle(0xffffff);
        maskShape.fillRect(
          worldX - CARD_WIDTH / 2,
          worldY - height / 2,
          CARD_WIDTH,
          height
        );
      };

      updateMask();
      const mask = maskShape.createGeometryMask();
      img.setMask(mask);

      // 保存更新函数以便拖拽时调用
      card.setData('updateMask', updateMask);
    });

    // ====== 横向拖拽滚动 ======
    let dragStartX = 0;
    let containerStartX = 0;
    let isDragging = false;

    this.input.on('pointerdown', p => {
      dragStartX = p.x;
      containerStartX = container.x;
      isDragging = false;
    });

    this.input.on('pointermove', p => {
      if (!p.isDown) return;

      const dx = p.x - dragStartX;
      if (Math.abs(dx) > 6) isDragging = true;

      const minX = Math.min(0, width - races.length * CARD_WIDTH);
      container.x = Phaser.Math.Clamp(
        containerStartX + dx,
        minX,
        0
      );

      // ⚠️ 更新所有 mask 位置
      container.each(card => {
        const updateMask = card.getData('updateMask');
        if (updateMask) updateMask();
      });
    });

    this.input.on('pointerup', () => {
      isDragging = false;
    });

    // ====== 确认按钮 ======
    const cx = width / 2;
    const cy = height / 2;

    this.add.image(cx, cy + 220, 'btn_confirm')
      .setScale(0.3)
      .setInteractive()
      .on('pointerdown', () => {
        if (!selectedRaceId) {
          this.cameras.main.shake(100, 0.005);
          return;
        }
        this.selectedRace = selectedRaceId;
        this.startSubRaceSelect();
      });
  }

  startSubRaceSelect() {
    this.children.removeAll();
    this.createBackground();

    const width = this.scale.width;
    const height = this.scale.height;

    const CARD_WIDTH = 200;
    const CARD_HEIGHT = 300;
    const CARD_SPACING = 20; // 卡片间距

    // 获取选中种族的子种族数据
    const selectedRaceData = RACES[this.selectedRace];
    const subraces = Object.entries(selectedRaceData.subraces);

    let selectedSubRaceId = null;
    let currentHighlight = null;

    // ====== 计算总宽度和起始位置 ======
    const totalCardsWidth = subraces.length * CARD_WIDTH + (subraces.length - 1) * CARD_SPACING;
    const containerWidth = totalCardsWidth;

    // 判断是否需要滚动
    const needsScroll = containerWidth > width;

    // 如果不需要滚动，居中显示；否则从左边开始
    const initialX = needsScroll ? 0 : (width - containerWidth) / 2;

    // ====== 横向容器 ======
    const container = this.add.container(initialX, 0);

    subraces.forEach(([id, subrace], index) => {
      const x = index * (CARD_WIDTH + CARD_SPACING);

      const card = this.add.container(
        x + CARD_WIDTH / 2,
        height / 2
      );

      // --- 白色半透明背景 ---
      const bg = this.add.rectangle(
        0, 0,
        CARD_WIDTH, CARD_HEIGHT,
        0xffffff, 0.3
      );

      // --- 透明边框 ---
      const border = this.add.graphics();
      border.lineStyle(2, 0xffffff, 0.8);
      border.strokeRect(
        -CARD_WIDTH / 2,
        -CARD_HEIGHT / 2,
        CARD_WIDTH,
        CARD_HEIGHT
      );

      // --- 选中高亮 ---
      const highlight = this.add.rectangle(
        0, 0,
        CARD_WIDTH, CARD_HEIGHT,
        0x00ff00, 0.25
      ).setVisible(false);

      // --- 子种族名称 ---
      const nameText = this.add.text(
        0, -CARD_HEIGHT / 2 + 30,
        subrace.name,
        {
          fontSize: '24px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 4,
          fontStyle: 'bold'
        }
      ).setOrigin(0.5);

      // --- 地区 ---
      const districtText = this.add.text(
        0, -CARD_HEIGHT / 2 + 70,
        ` ${REGION[subrace.district]}`,
        {
          fontSize: '16px',
          color: '#ffff00',
          stroke: '#000000',
          strokeThickness: 3
        }
      ).setOrigin(0.5);

      // --- 描述（自动换行） ---
      const desText = this.add.text(
        0, -CARD_HEIGHT / 2 + 110,
        subrace.des,
        {
          fontSize: '14px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 2,
          align: 'center',
          wordWrap: { width: CARD_WIDTH - 20 }
        }
      ).setOrigin(0.5, 0);

      // --- 交互区域 ---
      const hit = this.add.rectangle(
        0, 0,
        CARD_WIDTH, CARD_HEIGHT,
        0x000000, 0
      ).setInteractive();

      hit.on('pointerdown', () => {
        if (currentHighlight) {
          currentHighlight.setVisible(false);
        }
        highlight.setVisible(true);
        currentHighlight = highlight;
        selectedSubRaceId = id;
      });

      // --- 添加到卡片 ---
      card.add([bg, border, highlight, nameText, districtText, desText, hit]);
      container.add(card);
    });

    // ====== 横向拖拽滚动（仅在需要时启用） ======
    if (needsScroll) {
      let dragStartX = 0;
      let containerStartX = 0;
      let isDragging = false;

      this.input.on('pointerdown', p => {
        dragStartX = p.x;
        containerStartX = container.x;
        isDragging = false;
      });

      this.input.on('pointermove', p => {
        if (!p.isDown) return;

        const dx = p.x - dragStartX;
        if (Math.abs(dx) > 6) isDragging = true;

        // 限制滚动范围：右边界为0，左边界为容器宽度-屏幕宽度
        const minX = width - containerWidth;
        const maxX = 0;

        container.x = Phaser.Math.Clamp(
          containerStartX + dx,
          minX,
          maxX
        );
      });

      this.input.on('pointerup', () => {
        isDragging = false;
      });
    }

    // ====== 确认按钮 ======
    const cx = width / 2;
    const cy = height / 2;

    this.add.image(cx, cy + 220, 'btn_confirm')
      .setScale(0.3)
      .setInteractive()
      .on('pointerdown', () => {
        if (!selectedSubRaceId) return;

        this.selectedSubRace = selectedSubRaceId;

        this.startTarotSelect();
      });

    // ====== 返回按钮 ======
    const backBtn = this.add.container(80, 50);

    const backBg = this.add.image(0, 0, 'btn_back')
      .setScale(0.15) // 调整大小
      .setInteractive();

    const backText = this.add.text(0, 0, '← 返回', {
      fontSize: '18px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);

    backBtn.add([backBg, backText]);

    backBtn.setSize(backBg.displayWidth, backBg.displayHeight);
    backBtn.setInteractive(
      new Phaser.Geom.Rectangle(
        -backBg.displayWidth / 2,
        -backBg.displayHeight / 2,
        backBg.displayWidth,
        backBg.displayHeight
      ),
      Phaser.Geom.Rectangle.Contains
    );

    backBtn.on('pointerdown', () => {
      this.startRaceSelect(); // 返回种族选择
    });

    // 可选：悬停效果
    backBtn.on('pointerover', () => {
      backBg.setTint(0xcccccc);
    });

    backBtn.on('pointerout', () => {
      backBg.clearTint();
    });
  }

  startTarotSelect() {
    this.children.removeAll();
    this.createBackground();

    const width = this.scale.width;
    const height = this.scale.height;

    const CARD_WIDTH = 200 * 1.25;
    const CARD_HEIGHT = 320 * 1.25;
    const CARD_SPACING = 22;

    const tarots = Object.entries(TAROT);

    let selectedTarotId = null;
    let currentHighlight = null;
    let isAnimating = true;

    // ====== 计算总宽度和起始位置 ======
    const totalCardsWidth = tarots.length * CARD_WIDTH + (tarots.length - 1) * CARD_SPACING;
    const containerWidth = totalCardsWidth;

    const needsScroll = containerWidth > width;
    const initialX = needsScroll ? 0 : (width - containerWidth) / 2;

    // ====== 计算屏幕内可见的卡片数量 ======
    const visibleCardCount = Math.ceil(width / (CARD_WIDTH + CARD_SPACING)) + 1; // 多1张保证覆盖
    const cardsToAnimate = Math.min(visibleCardCount, tarots.length);

    // ====== 横向容器 ======
    const container = this.add.container(initialX, 0);

    tarots.forEach(([id, tarot], index) => {
      const x = index * (CARD_WIDTH + CARD_SPACING);
      const finalX = x + CARD_WIDTH / 2;

      // 判断卡片是否在初始屏幕内
      const isVisible = index < cardsToAnimate;

      const card = this.add.container(
        isVisible ? width + 200 : finalX,
        height / 2
      );

      // --- 塔罗牌图片 ---
      const img = this.add.image(0, 0, `tarot_${id}`);

      // contain
      const scale = Math.min(
        CARD_WIDTH / img.width,
        CARD_HEIGHT / img.height
      );
      img.setScale(scale);

      // --- 选中高亮 ---
      const highlight = this.add.rectangle(
        0, 0,
        CARD_WIDTH, CARD_HEIGHT,
        0xffff00, 0.25
      ).setVisible(false);

      // --- 信息框 ---
      const INFO_BOX_WIDTH = CARD_WIDTH - 40;
      const INFO_BOX_HEIGHT = 110 * 1.25;
      const INFO_BOX_Y = CARD_HEIGHT / 2 - INFO_BOX_HEIGHT / 2 - 8;

      const infoBg = this.add.rectangle(
        0, INFO_BOX_Y,
        INFO_BOX_WIDTH, INFO_BOX_HEIGHT,
        0xffffff, 0.85
      ); // 保持居中

      // --- 塔罗牌名称 ---
      const nameText = this.add.text(
        0, INFO_BOX_Y - INFO_BOX_HEIGHT / 2 - 25,
        tarot.name,
        {
          fontSize: '27px',
          color: '#ffd700',
          stroke: '#000000',
          strokeThickness: 4,
          fontStyle: 'bold',
          padding: { top: 10 },
        }
      ).setOrigin(0.5);

      const districtText = this.add.text(
        0, INFO_BOX_Y - 45,
        `特区：${tarot.district}`,
        {
          fontSize: '15px',
          color: '#000000',
          align: 'center',
          padding: { top: 10 },
          lineSpacing: 3.6,
          wordWrap: { width: INFO_BOX_WIDTH - 10 }
        }
      ).setOrigin(0.5);

      const traitText = this.add.text(
        0, INFO_BOX_Y - 10,
        `特性: ${tarot.trait}`,
        {
          fontSize: '15px',
          color: '#0066cc',
          align: 'center',
          padding: { top: 10 },
          lineSpacing: 3.6,
          wordWrap: { width: INFO_BOX_WIDTH - 10 }
        }
      ).setOrigin(0.5);

      const troopText = this.add.text(
        0, INFO_BOX_Y + 28,
        `特兵: ${tarot.troop}`,
        {
          fontSize: '15px',
          color: '#cc0066',
          align: 'center',
          padding: { top: 10 },
          lineSpacing: 3.6,
          wordWrap: { width: INFO_BOX_WIDTH - 10 }
        }
      ).setOrigin(0.5);

      // --- 交互区域 ---
      const hit = this.add.rectangle(
        0, 0,
        CARD_WIDTH, CARD_HEIGHT,
        0x000000, 0
      ).setInteractive();

      hit.on('pointerdown', () => {
        if (isAnimating) return; // 动画期间不响应点击

        if (currentHighlight) {
          currentHighlight.setVisible(false);
        }
        highlight.setVisible(true);
        currentHighlight = highlight;
        selectedTarotId = id;
      });

      // --- 添加到卡片 ---
      card.add([img, highlight, infoBg, nameText, districtText, traitText, troopText, hit]);
      container.add(card);

      // ====== 飞入动画 ======
      if (isVisible) {
        const delay = index * (1200 / cardsToAnimate);

        this.tweens.add({
          targets: card,
          x: finalX,
          duration: 500,
          delay: delay,
          ease: 'Back.easeOut',
          onComplete: () => {
            // 最后一张可见卡片飞入后，解除动画锁定
            if (index === cardsToAnimate - 1) {
              isAnimating = false;
            }
          }
        });
      }
    });

    // 如果所有卡片都不需要动画（全部可见），直接解锁
    if (cardsToAnimate === 0) {
      isAnimating = false;
    }

    // ====== 横向拖拽滚动（仅在需要时启用） ======
    if (needsScroll) {
      let dragStartX = 0;
      let containerStartX = 0;
      let isDragging = false;

      this.input.on('pointerdown', p => {
        if (isAnimating) return; // 动画期间不响应拖拽

        dragStartX = p.x;
        containerStartX = container.x;
        isDragging = false;
      });

      this.input.on('pointermove', p => {
        if (!p.isDown || isAnimating) return; // 动画期间不响应拖拽

        const dx = p.x - dragStartX;
        if (Math.abs(dx) > 6) isDragging = true;

        const minX = width - containerWidth;
        const maxX = 0;

        container.x = Phaser.Math.Clamp(
          containerStartX + dx,
          minX,
          maxX
        );
      });

      this.input.on('pointerup', () => {
        isDragging = false;
      });
    }

    // ====== 确认按钮 ======
    const cx = width / 2;
    const cy = height / 2;

    const confirmBtn = this.add.image(cx, cy + 220, 'btn_confirm')
      .setScale(0.3)
      .setInteractive()
      .on('pointerdown', () => {
        if (isAnimating) return; // 动画期间不响应
        if (!selectedTarotId) return;

        this.selectedTarot = selectedTarotId;
        this.startCapitalInput();

      });

    // ====== 返回按钮 ======
    const backBtn = this.add.container(80, 50);

    const backBg = this.add.image(0, 0, 'btn_back')
      .setScale(0.5)
      .setInteractive();

    const backText = this.add.text(0, 0, '← 返回', {
      fontSize: '18px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);

    backBtn.add([backBg, backText]);

    backBtn.setSize(backBg.displayWidth, backBg.displayHeight);
    backBtn.setInteractive(
      new Phaser.Geom.Rectangle(
        -backBg.displayWidth / 2,
        -backBg.displayHeight / 2,
        backBg.displayWidth,
        backBg.displayHeight
      ),
      Phaser.Geom.Rectangle.Contains
    );

    backBtn.on('pointerdown', () => {
      if (isAnimating) return;
      this.startSubRaceSelect();
    });

    backBtn.on('pointerover', () => {
      if (!isAnimating) backBg.setTint(0xcccccc);
    });

    backBtn.on('pointerout', () => {
      backBg.clearTint();
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
