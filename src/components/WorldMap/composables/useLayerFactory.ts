import { ref } from 'vue';
import type { Ref } from 'vue';
import type { Layer, LayerConfig } from './useLayerManager';
import { 
  BACKGROUND_DARK, 
  BACKGROUND_LIGHT,
  MAP_BACKGROUND_DARK,
  MAP_BACKGROUND_LIGHT,
  MAP_BORDER_DARK,
  MAP_BORDER_LIGHT
} from '../constants/colors';

// 创建基础图层
export function createBaseLayer(config: LayerConfig): Layer {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const visible = ref(config.visible !== undefined ? config.visible : true);
  const container = ref<HTMLElement | null>(null);
  const width = ref(0);
  const height = ref(0);
  
  // 初始化图层
  function init(parentElement: HTMLElement, w: number, h: number): void {
    // 设置样式
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'none'; // 默认不接收鼠标事件
    
    // 设置尺寸
    resize(w, h);
    
    // 添加到父元素
    parentElement.appendChild(canvas);
    container.value = parentElement;
    
    // 触发第一次渲染
    render();
  }
  
  // 调整画布大小
  function resize(w: number, h: number): void {
    width.value = w;
    height.value = h;
    canvas.width = w;
    canvas.height = h;
    
    // 修复高DPI屏幕
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);
    
    render();
  }
  
  // 清空画布
  function clear(): void {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  
  // 渲染图层
  function render(): void {
    if (!visible.value) return;
    
    clear();
    // 具体渲染逻辑由子类实现
  }
  
  // 销毁图层
  function destroy(): void {
    if (canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
    }
    container.value = null;
    clear();
  }
  
  return {
    id: config.id,
    name: config.name,
    canvas,
    ctx,
    zIndex: config.zIndex,
    visible,
    container: container.value,
    width: width.value,
    height: height.value,
    isBaseLayer: config.isBaseLayer,
    init,
    resize,
    render,
    clear,
    destroy
  };
}

// 创建底部灰色图层
export function createBackgroundLayer(config: LayerConfig, isDarkMode: Ref<boolean>): Layer {
  const baseLayer = createBaseLayer({
    ...config,
    isBaseLayer: true
  });
  
  // 重写渲染方法
  const originalRender = baseLayer.render;
  baseLayer.render = function (): void {
    if (!baseLayer.visible.value) return;
    
    baseLayer.clear();
    
    // 绘制全屏灰色背景
    baseLayer.ctx.fillStyle = isDarkMode.value ? BACKGROUND_DARK : BACKGROUND_LIGHT;
    baseLayer.ctx.fillRect(0, 0, baseLayer.canvas.width, baseLayer.canvas.height);
  };
  
  return baseLayer;
}

// 创建地图矩形图层
export function createMapLayer(
  config: LayerConfig, 
  isDarkMode: Ref<boolean>,
  offsetX: Ref<number>,
  offsetY: Ref<number>,
  scale: Ref<number>
): Layer {
  const baseLayer = createBaseLayer(config);
  
  // 重写渲染方法
  baseLayer.render = function (): void {
    if (!baseLayer.visible.value) return;
    
    baseLayer.clear();
    
    const ctx = baseLayer.ctx;
    const gridSize = 30;
    
    // 计算地图的总宽度和高度（以像素为单位）
    const mapWidthInPixels = 360 * gridSize;
    const mapHeightInPixels = 180 * gridSize;
    
    // 保存当前变换状态
    ctx.save();
    
    // 应用缩放和平移变换
    ctx.translate(offsetX.value, offsetY.value);
    ctx.scale(scale.value, scale.value);
    
    // 绘制地图背景和边框
    ctx.fillStyle = isDarkMode.value ? MAP_BACKGROUND_DARK : MAP_BACKGROUND_LIGHT;
    ctx.fillRect(0, 0, mapWidthInPixels, mapHeightInPixels);
    
    // 绘制地图边框 - 使用实线边框
    ctx.strokeStyle = isDarkMode.value ? MAP_BORDER_DARK : MAP_BORDER_LIGHT;
    
    // 使用固定线宽值，根据缩放范围调整
    if (scale.value < 0.2) {
      ctx.lineWidth = 1.2; // 缩小状态下使用较粗的边框
    } else if (scale.value < 0.5) {
      ctx.lineWidth = 0.8; // 中等缩放使用中等边框
    } else {
      ctx.lineWidth = 0.5; // 放大状态下使用细边框
    }
    
    ctx.strokeRect(0, 0, mapWidthInPixels, mapHeightInPixels);
    
    // 恢复变换状态
    ctx.restore();
  };
  
  return baseLayer;
}

// 导出辅助函数，用于获取当前地图矩形的位置和大小
export function getMapRect(offsetX: number, offsetY: number, scale: number): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const gridSize = 30;
  const mapWidthInPixels = 360 * gridSize * scale;
  const mapHeightInPixels = 180 * gridSize * scale;
  
  return {
    x: offsetX,
    y: offsetY,
    width: mapWidthInPixels,
    height: mapHeightInPixels
  };
} 