```
import { saveSystem } from './system/saveSystem.js';

// 1. 初始化
await saveSystem.init();

// 2. 创建新存档
const saveId = await saveSystem.createNewSave({
  name: '我的文明',
  capital: '首都',
  race: 'human',
  subRace: 'a',
  tarot: 'fool',
  trait: true,
  troop: true,
  district: false
});

console.log('当前存档ID:', saveSystem.currentSaveId);
console.log('当前存档数据:', saveSystem.currentSaveData);

// 3. 更新当前存档
saveSystem.updateCurrentSave({
  resource: { food: 100 },
  process: { turn: 10 }
});

console.log('是否有未保存修改:', saveSystem.isDirty); // true

// 4. 保存
await saveSystem.save();
console.log('是否有未保存修改:', saveSystem.isDirty); // false

// 5. 列出所有存档
const saves = await saveSystem.listSaves();
console.log(saves);
// [
//   { id: 'save_1234567890', name: '我的文明', turn: 10, era: '原始', ... },
//   ...
// ]

// 6. 加载存档
const loadedData = await saveSystem.loadSave('save_1234567890');
console.log(loadedData);

// 7. 获取当前存档的值
const food = saveSystem.getCurrentSaveValue('resource.food');
console.log('当前食物:', food);

// 8. 获取当前存档摘要
const summary = saveSystem.getCurrentSaveSummary();
console.log(summary);

// 9. 删除存档
await saveSystem.deleteSave('save_1234567890');

// 10. 检查是否有未保存的修改
if (saveSystem.hasUnsavedChanges()) {
  await saveSystem.save();
}
```