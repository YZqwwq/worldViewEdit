import type { Ref } from 'vue';
import { createBaseLayer, getMapRect, Layer, LayerConfig } from './useLayerFactory';
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
  LOCATION_NORMAL,
  BACKGROUND_DARK,
  BACKGROUND_LIGHT,
  MAP_BACKGROUND_DARK,
  MAP_BACKGROUND_LIGHT
} from '../constants/colors';
import { LRUCache } from '../utils/LRUCache';
import { ref } from 'vue';
import { useMapData } from './useMapData';


const TILE_SIZE = 256;
const TILE_CACHE_LIMIT = 100;

// 创建背景图层
export function createBackgroundLayer(
  config: LayerConfig,
  isDarkMode: Ref<boolean>
): Layer {
  const baseLayer = createBaseLayer({
    ...config,
    isBaseLayer: true
  });

  // 重写渲染方法
  baseLayer.render = function(): void {
    if (!baseLayer.visible.value) return;
    
    const ctx = baseLayer.ctx;
    
    // 设置背景颜色
    ctx.fillStyle = isDarkMode.value ? BACKGROUND_DARK : BACKGROUND_LIGHT;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  };

  return baseLayer;
}

// 创建地图绘制图层（双三插值实现）
export function createMapLayer(
  config: LayerConfig,
  isDarkMode: Ref<boolean>,
  offsetX: Ref<number>,
  offsetY: Ref<number>,
  scale: Ref<number>,
  mapId: string
): Layer {
  
  try {
    const baseLayer = createBaseLayer(config);
    
    // 确保地图图层可接收鼠标事件
    baseLayer.canvas.style.pointerEvents = 'auto';
    
    // 图像缓存
    const imageRef = ref<HTMLImageElement | null>(null);
    const isImageLoading = ref(false);
    
    // 低分辨率图片缓存
    const scaledImagesCache: { [scale: string]: HTMLCanvasElement } = {};
    // 标记渲染请求ID，防止多次渲染竞争
    let currentRenderRequestId = 0;

    // 预加载图片
    function preloadImage(): Promise<HTMLImageElement> {
      if (imageRef.value) return Promise.resolve(imageRef.value);
      if (isImageLoading.value) {
        // 如果图片已经在加载中，等待加载完成
        return new Promise((resolve, reject) => {
          const checkInterval = setInterval(() => {
            if (imageRef.value) {
              clearInterval(checkInterval);
              resolve(imageRef.value);
            }
          }, 100);
          
          // 设置超时防止无限等待
          setTimeout(() => {
            clearInterval(checkInterval);
            reject(new Error('图片加载超时'));
          }, 10000);
        });
      }
      
      isImageLoading.value = true;
      
      return new Promise<HTMLImageElement>((resolve, reject) => {
        try {
          const img = new window.Image();
          const worldId = useMapData().getWorldId();
          
          // 先检查文件是否存在
          const filePath = `world_${worldId}/images/world_${mapId}.png`;
          
          window.electronAPI.data.exists(filePath)
            .then(exists => {
              
              // 使用自定义协议加载图片
              if (exists) {
                img.src = `app-resource://world_${worldId}/images/world_${mapId}.png`;
              } else {
                console.warn(`图片文件 ${filePath} 不存在，使用默认图片`);
                // 创建一个空白的背景图
                const canvas = document.createElement('canvas');
                canvas.width = 1024;
                canvas.height = 1024;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.fillStyle = '#f0f0f0';
                  ctx.fillRect(0, 0, canvas.width, canvas.height);
                  ctx.font = '24px Arial';
                  ctx.fillStyle = '#666666';
                  ctx.textAlign = 'center';
                  ctx.fillText(`地图 ${mapId} 尚未创建`, canvas.width / 2, canvas.height / 2);
                  img.src = canvas.toDataURL('image/png');
                }
              }
              
              img.onload = () => {
                imageRef.value = img;
                isImageLoading.value = false;
                resolve(img);
              };
              
              img.onerror = (err) => {
                console.error('图片加载失败:', img.src, err);
                isImageLoading.value = false;
                reject(err);
              };
            })
            .catch(err => {
              isImageLoading.value = false;
              reject(err);
            });
        } catch (error) {
          console.error("预加载图片过程中出错:", error);
          isImageLoading.value = false;
          reject(error);
        }
      });
    }
    
    // 获取或创建缩放版本的图像
    function getScaledImage(originalImage: HTMLImageElement, targetScale: number): HTMLCanvasElement {
      // 规范化缩放级别，限制为几个固定值以减少缓存数量
      let normalizedScale = 1;
      if (targetScale <= 0.125) normalizedScale = 0.125;
      else if (targetScale <= 0.25) normalizedScale = 0.25;
      else if (targetScale <= 0.5) normalizedScale = 0.5;
      else if (targetScale <= 0.75) normalizedScale = 0.75;
      
      const scaleKey = normalizedScale.toString();
      
      // 如果已经有缓存，直接返回
      if (scaledImagesCache[scaleKey]) {
        return scaledImagesCache[scaleKey];
      }
      
      // 创建新的缩放图像
      const canvas = document.createElement('canvas');
      const scaledWidth = Math.floor(originalImage.width * normalizedScale);
      const scaledHeight = Math.floor(originalImage.height * normalizedScale);
      canvas.width = scaledWidth;
      canvas.height = scaledHeight;
      
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        // 使用高质量的图像缩放
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(originalImage, 0, 0, scaledWidth, scaledHeight);
        
        // 缓存结果
        scaledImagesCache[scaleKey] = canvas;
        return canvas;
      }
      
      // 如果创建失败，返回原始图像尺寸的空白画布
      const fallbackCanvas = document.createElement('canvas');
      fallbackCanvas.width = originalImage.width;
      fallbackCanvas.height = originalImage.height;
      return fallbackCanvas;
    }

    // 渲染整个图像而不是瓦片
    async function renderFullImage(
      ctx: CanvasRenderingContext2D, 
      image: HTMLImageElement,
      viewOffsetX: number,
      viewOffsetY: number,
      viewScale: number
    ) {
      const requestId = ++currentRenderRequestId;
      
      try {
        // 获取合适缩放级别的图像
        const sourceImage = viewScale >= 0.75 
          ? image 
          : getScaledImage(image, viewScale);
        
        // 计算图像在画布上的位置和尺寸
        const renderWidth = sourceImage.width * viewScale / (sourceImage === image ? 1 : (sourceImage.width / image.width));
        const renderHeight = sourceImage.height * viewScale / (sourceImage === image ? 1 : (sourceImage.height / image.height));
        
        // 检查渲染请求是否仍然有效（可能因为新的缩放/平移操作被取消）
        if (requestId !== currentRenderRequestId) return;
        
        // 清除画布
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        
        // 应用双三次插值进行高质量渲染
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // 渲染图像
        ctx.drawImage(
          sourceImage,
          0, 0, sourceImage.width, sourceImage.height,
          viewOffsetX, viewOffsetY, renderWidth, renderHeight
        );
      } catch (err) {
        console.error('渲染图像失败:', err);
        
        // 如果渲染失败，显示错误信息
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        
        ctx.font = '20px Arial';
        ctx.fillStyle = '#ff0000';
        ctx.textAlign = 'center';
        ctx.fillText('图像渲染失败', ctx.canvas.width / 2, ctx.canvas.height / 2);
      }
    }

    // 重写渲染方法
    baseLayer.render = async function () {
      if (!baseLayer.visible.value) {
        console.log("地图图层不可见，跳过渲染");
        return;
      }
      
      const ctx = baseLayer.ctx;
      const currentScale = scale.value;
      const currentOffsetX = offsetX.value;
      const currentOffsetY = offsetY.value;
      
      try {
        // 加载原始图像
        const originalImage = await preloadImage();
        
        // 使用新的渲染ID
        const thisRenderRequest = ++currentRenderRequestId;
        
        // 使用requestAnimationFrame确保渲染在下一帧执行
        requestAnimationFrame(() => {
          // 检查是否仍然是最新的渲染请求
          if (thisRenderRequest === currentRenderRequestId) {
            renderFullImage(ctx, originalImage, currentOffsetX, currentOffsetY, currentScale);
          }
        });
      } catch (error) {
        
        // 渲染一个简单的错误提示
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        
        ctx.font = '20px Arial';
        ctx.fillStyle = '#ff0000';
        ctx.textAlign = 'center';
        ctx.fillText('无法加载地图图像', ctx.canvas.width / 2, ctx.canvas.height / 2);
        
        // 尝试再次预加载（可能会在下一次渲染中成功）
        setTimeout(() => {
          preloadImage().catch(err => console.error('重试预加载图片失败:', err));
        }, 3000);
      }
    };

    // 预加载图像以加快首次渲染
    console.log("初始预加载图像");
    preloadImage().catch(err => console.error('预加载图片失败:', err));

    return baseLayer;
  } catch (error) {
    console.error("创建地图图层时发生错误:", error);
    // 返回一个默认图层
    const fallbackLayer = createBaseLayer(config);
    fallbackLayer.render = function() {
      const ctx = fallbackLayer.ctx;
      if (!ctx) return;
      
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      
      ctx.font = '20px Arial';
      ctx.fillStyle = '#ff0000';
      ctx.textAlign = 'center';
      ctx.fillText('地图图层创建失败', ctx.canvas.width / 2, ctx.canvas.height / 2);
    };
    return fallbackLayer;
  }
}

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
    const gridSize = 15;
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
    if (latitude <= 0) {  // 修改这里，小于等于0为北纬
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
    
    const gridSize = 15;
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
    
    if (scale.value < 0.2) interval = 15;
    else if (scale.value < 0.4) interval = 10;
    else if (scale.value < 0.8) interval = 5;
    else if (scale.value < 1.5) interval = 2.5;
    else interval = 1;
    
    // 绘制经度标注（横向）
    for (let lon = -180; lon <= 180; lon += interval) {
      if (lon === 0) continue; // 跳过0度，因为主轴已经标出
      
      const x = offsetX.value + (lon + 180) * scaledGridSize;
      
      // 确保在地图区域内
      if (x >= mapLeft && x <= mapRight) {
        // 只在顶部显示经度标注
        ctx.textAlign = 'center';
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
        // 只在左侧显示纬度标注
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(formatLatitude(lat), mapLeft - 5, y);
      }
    }
    
    // 绘制原点和主轴标签
    const originX = offsetX.value + 180 * scaledGridSize; // 经度0度
    const originY = offsetY.value + 90 * scaledGridSize;  // 纬度0度
    
    // 绘制主轴标签
    ctx.font = '12px Arial';
    ctx.fillStyle = textColor;
    
    // 本初子午线标签（只在顶部显示）
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('0°', originX, mapTop - 5);
    
    // 赤道标签（只在左侧显示）
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('0°', mapLeft - 5, originY);
    
    ctx.restore();
  };
  
  return baseLayer;
} 