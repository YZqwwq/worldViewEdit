// 定义基本的地图坐标接口
export interface MapCoordinate {
  x: number;
  y: number;
}

// 定义位置接口
export interface MapLocation extends MapCoordinate {
  id: string;
  name: string;
  description?: string;
  connections?: string[]; // 连接的位置ID列表
}

// 定义连接接口
export interface MapConnection {
  id: string;
  start: string; // 起始位置ID
  end: string;   // 终止位置ID
  type?: string; // 连接类型
}

// 定义地域接口（未来实现）
export interface Territory {
  id: string;
  name: string;
  description?: string;
  color?: string;
  points: MapCoordinate[]; // 定义地域边界的点
}

// 定义地图数据接口
export interface MapData {
  name: string;
  description?: string;
  locations: MapLocation[];
  connections: MapConnection[];
  territories?: Territory[];
  position?: {
    offsetX: number;
    offsetY: number;
  };
  scale?: number;
} 