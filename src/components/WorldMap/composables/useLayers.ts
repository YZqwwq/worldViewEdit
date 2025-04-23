import type { Ref } from 'vue';
import type { Layer, LayerConfig } from './useLayerManager';
import { createBaseLayer, getMapRect } from './useLayerFactory';
import { 
  GRID_LINE_DARK, 
  GRID_LINE_LIGHT, 
  MAIN_LINE_DARK, 
  MAIN_LINE_LIGHT,
  CONNECTION_LINE,
  ACTIVE_CONNECTION,
  TEXT_DARK,
  TEXT_LIGHT,
  LOCATION_SELECTED,
  LOCATION_NORMAL
} from '../constants/colors';

// 创建网格图层
export function createGridLayer(
  config: LayerConfig,
  isDarkMode: Ref<boolean>,
  offsetX: Ref<number>,
  offsetY: Ref<number>,
  scale: Ref<number>
): Layer {
  const baseLayer = createBaseLayer(config);
  
  // 重写渲染方法
  baseLayer.render = function(): void {
    if (!baseLayer.visible.value) return;
    
    baseLayer.clear();
    
    const ctx = baseLayer.ctx;
    const gridSize = 30;
    const scaledGridSize = gridSize * scale.value;
    
    // 所有经纬线都使用相同的灰色
    const gridColor = isDarkMode.value ? GRID_LINE_DARK : GRID_LINE_LIGHT;
    const mainLineColor = isDarkMode.value ? MAIN_LINE_DARK : MAIN_LINE_LIGHT;
    
    // 计算地图的真实边界（像素坐标）
    const mapLeft = offsetX.value;
    const mapTop = offsetY.value;
    const mapWidth = 360 * gridSize * scale.value;
    const mapHeight = 180 * gridSize * scale.value;
    const mapRight = mapLeft + mapWidth;
    const mapBottom = mapTop + mapHeight;
    
    // 根据当前缩放比例确定网格间隔
    let gridInterval = 1; // 默认每1度绘制一条线
    
    // 自适应网格间隔
    if (scale.value < 0.1) gridInterval = 9; // 极小比例，每45度一条线
    else if (scale.value < 0.2) gridInterval = 6; // 很小的比例，每10度一条线
    else if (scale.value < 0.4) gridInterval = 3; // 小比例，每5度一条线
    else if (scale.value < 0.8) gridInterval = 1.5; // 中等比例，每2度一条线
    else if (scale.value < 1.2) gridInterval = 1; // 一般比例，每1度一条线
    else if (scale.value < 2) gridInterval = 0.5; // 较大比例，每0.5度一条线
    else gridInterval = 0.25; // 最大比例，每0.25度一条线
    
    // 计算间隔后的网格大小
    const intervalScaledGridSize = gridInterval * scaledGridSize;
    
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = gridColor;
    
    // 根据缩放比例调整线宽：缩小时粗，放大时细
    if (scale.value < 0.2) {
      ctx.lineWidth = 0.8; // 小缩放时使用粗线
    } else {
      ctx.lineWidth = 0.5; // 大缩放时使用细线
    }
    
    // 创建剪切区域，只在地图矩形内绘制网格
    ctx.beginPath();
    ctx.rect(mapLeft, mapTop, mapWidth, mapHeight);
    ctx.clip();
    
    // 绘制垂直线（经度线）
    // 正确计算第一条可见的经度线
    const visibleStartLong = Math.ceil((-offsetX.value / scaledGridSize - 180) / gridInterval) * gridInterval;
    const startLongX = offsetX.value + (visibleStartLong + 180) * scaledGridSize;
    
    // 绘制可见范围内的所有经度线
    for (let longitude = visibleStartLong; longitude <= 180; longitude += gridInterval) {
      if (longitude < -180 || longitude > 180) continue; // 跳过超出范围的经度
      
      const x = offsetX.value + (longitude + 180) * scaledGridSize;
      if (x >= mapLeft && x <= mapRight) {
        // 确保线条不超出地图边界
        ctx.beginPath();
        ctx.moveTo(x, mapTop);
        ctx.lineTo(x, mapBottom);
        ctx.stroke();
      }
    }
    
    // 绘制水平线（纬度线）
    // 正确计算第一条可见的纬度线
    const visibleStartLat = Math.ceil((-offsetY.value / scaledGridSize - 90) / gridInterval) * gridInterval;
    const startLatY = offsetY.value + (visibleStartLat + 90) * scaledGridSize;
    
    // 绘制可见范围内的所有纬度线
    for (let latitude = visibleStartLat; latitude <= 90; latitude += gridInterval) {
      if (latitude < -90 || latitude > 90) continue; // 跳过超出范围的纬度
      
      const y = offsetY.value + (latitude + 90) * scaledGridSize;
      if (y >= mapTop && y <= mapBottom) {
        // 确保线条不超出地图边界
        ctx.beginPath();
        ctx.moveTo(mapLeft, y);
        ctx.lineTo(mapRight, y);
        ctx.stroke();
      }
    }
    
    // 绘制主轴（赤道和本初子午线）
    // 本初子午线（0度经线）
    const meridianX = offsetX.value + 180 * scaledGridSize;
    // 赤道（0度纬线）
    const equatorY = offsetY.value + 90 * scaledGridSize;
    
    ctx.beginPath();
    ctx.strokeStyle = mainLineColor;
    ctx.lineWidth = ctx.lineWidth * 1.5; // 主轴线宽是普通线的1.5倍
    
    // 本初子午线
    ctx.moveTo(meridianX, mapTop);
    ctx.lineTo(meridianX, mapBottom);
    
    // 赤道
    ctx.moveTo(mapLeft, equatorY);
    ctx.lineTo(mapRight, equatorY);
    
    ctx.stroke();
    
    ctx.restore();
  };
  
  return baseLayer;
}

// 创建连线图层
export function createConnectionLayer(
  config: LayerConfig,
  mapData: Ref<any>,
  offsetX: Ref<number>,
  offsetY: Ref<number>,
  scale: Ref<number>,
  isDrawingConnection: Ref<boolean>,
  connectionStartId: Ref<string>,
  mouseX: Ref<number>,
  mouseY: Ref<number>,
  currentLocationId: Ref<string>
): Layer {
  const baseLayer = createBaseLayer(config);
  
  // 重写渲染方法
  baseLayer.render = function(): void {
    if (!baseLayer.visible.value) return;
    
    baseLayer.clear();
    const ctx = baseLayer.ctx;
    
    // 如果没有数据或连接，直接返回
    if (!mapData.value || !mapData.value.connections || mapData.value.connections.length === 0) {
      // 检查是否正在绘制新连接
      if (isDrawingConnection.value && connectionStartId.value) {
        drawActiveConnection(ctx);
      }
      return;
    }
    
    // 保存当前状态
    ctx.save();
    
    // 绘制所有现有连接
    const connections = mapData.value.connections;
    const locations = mapData.value.locations || [];
    
    // 转为Map以便快速查找
    const locationsMap = new Map();
    locations.forEach((loc: any) => {
      locationsMap.set(loc.id, loc);
    });
    
    // 绘制所有连接
    ctx.strokeStyle = CONNECTION_LINE;
    ctx.lineWidth = 1;
    
    connections.forEach((conn: any) => {
      const startLoc = locationsMap.get(conn.start);
      const endLoc = locationsMap.get(conn.end);
      
      if (startLoc && endLoc) {
        // 计算屏幕坐标
        const startX = offsetX.value + startLoc.x * scale.value;
        const startY = offsetY.value + startLoc.y * scale.value;
        const endX = offsetX.value + endLoc.x * scale.value;
        const endY = offsetY.value + endLoc.y * scale.value;
        
        // 绘制连接线
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      }
    });
    
    // 检查是否正在绘制新连接
    if (isDrawingConnection.value && connectionStartId.value) {
      drawActiveConnection(ctx);
    }
    
    ctx.restore();
  };
  
  // 绘制活动连接（正在创建的连接）
  function drawActiveConnection(ctx: CanvasRenderingContext2D): void {
    const startLoc = mapData.value.locations.find((loc: any) => loc.id === connectionStartId.value);
    
    if (!startLoc) return;
    
    // 获取起点坐标
    const startX = offsetX.value + startLoc.x * scale.value;
    const startY = offsetY.value + startLoc.y * scale.value;
    
    // 计算终点（当前鼠标位置或目标位置）
    let endX = mouseX.value;
    let endY = mouseY.value;
    
    // 如果有目标位置，使用目标位置坐标
    if (currentLocationId.value) {
      const endLoc = mapData.value.locations.find((loc: any) => loc.id === currentLocationId.value);
      if (endLoc) {
        endX = offsetX.value + endLoc.x * scale.value;
        endY = offsetY.value + endLoc.y * scale.value;
      }
    }
    
    // 绘制活动连接线
    ctx.beginPath();
    ctx.strokeStyle = ACTIVE_CONNECTION;
    ctx.lineWidth = 2; // 活动连接线更粗
    ctx.setLineDash([5, 3]); // 虚线效果
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.setLineDash([]); // 重置为实线
  }
  
  return baseLayer;
}

// 创建位置节点图层
export function createLocationLayer(
  config: LayerConfig,
  mapData: Ref<any>,
  offsetX: Ref<number>,
  offsetY: Ref<number>,
  scale: Ref<number>,
  currentLocationId: Ref<string>
): Layer {
  const baseLayer = createBaseLayer(config);
  
  // 允许鼠标交互
  baseLayer.canvas.style.pointerEvents = 'auto';
  
  // 重写渲染方法
  baseLayer.render = function(): void {
    if (!baseLayer.visible.value) return;
    
    baseLayer.clear();
    const ctx = baseLayer.ctx;
    
    // 如果没有位置数据，直接返回
    if (!mapData.value || !mapData.value.locations || mapData.value.locations.length === 0) {
      return;
    }
    
    // 保存当前状态
    ctx.save();
    
    // 绘制所有位置节点
    mapData.value.locations.forEach((location: any) => {
      // 计算屏幕坐标
      const x = offsetX.value + location.x * scale.value;
      const y = offsetY.value + location.y * scale.value;
      
      // 确定节点样式
      const isSelected = location.id === currentLocationId.value;
      const radius = isSelected ? 6 : 4;
      
      // 绘制节点
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? LOCATION_SELECTED : LOCATION_NORMAL;
      ctx.fill();
      
      // 如果被选中，添加边框
      if (isSelected) {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });
    
    ctx.restore();
  };
  
  return baseLayer;
}

// 创建地域交互图层
export function createTerritoryLayer(
  config: LayerConfig,
  mapData: Ref<any>,
  offsetX: Ref<number>,
  offsetY: Ref<number>,
  scale: Ref<number>
): Layer {
  const baseLayer = createBaseLayer(config);
  
  // 重写渲染方法
  baseLayer.render = function(): void {
    if (!baseLayer.visible.value) return;
    
    baseLayer.clear();
    
    const ctx = baseLayer.ctx;
    
    // 如果没有地域数据，直接返回
    if (!mapData.value || !mapData.value.territories || mapData.value.territories.length === 0) {
      return;
    }
    
    // 保存当前状态
    ctx.save();
    
    // 绘制所有地域
    mapData.value.territories?.forEach((territory: any) => {
      if (territory.points && territory.points.length > 2) {
        // 设置填充颜色和透明度
        ctx.fillStyle = territory.color || 'rgba(100, 149, 237, 0.3)';
        ctx.strokeStyle = territory.color ? territory.color.replace('0.3', '0.7') : 'rgba(100, 149, 237, 0.7)';
        ctx.lineWidth = 1;
        
        // 绘制地域多边形
        ctx.beginPath();
        const firstPoint = territory.points[0];
        const startX = offsetX.value + firstPoint.x * scale.value;
        const startY = offsetY.value + firstPoint.y * scale.value;
        ctx.moveTo(startX, startY);
        
        for (let i = 1; i < territory.points.length; i++) {
          const point = territory.points[i];
          const x = offsetX.value + point.x * scale.value;
          const y = offsetY.value + point.y * scale.value;
          ctx.lineTo(x, y);
        }
        
        // 闭合路径
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // 如果缩放比例足够大，绘制地域名称
        if (scale.value > 0.4 && territory.name) {
          // 计算地域中心点（简单平均）
          let centerX = 0, centerY = 0;
          territory.points.forEach((p: any) => {
            centerX += p.x;
            centerY += p.y;
          });
          centerX = offsetX.value + (centerX / territory.points.length) * scale.value;
          centerY = offsetY.value + (centerY / territory.points.length) * scale.value;
          
          // 设置文本样式
          ctx.fillStyle = '#000000';
          ctx.font = 'bold 12px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          // 绘制带背景的文本
          const padding = 4;
          const text = territory.name;
          const textWidth = ctx.measureText(text).width;
          
          // 绘制文本背景
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.fillRect(
            centerX - textWidth/2 - padding,
            centerY - 6 - padding,
            textWidth + padding * 2,
            12 + padding * 2
          );
          
          // 绘制文本
          ctx.fillStyle = '#000000';
          ctx.fillText(text, centerX, centerY);
        }
      }
    });
    
    ctx.restore();
  };
  
  return baseLayer;
}

// 创建标签图层
export function createLabelLayer(
  config: LayerConfig,
  mapData: Ref<any>,
  offsetX: Ref<number>,
  offsetY: Ref<number>,
  scale: Ref<number>,
  isDarkMode: Ref<boolean>
): Layer {
  const baseLayer = createBaseLayer(config);
  
  // 重写渲染方法
  baseLayer.render = function(): void {
    if (!baseLayer.visible.value) return;
    
    baseLayer.clear();
    const ctx = baseLayer.ctx;
    
    // 如果没有位置数据，直接返回
    if (!mapData.value || !mapData.value.locations || mapData.value.locations.length === 0) {
      return;
    }
    
    // 保存当前状态
    ctx.save();
    
    // 设置文本样式
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isDarkMode.value ? TEXT_DARK : TEXT_LIGHT;
    
    // 绘制所有位置标签
    mapData.value.locations.forEach((location: any) => {
      // 计算屏幕坐标
      const x = offsetX.value + location.x * scale.value;
      const y = offsetY.value + location.y * scale.value;
      
      // 只有在缩放比例足够大时才显示标签
      if (scale.value > 0.5) {
        // 绘制标签文本
        ctx.fillText(location.name, x, y - 15);
      }
    });
    
    ctx.restore();
  };
  
  return baseLayer;
}

// 创建经纬度标注图层
export function createCoordinateLayer(
  config: LayerConfig,
  isDarkMode: Ref<boolean>,
  offsetX: Ref<number>,
  offsetY: Ref<number>,
  scale: Ref<number>
): Layer {
  const baseLayer = createBaseLayer(config);
  
  // 格式化经度
  function formatLongitude(longitude: number): string {
    const abs = Math.abs(longitude);
    if (longitude >= 0) {
      return `${abs}°E`;
    } else {
      return `${abs}°W`;
    }
  }
  
  // 格式化纬度
  function formatLatitude(latitude: number): string {
    const abs = Math.abs(latitude);
    if (latitude >= 0) {
      return `${abs}°N`;
    } else {
      return `${abs}°S`;
    }
  }
  
  // 重写渲染方法
  baseLayer.render = function(): void {
    if (!baseLayer.visible.value) return;
    
    baseLayer.clear();
    const ctx = baseLayer.ctx;
    
    const gridSize = 30;
    const scaledGridSize = gridSize * scale.value;
    
    // 计算地图边界
    const mapRect = getMapRect(offsetX.value, offsetY.value, scale.value);
    const { x: mapLeft, y: mapTop, width: mapWidth, height: mapHeight } = mapRect;
    const mapRight = mapLeft + mapWidth;
    const mapBottom = mapTop + mapHeight;
    
    // 文字颜色
    const textColor = isDarkMode.value ? TEXT_DARK : TEXT_LIGHT;
    
    // 保存当前状态
    ctx.save();
    
    // 设置文本样式
    ctx.font = '10px Arial';
    ctx.fillStyle = textColor;
    
    // 确定经纬度标注间隔
    let interval = 10; // 默认每10度标注
    
    if (scale.value < 0.2) interval = 30;
    else if (scale.value < 0.4) interval = 20;
    else if (scale.value < 0.8) interval = 10;
    else if (scale.value < 1.5) interval = 5;
    else interval = 1;
    
    // 绘制经度标注（横向）
    for (let lon = -180; lon <= 180; lon += interval) {
      if (lon === 0) continue; // 跳过0度，因为主轴已经标出
      
      const x = offsetX.value + (lon + 180) * scaledGridSize;
      
      // 确保在地图区域内
      if (x >= mapLeft && x <= mapRight) {
        // 底部标签
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(formatLongitude(lon), x, mapBottom + 5);
        
        // 顶部标签
        ctx.textBaseline = 'bottom';
        ctx.fillText(formatLongitude(lon), x, mapTop - 5);
      }
    }
    
    // 绘制纬度标注（纵向）
    for (let lat = -90; lat <= 90; lat += interval) {
      if (lat === 0) continue; // 跳过0度，因为主轴已经标出
      
      const y = offsetY.value + (lat + 90) * scaledGridSize;
      
      // 确保在地图区域内
      if (y >= mapTop && y <= mapBottom) {
        // 左侧标签
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(formatLatitude(lat), mapLeft - 5, y);
        
        // 右侧标签
        ctx.textAlign = 'left';
        ctx.fillText(formatLatitude(lat), mapRight + 5, y);
      }
    }
    
    // 绘制原点和主轴标签
    const originX = offsetX.value + 180 * scaledGridSize; // 经度0度
    const originY = offsetY.value + 90 * scaledGridSize;  // 纬度0度
    
    // 绘制主轴标签
    ctx.font = '12px Arial';
    ctx.fillStyle = textColor;
    
    // 本初子午线标签
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('0°', originX, mapBottom + 5);
    ctx.textBaseline = 'bottom';
    ctx.fillText('0°', originX, mapTop - 5);
    
    // 赤道标签
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('0°', mapLeft - 5, originY);
    ctx.textAlign = 'left';
    ctx.fillText('0°', mapRight + 5, originY);
    
    ctx.restore();
  };
  
  return baseLayer;
} 