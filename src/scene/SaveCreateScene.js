import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import { saveSystem } from '../system/saveSystem.js';
import { RACES } from '../data/race.js';
import { TAROT } from '../data/tarot.js';
import { REGION } from '../data/region.js';
import { MAPS } from '../data/map.js';

export class SaveCreateScene extends Phaser.Scene {
  constructor() {
    super('SaveCreate');
  }

  preload() {
    this.load.image('btn_confirm', '/assets/ui/confirm.png?v=2');
    this.load.image('btn_back', '/assets/ui/unconfirm.png?v=2');
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

  createConfirmBtn(x, y, text, onClickCallback) {
    const confirmBtn = this.add.container(x, y);
    const btnBg = this.add.image(0, 0, 'btn_confirm');

    const BTN_WIDTH = 300;
    const BTN_HEIGHT = 100;

    const btnScale = Math.min(
      BTN_WIDTH / btnBg.width,
      BTN_HEIGHT / btnBg.height
    );
    btnBg.setScale(btnScale);

    const btnText = this.add.text(0, 0, text, {
      fontSize: '28px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
      fontStyle: 'bold',
      padding: { top: 10 },
    }).setOrigin(0.5);

    confirmBtn.add([btnBg, btnText]);

    btnBg.setInteractive({ useHandCursor: true });

    btnBg.on('pointerover', () => {
      btnBg.setTint(0xcccccc);
    });

    btnBg.on('pointerout', () => {
      btnBg.clearTint();
    });

    btnBg.on('pointerdown', () => {
      if (onClickCallback) {
        onClickCallback.call(this);
      }
    });

    return confirmBtn;
  }

  createReturnBtn(x, y, text, onClickCallback) {
    const returnBtn = this.add.container(x, y);
    const btnBg = this.add.image(0, 0, 'btn_back');

    const BTN_WIDTH = 300;
    const BTN_HEIGHT = 100;

    const btnScale = Math.min(
      BTN_WIDTH / btnBg.width,
      BTN_HEIGHT / btnBg.height
    );
    btnBg.setScale(btnScale);

    const btnText = this.add.text(0, 0, text, {
      fontSize: '28px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
      fontStyle: 'bold',
      padding: { top: 10 },
    }).setOrigin(0.5);

    returnBtn.add([btnBg, btnText]);

    btnBg.setInteractive({ useHandCursor: true });

    btnBg.on('pointerover', () => {
      btnBg.setTint(0xcccccc);
    });

    btnBg.on('pointerout', () => {
      btnBg.clearTint();
    });

    btnBg.on('pointerdown', () => {
      if (onClickCallback) {
        onClickCallback.call(this);
      }
    });

    return returnBtn;
  }

  create() {
    this.createName();
  }

  createName() {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    // 任意 Scene 的 create()
    this.createBackground();

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

    this.createConfirmBtn(cx - 180, cy + 200, '确认', function () {
      this.civName = input.value || '无名文明';
      input.remove();
      this.startRaceSelect();
    });
    this.createReturnBtn(cx + 180, cy + 200, '返回', async function () {
      input.remove();
      // 检查存档数量
      const saves = await saveSystem.listSaves();

      if (saves.length > 0) {
        // 有存档，返回存档选择
        this.scene.start('SaveSelect');
      } else {
        // 没有存档，弹出警告
        alert('请先创建一个存档');
        // 重新显示输入框
        this.createName();
      }
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

      // --- mask ---
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

      // 新所有 mask 位置
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

    this.createConfirmBtn(cx - 180, cy + 200, '确认', function () {
      if (!selectedRaceId) {
        this.cameras.main.shake(100, 0.005);
        return;
      }
      this.selectedRace = selectedRaceId;
      this.startSubRaceSelect();
    });
    this.createReturnBtn(cx + 180, cy + 200, '返回', function () {
      this.createName();
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
    this.createConfirmBtn(cx - 180, cy + 200, '确认', function () {
      if (!selectedSubRaceId) return;
      this.selectedSubRace = selectedSubRaceId;
      this.startTarotSelect();
    });

    // ====== 返回按钮 ======
    this.createReturnBtn(cx + 180, cy + 200, '返回', function () {
      this.startRaceSelect();
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
    const container = this.add.container(initialX, -20);

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

    // 如果所有卡片都不需要动画，直接解锁
    if (cardsToAnimate === 0) {
      isAnimating = false;
    }

    // ====== 横向拖拽滚动 ======
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
    this.createConfirmBtn(cx - 180, cy + 200, '确认', function () {
      if (isAnimating) return; // 动画期间不响应
      if (!selectedTarotId) return;

      this.selectedTarot = selectedTarotId;
      this.startEffectSelect();
    });

    // ====== 返回按钮 ======
    this.createReturnBtn(cx + 180, cy + 200, '返回', function () {
      if (isAnimating) return;
      this.startSubRaceSelect();
    });
  }

  startEffectSelect() {
    this.children.removeAll();
    this.createBackground();

    const width = this.scale.width;
    const height = this.scale.height;

    const CARD_WIDTH = 200;
    const CARD_HEIGHT = 300;
    const CARD_SPACING = 40;

    const effects = [
      { id: 'trait', name: '特性' },
      { id: 'troop', name: '特兵' },
      { id: 'district', name: '特区' }
    ];

    const selectedEffects = new Set(); // 存储已选择的效果

    // ====== 计算总宽度和起始位置（居中显示） ======
    const totalCardsWidth = effects.length * CARD_WIDTH + (effects.length - 1) * CARD_SPACING;
    const initialX = (width - totalCardsWidth) / 2;

    // ====== 横向容器 ======
    const container = this.add.container(initialX, 0);

    const highlightMap = {}; // 存储每个卡片的高亮框

    effects.forEach((effect, index) => {
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

      highlightMap[effect.id] = highlight;

      // --- 效果名称 ---
      const nameText = this.add.text(
        0, 0,
        effect.name,
        {
          fontSize: '48px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 4,
          fontStyle: 'bold',
          padding: { top: 10 },
        }
      ).setOrigin(0.5);

      // --- 交互区域 ---
      const hit = this.add.rectangle(
        0, 0,
        CARD_WIDTH, CARD_HEIGHT,
        0x000000, 0
      ).setInteractive();

      hit.on('pointerdown', () => {
        // 切换选中状态
        if (selectedEffects.has(effect.id)) {
          // 取消选中
          selectedEffects.delete(effect.id);
          highlight.setVisible(false);
        } else {
          // 检查是否已经选了2个
          if (selectedEffects.size >= 2) {
            return; // 已经选了2个，不能再选
          }
          // 选中
          selectedEffects.add(effect.id);
          highlight.setVisible(true);
        }
      });

      // 鼠标悬停效果
      hit.on('pointerover', () => {
        this.input.setDefaultCursor('pointer');
        if (!selectedEffects.has(effect.id)) {
          bg.setAlpha(0.5);
        }
      });

      hit.on('pointerout', () => {
        this.input.setDefaultCursor('default');
        bg.setAlpha(0.3);
      });

      // --- 添加到卡片 ---
      card.add([bg, border, highlight, nameText, hit]);
      container.add(card);
    });

    // ====== 确认按钮 ======
    const cx = width / 2;
    const cy = height / 2;

    this.createConfirmBtn(cx - 180, cy + 200, '确认', function () {
      // 必须选择2个才能确认
      if (selectedEffects.size !== 2) {
        console.log('必须选择2个效果！');
        return;
      }

      // 保存选择的效果
      this.selectedEffects = Array.from(selectedEffects);
      console.log('已选择效果:', this.selectedEffects);

      // 进入下一步
      this.createCapitalName();
    });

    // ====== 返回按钮 ======
    this.createReturnBtn(cx + 180, cy + 200, '返回', function () {
      this.startTarotSelect();
    });
  }

  createCapitalName() {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    this.createBackground();

    this.add.text(cx, cy - 130, '输入首都名称', {
      fontSize: '60px',
      color: '#ffffff',
      padding: { top: 10 },
      stroke: 'black',
      strokeThickness: 3.5
    }).setOrigin(0.5, 0.8);

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

    this.createConfirmBtn(cx - 180, cy + 200, '确认', async () => {
      this.capitalName = input.value || '都城';
      input.remove();
      await this.finishCreate();
    });
    this.createReturnBtn(cx + 180, cy + 200, '返回', function () {
      input.remove();
      this.startTarotSelect();
    });
  }

  async finishCreate() {
    // 从 MAPS 中随机抽一个
    const mapTypes = Object.keys(MAPS);
    const randomMapType = mapTypes[Math.floor(Math.random() * mapTypes.length)];

    // 准备初始数据
    const initialData = {
      name: this.civName,
      capital: this.capitalName,
      race: this.selectedRace,
      subRace: this.selectedSubRace,
      tarot: this.selectedTarot,
      map_type: randomMapType,

      // 根据 selectedEffects 设置对应的值为 true
      trait: this.selectedEffects.includes('trait'),
      troop: this.selectedEffects.includes('troop'),
      district: this.selectedEffects.includes('district')
    };

    try {
      // 创建并保存存档
      const saveId = await saveSystem.createNewSave(initialData);

      // 立即保存到数据库
      await saveSystem.save();

      console.log('存档创建并保存成功:', saveId);
      console.log('存档数据:', saveSystem.currentSaveData);

      this.children.removeAll();
      this.scene.start('SaveSelect');

      return saveId;
    } catch (error) {
      console.error('创建存档失败:', error);
      throw error;
    }
  }

}
