import { ref, onMounted, onBeforeUnmount, computed, shallowRef } from 'vue';
import type { Ref } from 'vue';
import type { Layer, LayerConfig, BaseLayer } from './useLayerFactory';

// 创建图层管理器
export function useLayerManager() {
  // 使用shallowRef而不是ref，避免自动解包嵌套的ref
  const layerMap = shallowRef<Record<string, Layer>>({});
  const parentElement = ref<HTMLElement | null>(null);
  const canvasWidth = ref(0);
  const canvasHeight = ref(0);
  
  // 添加图层
  function addLayer(layer: Layer): void {
    layerMap.value[layer.id] = layer;
    sortLayers();
    
    // 如果已经有父元素，立即初始化
    if (parentElement.value) {
      layer.init(parentElement.value, canvasWidth.value, canvasHeight.value);
    }
  }
  
  // 获取图层
  function getLayer(id: string): Layer | undefined {
    return layerMap.value[id];
  }
  
  // 移除图层
  function removeLayer(id: string): void {
    const layer = layerMap.value[id];
    if (layer) {
      layer.destroy();
      delete layerMap.value[id];
    }
  }
  
  // 显示图层
  function showLayer(id: string): void {
    const layer = layerMap.value[id];
    if (layer) {
      layer.visible.value = true;
    }
  }
  
  // 隐藏图层
  function hideLayer(id: string): void {
    const layer = layerMap.value[id];
    if (layer) {
      layer.visible.value = false;
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
  }
  
  // 初始化图层管理器
  function initLayerManager(element: HTMLElement): void {
    parentElement.value = element;
    
    // 设置容器样式
    element.style.position = 'relative';
    element.style.overflow = 'hidden';
    
    // 获取容器尺寸
    const rect = element.getBoundingClientRect();
    canvasWidth.value = rect.width;
    canvasHeight.value = rect.height;
    
    // 初始化所有已添加的图层
    Object.values(layerMap.value).forEach(layer => {
      layer.init(element, canvasWidth.value, canvasHeight.value);
    });
    
    // 排序图层
    sortLayers();
  }
  
  // 调整所有图层大小
  function resizeAll(width: number, height: number): void {
    canvasWidth.value = width;
    canvasHeight.value = height;
    
    Object.values(layerMap.value).forEach(layer => {
      layer.resize(width, height);
    });
  }
  
  // 销毁所有图层
  function destroyAll(): void {
    Object.values(layerMap.value).forEach(layer => {
      layer.destroy();
    });
    layerMap.value = {};
    parentElement.value = null;
  }
  
  // 在组件卸载前清理
  onBeforeUnmount(() => {
    destroyAll();
  });
  
  // 兼容原有的 Map 接口
  const layers = computed(() => {
    const map = new Map<string, Layer>();
    Object.entries(layerMap.value).forEach(([key, value]) => {
      map.set(key, value);
    });
    return map;
  });
  
  // 获取所有图层
  function getAllLayers(): Layer[] {
    return Object.values(layerMap.value);
  }
  
  return {
    layers,  // 返回图层列表
    parentElement,  // 返回父元素
    canvasWidth,  // 返回画布宽度
    canvasHeight,  // 返回画布高度
    addLayer,  // 添加图层
    getLayer,  // 获取图层
    removeLayer,  // 移除图层
    showLayer,  // 显示图层
    hideLayer,  // 隐藏图层
    initLayerManager,  // 初始化图层管理器
    resizeAll,  // 调整所有图层大小
    destroyAll,  // 销毁所有图层
    getAllLayers
  };
}
