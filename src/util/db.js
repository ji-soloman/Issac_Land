const DB_NAME = 'IssaccLand';
const STORE = 'saves';
const DB_VERSION = 1;

/**
 * 打开数据库连接
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

/**
 * 初始化数据库
 * @returns {Promise<boolean>}
 */
export async function initDB() {
  try {
    await openDB();
    console.log('数据库初始化成功');
    return true;
  } catch (error) {
    console.error('数据库初始化失败:', error);
    return false;
  }
}

/**
 * 创建或更新记录
 * @param {Object} data - 包含 id 的数据对象
 * @returns {Promise<Object>}
 */
export async function put(data) {
  if (!data || !data.id) {
    throw new Error('数据必须包含 id 字段');
  }
  
  const db = await openDB();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  
  return new Promise((resolve, reject) => {
    const req = store.put(data);
    req.onsuccess = () => resolve(data);
    req.onerror = () => reject(req.error);
  });
}

/**
 * 获取单条记录
 * @param {number|string} id - 记录 ID
 * @returns {Promise<Object|null>}
 */
export async function get(id) {
  const db = await openDB();
  const tx = db.transaction(STORE, 'readonly');
  const store = tx.objectStore(STORE);
  
  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * 获取所有记录
 * @returns {Promise<Array>}
 */
export async function getAll() {
  const db = await openDB();
  const tx = db.transaction(STORE, 'readonly');
  const store = tx.objectStore(STORE);
  
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/**
 * 删除记录
 * @param {number|string} id - 记录 ID
 * @returns {Promise<boolean>}
 */
export async function remove(id) {
  const db = await openDB();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

/**
 * 清空所有记录
 * @returns {Promise<boolean>}
 */
export async function clear() {
  const db = await openDB();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  
  return new Promise((resolve, reject) => {
    const req = store.clear();
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

/**
 * 获取所有记录的键
 * @returns {Promise<Array>}
 */
export async function getAllKeys() {
  const db = await openDB();
  const tx = db.transaction(STORE, 'readonly');
  const store = tx.objectStore(STORE);
  
  return new Promise((resolve, reject) => {
    const req = store.getAllKeys();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/**
 * 检查记录是否存在
 * @param {number|string} id - 记录 ID
 * @returns {Promise<boolean>}
 */
export async function exists(id) {
  const result = await get(id);
  return result !== null;
}

/**
 * 批量写入
 * @param {Array<Object>} dataArray - 数据数组
 * @returns {Promise<Array>}
 */
export async function putBatch(dataArray) {
  if (!Array.isArray(dataArray)) {
    throw new Error('参数必须是数组');
  }
  
  const db = await openDB();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  
  return new Promise((resolve, reject) => {
    const results = [];
    let completed = 0;
    
    dataArray.forEach(data => {
      if (!data || !data.id) {
        reject(new Error('所有数据必须包含 id 字段'));
        return;
      }
      
      const req = store.put(data);
      req.onsuccess = () => {
        results.push(data);
        completed++;
        if (completed === dataArray.length) {
          resolve(results);
        }
      };
      req.onerror = () => reject(req.error);
    });
    
    if (dataArray.length === 0) {
      resolve([]);
    }
  });
}

/**
 * 批量删除
 * @param {Array<number|string>} ids - ID 数组
 * @returns {Promise<boolean>}
 */
export async function removeBatch(ids) {
  if (!Array.isArray(ids)) {
    throw new Error('参数必须是数组');
  }
  
  const db = await openDB();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  
  return new Promise((resolve, reject) => {
    let completed = 0;
    
    ids.forEach(id => {
      const req = store.delete(id);
      req.onsuccess = () => {
        completed++;
        if (completed === ids.length) {
          resolve(true);
        }
      };
      req.onerror = () => reject(req.error);
    });
    
    if (ids.length === 0) {
      resolve(true);
    }
  });
}

/**
 * 获取记录数量
 * @returns {Promise<number>}
 */
export async function count() {
  const db = await openDB();
  const tx = db.transaction(STORE, 'readonly');
  const store = tx.objectStore(STORE);
  
  return new Promise((resolve, reject) => {
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}