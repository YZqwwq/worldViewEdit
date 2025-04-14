// preload.js
// 明确指定为 CommonJS 模块
'use strict';

// 导入必要的模块
const { contextBridge, ipcRenderer } = require('electron');
const Store = require('electron-store');
const path = require('path');
const fs = require('fs');

// 简单的日志函数
function log(message) {
  console.log(`[Preload] ${message}`);
}

log('开始执行 preload 脚本');

// 为了方便调试，输出当前进程信息
log(`进程类型: ${process.type}`);
log(`当前工作目录: ${process.cwd()}`);

// 创建存储目录 - 使用绝对路径
const storeDir = path.resolve(process.cwd(), 'store');
log(`存储目录: ${storeDir}`);

// 确保目录存在
try {
  if (!fs.existsSync(storeDir)) {
    fs.mkdirSync(storeDir, { recursive: true });
    log(`创建了存储目录: ${storeDir}`);
  } else {
    log(`存储目录已存在: ${storeDir}`);
  }
} catch (error) {
  log(`创建存储目录失败: ${error.message}`);
}

// 创建 Store 实例
let worldStore;
try {
  worldStore = new Store({
    name: 'worlds',
    cwd: storeDir
  });
  log('世界观存储已初始化');
} catch (error) {
  log(`世界观存储初始化失败: ${error.message}`);
}

// 定义所有 API 函数 - 返回 Promise 确保异步处理
const worldAPI = {
  saveWorld: async (worldData) => {
    try {
      log(`准备保存世界观: ${worldData.name}`);
      // 生成 ID
      const id = worldData.id || Date.now().toString();
      log(`世界观 ID: ${id}`);
      
      // 创建单个世界观存储
      const store = new Store({
        name: `world_${id}`,
        cwd: storeDir
      });
      
      // 保存数据
      store.set('data', { ...worldData, id });
      log(`单文件存储完成: world_${id}.json`);
      
      // 更新索引
      const worldsList = worldStore.get('list') || [];
      const index = worldsList.findIndex(w => w.id === id);
      
      const worldInfo = {
        id, 
        name: worldData.name,
        createdAt: worldData.createdAt,
        updatedAt: new Date().toISOString()
      };
      
      if (index >= 0) {
        worldsList[index] = worldInfo;
        log(`更新了现有世界观信息`);
      } else {
        worldsList.push(worldInfo);
        log(`添加了新世界观信息`);
      }
      
      worldStore.set('list', worldsList);
      log(`世界观索引更新完成，当前共 ${worldsList.length} 个世界观`);
      
      return id;
    } catch (error) {
      log(`保存世界观失败: ${error.message}`);
      throw error;
    }
  },
  
  getWorldsList: async () => {
    try {
      const list = worldStore.get('list') || [];
      log(`获取世界观列表成功，共 ${list.length} 个`);
      return list;
    } catch (error) {
      log(`获取世界观列表失败: ${error.message}`);
      return [];
    }
  },
  
  getWorldData: async (id) => {
    try {
      log(`获取世界观数据，ID: ${id}`);
      const store = new Store({
        name: `world_${id}`,
        cwd: storeDir
      });
      
      const data = store.get('data');
      if (data) {
        log(`获取世界观数据成功: ${data.name}`);
      } else {
        log(`未找到世界观数据: ${id}`);
      }
      return data;
    } catch (error) {
      log(`获取世界观数据失败: ${error.message}`);
      return null;
    }
  },
  
  getStoreDir: () => {
    log(`返回存储目录: ${storeDir}`);
    return storeDir;
  },
  
  testConnection: () => {
    log('测试 API 连接');
    return 'API连接成功';
  }
};

// 当 DOM 加载完成时执行
window.addEventListener('DOMContentLoaded', () => {
  log('DOM 已加载完成，准备暴露 API');
});

// 尝试暴露 API
try {
  // 使用 contextBridge 暴露 API
  contextBridge.exposeInMainWorld('electronAPI', {
    worlds: worldAPI
  });
  log('API 已成功暴露到 window.electronAPI');
} catch (error) {
  log(`暴露 API 失败: ${error.message}`);
}

// 标记预加载脚本完成
log('preload 脚本执行完毕'); 