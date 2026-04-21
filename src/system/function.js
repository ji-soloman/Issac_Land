import { get } from '../system/i18n.js';
import { saveSystem } from '../system/saveSystem.js';

export const game = {
  addAction(type, name, config, callbacks = {}) {
    const saveData = saveSystem.currentSaveData;

    if (!saveData.actionList) saveData.actionList = {};
    if (!saveData.actionList[type]) saveData.actionList[type] = {};

    const actionNum = get.actionNum(saveData)[type];
    const currentNum = Object.keys(saveData.actionList[type]).length;

    if (actionNum <= currentNum) {
      callbacks.onFail?.({
        type,
        name,
        config,
        reason: 'limit'
      });
      callbacks.onComplete?.(false);
      return false;
    }

    saveData.actionList[type][name] = config;

    saveSystem.save().then(() => {
      callbacks.onSuccess?.({
        type,
        name,
        config
      });
    });

    callbacks.onComplete?.(true);
    return true;
  },
  //   game.addAction('civil', 'build_region_1', data, {
  //   onSuccess() {
  //     console.log('添加成功');
  //   },
  //   onFail(info) {
  //     console.log('失败原因:', info.reason);
  //   },
  //   onComplete(ok) {
  //     console.log('结束:', ok);
  //   }
  // });
  showTips(scene, tip) {
    const { width, height } = scene.scale;
    const x = width / 2;
    const y = height * 0.18;

    const text = scene.add.text(x, y, tip, {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.7)',
      padding: { x: 12, y: 6 },
      align: 'center'
    })
      .setOrigin(0.5)
      .setDepth(99999); // 保证在最上层

    scene.time.delayedCall(1200, () => {
      scene.tweens.add({
        targets: text,
        y: y - 50,      // 向上移动
        alpha: 0,       // 淡出
        duration: 1200,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          text.destroy();
        }
      });
    });
  },
};