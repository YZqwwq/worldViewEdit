<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, provide } from 'vue';
import { useRouter } from 'vue-router';
import WorldMapEditor from '../components/WorldMap/components/WorldMapEditor.vue';
import { useMapData } from '../components/WorldMap';
import { useLayerManager, LAYER_MANAGER_KEY } from '../components/WorldMap/composables/useLayerManager';

// 基础设置
const router = useRouter();
const emit = defineEmits(['save']);

// 创建全局唯一的图层管理器实例
const layerManager = useLayerManager();
// 提供给所有子组件
provide(LAYER_MANAGER_KEY, layerManager);
console.log('WorldMapView: 已创建并提供根级图层管理器实例');

// 地图状态
const error = ref<string | null>(null);
const mapEditorRef = ref<InstanceType<typeof WorldMapEditor> | null>(null);

// 获取地图数据
const mapData = useMapData();

// 处理错误
function handleError(errorMsg: string) {
  error.value = errorMsg;
  console.error('地图错误:', errorMsg);
}

// 处理保存
function handleSave(data: any) {
  try {
    // 导出地图数据为JSON
    const mapJson = mapData.exportToJSON();
    
    // 保存到localStorage
    localStorage.setItem('worldMapData', JSON.stringify(mapJson));
    
    // 向父组件发送保存事件
    emit('save', mapJson);
    
  } catch (e) {
    handleError(`保存地图失败: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// 保存地图状态
function saveMapState() {
  handleSave(null);
}

// 返回工具页面
function goBack() {
  const currentId = router.currentRoute.value.query.id;
  router.push({
    path: '/tool',
    query: currentId ? { id: currentId } : {}
  });
}

// 组件挂载
onMounted(async () => {
  try {
    console.log('地图视图组件挂载中...');
    error.value = null; // 清除可能的错误状态
    
    // 检查是否有保存的地图数据
    const savedMapData = localStorage.getItem('worldMapData');
    if (savedMapData) {
      try {
        console.log('加载保存的地图数据');
        const parsedData = JSON.parse(savedMapData);
        mapData.importFromJSON(parsedData);
      } catch (e) {
        console.error('加载保存的地图数据失败:', e);
        handleError(`加载地图数据失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  } catch (e) {
    console.error('组件挂载失败:', e);
    handleError(`组件挂载失败: ${e instanceof Error ? e.message : String(e)}`);
  }
});

// 组件卸载前清理
onBeforeUnmount(() => {
  console.log('地图视图组件卸载中...');
  // 确保清理图层管理器
  if (layerManager) {
    layerManager.destroyAll();
  }
});
</script>

<template>
  <div class="world-map-container" :class="{ 'dark-mode': mapData.getViewState().isDarkMode }">
    <!-- 错误显示 -->
    <div v-if="error" class="error">
      <span>{{ error }}</span>
    </div>
    
    <!-- 地图内容 -->
    <div v-else class="map-content">
      <!-- 使用WorldMapEditor组件 -->
      <WorldMapEditor 
        ref="mapEditorRef"
        @error="handleError"
        @save="handleSave"
      />
    </div>
  </div>
</template>

<style>
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --bg-tertiary: #e8e8e8;
  --bg-hover: #eeeeee;
  --text-primary: #333333;
  --text-secondary: #666666;
  --border-color: #dddddd;
  --accent-primary: #1976d2;
  --accent-secondary: #1565c0;
  --accent-tertiary: #64b5f6;
  --error: #f44336;
  --error-dark: #d32f2f;
}

.dark-mode {
  --bg-primary: #000000;
  --bg-secondary: #222222;
  --bg-tertiary: #333333;
  --bg-hover: #444444;
  --text-primary: #ffffff;
  --text-secondary: #aaaaaa;
  --border-color: #444444;
  --accent-primary: #0066cc;
  --accent-secondary: #0055aa;
  --accent-tertiary: #3388cc;
}
</style>

<style scoped>
.world-map-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: var(--bg-primary);
  overflow: hidden;
}

.map-content {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.error {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 1.2em;
  color: var(--error);
  text-align: center;
  max-width: 80%;
  padding: 20px;
  background-color: rgba(255, 255, 255, 0.9);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.dark-mode .error {
  background-color: rgba(34, 34, 34, 0.9);
}
</style>
