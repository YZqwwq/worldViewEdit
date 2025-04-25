<script setup lang="ts">
import { ref, computed, onMounted, reactive, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import WorldMapCanvas from './WorldMapCanvas.vue';
import { useMapData } from '../composables/useMapData';
import { useMapTools } from '../composables/useMapTools';
import type { WorldMapData } from '../../../types/map';
import FloatingPanel from './FloatingPanel.vue';

// 定义事件
const emit = defineEmits(['error', 'save']);

// 使用路由
const router = useRouter();

// 获取地图数据
const mapData = useMapData();

// 显示状态面板
const showStatusPanel = ref(true);

// 获取图层可见性状态
const layerVisibility = computed(() => mapData.layerVisibility);
const toggleLayerVisibility = (layerId: string) => mapData.toggleLayerVisibility(layerId);

// 引用地图画布组件
const mapCanvasRef = ref<InstanceType<typeof WorldMapCanvas> | null>(null);

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
      { id: 'grid', name: '网格' },
      { id: 'territory', name: '区域' },
      { id: 'connection', name: '连接' },
      { id: 'location', name: '位置' },
      { id: 'label', name: '标签' },
      { id: 'coordinate', name: '坐标' }
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
  { id: 'select', name: '选择', tooltip: '选择现有元素' },
  { id: 'location', name: '位置', tooltip: '添加新位置' },
  { id: 'connection', name: '连接', tooltip: '添加位置之间的连接' },
  { id: 'territory', name: '区域', tooltip: '绘制区域' },
  { id: 'label', name: '标签', tooltip: '添加文本标签' }
];

// 获取当前工具名称
function getCurrentToolName() {
  const tool = availableTools.find(t => t.id === mapData.getEditState().currentTool);
  return tool ? tool.name : '无';
}

// 设置当前工具
function setCurrentTool(toolId: string) {
  // 确保toolId是合法的工具类型
  const validToolId = toolId as WorldMapData['editState']['currentTool'];
  
  try {
    mapData.setCurrentTool(validToolId);
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

// 视图控制
function resetView() {
  try {
    mapData.batchUpdateViewState({
      offsetX: 0,
      offsetY: 0,
      scale: 1
    });
    
    // 重绘地图
    updateCanvas();
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
  if (!mapCanvasRef.value || !mapCanvasRef.value.$el) {
    emit('error', '地图画布未初始化');
    return;
  }
  
  try {
    const container = mapCanvasRef.value.$el as HTMLElement;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    // 世界地图大小 (360度 x 180度)
    const worldWidthDegrees = 360;
    const worldHeightDegrees = 180;
    
    // 计算适合的缩放比例
    const gridSize = 30; // 每格30像素
    const scaleX = containerWidth / (worldWidthDegrees * gridSize);
    const scaleY = containerHeight / (worldHeightDegrees * gridSize);
    
    // 使用较小的缩放比例以确保地图完全可见
    const newScale = Math.min(scaleX, scaleY) * 0.9;
    
    // 居中显示
    const scaledWorldWidth = worldWidthDegrees * gridSize * newScale;
    const scaledWorldHeight = worldHeightDegrees * gridSize * newScale;
    
    mapData.batchUpdateViewState({
      scale: newScale,
      offsetX: (containerWidth - scaledWorldWidth) / 2,
      offsetY: (containerHeight - scaledWorldHeight) / 2
    });
    
    // 重绘地图
    updateCanvas();
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
    console.log('视图状态已更新', newViewState);
    
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

// 组件挂载时初始化
onMounted(() => {
  console.log('WorldMapEditor组件已挂载');
  
  try {
    // 直接调用初始化方法
    nextTick(() => {
      if (mapCanvasRef.value) {
        if (typeof mapCanvasRef.value.initCanvas === 'function') {
          mapCanvasRef.value.initCanvas();
        }
      }
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
      <button 
        @click="toggleEditMode" 
        :class="{ 'active': mapData.getEditState().isEditing }"
      >
        {{ mapData.getEditState().isEditing ? '浏览模式' : '编辑模式' }}
      </button>
      
      <div class="tools-group" v-if="mapData.getEditState().isEditing">
        <button 
          v-for="tool in availableTools" 
          :key="tool.id"
          @click="setCurrentTool(tool.id)"
          :class="{ 'active': mapData.getEditState().currentTool === tool.id }"
          :title="tool.tooltip"
        >
          {{ tool.name }}
        </button>
      </div>
      
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
    
    <!-- 主要内容区域 -->
    <div class="editor-content">
      <!-- 地图画布 -->
      <WorldMapCanvas 
        ref="mapCanvasRef"
        :showCoordinates="true"
        :showStatusPanel="showStatusPanel"
        @location-selected="handleLocationSelected"
        @view-state-changed="handleViewStateChanged"
      />
      
      <!-- 浮动状态面板 -->
      <FloatingPanel v-if="showStatusPanel" title="地图状态" :initialX="960" :initialY="5" />
      
      <!-- 侧边栏 -->
      
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
  display: flex;
  align-items: center;
  padding: 10px;
  background-color: #fff;
  border-bottom: 1px solid #ddd;
  height: 50px;
  flex-shrink: 0;
}

.toolbar-buttons {
  display: flex;
  gap: 10px;
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
}
</style> 