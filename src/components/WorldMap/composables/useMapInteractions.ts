import { ref, computed, watch } from 'vue';
import type { Ref } from 'vue';
import { LAYER_IDS } from './useMapCanvas';
import { getMapRect } from './useLayerFactory';
import type { Layer } from './useLayerManager';

/**
 * 地图交互管理器
 * 处理地图的鼠标和键盘交互
 */
export function useMapInteractions(
  canvasContainerRef: Ref<HTMLElement | null>,
  mapData: Ref<any>,
  isDragging: Ref<boolean>,
  dragStartX: Ref<number>,
  dragStartY: Ref<number>,
  offsetX: Ref<number>,
  offsetY: Ref<number>,
  scale: Ref<number>,
  isDrawingConnection: Ref<boolean>,
  connectionStartId: Ref<string>,
  currentLocationId: Ref<string>,
  locationNameInput: Ref<string>,
  locationDescInput: Ref<string>,
  isEditing: Ref<boolean>,
  activeTool: Ref<string>,
  mouseX: Ref<number>,
  mouseY: Ref<number>,
  drawMap: () => void,
  layers: Ref<Map<string, Layer>>,
  toggleLayer: (layerId: string, visible?: boolean) => void
) {
  // 当前鼠标下的位置ID
  const hoveredLocationId = ref<string | null>(null);
  
  // 检查点是否在位置节点上
  function isPointInLocation(x: number, y: number, location: any): boolean {
    const locX = offsetX.value + location.x * scale.value;
    const locY = offsetY.value + location.y * scale.value;
    const radius = location.id === currentLocationId.value ? 6 : 4;
    
    // 计算点到位置中心的距离
    const distance = Math.sqrt(Math.pow(x - locX, 2) + Math.pow(y - locY, 2));
    
    // 如果距离小于半径，说明点在位置内部
    return distance <= radius;
  }
  
  // 查找鼠标位置下的节点
  function findLocationUnderCursor(x: number, y: number): string | null {
    if (!mapData.value || !mapData.value.locations) return null;
    
    // 从后向前查找（顶层优先）
    for (let i = mapData.value.locations.length - 1; i >= 0; i--) {
      const location = mapData.value.locations[i];
      if (isPointInLocation(x, y, location)) {
        return location.id;
      }
    }
    
    return null;
  }
  
  // 检查点是否在地图范围内
  function isPointInMap(x: number, y: number): boolean {
    const mapRect = getMapRect(offsetX.value, offsetY.value, scale.value);
    
    return (
      x >= mapRect.x &&
      x <= mapRect.x + mapRect.width &&
      y >= mapRect.y &&
      y <= mapRect.y + mapRect.height
    );
  }
  
  // 将屏幕坐标转换为地图坐标
  function screenToMapCoords(x: number, y: number): { x: number, y: number } {
    const mapX = Math.round((x - offsetX.value) / scale.value);
    const mapY = Math.round((y - offsetY.value) / scale.value);
    
    return { x: mapX, y: mapY };
  }
  
  // 处理鼠标按下事件
  function handleMouseDown(e: MouseEvent) {
    // 获取鼠标相对于画布容器的坐标
    const rect = canvasContainerRef.value?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // 更新鼠标位置
    mouseX.value = x;
    mouseY.value = y;
    
    // 根据当前工具执行不同操作
    if (activeTool.value === 'select') {
      // 开始拖动
      isDragging.value = true;
      dragStartX.value = x;
      dragStartY.value = y;
      
      // 检查是否点击了位置节点
      const locationId = findLocationUnderCursor(x, y);
      if (locationId) {
        currentLocationId.value = locationId;
        
        // 如果找到位置，加载其详情到编辑器
        const location = mapData.value.locations.find((loc: any) => loc.id === locationId);
        if (location) {
          locationNameInput.value = location.name || '';
          locationDescInput.value = location.description || '';
        }
        
        drawMap();
      }
    } else if (activeTool.value === 'add' && isPointInMap(x, y)) {
      // 添加新位置
      const mapCoords = screenToMapCoords(x, y);
      
      // 生成唯一ID
      const newId = `loc${Date.now()}`;
      
      // 创建新位置
      const newLocation = {
        id: newId,
        name: '新位置',
        x: mapCoords.x,
        y: mapCoords.y,
        connections: []
      };
      
      // 添加到地图数据
      mapData.value.locations.push(newLocation);
      
      // 设置为当前选中位置
      currentLocationId.value = newId;
      locationNameInput.value = newLocation.name;
      locationDescInput.value = '';
      
      // 切换到选择工具
      activeTool.value = 'select';
      
      drawMap();
    } else if (activeTool.value === 'connect') {
      // 连接位置
      const locationId = findLocationUnderCursor(x, y);
      
      if (locationId) {
        if (!isDrawingConnection.value) {
          // 开始绘制连接
          isDrawingConnection.value = true;
          connectionStartId.value = locationId;
        } else {
          // 完成连接
          if (connectionStartId.value !== locationId) {
            // 创建新连接
            const newConnection = {
              id: `conn${Date.now()}`,
              start: connectionStartId.value,
              end: locationId
            };
            
            // 添加到地图数据
            mapData.value.connections.push(newConnection);
            
            // 更新位置的连接列表
            const startLoc = mapData.value.locations.find((loc: any) => loc.id === connectionStartId.value);
            const endLoc = mapData.value.locations.find((loc: any) => loc.id === locationId);
            
            if (startLoc && !startLoc.connections) startLoc.connections = [];
            if (endLoc && !endLoc.connections) endLoc.connections = [];
            
            if (startLoc && !startLoc.connections.includes(locationId)) {
              startLoc.connections.push(locationId);
            }
            
            if (endLoc && !endLoc.connections.includes(connectionStartId.value)) {
              endLoc.connections.push(connectionStartId.value);
            }
          }
          
          // 重置绘制状态
          isDrawingConnection.value = false;
          connectionStartId.value = '';
        }
        
        drawMap();
      }
    } else if (activeTool.value === 'delete') {
      // 删除位置
      const locationId = findLocationUnderCursor(x, y);
      
      if (locationId) {
        // 删除所有相关连接
        mapData.value.connections = mapData.value.connections.filter((conn: any) => {
          return conn.start !== locationId && conn.end !== locationId;
        });
        
        // 从其他位置的连接中移除
        mapData.value.locations.forEach((loc: any) => {
          if (loc.connections) {
            loc.connections = loc.connections.filter((connId: string) => connId !== locationId);
          }
        });
        
        // 删除位置
        mapData.value.locations = mapData.value.locations.filter((loc: any) => loc.id !== locationId);
        
        // 如果删除的是当前选中的位置，重置选中状态
        if (currentLocationId.value === locationId) {
          currentLocationId.value = '';
          locationNameInput.value = '';
          locationDescInput.value = '';
        }
        
        drawMap();
      }
    }
  }
  
  // 绘制激活状态的连接线（正在拖动创建的连接）
  function drawActiveConnection(ctx: CanvasRenderingContext2D, offsetX: number) {
    const startLocation = mapData.value.locations.find((loc: any) => loc.id === connectionStartId.value);
    if (!startLocation || !canvasContainerRef.value) return;
    
    const rect = canvasContainerRef.value.getBoundingClientRect();
    const gridSize = 30;
    
    // 计算鼠标的世界坐标
    const mouseX = (dragStartX.value - rect.left - offsetX) / scale.value;
    const mouseY = (dragStartY.value - rect.top - offsetY.value) / scale.value;
    
    // 确保坐标在有效范围内
    const clampedMouseX = Math.max(0, Math.min(360 * gridSize, mouseX));
    
    ctx.save();
    ctx.translate(offsetX, offsetY.value);
    ctx.scale(scale.value, scale.value);
    
    // 绘制连接线
    ctx.beginPath();
    ctx.strokeStyle = 'var(--accent-secondary, #ff9800)';
    ctx.lineWidth = 2 / scale.value;
    
    // 直接绘制从起点到鼠标位置的连接线
    ctx.moveTo(startLocation.x, startLocation.y);
    ctx.lineTo(clampedMouseX, mouseY);
    
    ctx.stroke();
    ctx.restore();
  }
  
  // 处理鼠标移动事件
  function handleMouseMove(e: MouseEvent) {
    // 获取鼠标相对于画布容器的坐标
    const rect = canvasContainerRef.value?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // 更新鼠标位置
    mouseX.value = x;
    mouseY.value = y;
    
    // 检查鼠标悬停的位置
    hoveredLocationId.value = findLocationUnderCursor(x, y);
    
    // 如果正在拖动
    if (isDragging.value && activeTool.value === 'select') {
      // 计算拖动距离
      const dx = x - dragStartX.value;
      const dy = y - dragStartY.value;
      
      // 更新拖动起点
      dragStartX.value = x;
      dragStartY.value = y;
      
      // 更新地图偏移
      offsetX.value += dx;
      offsetY.value += dy;
      
      drawMap();
    }
    
    // 如果正在绘制连接
    if (isDrawingConnection.value) {
      const connectionLayer = layers.value.get(LAYER_IDS.CONNECTION);
      if (connectionLayer) {
        drawActiveConnection(connectionLayer.ctx, offsetX.value);
      }
      drawMap();
    }
  }
  
  // 处理鼠标抬起事件
  function handleMouseUp(e: MouseEvent) {
    isDragging.value = false;
  }
  
  // 处理鼠标点击事件
  function handleClick(e: MouseEvent) {
    // 此处可以添加特定的点击处理逻辑
  }
  
  // 处理键盘事件
  function handleKeyDown(e: KeyboardEvent) {
    // Escape键取消当前操作
    if (e.key === 'Escape') {
      isDrawingConnection.value = false;
      connectionStartId.value = '';
      activeTool.value = 'select';
      drawMap();
    }
  }
  
  // 处理滚轮事件（缩放）
  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    
    // 获取鼠标相对于画布容器的坐标
    const rect = canvasContainerRef.value?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // 计算缩放前鼠标位置对应的地图坐标
    const mapX = (x - offsetX.value) / scale.value;
    const mapY = (y - offsetY.value) / scale.value;
    
    // 计算缩放量，降低灵敏度
    const delta = -e.deltaY * 0.0002; // 将系数从 0.001 改为 0.0002
    
    // 根据当前缩放级别动态调整缩放步长
    let scaleFactor = 1;
    if (scale.value < 0.2) scaleFactor = 0.2; // 小比例尺时缩放更慢
    else if (scale.value >0.5) scaleFactor = 5; // 大比例尺时缩放更快
    
    const newScale = Math.max(0.05, Math.min(3, scale.value + delta * scaleFactor));
    
    // 应用缩放
    scale.value = newScale;
    
    // 调整偏移，使缩放以鼠标位置为中心
    offsetX.value = x - mapX * scale.value;
    offsetY.value = y - mapY * scale.value;
    
    drawMap();
  }
  
  // 切换图层可见性
  function handleToggleLayer(layerId: string) {
    toggleLayer(layerId);
  }
  
  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleClick,
    handleKeyDown,
    handleWheel,
    handleToggleLayer,
    hoveredLocationId,
    drawActiveConnection
  };
} 