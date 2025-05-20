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

// 控制预设图层列表的展开/折叠
const isDefaultExpanded = ref(true);

// 控制动态图层列表的展开/折叠
const isDynamicExpanded = ref(true);

// 控制添加图层对话框显示状态
const showAddLayerDialog = ref(false);
const newLayerName = ref('新图层');

// 预设图层列表配置
const defaultLayers = [
  { id: LAYER_IDS.MAP, name: '地图绘制' },
  { id: LAYER_IDS.TERRITORY, name: '势力范围' },
  { id: LAYER_IDS.GRID, name: '网格' },
  { id: LAYER_IDS.CONNECTION, name: '连接线' },
  { id: LAYER_IDS.LOCATION, name: '重要位置' },
  { id: LAYER_IDS.LABEL, name: '标签' },
  { id: LAYER_IDS.COORDINATE, name: '坐标系' }
];

// 动态图层列表
const dynamicLayers = ref<{ id: string; name: string }[]>([
  // 初始为空，将通过添加图层功能填充
]);

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

// 切换默认列表展开状态
function toggleDefaultExpanded() {
  isDefaultExpanded.value = !isDefaultExpanded.value;
}

// 切换动态列表展开状态
function toggleDynamicExpanded() {
  isDynamicExpanded.value = !isDynamicExpanded.value;
}

// 打开添加图层对话框
function openAddLayerDialog() {
  newLayerName.value = `图层 ${dynamicLayers.value.length + 1}`;
  showAddLayerDialog.value = true;
}

// 关闭添加图层对话框
function closeAddLayerDialog() {
  showAddLayerDialog.value = false;
}

// 添加新图层
function addNewLayer() {
  // 这里先占位，实际添加图层逻辑会在后续实现
  if (newLayerName.value.trim()) {
    const newLayerId = `normalpxMap_${Date.now()}`;
    dynamicLayers.value.push({
      id: newLayerId,
      name: newLayerName.value
    });
    // 关闭对话框
    closeAddLayerDialog();
  }
}

// 删除图层
function deleteLayer(layerId: string) {
  // 这里先占位，实际删除图层逻辑会在后续实现
  dynamicLayers.value = dynamicLayers.value.filter(layer => layer.id !== layerId);
}

// 设置所有预设图层可见性
function setAllDefaultLayersVisibility(visible: boolean) {
  // 准备批量更新配置
  const visibilityConfig: Record<string, boolean> = {};
  
  defaultLayers.forEach(layer => {
    // 跳过背景图层，始终保持可见
    if (layer.id !== LAYER_IDS.BACKGROUND) {
      visibilityConfig[layer.id] = visible;
    }
  });
  
  // 使用图层管理器的批量设置方法
  layerManager.setLayersVisibility(visibilityConfig);
  
  // 如果有画布引用，重新渲染画布
  if (props.mapCanvasRef) {
    try {
      props.mapCanvasRef.drawMap();
    } catch (e) {
      console.warn('更新画布显示失败', e);
    }
  }
}

// 设置所有动态图层可见性
function setAllDynamicLayersVisibility(visible: boolean) {
  // 准备批量更新配置
  const visibilityConfig: Record<string, boolean> = {};
  
  dynamicLayers.value.forEach(layer => {
    visibilityConfig[layer.id] = visible;
  });
  
  // 使用图层管理器的批量设置方法
  layerManager.setLayersVisibility(visibilityConfig);
  
  // 如果有画布引用，重新渲染画布
  if (props.mapCanvasRef) {
    try {
      props.mapCanvasRef.drawMap();
    } catch (e) {
      console.warn('更新画布显示失败', e);
    }
  }
}

// 显示所有预设图层
function showAllDefaultLayers() {
  setAllDefaultLayersVisibility(true);
}

// 隐藏所有预设图层
function hideAllDefaultLayers() {
  setAllDefaultLayersVisibility(false);
}

// 显示所有动态图层
function showAllDynamicLayers() {
  setAllDynamicLayersVisibility(true);
}

// 隐藏所有动态图层
function hideAllDynamicLayers() {
  setAllDynamicLayersVisibility(false);
}
</script>

<template>
  <!-- 使用FloatingPanel作为容器 -->
  <FloatingPanel
    title="图层管理器"
    :initialX="960"
    :initialY="70"
    :width="250"
  >
    <!-- 图层管理器内容 -->
    <div class="layer-manager-content">
      <!-- 预设图层部分 -->
      <div class="layer-section">
        <!-- 预设图层列表标题栏 -->
        <div class="layer-list-header" @click="toggleDefaultExpanded">
          <span class="expand-icon">{{ isDefaultExpanded ? '▼' : '►' }}</span>
          <span class="layer-list-title">预设图层</span>
        </div>
        
        <div v-if="isDefaultExpanded">
          <!-- 批量操作按钮 -->
          <div class="action-buttons">
            <button @click="showAllDefaultLayers" class="action-btn show-all">全部显示</button>
            <button @click="hideAllDefaultLayers" class="action-btn hide-all">全部隐藏</button>
          </div>
          
          <!-- 图层列表 -->
          <div class="layer-list">
            <div 
              v-for="layer in defaultLayers" 
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
      </div>
      
      <!-- 动态图层部分 -->
      <div class="layer-section">
        <!-- 动态图层列表标题栏 -->
        <div class="layer-list-header" @click="toggleDynamicExpanded">
          <span class="expand-icon">{{ isDynamicExpanded ? '▼' : '►' }}</span>
          <span class="layer-list-title">动态绘图图层</span>
        </div>
        
        <div v-if="isDynamicExpanded">
          <!-- 添加新图层按钮 -->
          <div class="add-layer-row">
            <button @click="openAddLayerDialog" class="add-layer-btn">
              <i class="fas fa-plus"></i> 添加新绘图图层
            </button>
          </div>
          
          <!-- 批量操作按钮 -->
          <div class="action-buttons" v-if="dynamicLayers.length > 0">
            <button @click="showAllDynamicLayers" class="action-btn show-all">全部显示</button>
            <button @click="hideAllDynamicLayers" class="action-btn hide-all">全部隐藏</button>
          </div>
          
          <!-- 动态图层列表 -->
          <div class="layer-list" v-if="dynamicLayers.length > 0">
            <div 
              v-for="layer in dynamicLayers" 
              :key="layer.id" 
              class="layer-item"
              :class="{'layer-visible': layerManager.getLayerVisibility(layer.id)}"
            >
              <div class="layer-item-wrapper">
                <label class="layer-label">
                  <input 
                    type="checkbox" 
                    :checked="layerManager.getLayerVisibility(layer.id)" 
                    @change="toggleLayerVisibility(layer.id)" 
                  />
                  <span class="layer-name">{{ layer.name }}</span>
                </label>
                <div class="layer-actions">
                  <button @click="deleteLayer(layer.id)" class="action-icon delete-layer">
                    <i class="fas fa-trash-alt"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 无动态图层时的提示 -->
          <div class="no-layers-message" v-else>
            <p>暂无动态图层</p>
            <p>点击上方按钮添加</p>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 添加图层对话框 -->
    <div class="add-layer-dialog" v-if="showAddLayerDialog">
      <div class="dialog-overlay" @click="closeAddLayerDialog"></div>
      <div class="dialog-content">
        <h3>添加新绘图图层</h3>
        <div class="form-group">
          <label for="layer-name">图层名称:</label>
          <input 
            type="text" 
            id="layer-name" 
            v-model="newLayerName" 
            @keyup.enter="addNewLayer"
            ref="layerNameInput"
          />
        </div>
        <div class="dialog-actions">
          <button @click="closeAddLayerDialog" class="btn-cancel">取消</button>
          <button @click="addNewLayer" class="btn-confirm">添加</button>
        </div>
      </div>
    </div>
  </FloatingPanel>
</template> 

<style lang="scss" scoped>
// 基础样式
.layer-manager-content {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

// 图层部分
.layer-section {
  display: flex;
  flex-direction: column;
  border: 1px solid #eee;
  border-radius: 6px;
  overflow: hidden;
}

// 操作按钮
.action-buttons {
  display: flex;
  gap: 8px;
  margin: 8px;
}

.action-btn {
  flex: 1;
  padding: 6px 10px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  background: #e0e0e0;
  color: #333;
}

.action-btn:hover {
  opacity: 0.9;
}

.show-all {
  background: #4caf50;
  color: white;
}

.hide-all {
  background: #f44336;
  color: white;
}

// 列表标题栏
.layer-list-header {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 10px;
  background: #f5f5f5;
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

// 图层列表
.layer-list {
  display: flex;
  flex-direction: column;
  margin: 8px;
}

.layer-item {
  padding: 6px 8px;
  border-radius: 4px;
  transition: all 0.2s;
  margin-bottom: 4px;
}

.layer-item:hover {
  background: rgba(0, 0, 0, 0.05);
}

.layer-visible {
  background: rgba(74, 107, 175, 0.1);
}

.layer-item-wrapper {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.layer-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  font-size: 13px;
  flex: 1;
}

.layer-name {
  margin-left: 8px;
}

// 图层操作按钮
.layer-actions {
  display: flex;
  gap: 4px;
}

.action-icon {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 3px;
  color: #666;
  font-size: 12px;
  transition: all 0.2s;
}

.action-icon:hover {
  background: rgba(0, 0, 0, 0.1);
}

.delete-layer:hover {
  color: #f44336;
}

// 添加图层按钮
.add-layer-row {
  padding: 8px;
}

.add-layer-btn {
  width: 100%;
  padding: 8px;
  background: #4a6daf;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s;
}

.add-layer-btn:hover {
  background: #3a5d9f;
}

// 无图层提示
.no-layers-message {
  text-align: center;
  padding: 15px 10px;
  color: #888;
  font-size: 12px;
  
  p {
    margin: 4px 0;
  }
}

// 添加图层对话框
.add-layer-dialog {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dialog-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
}

.dialog-content {
  background: white;
  border-radius: 8px;
  padding: 20px;
  width: 300px;
  z-index: 1;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2);
  
  h3 {
    margin-top: 0;
    margin-bottom: 15px;
    font-size: 16px;
  }
}

.form-group {
  margin-bottom: 15px;
  
  label {
    display: block;
    margin-bottom: 5px;
    font-size: 13px;
  }
  
  input {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 13px;
  }
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  
  button {
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    border: none;
    transition: all 0.2s;
  }
  
  .btn-cancel {
    background: #eee;
    color: #333;
  }
  
  .btn-confirm {
    background: #4a6daf;
    color: white;
  }
  
  button:hover {
    opacity: 0.9;
  }
}

/* 暗色模式样式 */
:deep(.dark-mode) {
  .layer-section {
    border-color: #333;
  }

  .layer-list-header {
    background: #2a2a2a;
    border-bottom: 1px solid #333;
  }

  .layer-item:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .layer-visible {
    background: rgba(74, 107, 175, 0.2);
  }

  .action-btn {
    background: #444;
    color: #ddd;
  }

  .show-all {
    background: #2e7d32;
  }

  .hide-all {
    background: #c62828;
  }
  
  .action-icon {
    color: #aaa;
  }
  
  .action-icon:hover {
    background: rgba(255, 255, 255, 0.15);
  }
  
  .no-layers-message {
    color: #aaa;
  }
  
  .add-layer-btn {
    background: #3a5d9f;
  }
  
  .add-layer-btn:hover {
    background: #2a4d8f;
  }
  
  .dialog-content {
    background: #222;
    color: #eee;
  }
  
  .form-group input {
    background: #333;
    border-color: #444;
    color: #eee;
  }
  
  .btn-cancel {
    background: #444;
    color: #eee;
  }
}
</style>
