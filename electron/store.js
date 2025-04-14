const Store = require('electron-store');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// 创建存储目录使用app.getPath获取安全目录
const storeDir = path.join(app.getPath('userData'), 'store');
console.log('[Store] 存储目录路径:', storeDir);

if (!fs.existsSync(storeDir)) {
  console.log('[Store] 创建存储目录:', storeDir);
  fs.mkdirSync(storeDir, { recursive: true });
} else {
  console.log('[Store] 存储目录已存在');
}

// 创建 electron-store 实例
const worldStore = new Store({
  name: 'worlds', // 将创建 worlds.json 文件
  cwd: storeDir, // 指定存储目录为 store 文件夹
});

// 增加调试信息
console.log('[Store] WorldStore 初始化完成，位置:', path.join(storeDir, 'worlds.json'));

// 工具函数：保存新世界观
function saveWorld(worldData) {
  try {
    console.log('[Store] 尝试保存世界观数据:', worldData.name);
    const id = worldData.id || Date.now().toString();
    const fileName = `world_${id}`;
    
    // 保存世界观数据到单独的文件
    const worldFileStore = new Store({
      name: fileName,
      cwd: storeDir,
    });
    
    worldFileStore.set('data', worldData);
    console.log('[Store] 已保存世界观数据到文件:', path.join(storeDir, `${fileName}.json`));
    
    // 更新世界观索引
    const worldsList = worldStore.get('list') || [];
    const existingIndex = worldsList.findIndex(w => w.id === id);
    
    if (existingIndex >= 0) {
      worldsList[existingIndex] = {
        id: id,
        name: worldData.name,
        createdAt: worldData.createdAt,
        updatedAt: new Date().toISOString(),
      };
    } else {
      worldsList.push({
        id: id,
        name: worldData.name,
        createdAt: worldData.createdAt,
        updatedAt: worldData.updatedAt,
      });
    }
    
    // 保存更新后的列表
    worldStore.set('list', worldsList);
    console.log('[Store] 已更新世界观列表, 当前共有:', worldsList.length, '个世界观');
    
    return id;
  } catch (error) {
    console.error('[Store] 保存世界观数据失败:', error);
    throw error;
  }
}

// 获取世界观列表
function getWorldsList() {
  try {
    const list = worldStore.get('list') || [];
    console.log('[Store] 获取世界观列表, 共有:', list.length, '个世界观');
    return list;
  } catch (error) {
    console.error('[Store] 获取世界观列表失败:', error);
    return [];
  }
}

// 获取指定的世界观数据
function getWorldData(id) {
  try {
    console.log('[Store] 尝试获取世界观数据, ID:', id);
    const fileName = `world_${id}`;
    const worldFileStore = new Store({
      name: fileName,
      cwd: storeDir,
    });
    
    const data = worldFileStore.get('data');
    if (data) {
      console.log('[Store] 已获取世界观数据:', data.name);
    } else {
      console.log('[Store] 未找到世界观数据, ID:', id);
    }
    return data;
  } catch (error) {
    console.error('[Store] 获取世界观数据失败:', error);
    return null;
  }
}

// 删除世界观
function deleteWorld(id) {
  const fileName = `world_${id}`;
  const filePath = path.join(storeDir, `${fileName}.json`);
  
  // 如果文件存在，则删除
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  
  // 更新世界观列表
  const worldsList = worldStore.get('list') || [];
  const updatedList = worldsList.filter(w => w.id !== id);
  worldStore.set('list', updatedList);
  
  return true;
}

module.exports = {
  saveWorld,
  getWorldsList,
  getWorldData,
  deleteWorld,
  storeDir
}; 