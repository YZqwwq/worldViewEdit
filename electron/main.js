const { app, BrowserWindow, ipcMain, Menu, dialog, protocol } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');
const crypto = require('crypto');
const net = require('electron').net;

// 确保使用 CommonJS
process.env.ELECTRON_DISABLE_ESM = '1';

// 保持对window对象的全局引用，避免JavaScript对象被垃圾回收时，窗口被自动关闭
let mainWindow;

// 定义数据目录
const dataDir = path.join(process.cwd(), 'data');

// 创建应用菜单
function createMenu() {
  const isMac = process.platform === 'darwin';
  
  const template = [
    // { role: 'appMenu' }
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => showSettings()
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    // { role: 'fileMenu' }
    {
      label: 'File',
      submenu: [
        {
          label: 'New World',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            // 需要在渲染进程中处理新建世界的逻辑
            mainWindow.webContents.send('menu-action', 'new-world');
          }
        },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => showSettings()
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    // { role: 'editMenu' }
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' },
          { role: 'delete' },
          { role: 'selectAll' },
          { type: 'separator' },
          {
            label: 'Speech',
            submenu: [
              { role: 'startSpeaking' },
              { role: 'stopSpeaking' }
            ]
          }
        ] : [
          { role: 'delete' },
          { type: 'separator' },
          { role: 'selectAll' }
        ])
      ]
    },
    // { role: 'viewMenu' }
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    // { role: 'windowMenu' }
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ] : [
          { role: 'close' }
        ])
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            const { shell } = require('electron');
            await shell.openExternal('https://github.com/yourusername/yourrepo');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// 显示设置对话框
function showSettings() {
  // 通知渲染进程显示设置页面
  if (mainWindow) {
    mainWindow.webContents.send('menu-action', 'open-settings');
  } else {
    dialog.showErrorBox('Error', 'Unable to open settings: Main window not available');
  }
}

function createWindow() {
  
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'simple-preload.js'), // 使用简化版预加载脚本
      nodeIntegration: false, // 禁用 Node.js 集成以避免冲突
      contextIsolation: true, // 保持上下文隔离
      webSecurity: true, // 启用网络安全限制
      sandbox: false, // 禁用沙箱模式以允许文件系统访问
    }
  });

  // 输出预加载脚本路径以便调试
  const preloadPath = path.join(__dirname, 'simple-preload.js');
  console.log('Preload脚本路径:', preloadPath);
  console.log('Preload脚本是否存在:', require('fs').existsSync(preloadPath) ? '是' : '否');
  
  // 加载应用
  const indexPath = url.format({
    pathname: path.join(__dirname, '../dist/index.html'),
    protocol: 'file:',
    slashes: true
  });
  
  // 显示加载的URL以便调试
  const loadUrl = app.isPackaged ? indexPath : 'http://localhost:5178';
  console.log('加载URL:', loadUrl);
  
  // 检测Vite服务器是否正在运行
  if (!app.isPackaged) {
    const request = net.request(loadUrl);
    request.on('response', (response) => {
      console.log(`Vite服务器可访问，状态码: ${response.statusCode}`);
      mainWindow.loadURL(loadUrl);
    });
    request.on('error', (error) => {
      console.error(`无法连接到Vite服务器: ${error.message}`);
      console.log('尝试使用备用端口...');
      // 尝试其他常见的Vite端口
      const altPorts = [5173, 3000, 8080, 8000];
      let portFound = false;
      
      for (const port of altPorts) {
        const altUrl = `http://localhost:${port}`;
        console.log(`尝试连接: ${altUrl}`);
        try {
          const altRequest = net.request(altUrl);
          altRequest.on('response', (resp) => {
            if (!portFound) {
              console.log(`成功连接到: ${altUrl}`);
              portFound = true;
              mainWindow.loadURL(altUrl);
            }
          });
          altRequest.on('error', () => {});
          altRequest.end();
        } catch (e) {
          console.error(`尝试端口 ${port} 失败: ${e.message}`);
        }
      }
      
      // 如果没有找到可用端口，加载离线页面
      setTimeout(() => {
        if (!portFound) {
          console.log('未找到可用的开发服务器，加载打包版本');
          mainWindow.loadURL(indexPath);
        }
      }, 3000);
    });
    request.end();
  } else {
    mainWindow.loadURL(loadUrl);
  }

  // 打开开发者工具，方便调试
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
    
    // 将控制台日志输出到终端
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
      console.log(`[WebContents] ${message}`);
    });
  }

  // 监听页面加载完成事件
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('页面加载完成');
    
    // 测试 preload 脚本是否正确加载
    mainWindow.webContents.executeJavaScript(`
      console.log('测试 electronAPI 是否可用:', typeof window.electronAPI);
      if (window.electronAPI && window.electronAPI.worlds) {
        console.log('electronAPI.worlds 已正确加载');
      } else {
        console.error('electronAPI 未正确定义', window.electronAPI);
      }
    `).catch(err => {
      console.error('执行测试脚本失败:', err);
    });
  });

  // 监听预加载脚本错误
  mainWindow.webContents.on('preload-error', (event, preloadPath, error) => {
    console.error('Preload脚本加载失败:', preloadPath, error);
  });

  // 监听渲染进程报错
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('渲染进程崩溃:', details.reason);
  });

  // 捕获IPC和其他错误
  mainWindow.webContents.on('ipc-message-error', (event, channel, error) => {
    console.error('IPC通信错误:', channel, error);
  });
  
  // 添加未捕获异常处理
  process.on('uncaughtException', (error) => {
    console.error('未捕获的异常:', error);
    dialog.showErrorBox('应用错误', `发生了未处理的错误: ${error.message}\n\n${error.stack}`);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('未处理的Promise拒绝:', reason);
  });

  // 当window被关闭时，释放window对象
  mainWindow.on('closed', function() {
    mainWindow = null;
  });
}

// 当Electron完成初始化并准备创建浏览器窗口时调用此方法
app.whenReady().then(() => {
  console.log('Electron应用准备就绪');
  
  // 注册自定义协议，用于加载本地资源
  protocol.handle('app-resource', (request) => {
    try {
      const url = request.url.replace('app-resource://', '');
      const decodedUrl = decodeURI(url);
      const filePath = path.join(dataDir, decodedUrl);
      console.log('请求加载资源:', filePath);
      
      if (!fs.existsSync(filePath)) {
        console.error('资源文件不存在:', filePath);
        return new Response(null, { status: 404 });
      }
      
      const fileStats = fs.statSync(filePath);
      if (!fileStats.isFile()) {
        console.error('请求的资源不是文件:', filePath);
        return new Response(null, { status: 404 });
      }
      
      console.log('成功加载资源:', filePath, '大小:', fileStats.size, '字节');
      return net.fetch(`file://${filePath}`);
    } catch (error) {
      console.error('加载资源失败:', error);
      return new Response(null, { status: 500 });
    }
  });
  
  createMenu(); // 创建菜单
  createWindow();
});

// 在macOS上，当所有窗口关闭时退出应用，除非用户用Cmd + Q明确退出
app.on('window-all-closed', function() {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 在macOS上，当点击dock图标并且没有其他窗口打开时，重新创建一个窗口
app.on('activate', function() {
  if (mainWindow === null) {
    createWindow();
  }
});

// 处理保存世界观
ipcMain.handle('world:save', async (event, worldData) => {
  try {
    const worldId = worldData.id || crypto.randomUUID();
    const worldFolderName = `world_${worldId}`;
    const worldFolderPath = path.join(dataDir, worldFolderName);
    
    // 确保世界文件夹存在
    if (!fs.existsSync(worldFolderPath)) {
      fs.mkdirSync(worldFolderPath, { recursive: true });
      
      // 创建子文件夹
      const subfolders = ['characters', 'locations', 'events', 'items', 'notes'];
      for (const folder of subfolders) {
        fs.mkdirSync(path.join(worldFolderPath, folder), { recursive: true });
      }
    }
    
    // 设置世界数据
    if (!worldData.id) {
      worldData.id = worldId;
      worldData.createdAt = new Date().toISOString();
    }
    
    worldData.updatedAt = new Date().toISOString();
    
    // 保存世界设置文件
    const worldSettingPath = path.join(worldFolderPath, 'world_setting.json');
    fs.writeFileSync(worldSettingPath, JSON.stringify(worldData, null, 2));
    
    // 更新世界列表
    let worldsList = [];
    const worldsListPath = path.join(dataDir, 'worlds.json');
    
    if (fs.existsSync(worldsListPath)) {
      worldsList = JSON.parse(fs.readFileSync(worldsListPath, 'utf8'));
    }
    
    // 查找是否已存在此世界
    const worldIndex = worldsList.findIndex(world => world.id === worldId);
    const worldInfo = {
      id: worldId,
      name: worldData.name,
      description: worldData.description || '',
      createdAt: worldData.createdAt,
      updatedAt: worldData.updatedAt
    };
    
    if (worldIndex !== -1) {
      worldsList[worldIndex] = worldInfo;
    } else {
      worldsList.push(worldInfo);
    }
    
    // 保存世界列表
    fs.writeFileSync(worldsListPath, JSON.stringify(worldsList, null, 2));
    
    return worldId;
  } catch (error) {
    console.error('保存世界观失败:', error);
    throw error;
  }
}); 