import type { Ref } from 'vue';
import {
  BACKGROUND_DARK,
  BACKGROUND_LIGHT,
  MAP_BACKGROUND_DARK,
  MAP_BACKGROUND_LIGHT,
  MAP_BORDER_DARK,
  MAP_BORDER_LIGHT,
  GRID_LINE_DARK,
  GRID_LINE_LIGHT,
  MAIN_LINE_DARK,
  MAIN_LINE_LIGHT,
  TEXT_DARK,
  TEXT_LIGHT,
  MAP_BOUNDARY_DARK,
  MAP_BOUNDARY_LIGHT,
  LABEL_BACKGROUND,
  INTERSECTION_FILL,
  INTERSECTION_STROKE,
  INTERSECTION_TEXT,
  CORNER_MARKER_DARK,
  CORNER_MARKER_LIGHT,
  WATERMARK_DARK,
  WATERMARK_LIGHT
} from '../constants/colors';

/**
 * 地图渲染器
 * 负责所有地图绘制相关的功能
 */
export function useMapRenderer(
  canvasRef: Ref<HTMLCanvasElement | null>,
  ctxRef: Ref<CanvasRenderingContext2D | null>,
  isDarkMode: Ref<boolean>,
  offsetX: Ref<number>,
  offsetY: Ref<number>,
  scale: Ref<number>,
  mapData: Ref<any>,
  currentLocationId: Ref<string>,
  isDrawingConnection: Ref<boolean>,
  connectionStartId: Ref<string>,
  dragStartX: Ref<number>,
  dragStartY: Ref<number>
) {
  // 绘制地图
  function drawMap() {
    if (!ctxRef.value || !canvasRef.value) return;
    
    const ctx = ctxRef.value;
    const canvas = canvasRef.value;
    const gridSize = 30;
    
    try {
      // 清空画布
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // 添加灰色背景，使地图缩小时能看到完整边界
      ctx.save();
      ctx.fillStyle = isDarkMode.value ? BACKGROUND_DARK : BACKGROUND_LIGHT;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      
      // 根据当前模式设置背景颜色
      ctx.fillStyle = isDarkMode.value ? MAP_BACKGROUND_DARK : MAP_BACKGROUND_LIGHT;
      
      // 计算地图的总宽度和高度（以像素为单位）
      const mapWidthInPixels = 360 * gridSize;
      const mapHeightInPixels = 180 * gridSize;
      
      // 保存当前变换状态
      ctx.save();
      
      // 应用缩放和平移变换
      ctx.translate(offsetX.value, offsetY.value);
      ctx.scale(scale.value, scale.value);
      
      // 绘制地图背景和边框
      ctx.fillStyle = isDarkMode.value ? MAP_BACKGROUND_DARK : MAP_BACKGROUND_LIGHT;
      ctx.fillRect(0, 0, mapWidthInPixels, mapHeightInPixels);
      
      // 绘制地图边框 - 使用实线边框
      ctx.strokeStyle = isDarkMode.value ? MAP_BORDER_DARK : MAP_BORDER_LIGHT;
      // 使用固定线宽值，根据缩放范围调整
      if (scale.value < 0.2) {
        ctx.lineWidth = 1.2; // 缩小状态下使用较粗的边框
      } else if (scale.value < 0.5) {
        ctx.lineWidth = 0.8; // 中等缩放使用中等边框
      } else {
        ctx.lineWidth = 0.5; // 放大状态下使用细边框
      }
      ctx.strokeRect(0, 0, mapWidthInPixels, mapHeightInPixels);
      
      // 恢复变换状态
      ctx.restore();
      
      // 绘制网格线 - 网格线会在边框内绘制
      drawGridLines(ctx, canvas.width, canvas.height, offsetX.value);
      
      // 绘制坐标轴和标记
      drawCoordinateSystem(ctx, canvas.width, canvas.height, offsetX.value);
      
      // 保存当前绘图状态
      ctx.save();
      
      // 应用变换（偏移和缩放）
      ctx.translate(offsetX.value, offsetY.value);
      ctx.scale(scale.value, scale.value);
      
      // 绘制基本地图内容
      drawConnections(ctx); // 先绘制连接线
      drawLocations(ctx);   // 再绘制位置节点
      
      // 恢复原始绘图状态
      ctx.restore();
      
      // 处理连接线绘制（如果正在绘制）
      if (isDrawingConnection.value && connectionStartId.value && canvasRef.value) {
        drawActiveConnection(ctx, offsetX.value);
      }
      
    } catch (error) {
      console.error('绘制地图时出错:', error);
      
      // 错误处理，绘制一个简单的错误信息
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = '14px Arial';
      ctx.fillStyle = '#ff0000';
      ctx.textAlign = 'center';
      ctx.fillText('绘制地图出错，请刷新页面', canvas.width / 2, canvas.height / 2);
    }
  }
  
  // 绘制网格线
  function drawGridLines(ctx: CanvasRenderingContext2D, width: number, height: number, offsetX: number) {
    const gridSize = 30;
    const scaledGridSize = gridSize * scale.value;
    
    // 所有经纬线都使用相同的灰色
    const gridColor = isDarkMode.value ? GRID_LINE_DARK : GRID_LINE_LIGHT;
    const mainLineColor = isDarkMode.value ? MAIN_LINE_DARK : MAIN_LINE_LIGHT;
    
    // 计算地图的真实边界（像素坐标）
    const mapLeft = offsetX;
    const mapTop = offsetY.value;
    const mapWidth = 360 * gridSize * scale.value;
    const mapHeight = 180 * gridSize * scale.value;
    const mapRight = mapLeft + mapWidth;
    const mapBottom = mapTop + mapHeight;
    
    // 根据当前缩放比例确定网格间隔
    let gridInterval = 1; // 默认每1度绘制一条线
    
    // 自适应网格间隔
    if (scale.value < 0.03) gridInterval = 90; // 极小比例，每90度一条线
    else if (scale.value < 0.05) gridInterval = 60; // 极小比例，每60度一条线
    else if (scale.value < 0.1) gridInterval = 45; // 非常小的比例，每45度一条线
    else if (scale.value < 0.2) gridInterval = 30; // 很小的比例，每30度一条线
    else if (scale.value < 0.4) gridInterval = 15; // 小比例，每15度一条线
    else if (scale.value < 0.8) gridInterval = 10; // 中等比例，每10度一条线
    else if (scale.value < 1.2) gridInterval = 5; // 一般比例，每5度一条线
    else if (scale.value < 2) gridInterval = 2; // 较大比例，每2度一条线
    
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
    
    // 绘制垂直线（经度线）
    // 正确计算第一条可见的经度线
    const visibleStartLong = Math.ceil((-offsetX / scaledGridSize - 180) / gridInterval) * gridInterval;
    const startLongX = offsetX + (visibleStartLong + 180) * scaledGridSize;
    
    // 绘制可见范围内的所有经度线
    for (let longitude = visibleStartLong; longitude <= 180; longitude += gridInterval) {
      if (longitude < -180 || longitude > 180) continue; // 跳过超出范围的经度
      
      const x = offsetX + (longitude + 180) * scaledGridSize;
      if (x >= mapLeft && x <= mapRight) {
        // 确保线条不超出地图边界
        ctx.moveTo(x, mapTop);
        ctx.lineTo(x, mapBottom);
        
        // 对于重要的经度线，使用更粗的灰色线（不再是红色）
        if (longitude === 0 || longitude === 180 || longitude === -180) {
          ctx.strokeStyle = mainLineColor;
          
          // 重要线条也遵循同样的粗细规则：缩小时粗，放大时细
          ctx.lineWidth = scale.value < 0.2 ? 1.5 : 0.8;
          ctx.stroke();
          
          ctx.beginPath();
          ctx.strokeStyle = gridColor;
          ctx.lineWidth = scale.value < 0.2 ? 0.8 : 0.5;
        }
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
        ctx.moveTo(mapLeft, y);
        ctx.lineTo(mapRight, y);
        
        // 对于赤道，使用更粗的灰色线（不再是红色）
        if (latitude === 0) {
          ctx.strokeStyle = mainLineColor;
          
          // 重要线条也遵循同样的粗细规则：缩小时粗，放大时细
          ctx.lineWidth = scale.value < 0.2 ? 1.5 : 0.8;
          ctx.stroke();
          
          ctx.beginPath();
          ctx.strokeStyle = gridColor;
          ctx.lineWidth = scale.value < 0.2 ? 0.8 : 0.5;
        }
      }
    }
    
    ctx.stroke();
    ctx.restore();
  }
  
  // 绘制位置节点
  function drawLocations(ctx: CanvasRenderingContext2D) {
    // 计算网格大小和地图总宽度（以像素为单位）
    const gridSize = 30;
    const mapWidthInPixels = 360 * gridSize;
    
    mapData.value.locations.forEach((location: any) => {
      const isSelected = location.id === currentLocationId.value;
      
      // 绘制节点
      ctx.beginPath();
      // 节点大小不应该被缩放影响，所以除以scale
      ctx.arc(location.x, location.y, isSelected ? 18 / scale.value : 15 / scale.value, 0, Math.PI * 2);
      ctx.fillStyle = isSelected 
        ? 'var(--accent-primary, #1976d2)' 
        : 'var(--accent-tertiary, #64b5f6)';
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2 / scale.value;
      ctx.stroke();
      
      // 绘制名称
      ctx.font = `${12 / scale.value}px Arial`;
      ctx.fillStyle = 'var(--text-primary, #333)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(location.name, location.x, location.y + 30 / scale.value);
    });
  }
  
  // 绘制连接线
  function drawConnections(ctx: CanvasRenderingContext2D) {
    // 计算网格大小和地图总宽度（以像素为单位）
    const gridSize = 30;
    const mapWidthInPixels = 360 * gridSize;
    
    mapData.value.locations.forEach((location: any) => {
      if (location.connections && location.connections.length > 0) {
        location.connections.forEach((targetId: string) => {
          const targetLocation = mapData.value.locations.find((loc: any) => loc.id === targetId);
          if (targetLocation) {
            // 计算起点和终点
            const startX = location.x;
            const startY = location.y;
            const endX = targetLocation.x;
            const endY = targetLocation.y;
            
            // 简化连接线绘制，不考虑循环
            ctx.beginPath();
            ctx.strokeStyle = 'var(--border-color, rgba(0,0,0,0.3))';
            ctx.lineWidth = 2 / scale.value; // 调整线宽以适应缩放
            
            // 直接绘制连接线
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            
            ctx.stroke();
          }
        });
      }
    });
  }
  
  // 绘制激活状态的连接线（正在拖动创建的连接）
  function drawActiveConnection(ctx: CanvasRenderingContext2D, offsetX: number) {
    const startLocation = mapData.value.locations.find((loc: any) => loc.id === connectionStartId.value);
    if (!startLocation || !canvasRef.value) return;
    
    const rect = canvasRef.value.getBoundingClientRect();
    const gridSize = 30;
    
    // 计算地图的总宽度（以像素为单位）
    const mapWidthInPixels = 360 * gridSize;
    
    // 计算鼠标的世界坐标
    const mouseX = (dragStartX.value - rect.left - offsetX) / scale.value;
    const mouseY = (dragStartY.value - rect.top - offsetY.value) / scale.value;
    
    // 确保坐标在有效范围内
    const clampedMouseX = Math.max(0, Math.min(mapWidthInPixels, mouseX));
    
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
  
  // 绘制坐标系统
  function drawCoordinateSystem(ctx: CanvasRenderingContext2D, width: number, height: number, offsetX: number) {
    const gridSize = 30;
    const scaledGridSize = gridSize * scale.value;
    const textColor = isDarkMode.value ? TEXT_DARK : TEXT_LIGHT;
    const axisColor = isDarkMode.value ? MAIN_LINE_DARK : MAIN_LINE_LIGHT;
    
    ctx.save();
    
    // 绘制地图边界线
    ctx.save();
    ctx.translate(offsetX, offsetY.value);
    ctx.scale(scale.value, scale.value);
    
    // 计算地图边界
    const mapWidthInPixels = 360 * gridSize;
    const mapHeightInPixels = 180 * gridSize;
    
    // 设置边界线样式
    ctx.strokeStyle = isDarkMode.value ? MAP_BOUNDARY_DARK : MAP_BOUNDARY_LIGHT;
    
    // 使用固定线宽，根据缩放调整
    if (scale.value < 0.2) {
      ctx.lineWidth = 2.0; // 缩小状态使用较粗的边界线
    } else if (scale.value < 0.5) {
      ctx.lineWidth = 1.2; // 中等缩放使用中等边界线
    } else {
      ctx.lineWidth = 0.8; // 放大状态使用细边界线
    }
    
    // 使用实线描边，不使用虚线
    ctx.strokeRect(0, 0, mapWidthInPixels, mapHeightInPixels);
    
    // 如果缩放比例很小，添加额外的视觉提示
    if (scale.value <= 0.2) {
      // 添加地图四角标记，但减小尺寸
      const cornerSize = 15 / scale.value;
      const cornerColor = isDarkMode.value ? CORNER_MARKER_DARK : CORNER_MARKER_LIGHT;
      
      ctx.fillStyle = cornerColor;
      // 左上角
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(cornerSize, 0);
      ctx.lineTo(0, cornerSize);
      ctx.closePath();
      ctx.fill();
      
      // 右上角
      ctx.beginPath();
      ctx.moveTo(mapWidthInPixels, 0);
      ctx.lineTo(mapWidthInPixels - cornerSize, 0);
      ctx.lineTo(mapWidthInPixels, cornerSize);
      ctx.closePath();
      ctx.fill();
      
      // 左下角
      ctx.beginPath();
      ctx.moveTo(0, mapHeightInPixels);
      ctx.lineTo(cornerSize, mapHeightInPixels);
      ctx.lineTo(0, mapHeightInPixels - cornerSize);
      ctx.closePath();
      ctx.fill();
      
      // 右下角
      ctx.beginPath();
      ctx.moveTo(mapWidthInPixels, mapHeightInPixels);
      ctx.lineTo(mapWidthInPixels - cornerSize, mapHeightInPixels);
      ctx.lineTo(mapWidthInPixels, mapHeightInPixels - cornerSize);
      ctx.closePath();
      ctx.fill();
      
      // 添加"世界地图"标题，但字体更小
      ctx.font = `bold ${30 / scale.value}px Arial`;
      ctx.fillStyle = isDarkMode.value ? WATERMARK_DARK : WATERMARK_LIGHT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('世界地图', mapWidthInPixels / 2, mapHeightInPixels / 2);
    }
    
    ctx.restore();
    
    // 根据缩放级别确定标签间隔
    let labelInterval = 1; // 默认每1度标记一次
    
    // 自适应标签间隔
    if (scale.value < 0.3) labelInterval = 30; // 非常小的比例，每30度标记
    else if (scale.value < 0.5) labelInterval = 15; // 小比例，每15度标记
    else if (scale.value < 0.8) labelInterval = 10; // 中等比例，每10度标记
    else if (scale.value < 1.2) labelInterval = 5; // 一般比例，每5度标记
    else if (scale.value < 2) labelInterval = 2; // 较大比例，每2度标记
    
    // 计算坐标轴标签
    // 只有当缩放比例大于等于0.11时才绘制坐标轴标签
    if (scale.value >= 0.11) {
      drawLongitudeLabels(ctx, width, offsetX, scaledGridSize, textColor, labelInterval);
      drawLatitudeLabels(ctx, height, scaledGridSize, textColor, labelInterval);
    }
    
    // 绘制主要坐标轴（赤道和本初子午线）
    drawMainAxes(ctx, width, height, offsetX, scaledGridSize, axisColor);
    
    ctx.restore();
  }
  
  // 绘制经度标签
  function drawLongitudeLabels(ctx: CanvasRenderingContext2D, width: number, offsetX: number, scaledGridSize: number, textColor: string, interval: number = 10) {
    const gridSize = 30;
    
    // 当缩放比例小于11%时不显示经度标签
    if (scale.value < 0.11) return;
    
    ctx.font = 'bold 10px Arial';
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    
    // 计算每个经度单位对应的像素宽度
    const pixelsPerLongitude = gridSize * scale.value;
    
    // 计算当前可见的第一个经度刻度
    const firstVisibleLong = Math.ceil((-offsetX / pixelsPerLongitude - 180) / interval) * interval;
    
    // 遍历所有可见的经度刻度
    for (let longitude = firstVisibleLong; longitude <= 180; longitude += interval) {
      if (longitude < -180 || longitude > 180) continue;
      
      // 计算屏幕X坐标
      const x = offsetX + (longitude + 180) * pixelsPerLongitude;
      
      // 检查是否在屏幕范围内
      if (x >= -50 && x <= width + 50) {
        // 为特殊经度添加特殊标签
        let labelText = `${longitude}°`;
        
        if (longitude === 0) {
          labelText = "本初子午线";
        } else if (longitude === 180 || longitude === -180) {
          labelText = "国际日期变更线";
        } else if (longitude > 0) {
          labelText = `${longitude}°E`;
        } else if (longitude < 0) {
          labelText = `${Math.abs(longitude)}°W`;
        }
        
        // 绘制标签背景提高可读性
        const metrics = ctx.measureText(labelText);
        const textWidth = metrics.width;
        ctx.fillStyle = LABEL_BACKGROUND;
        ctx.fillRect(x - textWidth/2 - 3, 5, textWidth + 6, 16);
        
        // 绘制标签文本
        ctx.fillStyle = textColor;
        ctx.fillText(labelText, x, 7);
      }
    }
  }
  
  // 绘制纬度标签
  function drawLatitudeLabels(ctx: CanvasRenderingContext2D, height: number, scaledGridSize: number, textColor: string, interval: number = 10) {
    const gridSize = 30;
    
    // 当缩放比例小于11%时不显示纬度标签
    if (scale.value < 0.11) return;
    
    ctx.font = 'bold 10px Arial';
    ctx.fillStyle = textColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    
    // 计算当前可见的第一个纬度刻度
    const firstVisibleLat = Math.ceil((-offsetY.value / (gridSize * scale.value) - 90) / interval) * interval;
    
    // 遍历所有可见的纬度
    for (let latitude = firstVisibleLat; latitude <= 90; latitude += interval) {
      if (latitude < -90 || latitude > 90) continue;
      
      // 计算屏幕Y坐标
      const y = offsetY.value + (latitude + 90) * gridSize * scale.value;
      
      // 只在屏幕范围内绘制
      if (y >= -50 && y <= height + 50) {
        // 纬度值需要翻转：地图顶部是北纬90度，底部是南纬90度
        // 而我们的计算是从北到南，所以对应的纬度值就是直接使用latitude
        const actualLatitude = latitude;
        
        let labelText = "";
        // 特殊位置使用特殊标签
        if (actualLatitude === 0) {
          labelText = '0°';
        } else if (actualLatitude > 0) {
          labelText = `${actualLatitude}°S`;
        } else {
          labelText = `${Math.abs(actualLatitude)}°N`;
        }
        
        // 绘制标签背景提高可读性
        const metrics = ctx.measureText(labelText);
        const textWidth = metrics.width;
        ctx.fillStyle = LABEL_BACKGROUND;
        ctx.fillRect(5, y - 8, textWidth + 6, 16);
        
        // 绘制标签
        ctx.fillStyle = textColor;
        ctx.fillText(labelText, 7, y);
      }
    }
  }
  
  // 绘制主要坐标轴（赤道和本初子午线）
  function drawMainAxes(ctx: CanvasRenderingContext2D, width: number, height: number, offsetX: number, scaledGridSize: number, axisColor: string) {
    const gridSize = 30;
    
    // 计算每个经度单位对应的像素宽度
    const pixelsPerLongitude = gridSize * scale.value;
    
    // 计算地图上本初子午线（经度0度）的屏幕X坐标
    const zeroLongitudeX = offsetX + (180 * pixelsPerLongitude);
    
    // 计算赤道位置（纬度0）
    // 从北纬90度（顶部）向下90个网格单位
    const equatorY = offsetY.value + (90 * gridSize * scale.value);
    
    // 绘制主要坐标轴
    drawAxis(ctx, width, height, zeroLongitudeX, equatorY, axisColor);
  }
  
  // 绘制坐标轴线
  function drawAxis(ctx: CanvasRenderingContext2D, width: number, height: number, meridianX: number, equatorY: number, axisColor: string) {
    // 绘制坐标轴
    ctx.beginPath();
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    
    // 绘制赤道（纬度0度）
    if (equatorY >= 0 && equatorY <= height) {
      ctx.moveTo(0, equatorY);
      ctx.lineTo(width, equatorY);
    }
    
    // 绘制本初子午线（经度0度）
    if (meridianX >= 0 && meridianX <= width) {
      ctx.moveTo(meridianX, 0);
      ctx.lineTo(meridianX, height);
    }
    
    ctx.stroke();
    
    // 绘制白色边框使线条更显眼
    ctx.beginPath();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 4]);
    ctx.globalCompositeOperation = 'destination-over';
    
    // 绘制同样的线条作为底层
    if (equatorY >= 0 && equatorY <= height) {
      ctx.moveTo(0, equatorY);
      ctx.lineTo(width, equatorY);
    }
    
    if (meridianX >= 0 && meridianX <= width) {
      ctx.moveTo(meridianX, 0);
      ctx.lineTo(meridianX, height);
    }
    
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.setLineDash([]);
  }
  
  // 格式化纬度显示（添加北纬/南纬）
  function formatLatitude(latitude: number): string {
    if (latitude === 0) return '0°';
    // 纠正纬度标记
    return latitude > 0 ? `北纬${latitude}°` : `南纬${Math.abs(latitude)}°`;
  }
  
  return {
    drawMap
  };
} 