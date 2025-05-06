import { ref, computed, onMounted, onBeforeUnmount, watchEffect, provide, inject } from 'vue';
import type { Ref } from 'vue';
import { useLayerManager, LAYER_MANAGER_KEY } from './useLayerManager';
// 引入useWorldMapLayers
import { useWorldMapLayers } from './useWorldMapLayers';

// 图层ID常量
export const LAYER_IDS = {
  BACKGROUND: 'background',  // 底部灰色图层
  MAP: 'map',                // 矩形图层 - 绘制地图地形
  TERRITORY: 'territory',    // 地域交互图层 - 绘制势力范围
  GRID: 'grid',              // 网格图层 - 在矩形图层约束内绘制
  CONNECTION: 'connection',  // 连线图层 - 连接相关势力
  LOCATION: 'location',      // 位置标记图层
  LABEL: 'label',            // 标签图层 - 打标签做描述
  COORDINATE: 'coordinate'   // 经纬度注释图层
};

/**
 * 地图画布管理
 * 负责画布初始化、尺寸调整和多图层绘制控制
 */
export function useMapCanvas(
  isDarkMode: Ref<boolean>,
  offsetX: Ref<number>,
  offsetY: Ref<number>,
  scale: Ref<number>,
  mapData: Ref<any>,
  currentLocationId: Ref<string>,
  canvasContainerRef: Ref<HTMLElement | null>
) {
  // 注入而不是创建LayerManager，指定类型
  const layerManager = inject<ReturnType<typeof useLayerManager>>(LAYER_MANAGER_KEY);
  
  if (!layerManager) {
    console.error('useMapCanvas: 未找到LayerManager，请确保在父组件中调用了provide');
    throw new Error('未找到LayerManager，无法初始化地图画布');
  }
  
  console.log('useMapCanvas: 成功获取已注入的图层管理器实例');
  
  // 使用增强的图层系统，传入注入的layerManager
  const worldMapLayers = useWorldMapLayers({
    mapId: '1', // 可以根据需要从参数中传入
    autoInit: false, // 我们手动控制初始化
    externalLayerManager: layerManager // 传入外部创建的图层管理器
  });
  
  // 计算画布宽高
  const containerWidth = ref(0);
  const containerHeight = ref(0);
  
  // 初始化图层系统
  function initLayers() {
    if (!canvasContainerRef.value) {
      console.error('Canvas容器引用不存在');
      return;
    }
    
    console.log('初始化多图层地图画布系统', canvasContainerRef.value);
    
    // 使用worldMapLayers初始化图层
    worldMapLayers.initializeLayers(canvasContainerRef.value, {
          isDarkMode,
          offsetX,
          offsetY,
          scale,
          mapData,
      isDrawingConnection: ref(false),
      connectionStartId: ref(''),
      mouseX: ref(0),
      mouseY: ref(0),
          currentLocationId
    });
      
      // 调试当前图层状态
    worldMapLayers.layerManager.debug();

    // 全局注册图层管理器，便于调试
    window.layerManager = layerManager as any;
  }
  
  // 初始化画布
  function initCanvas() {
    if (!canvasContainerRef.value) {
      console.error('Canvas容器引用不存在，无法初始化');
      return;
    }
    
    console.log('initCanvas() 正在初始化画布系统');
    
    // 初始化图层
    initLayers();
    
    // 设置容器大小
    const rect = canvasContainerRef.value.getBoundingClientRect();
    containerWidth.value = rect.width;
    containerHeight.value = rect.height;
    
    // 添加窗口尺寸变化监听
    window.addEventListener('resize', handleResize);
    
    // 首次渲染所有图层
    renderAll();
    
    console.log('画布系统初始化完成');
  }
  
  // 处理窗口尺寸变化
  function handleResize() {
    if (!canvasContainerRef.value) {
      console.warn('Canvas容器引用不存在，无法调整大小');
      return;
    }
    
    const rect = canvasContainerRef.value.getBoundingClientRect();
    containerWidth.value = rect.width;
    containerHeight.value = rect.height;
    
    console.log(`调整画布大小: ${rect.width}x${rect.height}`);
    
    // 使用worldMapLayers调整所有图层大小
    worldMapLayers.resizeAllLayers(rect.width, rect.height);
    
    // 重新渲染
    renderAll();
  }
  
  // 清除所有图层
  function clearAll() {
    Object.values(LAYER_IDS).forEach(id => {
      const layer = worldMapLayers.getLayer(id);
      if (layer) {
        layer.clear();
      }
    });
  }
  
  // 渲染所有图层
  function renderAll() {
    worldMapLayers.renderAllLayers();
  }
  
  // 渲染单个图层
  function renderLayer(id: string) {
    worldMapLayers.renderLayer(id);
  }
  
  // 主要绘制方法
  function drawMap() {
    renderAll();
  }
  
  // 销毁和清理
  onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize);
    clearAll();
  });
  
  // 导出接口（保持不变，便于兼容）
  return {
    // 基本信息
    canvasWidth: computed(() => worldMapLayers.layerManager.canvasWidth.value),
    canvasHeight: computed(() => worldMapLayers.layerManager.canvasHeight.value),
    
    // 图层相关
    layers: worldMapLayers.layerManager.layers,
    layerManager: worldMapLayers.layerManager,
    LAYER_IDS,
    
    // 方法
    initCanvas,
    handleResize,
    drawMap,
    renderLayer,
    
    // 工具方法
    getLayer: worldMapLayers.getLayer,
    showLayer: (id: string) => worldMapLayers.setLayerVisibility(id, true),
    hideLayer: (id: string) => worldMapLayers.setLayerVisibility(id, false)
  };
}

// 声明全局接口扩展
declare global {
  interface Window {
    layerManager?: ReturnType<typeof useLayerManager>;
  }
} 