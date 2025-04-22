import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import type { Ref } from 'vue';

export interface Layer {
  id: string;
  name: string;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  zIndex: number;
  visible: Ref<boolean>;
  container: HTMLElement | null;
  width: number;
  height: number;
  isBaseLayer?: boolean;
  init: (parentElement: HTMLElement, width: number, height: number) => void;
  resize: (width: number, height: number) => void;
  render: () => void;
  clear: () => void;
  destroy: () => void;
}

// 图层配置接口
export interface LayerConfig {
  id: string;
  name: string;
  zIndex: number;
  visible?: boolean;
  isBaseLayer?: boolean;
}

// 创建图层管理器
export function useLayerManager() {
  // 使用字符串映射对象而不是 Map
  const layerMap = ref<Record<string, Layer>>({});
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
  
  // 渲染所有图层
  function renderAll(): void {
    Object.values(layerMap.value).forEach(layer => {
      if (layer.visible.value) {
        layer.render();
      }
    });
  }
  
  // 清空所有图层
  function clearAll(): void {
    Object.values(layerMap.value).forEach(layer => {
      layer.clear();
    });
  }
  
  // 初始化图层管理器
  function init(element: HTMLElement): void {
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
  
  return {
    layers,
    parentElement,
    canvasWidth,
    canvasHeight,
    addLayer,
    getLayer,
    removeLayer,
    showLayer,
    hideLayer,
    init,
    resizeAll,
    renderAll,
    clearAll,
    destroyAll
  };
} 