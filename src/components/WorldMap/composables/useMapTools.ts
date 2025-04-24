import type { Ref } from 'vue';
import { useMapStore } from '../../../stores/mapStore';

// 定义地图尺寸接口
interface MapDimensions {
  width: number;
  height: number;
  gridSize: number;
}

// 定义位置计算参数接口
interface PositionCalculationParams {
  canvasWidth: number;
  canvasHeight: number;
  mapWidth: number;
  mapHeight: number;
  scale: number;
  verticalOffset?: number;
}

/**
 * 地图工具
 * 提供地图操作工具函数
 */
export function useMapTools(
  canvasRef: Ref<HTMLCanvasElement | null>,
  offsetX: Ref<number>,
  offsetY: Ref<number>,
  scale: Ref<number>,
  drawMap: () => void,
  minScale: number = 0.08,
  maxScale: number = 5.0,
  options: {
    gridSize?: number;
    verticalOffset?: number;
    scaleFactor?: number;
    defaultScale?: number;
  } = {}
) {
  const mapStore = useMapStore();
  
  // 合并默认选项
  const {
    gridSize = 30,
    verticalOffset = -50,
    scaleFactor = 0.9,
    defaultScale = 0.06
  } = options;

  // 计算地图尺寸
  const calculateMapDimensions = (currentScale: number): MapDimensions => {
    return {
      width: 360 * gridSize * currentScale,
      height: 180 * gridSize * currentScale,
      gridSize
    };
  };

  // 计算居中位置
  const calculateCenterPosition = ({
    canvasWidth,
    canvasHeight,
    mapWidth,
    mapHeight,
    scale,
    verticalOffset = 0
  }: PositionCalculationParams) => {
    const x = canvasWidth > mapWidth
      ? (canvasWidth - mapWidth) / 2
      : -(mapWidth - canvasWidth) / 2;
    
    const y = canvasHeight > mapHeight
      ? (canvasHeight - mapHeight) / 2 + verticalOffset
      : -(mapHeight - canvasHeight) / 2 + verticalOffset;
    
    return { x, y };
  };

  // 初始化地图位置
  function initMapPosition() {
    if (!canvasRef.value) {
      console.warn('Canvas reference is not available');
      return;
    }
    
    try {
      const rect = canvasRef.value.getBoundingClientRect();
      const dimensions = calculateMapDimensions(scale.value);
      
      const { x, y } = calculateCenterPosition({
        canvasWidth: rect.width,
        canvasHeight: rect.height,
        mapWidth: dimensions.width,
        mapHeight: dimensions.height,
        scale: scale.value,
        verticalOffset
      });
      
      mapStore.updateViewState({
        offsetX: x,
        offsetY: y
      });
      
      drawMap();
    } catch (error) {
      console.error('Failed to initialize map position:', error);
    }
  }
  
  // 重置视图函数
  function resetView() {
    mapStore.updateViewState({
      scale: 0.2
    });
    initMapPosition();
  }
  
  // 适应视图函数
  function fitWorldView() {
    if (!canvasRef.value) {
      mapStore.updateViewState({
        scale: defaultScale
      });
      return;
    }
    
    try {
      const rect = canvasRef.value.getBoundingClientRect();
      const dimensions = calculateMapDimensions(1); // 使用基础尺寸计算
      
      const scaleX = rect.width / dimensions.width;
      const scaleY = rect.height / dimensions.height;
      
      const newScale = Math.max(
        minScale,
        Math.min(
          maxScale,
          Math.min(scaleX, scaleY) * scaleFactor
        )
      );
      
      mapStore.updateViewState({
        scale: newScale
      });
      
      initMapPosition();
    } catch (error) {
      console.error('Failed to fit world view:', error);
      mapStore.updateViewState({
        scale: defaultScale
      });
    }
  }
  
  return {
    initMapPosition,
    resetView,
    fitWorldView
  };
} 