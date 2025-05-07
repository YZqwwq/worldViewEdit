<script setup lang="ts">
import { ref, computed, inject } from 'vue';
import { useMapData } from '../composables/useMapData';
import { LAYER_IDS } from '../composables/useMapCanvas';
import FloatingPanel from './FloatingPanel.vue';
import WorldMapCanvas from './WorldMapCanvas.vue';
import { useLayerManagerContext, LAYER_MANAGER_KEY } from '../composables/useLayerManager';

// 接收父组件传递的画布引用
const props = defineProps<{
  mapCanvasRef: null | InstanceType<typeof WorldMapCanvas>
}>();

// 获取地图数据
const mapData = useMapData();

// 定义图层管理器接口类型
interface LayerManagerLike {
  layerVisibility: { value: Record<string, boolean> };
  toggleLayer: (id: string, visible?: boolean) => void;
  getLayerVisibility: (id: string) => boolean;
  setLayersVisibility: (config: Record<string, boolean>) => void;
}

// 尝试直接从依赖注入获取图层管理器
const injectedLayerManager = inject(LAYER_MANAGER_KEY);

// 尝试获取图层管理器，使用多种方式确保能获取到实例
let layerManager: LayerManagerLike;
try {
  if (injectedLayerManager) {
    // 首选：使用注入的图层管理器
    layerManager = injectedLayerManager as LayerManagerLike;
    console.log('MapManageTool: 成功获取注入的图层管理器');
  } else if (props.mapCanvasRef) {
    // 备选1：尝试从画布引用获取图层管理器，但需要额外检查
    const canvasRef = props.mapCanvasRef as any;
    if (canvasRef && canvasRef.layerManager) {
      layerManager = canvasRef.layerManager;
      console.log('MapManageTool: 使用从mapCanvasRef获取的图层管理器');
    } else {
      throw new Error('mapCanvasRef存在但不包含layerManager');
    }
  } else {
    // 备选2：尝试通过useLayerManagerContext获取
    try {
      layerManager = useLayerManagerContext() as LayerManagerLike;
      console.log('MapManageTool: 通过context获取图层管理器');
    } catch (e) {
      // 最后备选：使用mapData中的适配实现
      console.warn('MapManageTool: 无法获取图层管理器，将使用mapData中的适配实现');
      // 创建适配器对象，转发对mapData的调用
      layerManager = {
        layerVisibility: computed(() => mapData.layerVisibility.value),
        toggleLayer: (id: string, visible?: boolean) => mapData.toggleLayerVisibility(id),
        getLayerVisibility: (id: string) => mapData.getLayerVisibility(id),
        setLayersVisibility: (config: Record<string, boolean>) => {
          Object.entries(config).forEach(([id, visible]) => {
            if (mapData.getLayerVisibility(id) !== visible) {
              mapData.toggleLayerVisibility(id);
            }
          });
        }
      };
    }
  }
} catch (e) {
  console.error('MapManageTool: 获取图层管理器失败，将使用基本适配实现', e);
  // 出错时创建最基本的适配器对象
  layerManager = {
    layerVisibility: computed(() => mapData.layerVisibility.value),
    toggleLayer: (id: string, visible?: boolean) => mapData.toggleLayerVisibility(id),
    getLayerVisibility: (id: string) => mapData.getLayerVisibility(id),
    setLayersVisibility: (config: Record<string, boolean>) => {
      Object.entries(config).forEach(([id, visible]) => {
        if (mapData.getLayerVisibility(id) !== visible) {
          mapData.toggleLayerVisibility(id);
        }
      });
    }
  };
}

// 图层可见性状态
const layerVisibility = computed(() => layerManager.layerVisibility.value);

// 控制图层列表的展开/折叠
const isExpanded = ref(true);

// 图层列表配置
const layers = [
  { id: LAYER_IDS.MAP, name: '地图绘制'  },
  { id: LAYER_IDS.TERRITORY, name: '势力范围',  },
  { id: LAYER_IDS.GRID, name: '网格', },
  { id: LAYER_IDS.CONNECTION, name: '连接线' },
  { id: LAYER_IDS.LOCATION, name: '重要位置'},
  { id: LAYER_IDS.LABEL, name: '标签' },
  { id: LAYER_IDS.COORDINATE, name: '坐标系'}
];

// 切换图层可见性
function toggleLayerVisibility(layerId: string) {
  // 使用图层管理器切换可见性
  layerManager.toggleLayer(layerId);
  
  // 如果有画布引用，只重新渲染被切换的图层
  if (props.mapCanvasRef) {
    try {
      // 使用renderLayer只渲染变更的图层，而不是重绘整个画布
      props.mapCanvasRef.renderLayer(layerId);
    } catch (e) {
      console.warn('更新画布显示失败', e);
    }
  }
}

// 切换列表展开状态
function toggleExpanded() {
  isExpanded.value = !isExpanded.value;
}

// 设置所有图层可见性
function setAllLayersVisibility(visible: boolean) {
  // 准备批量更新配置
  const visibilityConfig: Record<string, boolean> = {};
  
  layers.forEach(layer => {
    // 跳过背景图层，始终保持可见
    if (layer.id !== LAYER_IDS.BACKGROUND) {
      visibilityConfig[layer.id] = visible;
    }
  });
  
  // 使用图层管理器的批量设置方法
  layerManager.setLayersVisibility(visibilityConfig);
  
  // 如果有画布引用，只重新渲染画布，不重新初始化图层
  if (props.mapCanvasRef) {
    try {
      props.mapCanvasRef.drawMap();
    } catch (e) {
      console.warn('更新画布显示失败', e);
    }
  }
}

// 显示所有图层
function showAllLayers() {
  setAllLayersVisibility(true);
}

// 隐藏所有图层（除了背景）
function hideAllLayers() {
  setAllLayersVisibility(false);
}
</script>

<template>
  <!-- 使用FloatingPanel作为容器 -->
  <FloatingPanel
    title="图层管理器"
    :initialX="960"
    :initialY="70"
    :width="230"
  >
    <!-- 图层管理器内容 -->
    <div class="layer-manager-content">
      <!-- 批量操作按钮 -->
      <div class="action-buttons">
        <button @click="showAllLayers" class="action-btn show-all">全部显示</button>
        <button @click="hideAllLayers" class="action-btn hide-all">全部隐藏</button>
      </div>
      
      <!-- 图层列表标题栏 -->
      <div class="layer-list-header" @click="toggleExpanded">
        <span class="expand-icon">{{ isExpanded ? '▼' : '►' }}</span>
        <span class="layer-list-title">图层列表</span>
      </div>
      
      <!-- 图层列表 -->
      <div v-if="isExpanded" class="layer-list">
        <div 
          v-for="layer in layers" 
          :key="layer.id" 
          class="layer-item"
          :class="{'layer-visible': layerManager.getLayerVisibility(layer.id)}"
        >
          <label class="layer-label">
            <input 
              type="checkbox" 
              :checked="layerManager.getLayerVisibility(layer.id)" 
              @change="toggleLayerVisibility(layer.id)" 
            />
            <span class="layer-name">{{ layer.name }}</span>
          </label>
        </div>
      </div>
    </div>
  </FloatingPanel>
</template> 

<style lang="scss" scoped>
// 仅保留与图层管理相关的特定样式，移除与FloatingPanel重复的样式

.layer-manager-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.action-buttons {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.action-btn {
  flex: 1;
  padding: 6px 10px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.show-all {
  background: #c0c0c0;
  color: white;
}

.hide-all {
  background: #c0c0c0;
  color: white;
}

.action-btn:hover {
  opacity: 0.9;
}

.layer-list-header {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 8px 4px;
  border-bottom: 1px solid #eee;
  user-select: none;
}

.expand-icon {
  margin-right: 8px;
  font-size: 12px;
}

.layer-list-title {
  font-weight: 500;
  font-size: 13px;
}

.layer-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}

.layer-item {
  padding: 6px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.layer-item:hover {
  background: rgba(0, 0, 0, 0.05);
}

.layer-visible {
  background: rgba(74, 107, 175, 0.1);
}

.layer-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  font-size: 13px;
}

.layer-icon {
  margin: 0 8px;
}

.layer-name {
  flex: 1;
}

/* 暗色模式样式 */
:deep(.dark-mode) {
  .layer-item:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .layer-visible {
    background: rgba(74, 107, 175, 0.2);
  }

  .layer-list-header {
    border-bottom: 1px solid #333;
  }

  .action-btn.show-all {
    background: #2e7d32;
  }

  .action-btn.hide-all {
    background: #c62828;
  }
}
</style>
