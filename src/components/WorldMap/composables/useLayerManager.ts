import { ref, onMounted, onBeforeUnmount, computed, shallowRef, provide, inject } from 'vue';
import type { Ref } from 'vue';
import type { Layer, LayerConfig } from './useLayerFactory';

// 定义图层管理器上下文的键
export const LAYER_MANAGER_KEY = Symbol('layerManager');

// 声明全局接口扩展
declare global {
  interface Window {
    __layers?: Record<string, Layer>;
    getLayer?: <T extends Layer = Layer>(id: string) => T | null;
  }
}

// 创建图层管理器
export function useLayerManager() {
  const layerMap = shallowRef<Record<string, Layer>>({});
  const parentElement = ref<HTMLElement | null>(null);
  const canvasWidth = ref(0);
  const canvasHeight = ref(0);
  const isInitialized = ref(false);
  
  // 增加图层可见性状态存储
  const layerVisibilityState = ref<Record<string, boolean>>({});
  
  // 添加图层，返回图层引用以方便链式调用
  function addLayer(layer: Layer): Layer {
    const newLayerMap = { ...layerMap.value, [layer.id]: layer };
    layerMap.value = newLayerMap;
    
    // 应用预设的可见性（如果有）
    if (layer.id in layerVisibilityState.value) {
      layer.visible.value = layerVisibilityState.value[layer.id];
    }
    
    // 如果已经初始化，直接初始化图层
    if (isInitialized.value && parentElement.value) {
      layer.init(parentElement.value, canvasWidth.value, canvasHeight.value);
      sortLayers(); // 初始化后再排序
    }
    
    return layer;
  }
  
  // 批量添加图层
  function addLayers(layersToAdd: Layer[]): void {
    const newLayerMap = { ...layerMap.value };
    
    layersToAdd.forEach(layer => {
      // 应用预设的可见性（如果有）
      if (layer.id in layerVisibilityState.value) {
        layer.visible.value = layerVisibilityState.value[layer.id];
      }
      
      newLayerMap[layer.id] = layer;
    });
    
    layerMap.value = newLayerMap;  
    // 如果已经初始化，直接初始化图层
    if (isInitialized.value && parentElement.value) {
      layersToAdd.forEach(layer => {
        layer.init(parentElement.value!, canvasWidth.value, canvasHeight.value);
      });
      sortLayers();
    }
  }
  
  // 获取图层，增加错误处理
  function getLayer<T extends Layer = Layer>(id: string): T | null {
    const layer = layerMap.value[id] as T | undefined;
    if (!layer) {
      console.warn(`图层 ${id} 不存在`);
      return null;
    }
    return layer;
  }
  
  // 移除图层
  function removeLayer(id: string): void {
    const layer = layerMap.value[id];
    if (layer) {
      layer.destroy();
      const newLayerMap = { ...layerMap.value };
      delete newLayerMap[id];
      layerMap.value = newLayerMap;
      
      // 同时清除可见性状态
      const newVisibilityState = { ...layerVisibilityState.value };
      delete newVisibilityState[id];
      layerVisibilityState.value = newVisibilityState;
      
      console.log(`已移除图层 ${id}`);
    } else {
      console.warn(`尝试移除不存在的图层 ${id}`);
    }
  }
  
  // 获取图层可见性
  function getLayerVisibility(id: string): boolean {
    // 如果图层存在，返回图层的实际可见性
    const layer = layerMap.value[id];
    if (layer) {
      return layer.visible.value;
    }
    
    // 否则返回预设的可见性（如果有）
    return layerVisibilityState.value[id] ?? false;
  }
  
  // 显示图层
  function showLayer(id: string): void {
    // 更新可见性状态
    layerVisibilityState.value[id] = true;
    
    const layer = layerMap.value[id];
    if (layer) {
      layer.visible.value = true;
      console.log(`已显示图层 ${id}`);
    } else {
      console.log(`已预设图层 ${id} 为可见（图层尚未创建）`);
    }
  }
  
  // 隐藏图层
  function hideLayer(id: string): void {
    // 更新可见性状态
    layerVisibilityState.value[id] = false;
    
    const layer = layerMap.value[id];
    if (layer) {
      layer.visible.value = false;
      console.log(`已隐藏图层 ${id}`);
    } else {
      console.log(`已预设图层 ${id} 为不可见（图层尚未创建）`);
    }
  }

  // 切换图层可见性
  function toggleLayer(id: string, visible?: boolean): void {
    // 确定要设置的可见性
    if (visible === undefined) {
      // 如果未指定，则取反当前可见性
      visible = !getLayerVisibility(id);
    }
    
    // 更新可见性状态
    layerVisibilityState.value[id] = visible;
    
    // 更新实际图层（如果存在）
    const layer = layerMap.value[id];
    if (layer) {
      layer.visible.value = visible;
      console.log(`已切换图层 ${id} 可见性为 ${visible}`);
    } else {
      console.log(`已预设图层 ${id} 可见性为 ${visible}（图层尚未创建）`);
    }
  }
  
  // 根据zIndex排序图层
  function sortLayers(): void {
    const layerArray = Object.values(layerMap.value);
    
    // 按zIndex排序
    layerArray.sort((a, b) => a.zIndex - b.zIndex);
    
    // 更新DOM中的顺序
    if (parentElement.value) {
      layerArray.forEach(layer => {
        if (layer.canvas.parentNode) {
          parentElement.value?.appendChild(layer.canvas);
        }
      });
    }
    
    console.log(`已完成图层排序，顺序: ${layerArray.map(l => l.id).join(', ')}`);
  }
  
  // 增加批量设置图层可见性
  function setLayersVisibility(config: Record<string, boolean>): void {
    // 更新所有预设状态
    Object.entries(config).forEach(([id, visible]) => {
      layerVisibilityState.value[id] = visible;
      
      // 同时更新实际图层（如果存在）
      const layer = layerMap.value[id];
      if (layer) {
        layer.visible.value = visible;
      }
    });
    
    console.log(`已批量设置图层可见性: ${JSON.stringify(config)}`);
  }
  
  // 增加图层绘制方法
  function renderAll(): void {
    const visibleLayers = Object.values(layerMap.value).filter(layer => layer.visible.value);
    
    visibleLayers.forEach(layer => {
      try {
        layer.render();
      } catch (error) {
        console.error(`图层 ${layer.id} 渲染失败:`, error);
      }
    });
  }
  
  // 增加注册全局事件方法
  function registerGlobalEvents(): void {
    if (!parentElement.value) {
      console.warn('无法注册全局事件：父元素不存在');
      return;
    }
    
    // 监听窗口调整大小
    const handleResize = () => {
      if (!parentElement.value) return;
      const rect = parentElement.value.getBoundingClientRect();
      resizeAll(rect.width, rect.height);
    };
    
    window.addEventListener('resize', handleResize);
    console.log('已注册全局窗口调整大小事件');
    
    // 在组件卸载前移除事件监听
    onBeforeUnmount(() => {
      window.removeEventListener('resize', handleResize);
      console.log('已移除全局窗口调整大小事件');
    });
  }
  
  // 增加图层存在性检查方法
  function hasLayer(id: string): boolean {
    return id in layerMap.value;
  }
  
  // 调整所有图层大小
  function resizeAll(width: number, height: number): void {
    canvasWidth.value = width;
    canvasHeight.value = height;
    
    console.log(`调整所有图层大小为 ${width}x${height}`);
    
    Object.values(layerMap.value).forEach(layer => {
      try {
        layer.resize(width, height);
      } catch (error) {
        console.error(`图层 ${layer.id} 调整大小失败:`, error);
      }
    });
  }
  
  // 修改初始化方法，添加初始化状态标识
  function initLayerManager(element: HTMLElement): void {
    if (!element) {
      console.error('无法初始化图层管理器：元素不存在');
      return;
    }
    
    parentElement.value = element;
    
    // 设置容器样式
    element.style.position = 'relative';
    element.style.overflow = 'hidden';
    
    // 获取容器尺寸
    const rect = element.getBoundingClientRect();
    canvasWidth.value = rect.width;
    canvasHeight.value = rect.height;
    
    const layerCount = Object.keys(layerMap.value).length;
    console.log(`初始化图层管理器，容器大小: ${rect.width}x${rect.height}，图层数量: ${layerCount}`);
    
    // 初始化所有已添加的图层
    Object.values(layerMap.value).forEach(layer => {
      try {
        layer.init(element, canvasWidth.value, canvasHeight.value);
      } catch (error) {
        console.error(`图层 ${layer.id} 初始化失败:`, error);
      }
    });
    
    sortLayers();
    isInitialized.value = true;
    registerGlobalEvents();
    
    // 向全局注册图层访问方法，用于调试
    window.__layers = layerMap.value;
    window.getLayer = getLayer;
    
    console.log('图层管理器初始化完成');
  }
  
  // 销毁所有图层
  function destroyAll(): void {
    // 清空可见性状态
    layerVisibilityState.value = {};
    
    Object.values(layerMap.value).forEach(layer => {
      try {
        layer.destroy();
      } catch (error) {
        console.error(`图层 ${layer.id} 销毁失败:`, error);
      }
    });
    
    layerMap.value = {};
    parentElement.value = null;
    isInitialized.value = false;
    
    console.log('已销毁所有图层');
  }
  
  // 返回图层管理器对象
  const layerManager = {
    // 暴露响应式状态
    layers: computed(() => {
      const map = new Map<string, Layer>();
      const layerEntries = Object.entries(layerMap.value);
      
      layerEntries.forEach(([key, value]) => {
        map.set(key, value);
      });
      
      return map;
    }),
    parentElement,
    canvasWidth,
    canvasHeight,
    isInitialized,
    layerVisibility: computed(() => layerVisibilityState.value),
    
    // 暴露方法
    addLayer,
    addLayers,
    getLayer,
    removeLayer,
    showLayer,
    hideLayer,
    toggleLayer,
    hasLayer,
    getLayerVisibility,
    setLayersVisibility,
    initLayerManager,
    resizeAll,
    renderAll,
    destroyAll,
    getAllLayers: () => Object.values(layerMap.value),
    
    // 增加图层调试方法
    debug: () => {
      console.log('--- 图层管理器调试信息 ---');
      console.log(`初始化状态: ${isInitialized.value ? '已初始化' : '未初始化'}`);
      console.log(`容器: ${parentElement.value ? '存在' : '不存在'}`);
      console.log(`图层数量: ${Object.keys(layerMap.value).length}`);
      console.log(`可见性状态: ${JSON.stringify(layerVisibilityState.value)}`);
      
      return {
        isInitialized: isInitialized.value,
        layerCount: Object.keys(layerMap.value).length,
        layers: Object.keys(layerMap.value),
        canvasSize: { width: canvasWidth.value, height: canvasHeight.value },
        visibilityState: layerVisibilityState.value
      };
    }
  };
  
  // 使用provide提供给子组件
  provide(LAYER_MANAGER_KEY, layerManager);
  
  return layerManager;
}

// 为组件提供使用图层管理器的钩子
export function useLayerManagerContext() {
  const layerManager = inject<ReturnType<typeof useLayerManager>>(LAYER_MANAGER_KEY);
  if (!layerManager) {
    console.error('未找到LayerManager，请确保在父组件中调用了useLayerManager');
    throw new Error('未找到LayerManager，请确保在父组件中调用了useLayerManager');
  }
  return layerManager;
}
