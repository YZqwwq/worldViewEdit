import { ref, computed, Ref, watch, onMounted, onBeforeUnmount, provide } from 'vue';
import { useLayerManager, LAYER_MANAGER_KEY } from './useLayerManager';
import { 
  createBackgroundLayer, 
  createMapLayer, 
  createGridLayer,
  createConnectionLayer,
  createLocationLayer,
  createTerritoryLayer,
  createLabelLayer,
  createCoordinateLayer,
  normalpxMapLayer  // 正确导入 normalpxMapLayer
} from './useLayers';
import { LAYER_IDS } from './useMapCanvas';
import type { Layer } from './useLayerFactory';
import { useMapCacheStore } from '../utils/mapCacheStore';

/**
 * 世界地图图层系统
 * 
 * 该组合式函数对所有地图图层进行集中管理，提供了统一的接口来初始化、更新和控制图层
 * 注意：使用此函数的组件会自动将图层管理器提供给其所有子组件
 */
export function useWorldMapLayers(props: {
  // 要加载的地图ID
  mapId?: string;
  // 是否在初始化时自动创建图层
  autoInit?: boolean;
  // 允许外部传入图层管理器，确保全局只有一个实例
  externalLayerManager?: ReturnType<typeof useLayerManager>;
}) {
  // 默认值
  const defaultMapId = props.mapId || '1';
  const autoInit = props.autoInit !== false;
  
  // 获取图层管理器（优先使用外部传入的实例）
  const layerManager = props.externalLayerManager || useLayerManager();
  
  // 确保图层管理器被正确提供给子组件
  // 不管是使用自己创建的还是外部传入的，都需要在当前组件树中重新provide一次
  provide(LAYER_MANAGER_KEY, layerManager);
  
  if (!props.externalLayerManager) {
    console.log('useWorldMapLayers: 已创建并提供新的图层管理器实例');
  } else {
    console.log('useWorldMapLayers: 使用外部传入的图层管理器实例');
  }
  
  // 图层初始化状态
  const isLayersInitialized = ref(false);
  const isLayersReady = ref(false);
  
  // 存储全局事件清理函数
  let cleanupGlobalEvents: (() => void) | undefined;
  
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
    { id: LAYER_IDS.LOCATION, name: '重要位置', zIndex: 50, visible: true },
    { id: LAYER_IDS.LABEL, name: '标签', zIndex: 60, visible: true },
    { id: LAYER_IDS.COORDINATE, name: '坐标系', zIndex: 70, visible: true }
  ];
  
  // 初始化图层默认可见性
  defaultLayerConfigs.forEach(config => {
    layerManager.toggleLayer(config.id, config.visible);
  });
  
  // 添加全局变量引用
  // 这些变量在初始化图层时会被设置
  let offsetX: Ref<number> = ref(0);
  let offsetY: Ref<number> = ref(0);
  let scale: Ref<number> = ref(1);
  
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
      layerTools?: any;
    }
  ) {
    if (!container) {
      console.error('无法初始化图层：容器不存在');
      return;
    }
    
    // 解构视图属性
    const { 
      isDarkMode, 
      offsetX: viewOffsetX, 
      offsetY: viewOffsetY, 
      scale: viewScale,
      mapData, 
      isDrawingConnection = ref(false),
      connectionStartId = ref(''),
      mouseX = ref(0),
      mouseY = ref(0),
      currentLocationId = ref(''),
    } = viewProps;
    
    console.log('正在初始化世界地图图层系统...');
    
    // 初始化图层管理器
    layerManager.initLayerManager(container);
    
    // 注册全局事件并保存清理函数
    if (typeof layerManager.registerGlobalEvents === 'function') {
      cleanupGlobalEvents = layerManager.registerGlobalEvents();
    }
    
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
        viewOffsetX,
        viewOffsetY,
        viewScale,
        defaultMapId,
      ));
      
      // 势力范围图层
      layers.push(createTerritoryLayer(
        { id: LAYER_IDS.TERRITORY, name: '势力范围', zIndex: 20 },
        mapData,
        viewOffsetX,
        viewOffsetY,
        viewScale
      ));
      
      // 网格图层
      layers.push(createGridLayer(
        { id: LAYER_IDS.GRID, name: '网格', zIndex: 30 },
        isDarkMode,
        viewOffsetX,
        viewOffsetY,
        viewScale
      ));
      
      // 连接线图层
      layers.push(createConnectionLayer(
        { id: LAYER_IDS.CONNECTION, name: '连接线', zIndex: 40 },
        mapData,
        viewOffsetX,
        viewOffsetY,
        viewScale,
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
        viewOffsetX,
        viewOffsetY,
        viewScale,
        currentLocationId
      ));
      
      // 标签图层
      layers.push(createLabelLayer(
        { id: LAYER_IDS.LABEL, name: '标签', zIndex: 60 },
        mapData,
        viewOffsetX,
        viewOffsetY,
        viewScale,
        isDarkMode
      ));
      
      // 坐标系图层
      layers.push(createCoordinateLayer(
        { id: LAYER_IDS.COORDINATE, name: '坐标系', zIndex: 70 },
        isDarkMode,
        viewOffsetX,
        viewOffsetY,
        viewScale
      ));
      
      // 批量添加所有图层
      layerManager.addLayers(layers);
      console.log(`已创建并添加 ${layers.length} 个图层`);
      
      // 更新状态
      isLayersInitialized.value = true;
      
      // 首次渲染所有图层
      setTimeout(() => {
        renderAllLayers();
        isLayersReady.value = true;
        console.log('所有图层初始化完成并已渲染');
      }, 100);
      
      // 保存关键视图属性的引用，供其他方法使用
      offsetX = viewOffsetX;
      offsetY = viewOffsetY;
      scale = viewScale;
      
    } catch (error) {
      console.error('创建图层时出错:', error);
    }
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
   * 渲染单个图层
   * @param id 图层ID
   */
  function renderLayer(id: string) {
    if (!isLayersInitialized.value) {
      console.warn('图层尚未初始化，无法渲染');
      return;
    }
    
    layerManager.renderLayer(id);
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
      // 清理全局事件
      if (cleanupGlobalEvents) {
        cleanupGlobalEvents();
      }
      
      // 只有在我们自己创建的图层管理器时才销毁它
      if (!props.externalLayerManager) {
        layerManager.destroyAll();
      }
      isLayersInitialized.value = false;
      isLayersReady.value = false;
    }
  });
  
  /**
   * 添加动态绘图图层
   * 
   * @param name 图层名称
   * @returns 生成的图层ID
   */
  function addDynamicDrawingLayer(name: string): string {
    console.log('🎯 useWorldMapLayers: 开始添加动态绘图图层', {
      name,
      isLayersInitialized: isLayersInitialized.value
    });
    
    if (!isLayersInitialized.value) {
      throw new Error('图层系统未初始化，无法添加动态图层');
    }
    
    // 创建唯一ID
    const uniqueId = `normalpxMap_${Date.now()}`;
    
    try {
      // 获取图层容器
      const container = layerManager.parentElement.value;
      if (!container) {
        throw new Error('无法获取图层容器');
      }
      
      console.log('🔍 useWorldMapLayers: 图层容器获取成功');
      
      // 获取当前最高zIndex并+1
      const layers = layerManager.getAllLayers();
      const maxZIndex = Math.max(...layers.map(l => l.zIndex), 0);
      const newZIndex = maxZIndex + 10;
      
      console.log('📊 useWorldMapLayers: 图层层级计算', {
        currentLayersCount: layers.length,
        maxZIndex,
        newZIndex
      });
      
      // 创建新图层配置
      const layerConfig = {
        id: uniqueId,
        name: name || `绘图图层 ${uniqueId.substring(uniqueId.length - 4)}`, 
        zIndex: newZIndex
      };
      
      console.log('⚙️ useWorldMapLayers: 准备创建图层', layerConfig);
      
      // 使用normalpxMapLayer创建透明绘图图层
      const newLayer = normalpxMapLayer(
        layerConfig,
        offsetX,
        offsetY,
        scale,
        props.mapId || '1',
        uniqueId
      );
      
      console.log('🎨 useWorldMapLayers: normalpxMapLayer 创建完成');
      
      // 添加到图层管理器
      layerManager.addLayer(newLayer);
      console.log(`✅ useWorldMapLayers: 已创建动态绘图图层: ${name} (${uniqueId})`);
      
      return uniqueId;
    } catch (error) {
      console.error('❌ useWorldMapLayers: 创建动态绘图图层失败:', error);
      throw error;
    }
  }

  /**
   * 移除动态绘图图层
   * 
   * @param layerId 图层ID
   * @returns 是否成功删除
   */
  function removeDynamicDrawingLayer(layerId: string): boolean {
    if (!layerId.startsWith('normalpxMap_')) {
      console.warn('只能删除动态绘图图层 (normalpxMap_)');
      return false;
    }
    
    try {
      // 从图层管理器移除
      layerManager.removeLayer(layerId);
      
      // 从缓存系统清理
      const mapCacheStore = useMapCacheStore();
      if (mapCacheStore.isLayerInitialized(layerId)) {
        // 由于缓存store可能没有removeLayer方法，我们使用安全的方式清理
        try {
          // @ts-ignore - 临时忽略类型检查
          if (typeof mapCacheStore.removeLayer === 'function') {
            // @ts-ignore
            mapCacheStore.removeLayer(layerId);
          } else {
            console.warn('缓存存储没有removeLayer方法，无法清理缓存');
          }
        } catch (e) {
          console.warn('清理缓存失败:', e);
        }
      }
      
      console.log(`已移除动态绘图图层: ${layerId}`);
      return true;
    } catch (error) {
      console.error(`移除动态绘图图层失败: ${layerId}`, error);
      return false;
    }
  }
  
  // 返回接口，确保图层管理器被正确暴露
  return {
    // 图层管理器实例
    layerManager,
    // 状态
    isLayersInitialized,
    isLayersReady,
    // 方法
    initializeLayers,
    renderAllLayers,
    renderLayer,
    resizeAllLayers,
    getLayer,
    // 新增便捷方法
    setLayerVisibility: (id: string, visible: boolean) => {
      layerManager.toggleLayer(id, visible);
      renderLayer(id);
    },
    getLayerVisibility: (id: string) => layerManager.getLayerVisibility(id),
    // 动态图层管理
    addDynamicDrawingLayer,
    removeDynamicDrawingLayer
  };
} 