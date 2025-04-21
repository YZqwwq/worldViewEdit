import { ref } from 'vue';
import type { Store } from 'pinia';
import type { MapState } from '../../../stores/mapStore';

/**
 * 地图状态管理
 * 包含所有与地图状态相关的响应式变量和方法
 */
export function useMapState(mapStore: Store<'map', MapState>, drawMap?: () => void) {
  // 编辑状态
  const isEditing = ref(false);
  
  // 地图拖动状态
  const isDragging = ref(false);
  const dragStartX = ref(0);
  const dragStartY = ref(0);
  
  // 从mapStore中读取保存的位置和缩放比例
  const offsetX = ref(mapStore.position.x);
  const offsetY = ref(mapStore.position.y);
  const scale = ref(mapStore.scale);
  
  // 缩放限制
  const minScale = ref(0.2);
  const maxScale = ref(5);
  
  // 工具栏状态
  const activeTool = ref('select');
  const isDrawingConnection = ref(false);
  const connectionStartId = ref('');
  
  // 当前鼠标坐标
  const mouseX = ref(0);
  const mouseY = ref(0);
  const showCoordinates = ref(true);
  
  // 地图设置
  const isDarkMode = ref(false);
  
  // 地图范围限制
  const mapLimits = {
    minLatitude: -90,
    maxLatitude: 90,
    minLongitude: -180,
    maxLongitude: 180
  };
  
  // 设置活动工具
  function setActiveTool(tool: string) {
    activeTool.value = tool;
    isDrawingConnection.value = false;
    connectionStartId.value = '';
    
    if (tool !== 'select' && isEditing.value) {
      isEditing.value = false;
    }
  }
  
  // 重置地图视图到初始位置（赤道与本初子午线交点）
  function resetView() {
    scale.value = 0.5; // 设置为50%缩放
    offsetX.value = 0;
    offsetY.value = 0;
    // 如果提供了drawMap函数，则调用它重绘地图
    if (drawMap) {
      drawMap();
    }
  }
  
  // 切换坐标显示
  function toggleCoordinates() {
    showCoordinates.value = !showCoordinates.value;
  }
  
  // 切换暗色/亮色模式
  function toggleDarkMode() {
    isDarkMode.value = !isDarkMode.value;
  }
  
  return {
    isEditing,
    isDarkMode,
    activeTool,
    isDrawingConnection,
    connectionStartId,
    offsetX,
    offsetY,
    scale,
    minScale,
    maxScale,
    mouseX,
    mouseY,
    showCoordinates,
    isDragging,
    dragStartX,
    dragStartY,
    setActiveTool,
    toggleCoordinates,
    toggleDarkMode,
    resetView
  };
} 