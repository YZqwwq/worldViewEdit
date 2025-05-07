<script setup lang="ts">
import { ref, computed, onMounted, reactive, nextTick, onBeforeUnmount, provide, inject } from 'vue';
import { useRouter } from 'vue-router';
import WorldMapCanvas from './WorldMapCanvas.vue';
import { useMapData } from '../composables/useMapData';
import type { WorldMapData } from '../../../types/map';
import FloatingPanel from './FloatingPanel.vue';
import DrawToolPanel from './DrawToolPanel.vue';
import MapManageTool from './MapManageTool.vue';
import { useLayerManager, LAYER_MANAGER_KEY } from '../composables/useLayerManager';
import { DrawToolType } from '../composables/useLayerTools';

// 定义事件
const emit = defineEmits(['error', 'save']);

// 使用路由
const router = useRouter();

// 获取地图数据
const mapData = useMapData();

// 注入父组件提供的图层管理器
const layerManager = inject(LAYER_MANAGER_KEY);
if (!layerManager) {
  // 只记录警告，不再创建新实例，避免多实例问题
  console.warn('WorldMapEditor: 未找到父组件提供的LayerManager，这可能导致图层功能不可用');
} else {
  console.log('WorldMapEditor: 使用父组件提供的图层管理器实例');
}
// 重新提供图层管理器给子组件，确保依赖注入链完整
if (layerManager) {
  provide(LAYER_MANAGER_KEY, layerManager);
}

// 显示状态面板
const showStatusPanel = ref(true);

// 显示绘图工具面板
const showDrawToolPanel = computed(() => mapData.getEditState().currentTool === 'mapdraw');

// 引用地图画布组件
const mapCanvasRef = ref<InstanceType<typeof WorldMapCanvas> | null>(null);

// 鼠标位置的经纬度
const mousePosition = ref({ longitude: 0, latitude: 0 });

// 地图视图状态
const viewState = ref(mapData.getViewState());

// 更新鼠标位置和视图状态
function updateMapState() {
  viewState.value = mapData.getViewState();
}

// 格式化经度
function formatLongitude(longitude: number): string {
  const abs = Math.abs(longitude);
  if (longitude >= 0) {
    return `${abs.toFixed(2)}°E`;
  } else {
    return `${abs.toFixed(2)}°W`;
  }
}

// 格式化纬度
function formatLatitude(latitude: number): string {
  const abs = Math.abs(latitude);
  if (latitude >= 0) {
    return `${abs.toFixed(2)}°N`;
  } else {
    return `${abs.toFixed(2)}°S`;
  }
}

// 更新鼠标位置
function updateMousePosition(event: MouseEvent) {
  try {
    // 获取画布元素
    const canvas = document.querySelector('.world-map-canvas');
    if (!canvas) return;
    
    // 获取画布相对于视口的位置
    const rect = canvas.getBoundingClientRect();
    
    // 计算鼠标在画布上的相对位置
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;
    
    // 获取当前地图视图状态
    const viewState = mapData.getViewState();
    
    // 网格大小与比例
    const gridSize = 30; // 每格30像素
    const scaledGridSize = gridSize * viewState.scale;
    
    // 计算原点位置
    const originX = viewState.offsetX + 180 * scaledGridSize; // 经度0度
    const originY = viewState.offsetY + 90 * scaledGridSize;  // 纬度0度
    
    // 计算经纬度
    const longitude = (canvasX - originX) / scaledGridSize;
    const latitude = -(canvasY - originY) / scaledGridSize; // 注意纬度方向是反的
    
    // 格式化经纬度值
    mousePosition.value = {
      longitude: parseFloat(longitude.toFixed(2)),
      latitude: parseFloat(latitude.toFixed(2))
    };
    
  } catch (error) {
    console.error('计算经纬度时出错:', error);
  }
}

// 图层控制组件内联实现 (由于原LayerControl.vue已删除)
const LayerControl = {
  props: {
    layerVisibility: {
      type: Object,
      required: true
    }
  },
  emits: ['toggle-layer'],
  setup(props: { layerVisibility: Record<string, boolean> }, { emit }: { emit: (event: string, ...args: any[]) => void }) {
    const layers = [
      { id: 'background', name: '背景' },
      { id: 'mapdraw', name: '地图绘制' },
      { id: 'territory', name: '区域势力' },
      { id: 'grid', name: '网格' },
      { id: 'location', name: '重要地点' },
      { id: 'connection', name: '连接线' },
      { id: 'label', name: '标签' },
      { id: 'coordinate', name: '经纬度标签' }
    ];
    
    return {
      layers,
      toggleLayer: (layerId: string) => emit('toggle-layer', layerId)
    };
  },
  template: `
    <div class="layer-control">
      <h3>图层控制</h3>
      <div class="layer-list">
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
      </div>
    </div>
  `
};

// 可用的绘图工具
const availableTools = [
  { id: 'select', name: '选择', tooltip: '选择和移动现有元素' },
  { id: 'mapdraw', name: '地图绘制', tooltip: '绘制新地图' },
  { id: 'territory', name: '区域势力', tooltip: '绘制区域势力' },
  { id: 'location', name: '重要位置', tooltip: '添加新重要位置' },
  { id: 'connection', name: '连接线', tooltip: '添加位置之间的连接线' },
  { id: 'label', name: '标签', tooltip: '添加文本标签' }
];

// 获取当前工具名称
function getCurrentToolName() {
  const tool = availableTools.find(t => t.id === mapData.getEditState().currentTool);
  return tool ? tool.name : '选择工具';
}

// 获取工具图标
function getToolIcon(toolId: string): string {
  switch(toolId) {
    case 'select': return 'fas fa-mouse-pointer';
    case 'mapdraw': return 'fas fa-draw-polygon';
    case 'territory': return 'fas fa-map';
    case 'location': return 'fas fa-map-marker-alt';
    case 'connection': return 'fas fa-route';
    case 'label': return 'fas fa-font';
    default: return 'fas fa-tools';
  }
}

// 设置当前工具
function setCurrentTool(toolId: string) {
  // 确保工具ID是有效的
  try {
    // 如果当前不在编辑模式，切换到编辑模式
    if (!mapData.getEditState().isEditing) {
      mapData.toggleEditMode();
    }
    
    // 设置当前工具
    mapData.setCurrentTool(toolId as WorldMapData['editState']['currentTool']);
  } catch (e) {
    emit('error', `设置工具失败: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// 切换编辑模式
function toggleEditMode() {
  try {
    mapData.toggleEditMode();
  } catch (e) {
    emit('error', `切换编辑模式失败: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// 计算视图参数的通用函数
function calculateViewParams() {
  if (!mapCanvasRef.value || !mapCanvasRef.value.$el) {
    throw new Error('地图画布未初始化');
  }
  
  // 获取容器尺寸
  const container = mapCanvasRef.value.$el as HTMLElement;
  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;
  
  // 世界地图大小 (360度 x 180度)
  const worldWidthDegrees = 360;
  const worldHeightDegrees = 180;
  
  // 网格大小
  const gridSize = 15; // 每格30像素
  
  // 计算适合的缩放比例，使地图能够合适地显示
  const scaleX = containerWidth / (worldWidthDegrees * gridSize);
  const scaleY = containerHeight / (worldHeightDegrees * gridSize);
  
  // 使用较小的缩放比例以确保地图完全可见，并留出一些边距
  const newScale = Math.min(scaleX, scaleY) * 0.9;
  
  // 计算偏移以使地图中心对齐容器中心
  const scaledWorldWidth = worldWidthDegrees * gridSize * newScale;
  const scaledWorldHeight = worldHeightDegrees * gridSize * newScale;
  
  const offsetX = (containerWidth - scaledWorldWidth) / 2 + containerWidth * 0.01; // 向右偏移1%的宽度用于平衡被标签占用视觉影响
  const offsetY = (containerHeight - scaledWorldHeight) / 2 - containerHeight * 0.02; // 向上偏移2%的高度用于平衡被工具栏占用视觉影响

  return {
    containerWidth,
    containerHeight,
    scale: newScale,
    offsetX,
    offsetY
  };
}

// 视图控制
function resetView() {
  try {
    const params = calculateViewParams();
    
    // 更新视图状态
    mapData.batchUpdateViewState({
      offsetX: params.offsetX,
      offsetY: params.offsetY,
      scale: params.scale
    });
    
    // 重绘地图
    updateCanvas();
    
    console.log(`重置视图: 容器: ${params.containerWidth}x${params.containerHeight}, 缩放: ${params.scale.toFixed(2)}, 偏移: (${params.offsetX.toFixed(0)}, ${params.offsetY.toFixed(0)})`);
  } catch (e) {
    emit('error', `重置视图失败: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function zoomIn() {
  try {
    const currentViewState = mapData.getViewState();
    mapData.batchUpdateViewState({
      scale: currentViewState.scale * 1.2
    });
    
    // 重绘地图
    updateCanvas();
  } catch (e) {
    emit('error', `放大视图失败: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function zoomOut() {
  try {
    const currentViewState = mapData.getViewState();
    mapData.batchUpdateViewState({
      scale: currentViewState.scale / 1.2
    });
    
    // 重绘地图
    updateCanvas();
  } catch (e) {
    emit('error', `缩小视图失败: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// 适应视图
function fitWorldView() {
  try {
    const params = calculateViewParams();
    
    // 更新视图状态
    mapData.batchUpdateViewState({
      scale: params.scale,
      offsetX: params.offsetX,
      offsetY: params.offsetY
    });
    
    // 重绘地图
    
     } catch (e) {
    emit('error', `适应视图失败: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// 事件处理
function handleLocationSelected(id: string) {
  try {
    mapData.setSelectedId(id);
  } catch (e) {
    emit('error', `选择位置失败: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function handleViewStateChanged(newViewState: any) {
  try {
    // 视图状态已经在内部更新，这里可以添加额外处理
    //console.log('视图状态已更新', newViewState);
    
    // 重绘地图
    updateCanvas();
  } catch (e) {
    emit('error', `更新视图状态失败: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// 更新画布，触发重绘
function updateCanvas() {
  nextTick(() => {
    if (mapCanvasRef.value) {
      // 直接调用drawMap方法而不是通过事件
      if (typeof mapCanvasRef.value.drawMap === 'function') {
        mapCanvasRef.value.drawMap();
      }
    }
  });
}

// 保存地图数据
function saveMapState() {
  try {
    const mapJson = mapData.exportToJSON();
    emit('save', mapJson);
  } catch (e) {
    emit('error', `保存地图失败: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// 返回上一页
function goBack() {
  try {
    const currentId = router.currentRoute.value.query.id;
    router.push({
      path: '/tool',
      query: currentId ? { id: currentId } : {}
    });
  } catch (e) {
    emit('error', `导航失败: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// 处理绘图工具面板的事件
function handleDrawToolChange(event: { tool: DrawToolType }) {
  if (mapCanvasRef.value) {
    mapCanvasRef.value.handleDrawToolChange(event.tool);
  }
}

function handleTerrainChange(terrain: string) {
  if (mapCanvasRef.value) {
    mapCanvasRef.value.handleTerrainChange(terrain);
  }
}

function handleWidthChange(width: number) {
  if (mapCanvasRef.value) {
    mapCanvasRef.value.handleLineWidthChange(width);
  }
}

// 显示/隐藏工具下拉菜单
const showToolsDropdown = ref(false);

function toggleToolsDropdown() {
  showToolsDropdown.value = !showToolsDropdown.value;
}

// 点击其他区域关闭下拉菜单
function closeDropdownOnOutsideClick(event: MouseEvent) {
  const dropdown = document.querySelector('.tools-dropdown');
  if (dropdown && !dropdown.contains(event.target as Node)) {
    showToolsDropdown.value = false;
  }
}

// 组件挂载时初始化
onMounted(() => {
  console.log('WorldMapEditor组件已挂载');

  resetView();
  
  try {
    // 确保初始时处于编辑模式
    if (!mapData.getEditState().isEditing) {
      mapData.toggleEditMode();
    }
    
    // 直接调用初始化方法
    nextTick(() => {
      if (mapCanvasRef.value) {
        if (typeof mapCanvasRef.value.initCanvas === 'function') {
          mapCanvasRef.value.initCanvas();
        }
      }
    });

    
    
    // 监听鼠标移动事件更新经纬度
    document.addEventListener('mousemove', updateMousePosition);
    
    // 每500ms更新一次地图状态
    const updateInterval = window.setInterval(updateMapState, 500);
    
    // 添加点击事件监听器关闭下拉菜单
    document.addEventListener('click', closeDropdownOnOutsideClick);
    
    // 组件卸载前清除事件监听和定时器
    onBeforeUnmount(() => {
      document.removeEventListener('mousemove', updateMousePosition);
      document.removeEventListener('click', closeDropdownOnOutsideClick);
      clearInterval(updateInterval);
    });
  } catch (e) {
    emit('error', `初始化地图编辑器失败: ${e instanceof Error ? e.message : String(e)}`);
  }
});

// 对外暴露的方法
defineExpose({
  resetView,
  zoomIn,
  zoomOut,
  fitWorldView,
  saveMapState,
  goBack
});

</script>

<template>
  <div class="world-map-editor">
    <!-- 工具栏 -->
    <div class="editor-toolbar">
      <!-- 左侧工具 -->
      <div class="toolbar-left">
        <!-- 工具下拉菜单 -->
        <div class="tools-dropdown">
          <button 
            class="dropdown-toggle"
            @click="toggleToolsDropdown"
            :class="{ 'active': mapData.getEditState().currentTool !== 'select' }"
          >
            <i :class="getToolIcon(mapData.getEditState().currentTool)"></i>
            {{ getCurrentToolName() }}
            <i class="fas fa-chevron-down"></i>
          </button>
          
          <div class="dropdown-menu" v-if="showToolsDropdown">
            <button 
              v-for="tool in availableTools" 
              :key="tool.id"
              @click="setCurrentTool(tool.id); toggleToolsDropdown()"
              :class="{ 'active': mapData.getEditState().currentTool === tool.id }"
              :title="tool.tooltip"
            >
              <i :class="getToolIcon(tool.id)"></i> {{ tool.name }}
            </button>
          </div>
        </div>
      </div>
      
      <!-- 中央状态信息（真正居中显示） -->
      <div class="toolbar-center">
        <div class="map-status">
          <div class="status-item">
            <span class="status-label">经度:</span>
            <span class="status-value">{{ formatLongitude(mousePosition.longitude) }}</span>
          </div>
          <div class="status-item">
            <span class="status-label">纬度:</span>
            <span class="status-value">{{ formatLatitude(mousePosition.latitude) }}</span>
          </div>
          <div class="status-item">
            <span class="status-label">缩放:</span>
            <span class="status-value">{{ viewState.scale.toFixed(2) }}</span>
          </div>
        </div>
      </div>
      
      <!-- 右侧控制按钮 -->
      <div class="toolbar-right">
        <div class="view-controls">
          <button class="tool-btn back-btn" @click="goBack" title="返回">
            <i class="fas fa-arrow-left"></i>
          </button>
          <button @click="resetView" title="重置视图">
            <i class="fas fa-sync"></i>
          </button>
          <button @click="zoomIn" title="放大">+</button>
          <button @click="zoomOut" title="缩小">-</button>
          <button @click="fitWorldView" title="查看完整世界地图">
            <i class="fas fa-globe"></i>
          </button>
          <button @click="saveMapState" title="保存地图">
            <i class="fas fa-save"></i>
          </button>
        </div>
      </div>
    </div>
    
    <!-- 主要内容区域 -->
    <div class="editor-content">
      <!-- 地图画布 -->
      <WorldMapCanvas 
        ref="mapCanvasRef"
        :showCoordinates="true"
        :showStatusPanel="showStatusPanel"
        @location-selected="handleLocationSelected"
        @view-state-changed="handleViewStateChanged"
        @error="(msg) => emit('error', msg)"
      />
      
      <!-- 数据统计面板 -->
      <FloatingPanel v-if="showStatusPanel" title="数据统计" :initialX="960" :initialY="5" :showStats="true" />
      
      <!-- 绘图工具面板 -->
      <DrawToolPanel
        v-if="showDrawToolPanel"
        @tool-change="handleDrawToolChange"
        @terrain-change="handleTerrainChange"
        @width-change="handleWidthChange"
      />

      <MapManageTool :map-canvas-ref="mapCanvasRef" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.world-map-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background-color: #f5f5f5;
}

.editor-toolbar {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 0 10px;
  background-color: #fff;
  border-bottom: 1px solid #ddd;
  height: 50px;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 1000;
}

.toolbar-left {
  justify-self: start;
  display: flex;
  align-items: center;
}

.toolbar-center {
  justify-self: center;
  display: flex;
  align-items: center;
}

.toolbar-right {
  justify-self: end;
  display: flex;
  align-items: center;
}

.tools-dropdown {
  position: relative;
  
  .dropdown-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background-color: #f0f0f0;
    border: 1px solid #ccc;
    border-radius: 4px;
    cursor: pointer;
    min-width: 120px;
    
    &.active {
      background-color: #4a80bd;
      color: white;
      border-color: #3a6ca7;
    }
    
    i.fa-chevron-down {
      font-size: 10px;
      margin-left: auto;
    }
  }
  
  .dropdown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 1001;
    margin-top: 4px;
    background-color: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    min-width: 180px;
    display: flex;
    flex-direction: column;
    padding: 4px 0;
    
    button {
      padding: 8px 12px;
      text-align: left;
      border: none;
      background: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      white-space: nowrap;
      
      i {
        margin-right: 8px;
        width: 16px;
        text-align: center;
      }
      
      &:hover {
        background-color: #f5f5f5;
      }
      
      &.active {
        background-color: #eaf2fd;
        color: #4a80bd;
        font-weight: 500;
      }
    }
  }
}

.map-status {
  display: flex;
  gap: 15px;
  font-size: 13px;
  color: #444;
  background-color: #f8f8f8;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 6px 15px;
  align-items: center;
  height: 32px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  
  .status-item {
    display: flex;
    align-items: center;
    padding: 0 5px;
  }
  
  .status-label {
    color: #666;
    margin-right: 6px;
    font-weight: 400;
  }
  
  .status-value {
    font-weight: 600;
    min-width: 65px;
    text-align: right;
    letter-spacing: 0.2px;
  }
}

.view-controls {
  display: flex;
  gap: 5px;
}

.editor-content {
  display: flex;
  flex: 1;
  overflow: hidden;
  position: relative; /* 添加相对定位，使FloatingPanel可以相对于此定位 */
}

.editor-sidebar {
  width: 240px;
  background-color: #fff;
  border-left: 1px solid #ddd;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.tool-button {
  padding: 6px 10px;
  background-color: #f0f0f0;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
  
  &.active {
    background-color: #4a80bd;
    color: white;
    border-color: #3a6ca7;
  }
  
  &:hover:not(.active) {
    background-color: #e5e5e5;
  }
}

// 暗色模式样式
:deep(.dark-mode) {
  &.world-map-editor {
    background-color: #1a1a1a;
  }
  
  .editor-toolbar {
    background-color: #252525;
    border-color: #333;
  }
  
  .editor-sidebar {
    background-color: #252525;
    border-color: #333;
  }
  
  .tool-button {
    background-color: #333;
    border-color: #444;
    color: #f0f0f0;
    
    &.active {
      background-color: #2a5d9c;
      border-color: #1a4a8c;
    }
    
    &:hover:not(.active) {
      background-color: #444;
    }
  }
  
  .tools-dropdown {
    .dropdown-toggle {
      background-color: #333;
      border-color: #444;
      color: #f0f0f0;
      
      &.active {
        background-color: #2a5d9c;
        border-color: #1a4a8c;
      }
    }
    
    .dropdown-menu {
      background-color: #252525;
      border-color: #444;
      
      button {
        color: #eee;
        
        &:hover {
          background-color: #333;
        }
        
        &.active {
          background-color: #1e3a5a;
          color: #7ab3ff;
        }
      }
    }
  }
  
  .map-status {
    color: #eee;
    background-color: #2a2a2a;
    border-color: #444;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    
    .status-label {
      color: #aaa;
    }
    
    .status-value {
      color: #fff;
    }
  }
}
</style> 