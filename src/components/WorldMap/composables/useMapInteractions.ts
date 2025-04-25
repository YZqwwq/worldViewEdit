import { ref, computed, watch } from 'vue';
import type { Ref } from 'vue';
import { LAYER_IDS } from './useMapCanvas';
import { getMapRect } from './useLayerFactory';
import { useMapData } from './useMapData';
import type { Layer } from './useLayerManager';

/**
 * 地图交互管理器
 * 处理地图的鼠标和键盘交互
 */
export function useMapInteractions(
  canvasContainerRef: Ref<HTMLElement | null>,
  isDragging: Ref<boolean>,
  dragStartX: Ref<number>,
  dragStartY: Ref<number>,
  isDrawingConnection: Ref<boolean>,
  connectionStartId: Ref<string>,
  currentLocationId: Ref<string>,
  locationNameInput: Ref<string>,
  locationDescInput: Ref<string>,
  isEditing: Ref<boolean>,
  mouseX: Ref<number>,
  mouseY: Ref<number>,
  drawMap: () => void,
  layers: Ref<Map<string, Layer>>,
  toggleLayer: (layerId: string, visible?: boolean) => void
) {
  // 获取地图数据
  const mapData = useMapData();
  
  // 当前鼠标下的位置ID
  const hoveredLocationId = ref<string | null>(null);
  
  // 检查点是否在位置节点上
  function isPointInLocation(x: number, y: number, location: any): boolean {
    // 确保location对象存在且包含必要属性
    if (!location || !location.position || location.position.offsetX === undefined || location.position.offsetY === undefined) {
      return false;
    }
    
    const viewState = mapData.getViewState();
    const locX = viewState.offsetX + location.position.offsetX * viewState.scale;
    const locY = viewState.offsetY + location.position.offsetY * viewState.scale;
    const radius = location.id === currentLocationId.value ? 6 : 4;
    
    // 计算点到位置中心的距离
    const distance = Math.sqrt(Math.pow(x - locX, 2) + Math.pow(y - locY, 2));
    
    // 如果距离小于半径，说明点在位置内部
    return distance <= radius;
  }
  
  // 查找鼠标位置下的节点
  function findLocationUnderCursor(x: number, y: number): string | null {
    const locations = mapData.getLocations();
    if (!locations || locations.length === 0) return null;
    
    // 从后向前查找（顶层优先）
    for (let i = locations.length - 1; i >= 0; i--) {
      const location = locations[i];
      if (!location || !location.id) continue; // 跳过无效的位置
      
      if (isPointInLocation(x, y, location)) {
        return location.id;
      }
    }
    
    return null;
  }
  
  // 检查点是否在地图范围内
  function isPointInMap(x: number, y: number): boolean {
    const viewState = mapData.getViewState();
    const mapRect = getMapRect(viewState.offsetX, viewState.offsetY, viewState.scale);
    
    return (
      x >= mapRect.x &&
      x <= mapRect.x + mapRect.width &&
      y >= mapRect.y &&
      y <= mapRect.y + mapRect.height
    );
  }
  
  // 将屏幕坐标转换为地图坐标
  function screenToMapCoords(x: number, y: number): { offsetX: number, offsetY: number } {
    const viewState = mapData.getViewState();
    const mapX = Math.round((x - viewState.offsetX) / viewState.scale);
    const mapY = Math.round((y - viewState.offsetY) / viewState.scale);
    
    return { offsetX: mapX, offsetY: mapY };
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
    
    // 获取当前工具
    // 编辑状态不存在时退出
    const editState = mapData.getEditState();
    if (!editState) return; 
    
    const currentTool = editState.currentTool;
    
    // 根据当前工具执行不同操作
    if (currentTool === 'draw') {
      // 开始拖动
      isDragging.value = true;
      dragStartX.value = x;
      dragStartY.value = y;
      
      // 检查是否点击了位置节点
      const locationId = findLocationUnderCursor(x, y);
      if (locationId) {
        currentLocationId.value = locationId;
        
        // 如果找到位置，加载其详情到编辑器
        const location = mapData.getLocation(locationId);
        if (location) {
          locationNameInput.value = location.name || '';
          locationDescInput.value = location.description || '';
        }
        
        drawMap();
      }
    } else if (currentTool === 'location' && isPointInMap(x, y)) {
      // 添加新位置
      const mapCoords = screenToMapCoords(x, y);
      
      // 生成唯一ID
      const newId = `loc${Date.now()}`;
      
      // 创建新位置
      const newLocation = {
        id: newId,
        name: '新位置',
        type: 'default',
        importance: 'normal',
        position: {
          offsetX: mapCoords.offsetX,
          offsetY: mapCoords.offsetY
        },
        description: '',
        territories: [],
        isVisible: true,
        displayPriority: 1,
        connections: []
      };
      
      // 添加到地图数据
      const locations = mapData.getLocations() || [];
      const locationsMap = new Map(locations.filter(loc => loc && loc.id).map(loc => [loc.id, loc]));
      locationsMap.set(newId, newLocation);
      
      // 更新数据
      mapData.updateMapData({ locations: locationsMap });
      
      // 设置为当前选中位置
      currentLocationId.value = newId;
      locationNameInput.value = newLocation.name;
      locationDescInput.value = '';
      
      // 切换到绘图工具
      if (editState) {
        mapData.updateMapData({
          editState: {
            ...editState,
            currentTool: 'draw'
          }
        });
      }
      
      drawMap();
    } else if (currentTool === 'connection') {
      // 连接位置
      const locationId = findLocationUnderCursor(x, y);
      
      if (locationId) {
        if (!isDrawingConnection.value) {
          // 开始绘制连接
          isDrawingConnection.value = true;
          connectionStartId.value = locationId;
        } else if (connectionStartId.value && connectionStartId.value !== locationId) {
          // 完成连接 - 确保起始ID存在且不等于终点ID
          // 创建新连接
          const newConnectionId = `conn${Date.now()}`;
          const newConnection = {
            id: newConnectionId,
            start: connectionStartId.value,
            end: locationId,
            type: 'road',
            weight: {
              value: 1,
              description: '普通道路'
            },
            description: '',
            isVisible: true
          };
          
          // 添加到地图数据
          const connections = mapData.getConnections() || [];
          const connectionsMap = new Map(connections.filter(conn => conn && conn.id).map(conn => [conn.id, conn]));
          connectionsMap.set(newConnectionId, newConnection);
          
          // 更新数据
          mapData.updateMapData({ connections: connectionsMap });
          
          // 更新位置的连接列表
          const startLoc = mapData.getLocation(connectionStartId.value);
          const endLoc = mapData.getLocation(locationId);
          
          if (startLoc && endLoc) {
            // 创建新的位置对象以更新连接
            const updatedStartLoc = { ...startLoc };
            const updatedEndLoc = { ...endLoc };
            
            // 确保连接数组存在
            if (!updatedStartLoc.connections) updatedStartLoc.connections = [];
            if (!updatedEndLoc.connections) updatedEndLoc.connections = [];
            
            // 添加连接（如果不存在）
            if (!updatedStartLoc.connections.includes(locationId)) {
              updatedStartLoc.connections.push(locationId);
            }
            
            if (!updatedEndLoc.connections.includes(connectionStartId.value)) {
              updatedEndLoc.connections.push(connectionStartId.value);
            }
            
            // 更新位置数据
            const locations = mapData.getLocations() || [];
            const locationsMap = new Map(locations.filter(loc => loc && loc.id).map(loc => [loc.id, loc]));
            
            if (startLoc.id) locationsMap.set(startLoc.id, updatedStartLoc);
            if (endLoc.id) locationsMap.set(endLoc.id, updatedEndLoc);
            
            mapData.updateMapData({ locations: locationsMap });
          }
          
          // 重置绘制状态
          isDrawingConnection.value = false;
          connectionStartId.value = '';
          
          drawMap();
        }
      }
    } else if (currentTool === 'territory') {
      // 删除位置
      const locationId = findLocationUnderCursor(x, y);
      
      if (locationId) {
        // 获取当前连接和位置
        const connections = mapData.getConnections() || [];
        const locations = mapData.getLocations() || [];
        
        // 创建新的连接映射（排除与要删除位置相关的连接）
        const updatedConnectionsMap = new Map();
        connections.forEach(conn => {
          if (conn && conn.id && conn.start && conn.end && 
              conn.start !== locationId && conn.end !== locationId) {
            updatedConnectionsMap.set(conn.id, conn);
          }
        });
        
        // 创建位置映射并更新连接引用
        const updatedLocationsMap = new Map();
        locations.forEach(loc => {
          if (loc && loc.id && loc.id !== locationId) {
            // 创建新的位置对象，以便安全修改
            const updatedLoc = { ...loc };
            
            // 移除与被删除位置的连接引用
            if (updatedLoc.connections) {
              updatedLoc.connections = updatedLoc.connections.filter(
                connId => connId !== locationId
              );
            }
            
            updatedLocationsMap.set(loc.id, updatedLoc);
          }
        });
        
        // 更新数据
        mapData.updateMapData({
          locations: updatedLocationsMap,
          connections: updatedConnectionsMap
        });
        
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

  // 处理鼠标拖动事件
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
    
    // 获取编辑状态
    const editState = mapData.getEditState();
    const viewState = mapData.getViewState();
    
    // 确保编辑状态和视图状态存在
    if (!editState || !viewState) return;
    
    // 如果正在拖动
    if (isDragging.value && editState.currentTool === 'draw') {
      // 计算拖动距离
      const dx = x - dragStartX.value;
      const dy = y - dragStartY.value;
      
      // 更新拖动起点
      dragStartX.value = x;
      dragStartY.value = y;
      
      // 更新地图偏移
      const newViewState = {
        ...viewState,
        offsetX: viewState.offsetX + dx,
        offsetY: viewState.offsetY + dy
      };
      
      // 更新视图状态
      mapData.updateMapData({ viewState: newViewState });
      
      drawMap();
    }
    
    // 如果正在绘制连接
    if (isDrawingConnection.value) {
      const connectionLayer = layers.value.get(LAYER_IDS.CONNECTION);
      if (connectionLayer && connectionLayer.ctx) {
        drawActiveConnection(connectionLayer.ctx);
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
    // 获取编辑状态
    const editState = mapData.getEditState();
    
    // Escape键取消当前操作
    if (e.key === 'Escape') {
      isDrawingConnection.value = false;
      connectionStartId.value = '';
      
      // 更新编辑状态
      mapData.updateMapData({
        editState: {
          ...editState,
          currentTool: 'draw'
        }
      });
      
      drawMap();
    }
  }
  
  // 绘制激活状态的连接线（正在拖动创建的连接）
  function drawActiveConnection(ctx: CanvasRenderingContext2D) {
    if (!ctx) return;
    
    // 确保连接起点ID存在
    if (!connectionStartId.value) return;
    
    const startLocation = mapData.getLocation(connectionStartId.value);
    if (!startLocation || !startLocation.position || !canvasContainerRef.value) return;
    
    const rect = canvasContainerRef.value.getBoundingClientRect();
    const gridSize = 30;
    const viewState = mapData.getViewState() || { offsetX: 0, offsetY: 0, scale: 1 };
    
    // 计算鼠标的世界坐标
    const mouseX = (dragStartX.value - rect.left - viewState.offsetX) / viewState.scale;
    const mouseY = (dragStartY.value - rect.top - viewState.offsetY) / viewState.scale;
    
    // 确保坐标在有效范围内
    const clampedMouseX = Math.max(0, Math.min(360 * gridSize, mouseX));
    
    try {
      ctx.save();
      ctx.translate(viewState.offsetX, viewState.offsetY);
      ctx.scale(viewState.scale, viewState.scale);
      
      // 绘制连接线
      ctx.beginPath();
      ctx.strokeStyle = 'var(--accent-secondary, #ff9800)';
      ctx.lineWidth = 2 / viewState.scale;
      
      // 直接绘制从起点到鼠标位置的连接线
      ctx.moveTo(startLocation.position.offsetX, startLocation.position.offsetY);
      ctx.lineTo(clampedMouseX, mouseY);
      
      ctx.stroke();
      ctx.restore();
    } catch (error) {
      console.error('绘制活动连接线时出错:', error);
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
    
    // 获取视图状态
    const viewState = mapData.getViewState();
    
    // 计算缩放前鼠标位置对应的地图坐标
    const mapX = (x - viewState.offsetX) / viewState.scale;
    const mapY = (y - viewState.offsetY) / viewState.scale;
    
    // 计算缩放量，降低灵敏度
    const delta = -e.deltaY * 0.0002; // 将系数从 0.001 改为 0.0002
    
    // 根据当前缩放级别动态调整缩放步长
    let scaleFactor = 1;
    if (viewState.scale < 0.2) scaleFactor = 0.2; // 小比例尺时缩放更慢
    else if (viewState.scale > 0.5) scaleFactor = 5; // 大比例尺时缩放更快
    
    const newScale = Math.max(0.05, Math.min(3, viewState.scale + delta * scaleFactor));
    
    // 应用缩放
    const newViewState = {
      ...viewState,
      scale: newScale,
      offsetX: x - mapX * newScale,
      offsetY: y - mapY * newScale
    };
    
    // 更新视图状态
    mapData.updateMapData({ viewState: newViewState });
    
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