# worldViewEdit

A application for artist to create a world by graphical way

## 技术栈

- Vue 3
- TypeScript
- Vite
- Electron

## 开发指南

### 开发环境设置

```bash
# 安装依赖
npm install

# 启动 Vue 开发服务器
npm run dev

# 启动 Electron 开发环境（同时启动 Vue 开发服务器和 Electron）
npm run electron:dev
# 或使用构建脚本
node build.js --dev
```

### 构建应用

```bash
# 构建 Vue 应用
npm run build

# 构建 Electron 应用并打包
npm run electron:build
# 或使用构建脚本
node build.js
```

构建完成后，可以在 `release` 目录下找到打包好的安装程序。

## 应用结构

- `src/` - Vue 应用源代码
- `electron/` - Electron 主进程代码
  - `main.js` - Electron 主进程入口
  - `preload.js` - 预加载脚本，用于连接 Electron 和 Vue
- `public/` - 静态资源
- `dist/` - 构建输出目录
- `release/` - 打包后的安装程序输出目录

## 自定义配置

如需更改构建配置，请修改 `package.json` 中的 `build` 部分。

This project uses Vue 3 `<script setup>` SFCs. Check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about the recommended Project Setup and IDE Support in the [Vue Docs TypeScript Guide](https://vuejs.org/guide/typescript/overview.html#project-setup).
