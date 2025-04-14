const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 确保 electron 目录存在
if (!fs.existsSync('electron')) {
  fs.mkdirSync('electron');
}

// 确保已安装所有依赖
try {
  console.log('检查并安装依赖...');
  execSync('npm install', { stdio: 'inherit' });
} catch (error) {
  console.error('依赖安装失败', error);
  process.exit(1);
}

// 构建应用
try {
  console.log('构建应用...');
  
  // 开发模式
  if (process.argv.includes('--dev')) {
    console.log('以开发模式启动应用...');
    execSync('npm run electron:dev', { stdio: 'inherit' });
  } 
  // 生产模式构建
  else {
    console.log('构建生产版本...');
    execSync('npm run electron:build', { stdio: 'inherit' });
    console.log('应用构建完成! 可以在 release 目录找到安装包。');
  }
} catch (error) {
  console.error('构建失败', error);
  process.exit(1);
} 