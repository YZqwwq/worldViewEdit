import type { Ref } from 'vue';

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
  maxScale: number = 5.0
) {
  // 初始化地图位置
  function initMapPosition() {
    if (!canvasRef.value) return;
    
    const rect = canvasRef.value.getBoundingClientRect();
    const gridSize = 30;
    
    // 计算地图中心位置（0,0点应该在画布中心）
    const mapWidthInPixels = 360 * gridSize * scale.value;
    const mapHeightInPixels = 180 * gridSize * scale.value;
    
    // 居中显示地图
    if (rect.width > mapWidthInPixels) {
      // 地图宽度小于画布宽度，水平居中
      offsetX.value = (rect.width - mapWidthInPixels) / 2;
    } else {
      // 地图宽度大于画布宽度，显示中心区域
      offsetX.value = -(mapWidthInPixels - rect.width) / 2;
    }
    
    if (rect.height > mapHeightInPixels) {
      // 地图高度小于画布高度，垂直居中
      offsetY.value = (rect.height - mapHeightInPixels) / 2 - 50;
    } else {
      // 地图高度大于画布高度，显示中心区域
      offsetY.value = -(mapHeightInPixels - rect.height) / 2 - 50;
    }
    
    // 重绘地图
    drawMap();
  }
  
  // 重置视图函数
  function resetView() {
    // 设置为0.2的缩放值，对应每格30°的网格线
    scale.value = 0.2;
   
    // 重置地图位置
    initMapPosition();
  }
  
  // 新增：查看完整世界地图的功能
  function fitWorldView() {
     // 动态计算合适的缩放值，确保能看到完整地图
     if (canvasRef.value) {
      const rect = canvasRef.value.getBoundingClientRect();
      const gridSize = 30;
      
      // 计算最合适的缩放值，使整个地图都能显示
      const mapWidthInPixels = 360 * gridSize;
      const mapHeightInPixels = 180 * gridSize;
      
      // 计算水平和垂直方向上的最佳缩放比例
      const scaleX = rect.width / mapWidthInPixels;
      const scaleY = rect.height / mapHeightInPixels;
      
      // 选择较小的缩放比例，确保地图能完全显示在两个方向上
      scale.value = Math.min(scaleX, scaleY) * 0.9; // 乘以0.9留出一些边距
      
      // 确保不超出缩放范围
      scale.value = Math.max(minScale, Math.min(scale.value, maxScale));
    } else {
      // 如果画布不可用，使用默认的非常小的缩放比例
      scale.value = 0.06;
    }
    
    
    // 重置地图位置（居中显示）
    initMapPosition();
  }
  
  return {
    initMapPosition,
    resetView,
    fitWorldView
  };
} 