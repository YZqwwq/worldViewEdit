import { ref, computed } from 'vue';
import { useMapStore } from '../../../stores/mapStore';
import type { ViewState } from '../../../types/map';

/**
 * 地图状态管理
 * 包含所有与地图状态相关的响应式变量和方法
 */
export function useMapState(mapStore: ReturnType<typeof useMapStore>, drawMap?: () => void) {
  // 使用 computed 从 store 中获取状态
  const isEditing = computed(() => mapStore.editState.isEditing);
  const isDarkMode = computed(() => mapStore.viewState.isDarkMode);
  const activeTool = computed(() => mapStore.editState.currentTool);
  const offsetX = computed(() => mapStore.viewState.offsetX);
  const offsetY = computed(() => mapStore.viewState.offsetY);
  const scale = computed(() => mapStore.viewState.scale);
  
  // 本地状态
  const isDragging = ref(false);
  const dragStartX = ref(0);
  const dragStartY = ref(0);
  const isDrawingConnection = ref(false);
  const connectionStartId = ref('');
  const mouseX = ref(0);
  const mouseY = ref(0);
  const showCoordinates = ref(true);
  
  // 缩放限制
  const minScale = ref(0.08);
  const maxScale = ref(5);
  
  // 地图范围限制
  const mapLimits = {
    minLatitude: -90,
    maxLatitude: 90,
    minLongitude: -180,
    maxLongitude: 180
  };
  
  // 设置活动工具
  function setActiveTool(tool: 'draw' | 'territory' | 'location' | 'connection' | 'label') {
    mapStore.setCurrentTool(tool);
    isDrawingConnection.value = false;
    connectionStartId.value = '';
    
    if (tool !== 'draw' && isEditing.value) {
      mapStore.setIsEditing(false);
    }
  }
  
  // 切换坐标显示
  function toggleCoordinates() {
    showCoordinates.value = !showCoordinates.value;
    mapStore.updateViewState({ showCoordinates: showCoordinates.value } as Partial<ViewState>);
  }
  
  // 切换暗色/亮色模式
  function toggleDarkMode() {
    mapStore.toggleDarkMode();
  }
  
  // 更新鼠标位置
  function updateMousePosition(x: number, y: number) {
    mouseX.value = x;
    mouseY.value = y;
  }
  
  // 开始拖动
  function startDrag(x: number, y: number) {
    isDragging.value = true;
    dragStartX.value = x;
    dragStartY.value = y;
  }
  
  // 结束拖动
  function endDrag() {
    isDragging.value = false;
  }
  
  // 开始绘制连接
  function startDrawingConnection(id: string) {
    isDrawingConnection.value = true;
    connectionStartId.value = id;
  }
  
  // 结束绘制连接
  function endDrawingConnection() {
    isDrawingConnection.value = false;
    connectionStartId.value = '';
  }
  
  return {
    // 计算属性
    isEditing,
    isDarkMode,
    activeTool,
    offsetX,
    offsetY,
    scale,
    
    // 响应式引用
    isDragging,
    dragStartX,
    dragStartY,
    isDrawingConnection,
    connectionStartId,
    mouseX,
    mouseY,
    showCoordinates,
    minScale,
    maxScale,
    
    // 常量
    mapLimits,
    
    // 方法
    setActiveTool,
    toggleCoordinates,
    toggleDarkMode,
    updateMousePosition,
    startDrag,
    endDrag,
    startDrawingConnection,
    endDrawingConnection
  };
} 