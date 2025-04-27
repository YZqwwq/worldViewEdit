/**
 * 为 Electron API 定义类型
 */
interface ElectronAPI {
  // 保留原有接口以兼容旧代码
  worlds?: {
    // 保存世界观
    saveWorld: (worldData: WorldData) => Promise<string>;
    
    // 获取世界观列表
    getWorldsList: () => Promise<WorldInfo[]>;
    
    // 获取指定世界观数据
    getWorldData: (id: string) => Promise<WorldData | null>;
    
    // 删除世界观
    deleteWorld?: (id: string) => Promise<boolean>;
    
    // 获取存储目录
    getStoreDir: () => string;
    
    // 测试 API 连接
    testConnection: () => string;
  },
  
  // 新的简化数据接口
  data: {
    // 测试连接
    test: () => Promise<string>;
    
    // 获取文件路径
    getFilePath: (filename: string) => string;
    
    // 保存文件
    saveFile: (filename: string, content: any) => Promise<string>;
    
    // 读取文件
    readFile: (filename: string) => Promise<any>;
    
    // 列出所有文件
    listFiles: () => Promise<string[]>;
    
    // 删除文件
    deleteFile: (filename: string) => Promise<boolean>;
    
    // 创建文件夹
    createFolder: (folderPath: string) => Promise<boolean>;
    
    // 检查文件或文件夹是否存在
    exists: (path: string) => Promise<boolean>;
  },
  
  // 菜单操作接口
  menu?: {
    // 监听菜单动作
    onMenuAction: (callback: (action: string) => void) => void;
    
    // 移除菜单动作监听器
    removeMenuActionListener: () => void;
  }
}

/**
 * 世界观信息（列表中的简要信息）
 */
interface WorldInfo {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 完整的世界观数据
 */
interface WorldData extends WorldInfo {
  description: string;
  content: Record<string, any>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export { WorldInfo, WorldData }; 