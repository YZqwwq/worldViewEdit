# WorldMap组件技术文档 - 补充说明

## 1. 文件关系与依赖结构

### 1.1 完整文件结构

```
src/components/WorldMap/
├── components/            # 地图UI组件
│   ├── WorldMapEditor.vue     # 地图编辑器主界面
│   ├── WorldMapCanvas.vue     # 地图画布组件
│   ├── FloatingPanel.vue      # 浮动面板
│   ├── DrawToolPanel.vue      # 绘图工具面板
│   ├── LayerControl.vue       # 图层控制面板
│   ├── LocationPanel.vue      # 地点编辑面板
│   ├── TerritoryPanel.vue     # 势力范围编辑面板
│   └── LabelEditor.vue        # 标签编辑器
├── composables/           # 组合式API
│   ├── useMapData.ts          # 地图数据管理
│   ├── useMapCanvas.ts        # 画布相关功能
│   ├── useMapInteractions.ts  # 地图交互管理
│   ├── useLayerManager.ts     # 图层管理系统
│   ├── useLayerFactory.ts     # 图层创建工厂
│   ├── useLayers.ts           # 各种图层实现
│   ├── useWorldMapLayers.ts   # 世界地图图层集成
│   ├── useMapTools.ts         # 地图工具逻辑
│   └── useMapExport.ts        # 地图导出功能
├── constants/             # 常量定义
│   ├── colors.ts              # 颜色常量
│   ├── layerIds.ts            # 图层ID常量
│   └── toolsConfig.ts         # 工具配置常量
├── utils/                 # 工具函数
│   ├── LRUCache.ts            # 缓存实现
│   ├── mapCalculations.ts     # 地图计算工具
│   ├── coordinateUtils.ts     # 坐标转换工具
│   └── imageProcessing.ts     # 图像处理工具
└── index.ts               # 模块入口
```

### 1.2 核心文件依赖关系图

```
      index.ts
         │
         ▼
┌─────────────────┐    ┌───────────────────┐
│ WorldMapView.vue│◄───┤ useMapData.ts     │
└────────┬────────┘    └─────────┬─────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌───────────────────┐
│WorldMapEditor.vue│◄──┤ mapStore(Pinia)   │
└────────┬────────┘    └───────────────────┘
         │
         ├────────────────┬─────────────────┐
         ▼                ▼                 ▼
┌─────────────────┐┌─────────────┐ ┌─────────────────┐
│WorldMapCanvas.vue││FloatingPanel│ │ DrawToolPanel.vue│
└────────┬────────┘└─────────────┘ └─────────────────┘
         │
         ├────────────────┬─────────────────┐
         ▼                ▼                 ▼
┌─────────────────┐┌─────────────┐ ┌─────────────────┐
│useWorldMapLayers││useMapCanvas │ │useMapInteractions│
└────────┬────────┘└─────────────┘ └─────────────────┘
         │
         ├────────────────┬─────────────────┐
         ▼                ▼                 ▼
┌─────────────────┐┌─────────────┐ ┌─────────────────┐
│useLayerManager  ││useLayerFactory│useLayers       │
└─────────────────┘└─────────────┘ └─────────────────┘
```

## 2. 模块间交互与数据流

### 2.1 数据流向与事件处理

WorldMap组件采用自上而下的数据流模式，同时结合事件向上传递的机制：

1. **数据源**：`mapStore`（Pinia Store）作为中央数据源
2. **数据提取**：`useMapData` 从 store 获取数据并提供响应式访问接口
3. **数据消费**：各组件通过 `useMapData` 读取数据状态
4. **状态变更**：组件通过 `useMapData` 提供的方法更新状态
5. **更新渲染**：状态变更触发组件重新渲染

```
用户交互 ──► WorldMapEditor/Canvas ──► useMapData ──► mapStore
                       ▲                    │
                       └────────────────────┘
                         (响应式状态更新)
```

### 2.2 图层系统工作流程

图层系统采用了组合模式和工厂模式，实现了高度可扩展的分层渲染：

```
WorldMapCanvas
      │
      ▼
useWorldMapLayers (协调所有图层)
      │
      ├─────────┬─────────┬─────────┬─────────┐
      ▼         ▼         ▼         ▼         ▼
背景图层    地图图层    势力图层    网格图层   ... 其他图层
      │         │         │         │         │
      └─────────┴─────────┴─────────┴─────────┘
                           │
                           ▼
                    useLayerManager
                    (统一管理渲染)
```

1. **图层创建**：`useWorldMapLayers` 使用各种图层工厂函数创建图层
2. **图层初始化**：图层在 DOM 挂载后通过 `useLayerManager` 初始化
3. **图层排序**：根据 zIndex 确定图层的渲染顺序
4. **图层渲染**：调用 `renderAll()` 方法按顺序渲染所有可见图层
5. **图层交互**：事件先由顶层图层处理，未处理则传递到下层图层

### 2.3 关键组件职责与调用关系

| 组件/模块 | 主要职责 | 依赖模块 | 被调用方式 |
|---------|---------|---------|----------|
| WorldMapView | 页面级容器，加载/保存数据 | useMapData | 页面路由加载 |
| WorldMapEditor | 工具栏和画布的容器 | WorldMapCanvas, useMapData | WorldMapView 子组件 |
| WorldMapCanvas | 渲染画布和处理交互 | useWorldMapLayers, useMapInteractions | WorldMapEditor 子组件 |
| useLayerManager | 管理所有图层的生命周期 | - | useWorldMapLayers 调用 |
| useLayerFactory | 创建不同类型的图层 | - | useLayers 调用 |
| useLayers | 提供特定功能的图层实现 | useLayerFactory | useWorldMapLayers 调用 |
| useMapData | 提供地图数据访问和修改接口 | mapStore | 各组件直接调用 |

## 3. 关键功能的实现流程

### 3.1 地图渲染流程

1. **初始化**:
   ```
   WorldMapCanvas 挂载
     │
     ▼
   useWorldMapLayers.initializeLayers()
     │
     ▼
   为每个图层创建Canvas元素
     │
     ▼
   layerManager.initLayerManager()
     │
     ▼
   添加所有Canvas到DOM
     │
     ▼
   初始化渲染 renderAll()
   ```

2. **渲染更新**:
   ```
   状态变化触发(比如缩放、平移)
     │
     ▼
   updateViewState() 更新视图状态
     │
     ▼
   各图层监听状态变化
     │
     ▼
   layerManager.renderAll()
     │
     ▼
   按Z轴顺序绘制每个图层
   ```

### 3.2 交互处理流程

1. **鼠标事件处理**:
   ```
   用户交互 (点击/拖拽)
     │
     ▼
   WorldMapCanvas 接收事件
     │
     ▼
   useMapInteractions 处理交互
     │
     ▼
   根据当前工具和上下文处理事件
     │
     ┌─────────┬─────────┬─────────┐
     ▼         ▼         ▼         ▼
   平移地图    选择元素    添加位置    绘制区域
     │         │         │         │
     └─────────┴─────────┴─────────┘
                  │
                  ▼
             更新状态数据
                  │
                  ▼
           重新渲染相关图层
   ```

2. **工具切换流程**:
   ```
   用户选择工具
     │
     ▼
   WorldMapEditor.setCurrentTool()
     │
     ▼
   useMapData.setCurrentTool()
     │
     ▼
   mapStore 更新当前工具状态
     │
     ▼
   相关组件响应工具变化
     │
     ▼
   显示对应工具面板(如DrawToolPanel)
   ```

### 3.3 数据保存与加载流程

```
用户触发保存
    │
    ▼
handleSave() 方法调用
    │
    ▼
useMapData.exportToJSON() 方法导出数据
    │
    ▼
转换Map对象为可序列化结构
    │
    ▼
保存到localStorage或发送到服务器
    │
    ▼
emit('save') 通知父组件
```

```
页面加载
    │
    ▼
onMounted() 钩子触发
    │
    ▼
检查localStorage或URL参数
    │
    ▼
读取保存的地图数据
    │
    ▼
useMapData.importFromJSON() 导入数据
    │
    ▼
mapStore 更新状态
    │
    ▼
图层系统重新渲染
```

## 4. 示例场景与工作流程

### 4.1 添加位置标记的完整流程

1. 用户点击工具栏中的"位置"工具
   ```javascript
   // WorldMapEditor.vue
   function setCurrentTool(toolId: string) {
     if (!mapData.getEditState().isEditing) {
       mapData.toggleEditMode();
     }
     mapData.setCurrentTool(toolId as WorldMapData['editState']['currentTool']);
   }
   ```

2. 工具状态更新，光标样式改变
   ```javascript
   // WorldMapCanvas.vue
   const cursorStyle = computed(() => {
     const tool = mapData.getEditState().currentTool;
     switch (tool) {
       case 'location': return 'crosshair';
       case 'select': return 'default';
       // ...其他工具
       default: return 'default';
     }
   });
   ```

3. 用户在地图上点击位置
   ```javascript
   // useMapInteractions.ts
   function handleCanvasClick(event: MouseEvent) {
     const tool = mapData.getEditState().currentTool;
     
     if (tool === 'location') {
       const { mapX, mapY } = convertScreenToMapCoordinates(event.offsetX, event.offsetY);
       addNewLocation(mapX, mapY);
     }
   }
   ```

4. 创建新位置并更新数据
   ```javascript
   // useMapData.ts
   function addNewLocation(x: number, y: number) {
     const newId = generateId();
     const newLocation = {
       id: newId,
       name: `位置 ${newId.substring(0, 5)}`,
       type: 'default',
       importance: 'normal',
       position: { offsetX: x, offsetY: y },
       description: '',
       territories: [],
       isVisible: true,
       displayPriority: 1,
       connections: []
     };
     
     // 更新store
     mapStore.addLocation(newLocation);
     
     // 选中新添加的位置
     mapStore.setSelectedId(newId);
   }
   ```

5. 图层系统响应数据变化，重新渲染
   ```javascript
   // LocationLayer 的 render 方法
   function render() {
     clear();
     
     // 获取所有位置
     const locations = mapData.value.locations;
     
     locations.forEach((location) => {
       if (!location.isVisible) return;
       
       const { x, y } = convertMapToScreenCoordinates(
         location.position.offsetX, 
         location.position.offsetY
       );
       
       drawLocationMarker(
         x, y, 
         location.id === currentLocationId.value
       );
     });
   }
   ```

### 4.2 图层可见性切换工作流程

1. 用户点击图层控制面板中的图层切换按钮
   ```javascript
   // LayerControl.vue
   function toggleLayer(layerId: string) {
     emit('toggle-layer', layerId);
   }
   ```

2. 事件传递到父组件处理
   ```javascript
   // WorldMapEditor.vue
   const toggleLayerVisibility = (layerId: string) => {
     mapData.toggleLayerVisibility(layerId);
   };
   ```

3. 更新图层可见性状态
   ```javascript
   // useMapData.ts
   function toggleLayerVisibility(layerId: string) {
     const layer = layerManager.getLayer(layerId);
     if (layer) {
       layer.visible.value = !layer.visible.value;
       
       // 更新存储的可见性状态
       const newVisibility = {
         ...layerVisibility.value,
         [layerId]: layer.visible.value
       };
       layerVisibility.value = newVisibility;
       
       // 重新渲染
       layerManager.renderAll();
     }
   }
   ```

4. 更新UI状态
   ```javascript
   // LayerControl.vue
   <div v-for="layer in layers" :key="layer.id" class="layer-item">
     <label>
       <input 
         type="checkbox" 
         :checked="layerVisibility[layer.id]" 
         @change="toggleLayer(layer.id)" 
       />
       {{ layer.name }}
     </label>
   </div>
   ```

## 5. 组件间通信方式

WorldMap系统使用了多种组件通信方式：

1. **Props和Events**：父子组件间的基本通信方式
   ```vue
   <!-- 父组件 -->
   <WorldMapCanvas 
     :showCoordinates="true"
     @location-selected="handleLocationSelected"
   />
   
   <!-- 子组件 -->
   const props = defineProps({
     showCoordinates: {
       type: Boolean,
       default: false
     }
   });
   
   const emit = defineEmits(['locationSelected']);
   // 在适当的时候
   emit('locationSelected', locationId);
   ```

2. **Provide/Inject**：跨多级组件传递图层管理器
   ```javascript
   // useLayerManager.ts
   provide(LAYER_MANAGER_KEY, layerManager);
   
   // 子组件中
   const layerManager = inject(LAYER_MANAGER_KEY);
   ```

3. **Pinia Store**：全局状态管理
   ```javascript
   // 组件中
   import { useMapStore } from '../stores/mapStore';
   const mapStore = useMapStore();
   
   // 读取状态
   const mapData = mapStore.mapData;
   
   // 更新状态
   mapStore.setCurrentTool('location');
   ```

4. **组合式API共享状态**：通过导出的组合式API共享状态
   ```javascript
   // 在多个组件中
   import { useMapData } from '../composables/useMapData';
   const mapData = useMapData();
   
   // 共享同一状态实例
   ```

## 6. 扩展与定制指南

### 6.1 添加新的图层类型

1. **在useLayers.ts中定义新图层工厂函数**：
   ```typescript
   export function createCustomLayer(
     config: LayerConfig,
     // 所需依赖...
   ): Layer {
     const baseLayer = createBaseLayer(config);
     
     // 重写渲染方法
     baseLayer.render = function(): void {
       // 自定义渲染逻辑
     };
     
     return baseLayer;
   }
   ```

2. **在useWorldMapLayers.ts中集成新图层**：
   ```typescript
   // 添加到初始化函数中
   layers.push(createCustomLayer(
     { id: 'custom-layer', name: '自定义图层', zIndex: 75 },
     // 所需参数...
   ));
   ```

3. **在LayerControl中添加UI控制**：
   ```javascript
   const layers = [
     // ...现有图层
     { id: 'custom-layer', name: '自定义图层' }
   ];
   ```

### 6.2 添加新的交互工具

1. **扩展编辑状态类型**：
   ```typescript
   // types/map.ts
   export interface WorldMapData {
     // ...
     editState: {
       currentTool: 'mapdraw' | 'territory' | 'location' | 'connection' | 'label' | 'select' | 'custom-tool';
       // ...
     };
   }
   ```

2. **添加工具配置**：
   ```javascript
   // WorldMapEditor.vue
   const availableTools = [
     // ...现有工具
     { 
       id: 'custom-tool', 
       name: '自定义工具', 
       tooltip: '这是一个自定义工具' 
     }
   ];
   ```

3. **实现工具处理逻辑**：
   ```javascript
   // useMapInteractions.ts
   function handleCanvasClick(event: MouseEvent) {
     const tool = mapData.getEditState().currentTool;
     
     // ...现有工具处理
     
     if (tool === 'custom-tool') {
       // 自定义工具逻辑
     }
   }
   ```

### 6.3 自定义渲染样式

修改constants/colors.ts中的颜色常量，可以定制地图的视觉风格：

```typescript
// constants/colors.ts
export const CUSTOM_COLOR_LIGHT = '#custom-color';
export const CUSTOM_COLOR_DARK = '#custom-color-dark';

// 在图层实现中
import { CUSTOM_COLOR_LIGHT, CUSTOM_COLOR_DARK } from '../constants/colors';

// 使用颜色
const color = isDarkMode.value ? CUSTOM_COLOR_DARK : CUSTOM_COLOR_LIGHT;
```