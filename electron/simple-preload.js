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
      let safeContent;
      
      // 尝试克隆对象以确保安全序列化
      try {
        // 递归克隆和清理对象
        const deepClone = (obj) => {
          if (obj === null || obj === undefined) {
            return obj;
          }
          
          // 处理基本类型
          if (typeof obj !== 'object') {
            return obj;
          }
          
          // 处理数组
          if (Array.isArray(obj)) {
            return obj.map(item => deepClone(item));
          }
          
          // 处理日期
          if (obj instanceof Date) {
            return obj.toISOString();
          }
          
          // 处理对象
          const result = {};
          for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
              try {
                // 忽略函数和Symbol
                const value = obj[key];
                if (typeof value !== 'function' && typeof value !== 'symbol') {
                  result[key] = deepClone(value);
                }
              } catch (err) {
                console.error(`处理属性 ${key} 时出错`, err);
              }
            }
          }
          return result;
        };
        
        safeContent = deepClone(content);
        
        // 最终确认可序列化
        JSON.stringify(safeContent);
      } catch (serializationError) {
        console.error(`内容序列化失败:`, serializationError);
        // 如果深度克隆失败，使用浅层复制
        safeContent = {};
        for (const key in content) {
          try {
            if (Object.prototype.hasOwnProperty.call(content, key)) {
              const value = content[key];
              if (typeof value !== 'function' && typeof value !== 'symbol') {
                safeContent[key] = value;
              }
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
    console.log(`[API] 读取文件: ${filePath}`);
    
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      console.log(`[API] 文件存在，内容长度: ${fileContent.length}`);
      
      try {
        return JSON.parse(fileContent);
      } catch (parseError) {
        console.error(`[API] 解析文件内容失败 ${filename}:`, parseError);
        return null;
      }
    }
    
    console.log(`[API] 文件不存在: ${filePath}`);
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
  },
  
  // 创建文件夹
  createFolder: async (folderPath) => {
    try {
      const fullPath = path.join(dataDir, folderPath);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`已创建文件夹: ${fullPath}`);
        return true;
      }
      console.log(`文件夹已存在: ${fullPath}`);
      return true;
    } catch (error) {
      console.error(`创建文件夹失败 ${folderPath}:`, error);
      return false;
    }
  },
  
  // 检查文件或文件夹是否存在
  exists: async (filePath) => {
    const fullPath = path.join(dataDir, filePath);
    const exists = fs.existsSync(fullPath);
    console.log(`检查路径是否存在: ${fullPath}, 结果: ${exists}`);
    return exists;
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