const { app, BrowserWindow } = require('electron');
const path = require('path');
const url = require('url');

// 保持对window对象的全局引用，避免JavaScript对象被垃圾回收时，窗口被自动关闭
let mainWindow;

function createWindow() {
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true, // 是否集成Node
      contextIsolation: false,
      enableRemoteModule: true,
    }
  });

  // 加载应用
  const indexPath = url.format({
    pathname: path.join(__dirname, '../dist/index.html'),
    protocol: 'file:',
    slashes: true
  });
  
  mainWindow.loadURL(
    app.isPackaged 
      ? indexPath
      : 'http://localhost:5175'
  );

  // 打开开发者工具，方便调试
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  // 当window被关闭时，释放window对象
  mainWindow.on('closed', function() {
    mainWindow = null;
  });
}

// 当Electron完成初始化并准备创建浏览器窗口时调用此方法
app.on('ready', createWindow);

// 所有窗口关闭时退出应用
app.on('window-all-closed', function() {
  // macOS中除非用户按下 Cmd + Q 显式退出，否则应用与菜单栏始终处于活动状态
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function() {
  // macOS中点击Dock图标时没有已打开的其余应用窗口时，则通常在应用中重建一个窗口
  if (mainWindow === null) {
    createWindow();
  }
}); 