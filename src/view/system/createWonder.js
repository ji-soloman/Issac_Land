// src/view/system/CreateWonder.js
import * as Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.esm.js';
import { WONDER } from '../../data/wonder.js';
import { get } from '../../system/i18n.js';

export class CreateWonder {
    constructor(scene, gridId, data) {
        this.scene = scene;
        this.gridId = gridId;
        this.data = data;
        
        // 区分选中建造目标和当前查看目标
        this.selectedWonderKey = null; 
        this.viewedWonderKey = null; 

        this.wonderItems = {};

        // 左侧滚动参数
        this.scrollY = 0;
        this.maxScrollY = 0;

        // 右侧滚动参数
        this.detailScrollY = 0;
        this.maxDetailScrollY = 0;

        this.create();
    }

    preventEventPenetration(element, scrollArea = null) {
        if (!element.input) {
            element.setInteractive();
        }
        element.on('pointerdown', (p, lx, ly, e) => { if (e) e.stopPropagation(); });
        element.on('pointerup', (p, lx, ly, e) => { if (e) e.stopPropagation(); });
        element.on('pointermove', (p, lx, ly, e) => { if (e) e.stopPropagation(); });
        element.on('wheel', (p, dx, dy, dz, e) => {
            if (e) e.stopPropagation();
            if (scrollArea === 'left') this.handleScroll(dy);
            if (scrollArea === 'right') this.handleDetailScroll(dy);
        });
    }

    create() {
        const { width, height } = this.scene.scale;

        // 区域宽度划分：左侧 75%，右侧 25%
        this.leftWidth = width * 0.75;
        this.rightWidth = width * 0.25;

        // 主容器
        this.container = this.scene.add.container(0, 0);
        this.container.setDepth(2000);

        // 背景遮罩
        const fullBg = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0.75);
        fullBg.setOrigin(0, 0).setInteractive();

        // 阻断底层拖拽、点击与滚轮事件，并按鼠标 X 坐标分发滚动区域
        fullBg.on('pointerdown', (p, lx, ly, e) => { if (e) e.stopPropagation(); });
        fullBg.on('pointerup', (p, lx, ly, e) => { if (e) e.stopPropagation(); });
        fullBg.on('pointermove', (p, lx, ly, e) => { if (e) e.stopPropagation(); });
        fullBg.on('wheel', (pointer, deltaX, deltaY, deltaZ, event) => {
            if (event) event.stopPropagation();
            if (pointer.x <= this.leftWidth) {
                this.handleScroll(deltaY);
            } else {
                this.handleDetailScroll(deltaY);
            }
        });
        this.container.add(fullBg);

        // 顶部固定标题
        const title = this.scene.add.text(width / 2, 60, "创建奇迹", {
            fontSize: '36px', color: '#ffd700', fontStyle: 'bold', padding: { top: 4 },
        }).setOrigin(0.5);
        this.container.add(title);

        // 滚动区域参数
        this.listAreaY = 150;
        this.listAreaHeight = height - 300;
        const scrollBarX = this.leftWidth - 20;

        // 左侧滚动容器与遮罩
        this.scrollContainer = this.scene.add.container(0, this.listAreaY);
        this.container.add(this.scrollContainer);

        const shape = this.scene.make.graphics();
        shape.fillStyle(0xffffff);
        shape.fillRect(0, this.listAreaY, this.leftWidth, this.listAreaHeight);
        const mask = shape.createGeometryMask();
        this.scrollContainer.setMask(mask);

        // 右侧详情容器及独立滚动区
        this.detailPanel = this.scene.add.container(this.leftWidth, this.listAreaY);

        const detailBg = this.scene.add.rectangle(0, 0, this.rightWidth, this.listAreaHeight, 0x111111, 0.6).setOrigin(0, 0).setStrokeStyle(1, 0x333333);
        this.preventEventPenetration(detailBg, 'right');

        // 右侧内容的滚动容器
        this.detailScrollContainer = this.scene.add.container(0, 0);
        this.detailContent = this.scene.add.container(0, 0);
        this.detailScrollContainer.add(this.detailContent);

        // 右侧内容遮罩
        const detailShape = this.scene.make.graphics();
        detailShape.fillStyle(0xffffff);
        detailShape.fillRect(this.leftWidth, this.listAreaY, this.rightWidth, this.listAreaHeight);
        const detailMask = detailShape.createGeometryMask();
        this.detailScrollContainer.setMask(detailMask);

        // 右侧滚动条
        const detailScrollBarX = this.rightWidth - 12;
        this.detailTrack = this.scene.add.rectangle(detailScrollBarX, 0, 8, this.listAreaHeight, 0x333333).setOrigin(0, 0);
        this.detailScrollHandle = this.scene.add.rectangle(detailScrollBarX, 0, 8, 30, 0xffd700).setOrigin(0, 0);
        this.detailTrack.setVisible(false);
        this.detailScrollHandle.setVisible(false);

        // 右侧滚动条拖拽与阻断
        this.detailScrollHandle.setInteractive({ draggable: true, useHandCursor: true });
        this.preventEventPenetration(this.detailScrollHandle, 'right');
        this.detailScrollHandle.on('drag', (pointer, dragX, dragY) => {
            this.updateDetailScrollByHandle(dragY);
        });

        this.detailPanel.add([detailBg, this.detailScrollContainer, this.detailTrack, this.detailScrollHandle]);
        this.container.add(this.detailPanel);

        // 渲染列表
        this.renderWonderList(this.leftWidth, this.listAreaHeight);

        // 创建左侧滚动条视觉轨道并绑定拖拽事件
        if (this.maxScrollY > 0) {
            const track = this.scene.add.rectangle(scrollBarX, this.listAreaY, 8, this.listAreaHeight, 0x333333).setOrigin(0, 0);
            this.container.add(track);

            this.scrollHandleHeight = Math.max(30, (this.listAreaHeight / (this.listAreaHeight + this.maxScrollY)) * this.listAreaHeight);
            this.scrollHandle = this.scene.add.rectangle(scrollBarX, this.listAreaY, 8, this.scrollHandleHeight, 0xffd700).setOrigin(0, 0);
            this.container.add(this.scrollHandle);

            this.trackY = this.listAreaY;
            this.trackHeight = this.listAreaHeight;

            this.scrollHandle.setInteractive({ draggable: true, useHandCursor: true });
            this.preventEventPenetration(this.scrollHandle, 'left');

            this.scrollHandle.on('drag', (pointer, dragX, dragY) => {
                const localY = dragY - this.trackY;
                this.updateScrollByHandle(localY);
            });
        }

        // 底部按钮与关闭
        this.createConfirmButton(width, height);
        this.createCloseButton(width);

        this.container.alpha = 0;
        this.scene.tweens.add({ targets: this.container, alpha: 1, duration: 250 });
    }

    renderWonderList(areaWidth, listAreaHeight) {
        const startX = areaWidth * 0.12;
        const colSpacing = (areaWidth * 0.76) / 3;
        const rowSpacing = 280;
        const cols = 4;

        let index = 0;
        for (const [key, config] of Object.entries(WONDER)) {
            const r = Math.floor(index / cols);
            const c = index % cols;
            
            // 【测试逻辑】：第一个奇迹强行设为不可建造
            const isBuildable = index !== 0; 

            const itemContainer = this.scene.add.container(startX + c * colSpacing, 120 + r * rowSpacing);
            const itemBg = this.scene.add.rectangle(0, 0, 190, 240, isBuildable ? 0x222222 : 0x111111, 1).setStrokeStyle(2, 0x555555).setInteractive({ useHandCursor: true });

            this.preventEventPenetration(itemBg, 'left'); 

            const img = this.scene.add.image(0, -30, `wonder_${key}`);
            img.setScale(Math.min(150 / img.width, 110 / img.height));
            
            // 不可建造的视觉样式：变暗、半透明
            if (!isBuildable) {
                img.setAlpha(0.4);
                img.setTint(0x888888);
            }

            const nameText = this.scene.add.text(0, 55, config.name, { 
                fontSize: '20px', 
                color: isBuildable ? '#ffffff' : '#888888', 
                padding: { top: 4 }, 
            }).setOrigin(0.5);
            
            const infoText = this.scene.add.text(0, 85, config.filter_info, { 
                fontSize: '12px', 
                color: '#bbbbbb', 
                align: 'center', 
                padding: { top: 4 }, 
                wordWrap: { width: 170 } 
            }).setOrigin(0.5);

            itemContainer.add([itemBg, img, nameText, infoText]);
            this.scrollContainer.add(itemContainer);

            itemBg.on('pointerdown', () => this.selectWonder(key));
            this.wonderItems[key] = { bg: itemBg, isBuildable: isBuildable };
            index++;
        }

        const totalRows = Math.ceil(index / cols);
        const contentHeight = 120 + totalRows * rowSpacing + 50;
        this.maxScrollY = Math.max(0, contentHeight - listAreaHeight);
    }

    renderWonderDetail(key) {
        this.detailContent.removeAll(true);
        if (!key || !WONDER[key]) return;

        const config = WONDER[key];
        const centerX = this.rightWidth / 2;
        const textWrapWidth = this.rightWidth * 0.85;
        let currentY = 40;

        const img = this.scene.add.image(centerX, currentY, `wonder_${key}`);
        img.setOrigin(0.5, 0);
        img.setScale(Math.min((this.rightWidth * 0.7) / img.width, 180 / img.height));
        this.detailContent.add(img);
        currentY += (img.height * img.scaleY) + 30;

        const nameText = this.scene.add.text(centerX, currentY, config.name, { fontSize: '32px', color: '#ffd700', fontStyle: 'bold', padding: { top: 4 } }).setOrigin(0.5, 0);
        this.detailContent.add(nameText);
        currentY += nameText.height + 20;

        const timeText = this.scene.add.text(centerX, currentY, `建造时间: ${config.time_cost} 轮`, { fontSize: '20px', color: '#ffffff', padding: { top: 4 } }).setOrigin(0.5, 0);
        this.detailContent.add(timeText);
        currentY += timeText.height + 20;

        if (config.cost && Object.keys(config.cost).length > 0) {
            let costStr = '建筑消耗:\n';
            for (const [resKey, amount] of Object.entries(config.cost)) {
                costStr += `${get.translation(resKey)}: ${amount}   `;
            }
            const costText = this.scene.add.text(centerX, currentY, costStr.trim(), { fontSize: '18px', color: '#ffaaaa', align: 'center', lineSpacing: 8, padding: { top: 4 } }).setOrigin(0.5, 0);
            this.detailContent.add(costText);
            currentY += costText.height + 20;
        }

        if (config.effect_info) {
            const effectText = this.scene.add.text(centerX, currentY, `建筑效果:\n${config.effect_info}`, {
                fontSize: '18px', color: '#aaffaa', align: 'center', lineSpacing: 8, wordWrap: { width: textWrapWidth }, padding: { top: 4 }
            }).setOrigin(0.5, 0);
            this.detailContent.add(effectText);
            currentY += effectText.height + 20;
        }

        if (config.filter_info) {
            const reqText = this.scene.add.text(centerX, currentY, `解锁条件:\n${config.filter_info}`, {
                fontSize: '18px', color: '#bbbbbb', align: 'center', lineSpacing: 8, wordWrap: { width: textWrapWidth }, padding: { top: 4 }
            }).setOrigin(0.5, 0);
            this.detailContent.add(reqText);
            currentY += reqText.height + 30;
        }

        const contentHeight = currentY + 20;
        this.maxDetailScrollY = Math.max(0, contentHeight - this.listAreaHeight);
        this.detailScrollY = 0;
        this.detailContent.y = 0;

        if (this.maxDetailScrollY > 0) {
            this.detailTrack.setVisible(true);
            this.detailScrollHandle.setVisible(true);

            this.detailScrollHandleHeight = Math.max(30, (this.listAreaHeight / contentHeight) * this.listAreaHeight);
            this.detailScrollHandle.setDisplaySize(8, this.detailScrollHandleHeight);
            this.detailScrollHandle.y = 0;
        } else {
            this.detailTrack.setVisible(false);
            this.detailScrollHandle.setVisible(false);
        }
    }

    updateScrollByHandle(localY) {
        const availableTrack = this.trackHeight - this.scrollHandleHeight;
        const clampedY = Phaser.Math.Clamp(localY, 0, availableTrack);
        const scrollPercent = clampedY / availableTrack;

        this.scrollY = -(scrollPercent * this.maxScrollY);
        this.scrollContainer.y = this.listAreaY + this.scrollY;
        this.scrollHandle.y = this.trackY + clampedY;
    }

    handleScroll(deltaY) {
        if (this.maxScrollY <= 0) return;

        this.scrollY -= deltaY * 0.8;
        this.scrollY = Phaser.Math.Clamp(this.scrollY, -this.maxScrollY, 0);

        this.scrollContainer.y = this.listAreaY + this.scrollY;

        if (this.scrollHandle) {
            const scrollPercent = this.scrollY / (-this.maxScrollY);
            const availableTrack = this.trackHeight - this.scrollHandleHeight;
            const targetHandleY = scrollPercent * availableTrack;
            this.scrollHandle.y = this.trackY + targetHandleY;
        }
    }

    updateDetailScrollByHandle(localY) {
        if (this.maxDetailScrollY <= 0) return;
        const availableTrack = this.listAreaHeight - this.detailScrollHandleHeight;
        const clampedY = Phaser.Math.Clamp(localY, 0, availableTrack);
        const scrollPercent = clampedY / availableTrack;

        this.detailScrollY = -(scrollPercent * this.maxDetailScrollY);
        this.detailContent.y = this.detailScrollY;
        this.detailScrollHandle.y = clampedY;
    }

    handleDetailScroll(deltaY) {
        if (this.maxDetailScrollY <= 0) return;

        this.detailScrollY -= deltaY * 0.8;
        this.detailScrollY = Phaser.Math.Clamp(this.detailScrollY, -this.maxDetailScrollY, 0);

        this.detailContent.y = this.detailScrollY;

        if (this.detailScrollHandle) {
            const scrollPercent = this.detailScrollY / (-this.maxDetailScrollY);
            const availableTrack = this.listAreaHeight - this.detailScrollHandleHeight;
            this.detailScrollHandle.y = scrollPercent * availableTrack;
        }
    }

    selectWonder(key) {
        const itemData = this.wonderItems[key];
        
        // 更新右侧查看目标
        this.viewedWonderKey = key;

        // 如果可建造，则切换选中状态；否则清空选中状态
        if (itemData.isBuildable) {
            this.selectedWonderKey = (this.selectedWonderKey === key) ? null : key;
        } else {
            this.selectedWonderKey = null;
        }

        for (const [k, item] of Object.entries(this.wonderItems)) {
            const isSel = k === this.selectedWonderKey;
            const isViewed = k === this.viewedWonderKey;
            
            if (isSel) {
                // 可建造且被选中：绿色描边
                item.bg.setStrokeStyle(4, 0x00ff00);
                item.bg.setFillStyle(0x333333);
            } else if (isViewed && !item.isBuildable) {
                // 查看不可建造的奇迹：红色描边以示警告
                item.bg.setStrokeStyle(3, 0xaa0000);
                item.bg.setFillStyle(0x222222);
            } else {
                // 默认状态
                item.bg.setStrokeStyle(2, 0x555555);
                item.bg.setFillStyle(item.isBuildable ? 0x222222 : 0x111111);
            }
        }

        this.renderWonderDetail(this.viewedWonderKey);
        this.updateConfirmButton();
    }

    createConfirmButton(width, height) {
        this.confirmBtnGroup = this.scene.add.container(width / 2, height - 80);
        this.confirmBtnBg = this.scene.add.rectangle(0, 0, 260, 60, 0x444444, 1).setStrokeStyle(2, 0x666666).setInteractive({ useHandCursor: false });

        this.preventEventPenetration(this.confirmBtnBg);

        this.confirmBtnText = this.scene.add.text(0, 0, '请选择奇迹', { fontSize: '24px', color: '#888888', padding: { top: 2, bottom: 2 } }).setOrigin(0.5);
        this.confirmBtnGroup.add([this.confirmBtnBg, this.confirmBtnText]);
        this.container.add(this.confirmBtnGroup);
        
        this.confirmBtnBg.on('pointerdown', () => this.selectedWonderKey && this.executeBuild());
    }

    updateConfirmButton() {
        if (this.selectedWonderKey) {
            // 已选中可建造奇迹
            this.confirmBtnBg.setFillStyle(0xffa500, 1).setStrokeStyle(2, 0xffffff);
            this.confirmBtnBg.input.cursor = 'pointer';
            this.confirmBtnText.setText(`开始建造`).setColor('#ffffff');
        } else if (this.viewedWonderKey && !this.wonderItems[this.viewedWonderKey].isBuildable) {
            // 正在查看不可建造的奇迹
            this.confirmBtnBg.setFillStyle(0x333333, 1).setStrokeStyle(2, 0x555555);
            this.confirmBtnBg.input.cursor = 'default';
            this.confirmBtnText.setText('条件不足').setColor('#aa0000');
        } else {
            // 默认未选中状态
            this.confirmBtnBg.setFillStyle(0x444444, 1).setStrokeStyle(2, 0x666666);
            this.confirmBtnBg.input.cursor = 'default';
            this.confirmBtnText.setText('请选择奇迹').setColor('#888888');
        }
    }

    createCloseButton(width) {
        const closeBtn = this.scene.add.text(width - 60, 60, '✕', { fontSize: '44px', color: '#ffffff', padding: { top: 4 } })
            .setOrigin(0.5).setInteractive({ useHandCursor: true });

        this.preventEventPenetration(closeBtn);
        closeBtn.on('pointerdown', () => this.close());
        this.container.add(closeBtn);
    }

    executeBuild() {
        this.scene.events.emit('build_wonder', { gridId: this.gridId, wonderKey: this.selectedWonderKey });
        this.close();
    }

    close() {
        this.scene.tweens.add({ targets: this.container, alpha: 0, duration: 200, onComplete: () => this.container.destroy() });
    }
}