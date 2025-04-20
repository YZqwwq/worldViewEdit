import { ref } from 'vue';
import type { Ref } from 'vue';
import { useMapRenderer } from './useMapRenderer';

/**
 * 地图画布管理
 * 负责画布初始化、尺寸调整和绘制控制
 */
export function useMapCanvas(
  isDarkMode: Ref<boolean>,
  offsetX: Ref<number>,
  offsetY: Ref<number>,
  scale: Ref<number>,
  mapData: Ref<any>,
  currentLocationId: Ref<string>,
  isDrawingConnection: Ref<boolean>,
  connectionStartId: Ref<string>,
  dragStartX: Ref<number>,
  dragStartY: Ref<number>
) {
  // 画布引用
  const canvasRef = ref<HTMLCanvasElement | null>(null);
  const ctxRef = ref<CanvasRenderingContext2D | null>(null);
  
  // 画布尺寸
  const canvasWidth = ref(800);
  const canvasHeight = ref(600);
  
  // 引入渲染器
  const { drawMap: renderMap } = useMapRenderer(
    canvasRef, ctxRef, isDarkMode, offsetX, offsetY, 
    scale, mapData, currentLocationId, isDrawingConnection, 
    connectionStartId, dragStartX, dragStartY
  );
  
  // 初始化画布
  function initCanvas() {
    if (!canvasRef.value) return;
    
    const canvas = canvasRef.value;
    ctxRef.value = canvas.getContext('2d');
    
    // 初次渲染
    drawMap();
  }
  
  // 调整尺寸
  function handleResize() {
    if (!canvasRef.value) return;
    
    const container = canvasRef.value.parentElement;
    if (!container) return;
    
    canvasWidth.value = container.clientWidth;
    canvasHeight.value = container.clientHeight;
    
    canvasRef.value.width = canvasWidth.value;
    canvasRef.value.height = canvasHeight.value;
    
    drawMap();
  }
  
  // 包装绘制函数，提供额外逻辑
  function drawMap() {
    renderMap();
  }
  
  return {
    canvasRef,
    ctxRef,
    canvasWidth,
    canvasHeight,
    drawMap,
    initCanvas,
    handleResize
  };
} 