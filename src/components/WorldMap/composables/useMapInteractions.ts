import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import type { Ref } from 'vue';
import { LAYER_IDS } from './useMapCanvas';
import { getMapRect } from './useLayerFactory';
import { useMapData } from './useMapData';
import type { Layer } from './useLayerFactory';
import { useCoordinateTransform } from '../utils/CoordinateTransform';

/**
 * 地图交互管理器
 * 处理地图的指针和键盘交互
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
  // 替换为useMapCanvas的绘图API，注意：现在传递地图坐标而非画布坐标
  startDrawing: (mapX: number, mapY: number) => void,
  continueDrawing: (mapX: number, mapY: number) => void,
  stopDrawing: () => void
) {
  // 获取地图数据
  const mapData = useMapData();
  
  // 获取视图状态
  const viewState = computed(() => mapData.getViewState());
  
  // 创建坐标转换工具
  const coordTransform = useCoordinateTransform(
    computed(() => viewState.value.offsetX),
    computed(() => viewState.value.offsetY),
    computed(() => viewState.value.scale)
  );
  
  // 当前指针下的位置ID
  const hoveredLocationId = ref<string | null>(null);
  
  // 将屏幕坐标转换为地图坐标
  function screenToMapCoords(x: number, y: number): { x: number, y: number } {
    const viewState = mapData.getViewState();
    return {
      x: (x - viewState.offsetX) / viewState.scale,
      y: (y - viewState.offsetY) / viewState.scale
    };
  }
  
  // 检查点是否在位置节点上
  function isPointInLocation(x: number, y: number, location: any): boolean {
    // x, y 已为地图坐标
    if (!location || !location.position || location.position.offsetX === undefined || location.position.offsetY === undefined) {
      return false;
    }
    const radius = location.id === currentLocationId.value ? 6 : 4;
    const distance = Math.sqrt(
      Math.pow(x - location.position.offsetX, 2) +
      Math.pow(y - location.position.offsetY, 2)
    );
    return distance <= radius;
  }
  
  // 查找指针位置下的节点
  function findLocationUnderCursor(screenX: number, screenY: number): string | null {
    const locations = mapData.getLocations();
    if (!locations || locations.length === 0) return null;
    const mapPt = screenToMapCoords(screenX, screenY);
    for (let i = locations.length - 1; i >= 0; i--) {
      const location = locations[i];
      if (!location || !location.id) continue;
      if (isPointInLocation(mapPt.x, mapPt.y, location)) {
        return location.id;
      }
    }
    return null;
  }
  
  // 检查点是否在地图范围内
  function isPointInMap(screenX: number, screenY: number): boolean {
    const viewState = mapData.getViewState();
    const mapRect = getMapRect(0, 0, 1); // 地图原始坐标
    const mapPt = screenToMapCoords(screenX, screenY);
    return (
      mapPt.x >= mapRect.x &&
      mapPt.x <= mapRect.x + mapRect.width &&
      mapPt.y >= mapRect.y &&
      mapPt.y <= mapRect.y + mapRect.height
    );
  }
  
  // 处理指针按下事件
  function handlePointerDown(e: PointerEvent) {
    // 获取指针相对于画布容器的坐标
    const rect = canvasContainerRef.value?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // 更新指针位置
    mouseX.value = x;
    mouseY.value = y;
    
    // 获取当前工具
    // 编辑状态不存在时退出
    const editState = mapData.getEditState();
    if (!editState) return; 
    
    const currentTool = editState.currentTool;
    // 阻止默认的浏览器拖拽行为等
    e.preventDefault();
    // 如果画布容器存在，显式捕获指针事件
    canvasContainerRef.value?.setPointerCapture(e.pointerId);
    
    // 根据当前工具执行不同操作
    if(currentTool === 'select'){
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
      }
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
        }
      }
    } 
    // 对于mapdraw模式，使用高级绘图API
    else if (currentTool === 'mapdraw') {
      console.log('mapdraw模式下的指针事件，调用绘图API');
      
      // 获取MAP图层
      const mapLayer = layers.value.get(LAYER_IDS.MAP);
      if (mapLayer && mapLayer.canvas) {
        // 检查鼠标是否在画布区域内
        if (coordTransform.isPointInCanvas(e.clientX, e.clientY, mapLayer.canvas)) {
          // 使用坐标转换工具，直接获取地图坐标
          const mapCoord = coordTransform.screenToMap(e.clientX, e.clientY, mapLayer.canvas);
          console.log("开始绘制，地图坐标:", mapCoord);
          
          // 调用高级绘图API开始绘制，传递地图坐标
          startDrawing(mapCoord.x, mapCoord.y);
        } else {
          console.log("鼠标不在画布区域内，不执行绘制");
        }
      } else {
        console.warn("无法获取MAP图层");
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
          offsetX: mapCoords.x,
          offsetY: mapCoords.y
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
      
      // 切换到选择工具
      if (editState) {
        mapData.updateMapData({
          editState: {
            ...editState,
            currentTool: 'select'
          }
        });
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
      }
    }
  }

  // 处理指针移动事件
  function handlePointerMove(e: PointerEvent) {
    // 如果没有捕获指针，或者不是主指针（例如多点触控），则忽略
    if (!canvasContainerRef.value?.hasPointerCapture(e.pointerId)) return;

    // 获取编辑状态
    const editState = mapData.getEditState();
    const viewState = mapData.getViewState();

    // 确保编辑状态和视图状态存在
    if (!editState || !viewState) return;

    // 如果正在拖动
    if (isDragging.value && editState.currentTool === 'select') {
       // 获取指针相对于画布容器的坐标
    const rect = canvasContainerRef.value?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 更新指针位置
    mouseX.value = x;
    mouseY.value = y;

    // 检查指针悬停的位置
    hoveredLocationId.value = findLocationUnderCursor(x, y);
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
    }
    
    // 如果正在绘制连接
    if (isDrawingConnection.value) {
      // 更新当前鼠标位置用于绘制活动连接线
      drawActiveConnection();
    }
    
    // 支持绘图工具的移动事件
    if (editState.currentTool === 'mapdraw') {
      // 如果处于绘图状态，调用高级绘图API继续绘制
      const mapLayer = layers.value.get(LAYER_IDS.MAP);
      if (mapLayer && mapLayer.canvas) {
        // 检查鼠标是否在画布区域内
        if (coordTransform.isPointInCanvas(e.clientX, e.clientY, mapLayer.canvas)) {
          // 使用坐标转换工具，直接获取地图坐标
          const mapCoord = coordTransform.screenToMap(e.clientX, e.clientY, mapLayer.canvas);
          
          // 调用高级绘图API继续绘制，传递地图坐标
          continueDrawing(mapCoord.x, mapCoord.y);
        }
      }
    }
  }
  
  // 处理指针抬起事件
  function handlePointerUp(e: PointerEvent) {
    // 如果该指针事件没有被捕获，忽略
    if (!canvasContainerRef.value?.hasPointerCapture(e.pointerId)) return;

    // 释放指针捕获
    canvasContainerRef.value?.releasePointerCapture(e.pointerId);

    // 获取编辑状态
    const editState = mapData.getEditState();
    if (!editState) return;

    // 如果是绘图工具，在抬起时结束绘图
    if (editState.currentTool === 'mapdraw') {
      console.log("结束绘制");
      stopDrawing();
    }

    isDragging.value = false;

    // 如果是在绘制连接过程中抬起，并且没有在某个点上结束，则取消绘制
    const x = e.clientX - (canvasContainerRef.value?.getBoundingClientRect()?.left || 0);
    const y = e.clientY - (canvasContainerRef.value?.getBoundingClientRect()?.top || 0);
    const locationUnderCursor = findLocationUnderCursor(x, y);

    if (isDrawingConnection.value && (!locationUnderCursor || locationUnderCursor === connectionStartId.value)) {
      // 如果抬起时不在有效目标点上，或者在起点上，则取消
      isDrawingConnection.value = false;
      connectionStartId.value = '';
    }
    // 连接完成的逻辑已经在 handlePointerDown 中处理了第二次点击
  }
  
  // 处理键盘事件
  function handleKeyDown(e: KeyboardEvent) {
    // 获取编辑状态
    const editState = mapData.getEditState();
    if (!editState) return; // 如果没有编辑状态，直接返回

    // Escape键取消当前操作
    if (e.key === 'Escape') {
      if (isDrawingConnection.value) {
          isDrawingConnection.value = false;
          connectionStartId.value = '';
      }

      // 如果在使用绘图工具，也需要结束绘图
      if (editState.currentTool === 'mapdraw') {
        stopDrawing();
      }

      // 总是切换回 select 工具
      mapData.updateMapData({
        editState: {
          ...editState,
          currentTool: 'select'
        }
      });
    }
  }
  
  // 绘制激活状态的连接线
  function drawActiveConnection() {
    const connectionLayer = layers.value.get(LAYER_IDS.CONNECTION);
    const ctx = connectionLayer?.ctx;
    if (!ctx || !isDrawingConnection.value || !connectionStartId.value) return;

    const startLocation = mapData.getLocation(connectionStartId.value);
    if (!startLocation || !startLocation.position || !canvasContainerRef.value) return;

    const viewState = mapData.getViewState() || { offsetX: 0, offsetY: 0, scale: 1 };

    // 使用mouseX, mouseY作为当前指针位置
    // 将屏幕坐标转换为地图坐标（相对于地图内容）
    const targetMapX = (mouseX.value - viewState.offsetX) / viewState.scale;
    const targetMapY = (mouseY.value - viewState.offsetY) / viewState.scale;

    try {
      ctx.save();
      ctx.translate(viewState.offsetX, viewState.offsetY);
      ctx.scale(viewState.scale, viewState.scale);

      ctx.beginPath();
      ctx.strokeStyle = 'var(--accent-secondary, #ff9800)';
      ctx.lineWidth = 2 / viewState.scale; // 线宽反向缩放

      // 从起点位置的地图坐标开始绘制
      ctx.moveTo(startLocation.position.offsetX, startLocation.position.offsetY);
      // 绘制到当前鼠标位置的地图坐标
      ctx.lineTo(targetMapX, targetMapY);

      ctx.stroke();
      ctx.restore();
    } catch (error) {
      console.error('绘制活动连接线时出错:', error);
    }
  }
  
  // 处理滚轮事件（缩放）
  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    
    // 获取指针相对于画布容器的坐标
    const rect = canvasContainerRef.value?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // 获取视图状态
    const viewState = mapData.getViewState();
    
    // 计算缩放前指针位置对应的地图坐标
    const mapX = (x - viewState.offsetX) / viewState.scale;
    const mapY = (y - viewState.offsetY) / viewState.scale;
    
    // 计算缩放量，降低灵敏度
    const delta = -e.deltaY * 0.0002;
    
    // 根据当前缩放级别动态调整缩放步长
    let scaleFactor = 1;
    if (viewState.scale < 0.2) scaleFactor = 0.2;
    else if (viewState.scale > 0.5) scaleFactor = 5;
    
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
  }
  
  // 添加和移除事件监听器
  onMounted(() => {
    const container = canvasContainerRef.value;
    if (container) {
      container.addEventListener('pointerdown', handlePointerDown);
      container.addEventListener('pointermove', handlePointerMove);
      container.addEventListener('pointerup', handlePointerUp);
      container.addEventListener('wheel', handleWheel, { passive: false }); // passive: false for preventDefault
      window.addEventListener('keydown', handleKeyDown); // Keydown on window
    }
  });

  onBeforeUnmount(() => {
    const container = canvasContainerRef.value;
    if (container) {
      container.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerup', handlePointerUp);
      container.removeEventListener('wheel', handleWheel);
    }
    window.removeEventListener('keydown', handleKeyDown); // Remove keydown listener
  });
  
  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleKeyDown,
    handleWheel,
    hoveredLocationId,
    drawActiveConnection
  };
} 