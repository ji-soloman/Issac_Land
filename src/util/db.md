```
import * as db from './util/db.js';

// 初始化
await db.initDB();

// 写入数据
await db.put({ id: 1, name: '存档1', data: {...} });

// 读取数据
const save = await db.get(1);

// 获取所有
const all = await db.getAll();

// 删除
await db.remove(1);

// 批量操作
await db.putBatch([
  { id: 1, name: '存档1' },
  { id: 2, name: '存档2' }
]);

await db.removeBatch([1, 2]);

// 检查存在
const exists = await db.exists(1);

// 获取数量
const total = await db.count();
```