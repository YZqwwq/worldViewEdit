# WorldMap 多图层地图组件

这是一个基于Canvas的世界地图组件，采用多图层架构设计，用于在世界观编辑器中进行地图编辑和查看。

## 架构设计

该组件采用分层架构设计，由以下几个主要部分组成：

### 1. 图层系统 (Layer System)

整个地图由多个独立的Canvas图层组成，包括：

- **背景图层 (Background Layer)**: 最底层灰色背景
- **地图图层 (Map Layer)**: 绘制矩形的地图区域
- **地域交互图层 (Territory Layer)**: 用于绘制势力范围（预留，未来实现）
- **网格图层 (Grid Layer)**: 在地图区域内绘制网格线
- **连线图层 (Connection Layer)**: 绘制位置之间的连接线
- **位置图层 (Location Layer)**: 绘制位置节点
- **标签图层 (Label Layer)**: 绘制位置标签
- **经纬度标注图层 (Coordinate Layer)**: 绘制经纬度标注

每个图层都是独立的Canvas元素，可以单独控制可见性和更新，从而提高渲染效率。

### 2. 图层管理器 (Layer Manager)

管理所有图层的创建、渲染、排序和销毁。主要功能：

- 管理图层的Z轴顺序
- 控制图层的可见性
- 处理图层的初始化和销毁
- 提供统一的渲染接口

### 3. 交互系统 (Interaction System)

处理与地图的所有交互，包括：

- 鼠标拖动平移地图
- 鼠标滚轮缩放地图
- 添加/编辑/删除位置
- 创建位置之间的连接
- 选择和编辑位置信息

### 4. 状态管理 (State Management)

使用Vue的响应式系统管理地图状态，主要数据：

- 地图位置和缩放
- 位置和连接数据
- 当前选中的位置
- 当前活动的工具
- 黑暗/亮色模式

## 主要特性

- **多图层渲染**: 使用多个Canvas元素分层渲染，提高性能和可维护性
- **响应式设计**: 适应不同屏幕尺寸
- **主题切换**: 支持亮色和暗色主题
- **位置管理**: 添加、编辑、删除位置
- **连接管理**: 创建位置间的连接
- **交互控制**: 拖动、缩放、点击等交互
- **图层控制**: 可单独控制各图层的可见性

## 技术栈

- Vue 3 + TypeScript
- Canvas API
- Composition API
- Pinia 状态管理

## 未来计划

- 实现地域交互图层，支持绘制和编辑多边形区域表示势力范围
- 添加地形绘制能力
- 优化性能，使用Web Workers处理复杂计算
- 实现地图数据的导入/导出
- 支持更多的交互方式和快捷键

## 使用方法

组件位于 `src/components/WorldMap` 目录下，主要使用 `WorldMapCanvas.vue` 组件进行集成。

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
