import { ref, computed, Ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { useLayerManager } from './useLayerManager';
import { 
  createBackgroundLayer, 
  createMapLayer, 
  createGridLayer,
  createConnectionLayer,
  createLocationLayer,
  createTerritoryLayer,
  createLabelLayer,
  createCoordinateLayer
} from './useLayers';
import { LAYER_IDS } from './useMapCanvas';
import type { Layer } from './useLayerFactory';

/**
 * 世界地图图层系统
 * 
 * 该组合式函数对所有地图图层进行集中管理，提供了统一的接口来初始化、更新和控制图层
 */
export function useWorldMapLayers(props: {
  // 要加载的地图ID
  mapId?: string;
  // 是否在初始化时自动创建图层
  autoInit?: boolean;
}) {
  // 默认值
  const defaultMapId = props.mapId || 'default';
  const autoInit = props.autoInit !== false;
  
  // 获取图层管理器
  const layerManager = useLayerManager();
  
  // 图层初始化状态
  const isLayersInitialized = ref(false);
  const isLayersReady = ref(false);
  
  // 记录当前可见性状态
  const layerVisibility = ref<Record<string, boolean>>({});
  
  // 图层配置
  interface LayerConfig {
    id: string;
    name: string;
    zIndex: number;
    visible: boolean;
  }
  
  // 默认图层配置
  const defaultLayerConfigs: LayerConfig[] = [
    { id: LAYER_IDS.BACKGROUND, name: '背景', zIndex: 1, visible: true },
    { id: LAYER_IDS.MAP, name: '地图', zIndex: 10, visible: true },
    { id: LAYER_IDS.TERRITORY, name: '势力范围', zIndex: 20, visible: true },
    { id: LAYER_IDS.GRID, name: '网格', zIndex: 30, visible: true },
    { id: LAYER_IDS.CONNECTION, name: '连接线', zIndex: 40, visible: true },
    { id: LAYER_IDS.LOCATION, name: '位置', zIndex: 50, visible: true },
    { id: LAYER_IDS.LABEL, name: '标签', zIndex: 60, visible: true },
    { id: LAYER_IDS.COORDINATE, name: '坐标系', zIndex: 70, visible: true }
  ];
  
  // 初始化图层可见性
  defaultLayerConfigs.forEach(config => {
    layerVisibility.value[config.id] = config.visible;
  });
  
  /**
   * 创建并初始化所有图层
   * 
   * @param container DOM容器元素
   * @param viewProps 视图属性
   */
  function initializeLayers(
    container: HTMLElement,
    viewProps: {
      isDarkMode: Ref<boolean>;
      offsetX: Ref<number>;
      offsetY: Ref<number>;
      scale: Ref<number>;
      mapData: Ref<any>;
      isDrawingConnection?: Ref<boolean>;
      connectionStartId?: Ref<string>;
      mouseX?: Ref<number>;
      mouseY?: Ref<number>;
      currentLocationId?: Ref<string>;
    }
  ) {
    if (!container) {
      console.error('无法初始化图层：容器不存在');
      return;
    }
    
    // 解构视图属性
    const { 
      isDarkMode, 
      offsetX, 
      offsetY, 
      scale,
      mapData, 
      isDrawingConnection = ref(false),
      connectionStartId = ref(''),
      mouseX = ref(0),
      mouseY = ref(0),
      currentLocationId = ref('') 
    } = viewProps;
    
    console.log('正在初始化世界地图图层系统...');
    
    // 初始化图层管理器
    layerManager.initLayerManager(container);
    
    try {
      // 批量创建所有图层
      const layers: Layer[] = [];
      
      // 背景图层
      layers.push(createBackgroundLayer(
        { id: LAYER_IDS.BACKGROUND, name: '背景', zIndex: 1, isBaseLayer: true },
        isDarkMode
      ));
      
      // 地图图层
      layers.push(createMapLayer(
        { id: LAYER_IDS.MAP, name: '地图', zIndex: 10 },
        isDarkMode,
        offsetX,
        offsetY,
        scale,
        defaultMapId
      ));
      
      // 势力范围图层
      layers.push(createTerritoryLayer(
        { id: LAYER_IDS.TERRITORY, name: '势力范围', zIndex: 20 },
        mapData,
        offsetX,
        offsetY,
        scale
      ));
      
      // 网格图层
      layers.push(createGridLayer(
        { id: LAYER_IDS.GRID, name: '网格', zIndex: 30 },
        isDarkMode,
        offsetX,
        offsetY,
        scale
      ));
      
      // 连接线图层
      layers.push(createConnectionLayer(
        { id: LAYER_IDS.CONNECTION, name: '连接线', zIndex: 40 },
        mapData,
        offsetX,
        offsetY,
        scale,
        isDrawingConnection,
        connectionStartId,
        mouseX,
        mouseY,
        currentLocationId
      ));
      
      // 位置图层
      layers.push(createLocationLayer(
        { id: LAYER_IDS.LOCATION, name: '位置', zIndex: 50 },
        mapData,
        offsetX,
        offsetY,
        scale,
        currentLocationId
      ));
      
      // 标签图层
      layers.push(createLabelLayer(
        { id: LAYER_IDS.LABEL, name: '标签', zIndex: 60 },
        mapData,
        offsetX,
        offsetY,
        scale,
        isDarkMode
      ));
      
      // 坐标系图层
      layers.push(createCoordinateLayer(
        { id: LAYER_IDS.COORDINATE, name: '坐标系', zIndex: 70 },
        isDarkMode,
        offsetX,
        offsetY,
        scale
      ));
      
      // 批量添加所有图层
      layerManager.addLayers(layers);
      console.log(`已创建并添加 ${layers.length} 个图层`);
      
      // 应用初始可见性
      Object.entries(layerVisibility.value).forEach(([id, visible]) => {
        layerManager.toggleLayer(id, visible);
      });
      
      // 更新状态
      isLayersInitialized.value = true;
      
      // 首次渲染所有图层
      setTimeout(() => {
        renderAllLayers();
        isLayersReady.value = true;
        console.log('所有图层初始化完成并已渲染');
      }, 100);
      
    } catch (error) {
      console.error('创建图层时出错:', error);
    }
  }
  
  /**
   * 设置图层可见性
   * 
   * @param id 图层ID
   * @param visible 是否可见
   */
  function setLayerVisibility(id: string, visible: boolean) {
    // 更新本地状态
    layerVisibility.value[id] = visible;
    
    // 应用到图层
    if (isLayersInitialized.value) {
      layerManager.toggleLayer(id, visible);
    }
  }
  
  /**
   * 获取图层可见性
   * 
   * @param id 图层ID
   * @returns 图层是否可见
   */
  function getLayerVisibility(id: string): boolean {
    // 优先使用图层管理器中的状态
    if (isLayersInitialized.value) {
      const layer = layerManager.getLayer(id);
      if (layer) {
        return layer.visible.value;
      }
    }
    
    // 回退到本地状态
    return layerVisibility.value[id] || false;
  }
  
  /**
   * 切换图层可见性
   * 
   * @param id 图层ID
   */
  function toggleLayerVisibility(id: string) {
    const currentVisibility = getLayerVisibility(id);
    setLayerVisibility(id, !currentVisibility);
  }
  
  /**
   * 渲染所有图层
   */
  function renderAllLayers() {
    if (!isLayersInitialized.value) {
      console.warn('图层尚未初始化，无法渲染');
      return;
    }
    
    layerManager.renderAll();
  }
  
  /**
   * 调整所有图层大小
   * 
   * @param width 新宽度
   * @param height 新高度
   */
  function resizeAllLayers(width?: number, height?: number) {
    if (!isLayersInitialized.value) return;
    
    // 如果未指定尺寸，尝试从容器获取
    if (!width || !height) {
      const container = layerManager.parentElement.value;
      if (container) {
        const rect = container.getBoundingClientRect();
        width = rect.width;
        height = rect.height;
      } else {
        console.warn('无法确定大小，图层调整大小失败');
        return;
      }
    }
    
    layerManager.resizeAll(width, height);
    renderAllLayers();
  }
  
  /**
   * 获取指定图层
   * 
   * @param id 图层ID
   * @returns 图层对象
   */
  function getLayer<T extends Layer = Layer>(id: string): T | null {
    return layerManager.getLayer<T>(id);
  }
  
  // 在组件挂载时自动初始化
  onMounted(() => {
    if (autoInit) {
      console.log('autoInit 已开启，但需要调用 initializeLayers 手动初始化图层');
    }
  });
  
  // 销毁图层
  onBeforeUnmount(() => {
    if (isLayersInitialized.value) {
      layerManager.destroyAll();
      isLayersInitialized.value = false;
      isLayersReady.value = false;
    }
  });
  
  // 返回接口
  return {
    // 状态
    isLayersInitialized,
    isLayersReady,
    layerVisibility: computed(() => layerVisibility.value),
    
    // 底层图层管理器
    layerManager,
    LAYER_IDS,
    
    // 核心方法
    initializeLayers,
    renderAllLayers,
    resizeAllLayers,
    
    // 图层操作
    getLayer,
    setLayerVisibility,
    getLayerVisibility, 
    toggleLayerVisibility,
    
    // 图层配置
    layerConfigs: defaultLayerConfigs
  };
} 