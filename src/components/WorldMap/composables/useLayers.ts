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
import { ref } from 'vue';
import { useMapData } from './useMapData';
import { useMapCacheStore } from '../utils/mapCacheStore';


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
  mapId: string,
  layerId: string = 'map'
): Layer {
  try {
    const baseLayer = createBaseLayer(config);
    baseLayer.canvas.style.pointerEvents = 'auto';

    // 全局缓存store
    const mapCacheStore = useMapCacheStore();
    const imageRef = ref<HTMLImageElement | null>(null);
    const isImageLoading = ref(false);
    let imageLoadedToCache = false;

    // 预加载图片并写入全局缓存
    async function preloadAndCacheImage(): Promise<void> {
      if (imageLoadedToCache) return;
      
      // 先初始化缓存，使用固定地图尺寸
      const GRID_SIZE = 15;
      const MAP_WIDTH = 360 * GRID_SIZE;
      const MAP_HEIGHT = 180 * GRID_SIZE;
      
      // 检查缓存是否已经初始化
      if (!mapCacheStore.isLayerInitialized(layerId)) {
        // 确保缓存使用正确的地图尺寸
        mapCacheStore.initializeLayer(layerId, MAP_WIDTH, MAP_HEIGHT);
        console.log(`初始化地图缓存，尺寸: ${MAP_WIDTH}x${MAP_HEIGHT}`);
      } else {
        console.log(`地图缓存已初始化，尺寸: ${mapCacheStore.getLayerDimensions(layerId).width}x${mapCacheStore.getLayerDimensions(layerId).height}`);
      }
      
      // 检查缓存中是否已有底图
      if (mapCacheStore.hasBaseImage(layerId)) {
        console.log('缓存中已有底图，无需重新加载');
        imageLoadedToCache = true;
        return;
      }
      
      if (imageRef.value) {
        await mapCacheStore.loadImage(layerId, imageRef.value);
        imageLoadedToCache = true;
        return;
      }
      
      const img = await preloadImage();
      imageRef.value = img;
      await mapCacheStore.loadImage(layerId, img);
      imageLoadedToCache = true;
    }

    // 预加载图片（只保留一次底图不存在的处理逻辑）
    function preloadImage(): Promise<HTMLImageElement> {
      if (imageRef.value) return Promise.resolve(imageRef.value);
      if (isImageLoading.value) {
        return new Promise((resolve, reject) => {
          const checkInterval = setInterval(() => {
            if (imageRef.value) {
              clearInterval(checkInterval);
              resolve(imageRef.value);
            }
          }, 100);
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
          const filePath = `world_${worldId}/images/world_${mapId}.png`;
          window.electronAPI.data.exists(filePath)
            .then(exists => {
              if (exists) {
                img.src = `app-resource://world_${worldId}/images/world_${mapId}.png`;
              } else {
                // 只保留一次底图不存在的处理
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
                isImageLoading.value = false;
                reject(err);
              };
            })
            .catch(err => {
              isImageLoading.value = false;
              reject(err);
            });
        } catch (error) {
          isImageLoading.value = false;
          reject(error);
        }
      });
    }

    // 渲染方法直接从全局缓存store渲染
    baseLayer.render = async function () {
      if (!baseLayer.visible.value) return;
      const ctx = baseLayer.ctx;
      const currentScale = scale.value;
      const currentOffsetX = offsetX.value;
      const currentOffsetY = offsetY.value;
      
      // 确保在渲染前已加载和初始化缓存
      await preloadAndCacheImage();
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      
      // 记录渲染参数，帮助调试
      console.log(`地图图层渲染 - 画布尺寸: ${ctx.canvas.width}x${ctx.canvas.height}, 缩放: ${currentScale}, 偏移: (${currentOffsetX}, ${currentOffsetY})`);
      
      // 确保使用与其他图层相同的变换方式
      ctx.save();
      ctx.setTransform(currentScale, 0, 0, currentScale, currentOffsetX, currentOffsetY);
      
      // 确保缓存已初始化
      if (mapCacheStore.isLayerInitialized(layerId)) {
        // 自行实现渲染逻辑，而不是直接调用mapCacheStore.renderTo
        // 获取离屏缓存上下文，直接绘制到当前画布
        try {
          // 从mapCacheStore获取对应图层的MapCache实例
          const cacheLayer = mapCacheStore.getLayer(layerId);
          
          if (cacheLayer && cacheLayer.isInitialized()) {
            // 直接绘制离屏缓存到当前上下文
            // 因为外部已经应用了变换矩阵，所以这里直接绘制，不需要再考虑变换
            const offscreenCanvas = cacheLayer.getOffscreenCanvas();
            if (offscreenCanvas) {
              ctx.drawImage(offscreenCanvas, 0, 0);
            } else {
              console.error('获取离屏Canvas失败');
            }
          } else {
            console.error('缓存图层未初始化或无效');
          }
        } catch (error) {
          console.error('渲染缓存到画布时出错:', error);
        }
      } else {
        console.error('地图缓存尚未初始化，无法渲染');
      }
      
      ctx.restore();
    };

    // 预加载一次
    preloadAndCacheImage().catch(err => console.error('底图缓存加载失败:', err));

    return baseLayer;
  } catch (error) {
    console.error('创建地图图层时发生错误:', error);
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

    // 保存原始状态
    ctx.save();
    // 设置变换
    ctx.setTransform(scale.value, 0, 0, scale.value, offsetX.value, offsetY.value);
    
    // 颜色
    const gridColor = isDarkMode.value ? GRID_LINE_DARK : GRID_LINE_LIGHT;
    const mainLineColor = isDarkMode.value ? MAIN_LINE_DARK : MAIN_LINE_LIGHT;
    
    // 地图边界
    const mapLeft = 0;
    const mapTop = 0;
    const mapWidth = 360 * gridSize;
    const mapHeight = 180 * gridSize;
    const mapRight = mapLeft + mapWidth;
    const mapBottom = mapTop + mapHeight;
    
    // 网格间隔 - 根据缩放智能调整
    let gridInterval = 1;
    if (scale.value < 0.1) gridInterval = 9;
    else if (scale.value < 0.2) gridInterval = 6;
    else if (scale.value < 0.4) gridInterval = 3;
    else if (scale.value < 0.8) gridInterval = 1.5;
    else if (scale.value < 1.2) gridInterval = 1;
    else if (scale.value < 2) gridInterval = 0.5;
    else gridInterval = 0.25;
    
    // 线宽 - 根据缩放反向调整
    // 缩小时线宽相对变粗（1/scale），保证视觉效果
    let baseLineWidth = 0.5;  // 基础线宽
    if (scale.value < 0.2) baseLineWidth = 0.8;
    else if (scale.value < 0.5) baseLineWidth = 0.6;
    else if (scale.value > 1.5) baseLineWidth = 0.3;
    
    // 线宽与缩放成反比，确保任何缩放下网格可见性一致
    // 但设置上下限，避免过粗或过细
    const lineWidth = Math.min(Math.max(baseLineWidth / scale.value, 0.2), 1.5);
    
    ctx.beginPath();
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = lineWidth;
    
    // 垂直线
    for (let longitude = -180; longitude <= 180; longitude += gridInterval) {
      const x = (longitude + 180) * gridSize;
      ctx.beginPath();
      ctx.moveTo(x, mapTop);
      ctx.lineTo(x, mapBottom);
      ctx.stroke();
    }
    
    // 水平线
    for (let latitude = -90; latitude <= 90; latitude += gridInterval) {
      const y = (latitude + 90) * gridSize;
      ctx.beginPath();
      ctx.moveTo(mapLeft, y);
      ctx.lineTo(mapRight, y);
      ctx.stroke();
    }
    
    // 主轴
    const meridianX = 180 * gridSize;
    const equatorY = 90 * gridSize;
    ctx.beginPath();
    ctx.strokeStyle = mainLineColor;
    ctx.lineWidth = lineWidth * 1.5;  // 主轴线宽是普通线的1.5倍
    ctx.moveTo(meridianX, mapTop);
    ctx.lineTo(meridianX, mapBottom);
    ctx.moveTo(mapLeft, equatorY);
    ctx.lineTo(mapRight, equatorY);
    ctx.stroke();
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);
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
    ctx.save();
    ctx.setTransform(scale.value, 0, 0, scale.value, offsetX.value, offsetY.value);
    
    // 如果没有数据或连接，直接返回
    if (!mapData.value || !mapData.value.connections || mapData.value.connections.length === 0) {
      // 检查是否正在绘制新连接
      if (isDrawingConnection.value && connectionStartId.value) {
        drawActiveConnection(ctx);
      }
      return;
    }
    
    // 保存当前状态
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
        let startX = startLoc.x;
        let startY = startLoc.y;
        let endX = endLoc.x;
        let endY = endLoc.y;
        
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
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.restore();
  };
  
  // 绘制活动连接（正在创建的连接）
  function drawActiveConnection(ctx: CanvasRenderingContext2D): void {
    const startLoc = mapData.value.locations.find((loc: any) => loc.id === connectionStartId.value);
    
    if (!startLoc) return;
    
    // 获取起点坐标
    let startX = startLoc.x;
    let startY = startLoc.y;
    
    // 计算终点（当前鼠标位置或目标位置）
    let endX = mouseX.value;
    let endY = mouseY.value;
    
    // 如果有目标位置，使用目标位置坐标
    if (currentLocationId.value) {
      const endLoc = mapData.value.locations.find((loc: any) => loc.id === currentLocationId.value);
      if (endLoc) {
        endX = endLoc.x;
        endY = endLoc.y;
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
    ctx.save();
    ctx.setTransform(scale.value, 0, 0, scale.value, offsetX.value, offsetY.value);
    
    // 如果没有位置数据，直接返回
    if (!mapData.value || !mapData.value.locations || mapData.value.locations.length === 0) {
      return;
    }
    
    // 绘制所有位置节点
    mapData.value.locations.forEach((location: any) => {
      // 计算屏幕坐标
      let x = location.x;
      let y = location.y;
      
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
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);
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
    ctx.save();
    ctx.setTransform(scale.value, 0, 0, scale.value, offsetX.value, offsetY.value);
    
    // 如果没有地域数据，直接返回
    if (!mapData.value || !mapData.value.territories || mapData.value.territories.length === 0) {
      return;
    }
    
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
        let x = firstPoint.x;
        let y = firstPoint.y;
        ctx.moveTo(x, y);
        
        for (let i = 1; i < territory.points.length; i++) {
          const point = territory.points[i];
          x = point.x;
          y = point.y;
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
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);
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
  baseLayer.render = function(): void {
    if (!baseLayer.visible.value) return;
    baseLayer.clear();
    const ctx = baseLayer.ctx;
    ctx.save();
    ctx.setTransform(scale.value, 0, 0, scale.value, offsetX.value, offsetY.value);
    const gridSize = 15;
    if (!mapData.value || !mapData.value.locations || mapData.value.locations.length === 0) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.restore();
      return;
    }
    
    // 计算标签字体大小 - 与缩放成反比
    const baseFontSize = 12;
    // 先计算期望的字体大小
    const desiredFontSize = Math.min(Math.max(baseFontSize / scale.value, 10), 24);
    // 额外除以scale.value来补偿变换矩阵的影响
    const compensatedFontSize = desiredFontSize / scale.value;
    ctx.font = `${compensatedFontSize}px Arial`;
    
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isDarkMode.value ? TEXT_DARK : TEXT_LIGHT;
    
    mapData.value.locations.forEach((location: any) => {
      // 假设location有longitude/latitude属性，否则用x/y
      let x = location.longitude !== undefined ? (location.longitude + 180) * gridSize : location.x;
      let y = location.latitude !== undefined ? (location.latitude + 90) * gridSize : location.y;
      
      // 计算标签偏移量 - 与缩放成反比，确保任何缩放下都有合适间距
      const labelOffsetY = Math.min(Math.max(10 / scale.value, 5), 20);
      
      // 删除scale.value > 0.5的限制，始终显示标签
      ctx.fillText(location.name, x, y - labelOffsetY);
    });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
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
    if (latitude === 0) {
      return `0°N`; // 明确标识赤道为北纬零度，避免与经度0°标签混淆
    } else if (latitude <= 0) {  // 保持原有逻辑，小于等于0为北纬(但0°已单独处理)
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
    // 获取画布尺寸
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;
    
    // 地图边界 - 原始地图坐标
    const mapWidth = 360 * gridSize;
    const mapHeight = 180 * gridSize;
    
    // 计算当前视口可见的地图区域（地图坐标）
    const visibleLeft = -offsetX.value / scale.value;
    const visibleTop = -offsetY.value / scale.value;
    const visibleRight = visibleLeft + canvasWidth / scale.value;
    const visibleBottom = visibleTop + canvasHeight / scale.value;
    
    // 将视口坐标转换为经纬度
    const minLongitude = Math.max(-180, Math.floor((visibleLeft - gridSize) / gridSize) - 180);
    const maxLongitude = Math.min(180, Math.ceil((visibleRight + gridSize) / gridSize) - 180);
    const minLatitude = Math.max(-90, Math.floor((visibleTop - gridSize) / gridSize) - 90);
    const maxLatitude = Math.min(90, Math.ceil((visibleBottom + gridSize) / gridSize) - 90);
    
    // 间隔设置
    let interval = 10; // 默认每10度标注
    if (scale.value < 0.25) interval = 30;
    else if (scale.value < 0.4) interval = 15;
    else if (scale.value < 0.8) interval = 5;
    else if (scale.value < 1.5) interval = 2.5;
    else interval = 1;
    
    // 文字颜色
    const textColor = isDarkMode.value ? TEXT_DARK : TEXT_LIGHT;
    
    // 保存当前绘图状态
    ctx.save();
    
    // 计算标签字体大小 - 与缩放成反比
    // 基础字体大小
    const baseFontSize = 15;
    // 先计算期望的字体大小
    const desiredFontSize = Math.min(Math.max(baseFontSize / scale.value, 15), 16);
   
    // 额外除以scale.value来补偿变换矩阵的影响
    const compensatedFontSize = desiredFontSize / scale.value;

    // 设置相对固定大小的字体
    ctx.font = `${compensatedFontSize}px Arial`;
    ctx.fillStyle = textColor;
    
    // 先应用变换 - 这样坐标点会变换，但字体大小会进行额外补偿
    ctx.setTransform(scale.value, 0, 0, scale.value, offsetX.value, offsetY.value);
    
    // 标签位置偏移 - 与缩放成反比，确保任何缩放下都有合适间距
    const offset = Math.min(Math.max(5 / scale.value, 3), 10);
    
    // 绘制经度标签（上方）
    for (let lon = Math.ceil(minLongitude / interval) * interval; lon <= maxLongitude; lon += interval) {
      if (lon <= -180 || lon >= 180) continue;
      const x = (lon + 180) * gridSize;
      const y = 0; // 地图上边缘
      
      // 绘制标签
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(formatLongitude(lon), x, y - offset); // 向上偏移
    }
    
    // 绘制纬度标签（左侧）
    for (let lat = Math.ceil(minLatitude / interval) * interval; lat <= maxLatitude; lat += interval) {
      const x = 0; // 地图左边缘
      const y = (lat + 90) * gridSize;
      
      // 绘制标签
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(formatLatitude(lat), x - offset, y); // 向左偏移
    }
    
    // 恢复绘图状态
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.restore();
  };
  
  return baseLayer;
} 