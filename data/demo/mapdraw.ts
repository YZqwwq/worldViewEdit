// 地形类型枚举
enum TerrainType {
    OCEAN = 'ocean',
    PLAIN = 'plain',
    MOUNTAIN = 'mountain',
    DESERT = 'desert',
    FOREST = 'forest',
    CANYON = 'canyon',
    // ... 其他地形类型
  }
  
  // 单个像素数据
  interface PixelData {
    // 视觉信息
    color: {
      r: number;  // 0-255
      g: number;  // 0-255
      b: number;  // 0-255
      a: number;  // 0-1
    };
    
    // 高度信息 (-1000 到 1000)
    elevation: number;
    
    // 地形混合状态
    terrainMix: {
      [key in TerrainType]?: number;  // 0-1，表示该类型的占比
    };
  }
  
  // 经纬度块数据（30*30像素）
  interface GridBlock {
    pixels: PixelData[][];  // 30x30的像素数组
    lastModified: number;   // 最后修改时间戳
    // 块级别的元数据，可用于优化渲染
    metadata: {
      avgElevation: number;    // 平均高度
      maxElevation: number;    // 最大高度
      minElevation: number;    // 最小高度
      dominantTerrain: TerrainType;  // 主导地形类型
    };
  }
  
  // 地图修改记录
  interface MapEditRecord {
    id: string;
    timestamp: number;
    position: {
      longitude: number;
      latitude: number;
      x: number;  // 块内x坐标 (0-29)
      y: number;  // 块内y坐标 (0-29)
    };
    previousData: PixelData;
    newData: PixelData;
    editType: 'draw' | 'elevation' | 'terrain' | 'color';
  }
  
  // 地图数据主结构
  interface WorldMapData {
    metadata: {
      version: string;
      name: string;
      description: string;
      createdAt: number;
      lastModified: number;
    };
    
    // 地图数据存储
    gridBlocks: Map<string, GridBlock>;  // key: "经度_纬度"
    
    // 编辑历史记录
    editHistory: {
      records: MapEditRecord[];
      maxRecords: number;  // 30
    };
    
    // 统计信息
    statistics: {
      highestPoint: number;
      lowestPoint: number;
      averageElevation: number;
      terrainDistribution: {
        [key in TerrainType]: number;
      };
    };
  }
  
  // 渲染配置接口
  interface RenderConfig {
    interpolationMethod: 'nearestNeighbor' | 'bilinear' | 'edgeDirected';
    quality: 'low' | 'medium' | 'high';
    showGrid: boolean;
    showElevation: boolean;
    showTerrainMix: boolean;
    heightMapMode: boolean;  // 是否显示高度图模式
  }
  
  // 地图操作接口
  interface MapOperations {
    // 基础数据操作
    getPixelAt(longitude: number, latitude: number, x: number, y: number): PixelData;
    getGridBlock(longitude: number, latitude: number): GridBlock;
    
    // 编辑操作
    modifyPixel(longitude: number, latitude: number, x: number, y: number, newData: Partial<PixelData>): void;
    modifyArea(center: {longitude: number, latitude: number, x: number, y: number}, radius: number, modification: Partial<PixelData>): void;
    
    // 渲染相关
    getInterpolatedPixel(x: number, y: number, scale: number, config: RenderConfig): PixelData;
    renderGridBlock(block: GridBlock, scale: number, config: RenderConfig): ImageData;
    
    // 历史记录
    addEditRecord(record: MapEditRecord): void;
    undoLastEdit(): void;
    
    // 统计和分析
    updateBlockMetadata(longitude: number, latitude: number): void;
    updateGlobalStatistics(): void;
  }