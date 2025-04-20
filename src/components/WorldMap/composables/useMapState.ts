import { ref } from 'vue';

/**
 * 地图状态管理
 * 包含所有与地图状态相关的响应式变量和方法
 */
export function useMapState() {
  // 编辑状态
  const isEditing = ref(false);
  
  // 地图拖动状态
  const isDragging = ref(false);
  const dragStartX = ref(0);
  const dragStartY = ref(0);
  const offsetX = ref(0);
  const offsetY = ref(0);
  
  // 缩放状态
  const scale = ref(0.5); // 默认缩放比例
  const minScale = ref(0.2); // 限制最小缩放值为0.2，对应每格30°
  const maxScale = ref(5);
  
  // 工具栏状态
  const activeTool = ref('select'); // select, add, connect, delete
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
    minLatitude: -90, // 南纬90度
    maxLatitude: 90,  // 北纬90度
    minLongitude: -180, // 西经180度
    maxLongitude: 180   // 东经180度
  };
  
  // 设置活动工具
  function setActiveTool(tool: string) {
    activeTool.value = tool;
    
    // 重置状态
    isDrawingConnection.value = false;
    connectionStartId.value = '';
    
    // 如果切换到其他工具，退出编辑模式
    if (tool !== 'select' && isEditing.value) {
      isEditing.value = false;
    }
  }
  
  // 重置地图视图
  function resetView() {
    scale.value = 0.2; // 设置为0.2，对应每格30度的网格间隔
    offsetX.value = 0;
    offsetY.value = 0;
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
    mapLimits,
    setActiveTool,
    resetView,
    toggleCoordinates,
    toggleDarkMode
  };
} 