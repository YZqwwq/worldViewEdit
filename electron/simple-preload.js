const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

// 本地数据存储目录
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 简单的 API
const api = {
  test: async () => 'API 连接成功！',
  
  getFilePath: (filename) => path.join(dataDir, filename),
  
  saveFile: async (filename, content) => {
    try {
      // 确保目录存在
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        console.log(`创建了数据目录: ${dataDir}`);
      }
      
      // 确保内容可序列化
      let safeContent = content;
      
      // 检查内容是否包含不可序列化的对象
      try {
        // 尝试序列化，如果失败则进行处理
        JSON.stringify(content);
      } catch (serializationError) {
        console.error(`内容序列化失败:`, serializationError);
        // 创建一个简单的可序列化副本
        safeContent = {};
        // 只复制可枚举的基本属性
        for (const key in content) {
          try {
            const value = content[key];
            if (typeof value !== 'function' && typeof value !== 'symbol') {
              safeContent[key] = value;
            }
          } catch (err) {
            console.error(`处理属性 ${key} 时出错`, err);
          }
        }
      }
      
      const filePath = path.join(dataDir, filename);
      fs.writeFileSync(filePath, JSON.stringify(safeContent, null, 2), { encoding: 'utf8' });
      console.log(`文件保存成功: ${filePath}`);
      return filePath;
    } catch (error) {
      console.error(`保存文件失败 ${filename}:`, error);
      throw error; // 重新抛出错误以便调用者处理
    }
  },
  
  readFile: async (filename) => {
    const filePath = path.join(dataDir, filename);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    return null;
  },
  
  listFiles: async () => {
    return fs.readdirSync(dataDir);
  },
  
  deleteFile: async (filename) => {
    const filePath = path.join(dataDir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`已删除文件: ${filePath}`);
      return true;
    }
    console.log(`文件不存在: ${filePath}`);
    return false;
  }
};

// 菜单和通讯相关的API
const menuApi = {
  // 注册菜单动作监听器
  onMenuAction: (callback) => {
    ipcRenderer.on('menu-action', (event, action) => {
      console.log('收到菜单动作:', action);
      callback(action);
    });
  },
  
  // 取消注册监听器
  removeMenuActionListener: () => {
    ipcRenderer.removeAllListeners('menu-action');
  }
};

// 暴露 API 给渲染进程
try {
  contextBridge.exposeInMainWorld('electronAPI', {
    data: api,
    menu: menuApi
  });
  console.log('[PreloadSimple] API 已成功暴露到 window.electronAPI');
} catch (error) {
  console.error('[PreloadSimple] API 暴露失败:', error.message);
} 