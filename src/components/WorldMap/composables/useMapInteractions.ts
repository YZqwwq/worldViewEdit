import type { Ref } from 'vue';

/**
 * 地图交互
 * 处理所有与地图交互相关的功能
 */
export function useMapInteractions(
  canvasRef: Ref<HTMLCanvasElement | null>,
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
  drawMap: () => void
) {
  // 查找被点击的位置
  function findClickedLocation(x: number, y: number, checkCycleEdges: boolean = false) {
    const gridSize = 30;
    const mapWidthInPixels = 360 * gridSize;
    
    // 查找点击范围内的位置
    let clickedLocation = mapData.value.locations.find((loc: any) => {
      // 计算直接距离
      const dx = Math.abs(loc.x - x);
      const dy = Math.abs(loc.y - y);
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance <= 15;
    });
    
    // 不再检查循环边缘
    
    return clickedLocation;
  }
  
  // 添加新位置
  function addNewLocation(longitude: number, latitude: number, x: number, y: number) {
    const newLocation = {
      id: Date.now().toString(),
      name: formatCoordinates(longitude, latitude),
      description: '',
      x,
      y,
      connections: []
    };
    
    mapData.value.locations.push(newLocation);
    currentLocationId.value = newLocation.id;
    locationNameInput.value = newLocation.name;
    locationDescInput.value = newLocation.description;
    isEditing.value = true;
    
    // 重绘地图
    setTimeout(() => {
      drawMap();
    }, 0);
  }
  
  // 格式化坐标为位置名称
  function formatCoordinates(longitude: number, latitude: number): string {
    const longStr = longitude > 0 ? `${longitude}°E` : `${Math.abs(longitude)}°W`;
    const latStr = latitude > 0 ? `${latitude}°N` : `${Math.abs(latitude)}°S`;
    return `${longStr}, ${latStr}`;
  }
  
  // 开始绘制连接
  function handleConnectionStart(x: number, y: number) {
    const clickedLocation = findClickedLocation(x, y);
    
    if (clickedLocation) {
      isDrawingConnection.value = true;
      connectionStartId.value = clickedLocation.id;
    }
  }
  
  // 删除位置
  function deleteLocation(x: number, y: number) {
    const locationToDelete = findClickedLocation(x, y);
    
    if (locationToDelete) {
      // 从位置列表中移除
      mapData.value.locations = mapData.value.locations.filter(
        (loc: any) => loc.id !== locationToDelete.id
      );
      
      // 移除所有指向该位置的连接
      mapData.value.locations.forEach((loc: any) => {
        if (loc.connections) {
          loc.connections = loc.connections.filter(
            (id: string) => id !== locationToDelete.id
          );
        }
      });
      
      // 如果当前编辑的是被删除的位置，清除编辑状态
      if (currentLocationId.value === locationToDelete.id) {
        isEditing.value = false;
        currentLocationId.value = '';
      }
      
      // 重绘地图
      setTimeout(() => {
        drawMap();
      }, 0);
    }
  }
  
  // 处理鼠标按下事件
  function handleMouseDown(e: MouseEvent) {
    if (!canvasRef.value) return;
    
    try {
      const rect = canvasRef.value.getBoundingClientRect();
      const gridSize = 30;
      
      // 计算地图的总宽度（以像素为单位）
      const mapWidthInPixels = 360 * gridSize;
      
      // 计算鼠标在画布上的坐标
      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;
      
      // 转换为地图上的世界坐标
      const worldX = (canvasX - offsetX.value) / scale.value;
      const worldY = (canvasY - offsetY.value) / scale.value;
      
      // 计算经度（-180到180范围）
      const longitude = Math.floor(worldX / gridSize);
      // 限制经度范围在-180到180之间
      const normalizedLong = Math.min(180, Math.max(-180, longitude > 180 ? longitude - 360 : longitude));
      
      // 计算纬度（北纬90到南纬90）
      const latitude = 90 - Math.floor(worldY / gridSize);
      const clampedLat = Math.min(90, Math.max(-90, latitude));
      
      // 转换为地图上的X、Y坐标
      // X坐标使用0到360范围
      const x = (normalizedLong + 180) * gridSize;
      // Y坐标从北纬90度(顶部)开始计算
      const y = (90 - clampedLat) * gridSize;
      
      // 记录拖动起始点
      dragStartX.value = e.clientX;
      dragStartY.value = e.clientY;
      
      // 根据当前工具处理鼠标点击
      switch (activeTool.value) {
        case 'select':
          // 查找被点击的位置
          const clickedLocation = findClickedLocation(x, y);
          
          if (clickedLocation) {
            // 选中位置
            currentLocationId.value = clickedLocation.id;
            locationNameInput.value = clickedLocation.name;
            locationDescInput.value = clickedLocation.description || '';
            isEditing.value = true;
          } else {
            // 开始拖动地图
            isDragging.value = true;
          }
          break;
          
        case 'add':
          // 添加新位置
          addNewLocation(normalizedLong, clampedLat, x, y);
          break;
          
        case 'connect':
          // 开始绘制连接
          handleConnectionStart(x, y);
          break;
          
        case 'delete':
          // 删除位置
          deleteLocation(x, y);
          break;
      }
    } catch (error) {
      console.error('处理鼠标点击时出错:', error);
    }
  }
  
  // 处理鼠标移动事件
  function handleMouseMove(e: MouseEvent) {
    if (!canvasRef.value) return;
    
    const rect = canvasRef.value.getBoundingClientRect();
    const gridSize = 30;
    
    // 计算地图的总宽度和高度（以像素为单位）
    const mapWidthInPixels = 360 * gridSize;
    const mapHeightInPixels = 180 * gridSize;
    
    // 计算鼠标在画布上的坐标
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    
    // 转换为地图上的世界坐标
    const worldX = (canvasX - offsetX.value) / scale.value;
    const worldY = (canvasY - offsetY.value) / scale.value;
    
    // 计算经度（-180到180范围）
    const longitude = Math.floor(worldX / gridSize);
    const normalizedLong = longitude >= 0 && longitude <= 360 ? 
                         (longitude > 180 ? longitude - 360 : longitude) : 
                         (longitude < -180 ? -180 : longitude > 180 ? 180 : longitude);
    
    // 计算纬度（90到-90范围，90是北极，-90是南极）
    // 纬度值的计算修正: y坐标与纬度是相反的关系
    const latitude = 90 - Math.floor(worldY / gridSize);
    const clampedLat = Math.min(90, Math.max(-90, latitude));
    
    // 更新鼠标坐标显示
    mouseX.value = normalizedLong;
    mouseY.value = clampedLat;
    
    // 处理地图拖动
    if (isDragging.value) {
      const dx = e.clientX - dragStartX.value;
      const dy = e.clientY - dragStartY.value;
      
      // 计算新的偏移值
      const newOffsetX = offsetX.value + dx;
      const newOffsetY = offsetY.value + dy;
      
      // 移除所有边界限制，允许在灰色区域自由拖动
      offsetX.value = newOffsetX;
      offsetY.value = newOffsetY;
      
      // 更新拖动起始点
      dragStartX.value = e.clientX;
      dragStartY.value = e.clientY;
      
      // 重绘地图
      drawMap();
    }
    
    // 如果正在绘制连接
    if (isDrawingConnection.value) {
      dragStartX.value = e.clientX;
      dragStartY.value = e.clientY;
      drawMap();
    }
  }
  
  // 处理鼠标松开事件
  function handleMouseUp(e: MouseEvent) {
    if (!canvasRef.value) return;
    
    // 如果正在拖动地图
    if (isDragging.value) {
      isDragging.value = false;
    }
    
    // 如果正在绘制连接
    if (isDrawingConnection.value) {
      const rect = canvasRef.value.getBoundingClientRect();
      const gridSize = 30;
      
      // 计算地图的总宽度
      const mapWidthInPixels = 360 * gridSize;
      
      // 计算鼠标在世界坐标系中的位置
      const worldX = (e.clientX - rect.left - offsetX.value) / scale.value;
      const worldY = (e.clientY - rect.top - offsetY.value) / scale.value;
      
      // 确保坐标在有效范围内
      const clampedX = Math.max(0, Math.min(mapWidthInPixels, worldX));
      
      // 查找目标位置
      let targetLocation = findClickedLocation(clampedX, worldY, false);
      
      if (targetLocation && targetLocation.id !== connectionStartId.value) {
        // 找到有效的目标位置，创建连接
        const sourceLocation = mapData.value.locations.find(
          (loc: any) => loc.id === connectionStartId.value
        );
        
        if (sourceLocation) {
          // 添加连接（如果不存在）
          if (!sourceLocation.connections.includes(targetLocation.id)) {
            sourceLocation.connections.push(targetLocation.id);
          }
          
          // 添加反向连接（如果不存在）
          if (!targetLocation.connections.includes(sourceLocation.id)) {
            targetLocation.connections.push(sourceLocation.id);
          }
        }
      }
      
      // 重置连接状态
      isDrawingConnection.value = false;
      connectionStartId.value = '';
      
      // 重绘地图
      drawMap();
    }
  }
  
  // 处理点击事件 (大多数逻辑已在mousedown处理)
  function handleClick(e: MouseEvent) {
    // 空实现，大多数逻辑已经在mousedown中处理
  }
  
  // 处理键盘事件
  function handleKeyDown(e: KeyboardEvent) {
    // 支持Ctrl+S保存
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      // 调用保存函数
    }
  }
  
  // 处理鼠标滚轮事件
  function handleWheel(e: WheelEvent) {
    e.preventDefault(); // 阻止默认滚动行为
    
    if (!canvasRef.value) return;
    
    const rect = canvasRef.value.getBoundingClientRect();
    const mouseCanvasX = e.clientX - rect.left;
    const mouseCanvasY = e.clientY - rect.top;
    
    // 计算缩放方向和缩放因子
    const delta = -Math.sign(e.deltaY); // 正值表示放大，负值表示缩小
    let factor = 1.0;
    
    // 根据当前缩放比例确定缩放步进
    if (scale.value < 0.2) {
      factor = 1.2; // 小比例时使用大步进
    } else if (scale.value < 1) {
      factor = 1.1; // 中等比例
    } else {
      factor = 1.05; // 大比例时使用小步进
    }
    
    // 根据滚轮方向计算新的缩放值
    const newScale = delta > 0 ? scale.value * factor : scale.value / factor;
    
    // 使用传入的minScale值（ref）
    if (newScale >= 0.03 && newScale <= 5) {
      // 保存鼠标指针下的世界坐标
      const worldX = (mouseCanvasX - offsetX.value) / scale.value;
      const worldY = (mouseCanvasY - offsetY.value) / scale.value;
      
      // 应用新的缩放值
      scale.value = newScale;
      
      // 调整偏移量，使鼠标指针下的世界坐标保持不变
      offsetX.value = mouseCanvasX - worldX * scale.value;
      offsetY.value = mouseCanvasY - worldY * scale.value; // 保持Y轴也随鼠标缩放
      
      // 限制Y轴偏移，确保不会超出纬度限制
      if (canvasRef.value) {
        const canvasHeight = canvasRef.value.height;
        const canvasWidth = canvasRef.value.width;
        const gridSize = 30;
        const mapWidthInPixels = 360 * gridSize * scale.value;
        const mapHeightInPixels = 180 * gridSize * scale.value;
        
        // 地图高度大于画布高度时，限制偏移范围
        if (mapHeightInPixels > canvasHeight) {
          const minOffsetY = canvasHeight - mapHeightInPixels;
          const maxOffsetY = 0;
          
          offsetY.value = Math.min(maxOffsetY, Math.max(minOffsetY, offsetY.value));
        } else {
          // 地图高度小于画布高度，将地图居中显示
          offsetY.value = (canvasHeight - mapHeightInPixels) / 2;
        }
        
        // 地图宽度大于画布宽度时，限制偏移范围
        if (mapWidthInPixels > canvasWidth) {
          const minOffsetX = canvasWidth - mapWidthInPixels;
          const maxOffsetX = 0;
          
          offsetX.value = Math.min(maxOffsetX, Math.max(minOffsetX, offsetX.value));
        } else {
          // 地图宽度小于画布宽度，将地图居中显示
          offsetX.value = (canvasWidth - mapWidthInPixels) / 2;
        }
      }
      
      // 重绘地图
      drawMap();
      
      // 更新鼠标位置显示（适应新的缩放比例）
      updateMouseCoordinates(mouseCanvasX, mouseCanvasY);
    }
  }
  
  // 辅助函数：更新鼠标坐标显示
  function updateMouseCoordinates(canvasX: number, canvasY: number) {
    const gridSize = 30;
    
    // 计算鼠标在地图上的世界坐标
    const worldX = (canvasX - offsetX.value) / scale.value;
    const worldY = (canvasY - offsetY.value) / scale.value;
    
    // 计算经度（-180到180范围）
    const longitude = Math.floor(worldX / gridSize);
    let normalizedLong = longitude;
    
    // 确保经度在-180到180范围内
    if (longitude > 180) {
      normalizedLong = longitude - 360;
    } else if (longitude < -180) {
      normalizedLong = longitude + 360;
    }
    
    // 计算纬度（90到-90范围，90是北极，-90是南极）
    // 修正纬度计算：y坐标增加时，纬度值减小
    const latitude = 90 - Math.floor(worldY / gridSize);
    const clampedLat = Math.min(90, Math.max(-90, latitude));
    
    // 更新鼠标坐标显示
    mouseX.value = normalizedLong;
    mouseY.value = clampedLat;
  }
  
  return {
    findClickedLocation,
    addNewLocation, 
    handleConnectionStart,
    deleteLocation,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleClick,
    handleKeyDown,
    handleWheel
  };
} 