// src/types/map.ts

// 向后兼容
export interface MapLocation {
  id: string;
  name: string;
  description: string;
  position: {
    x: number;
    y: number;
  };
  type: string;
  connections: string[];
}

export interface MapConnection {
  id: string;
  from: string;
  to: string;
  type: string;
  description: string;
}

// 旧的MapData接口 - 为了兼容性保留
export interface MapData {
  name: string;
  description: string;
  locations: MapLocation[];
  connections: MapConnection[];
}

// 基础类型
export interface Position {
  longitude: number;
  latitude: number;
}

export interface Metadata {
  version: string;
  name: string;
  description: string;
  createdAt: number;
  lastModified: number;
}

// 地图数据
export interface WorldMapData {
  metadata: Metadata;
  gridBlocks: Map<string, {
    elevation: number;
    terrainType: string;
    isVisible: boolean;
  }>;
  statistics: {
    highestPoint: number;
    lowestPoint: number;
    averageElevation: number;
    terrainDistribution: Record<string, number>;
  };
}

// 势力数据
export interface TerritoryMapData {
  metadata: Metadata;
  territories: Map<string, {
    id: string;
    name: string;
    type: string;
    color: string;
    description: string;
    members: string[];
    isVisible: boolean;
    displayPriority: number;
  }>;
  hexGrid: {
    cells: Map<string, {
      territoryId: string;
      level: number;
      isVisible: boolean;
    }>;
    spatialIndex: {
      byTypeAndLevel: Record<string, string[]>;
      conflictZones: string[];
    };
  };
}

// 位置和连线数据
export interface Location {
  id: string;
  name: string;
  type: string;
  importance: string;
  position: Position;
  description: string;
  territories: string[];
  isVisible: boolean;
  displayPriority: number;
}

export interface Connection {
  id: string;
  start: string;
  end: string;
  type: string;
  weight: {
    value: number;
    description: string;
  };
  description: string;
  isVisible: boolean;
}

export interface LocationMapData {
  metadata: Metadata;
  locations: Map<string, Location>;
  connections: Map<string, Connection>;
  spatialIndex: {
    byType: Record<string, string[]>;
    byImportance: Record<string, string[]>;
    connectionsByLocation: Map<string, string[]>;
  };
}

// 标签数据
export interface Label {
  id: string;
  type: string;
  text: string;
  position: Position;
  relatedId?: string;
  isVisible: boolean;
  style: {
    fontSize: number;
    color: string;
    backgroundColor?: string;
    padding: number;
    borderRadius: number;
    borderWidth?: number;
    borderColor?: string;
  };
  metadata: {
    createdAt: number;
    lastModified: number;
    createdBy: string;
  };
}

export interface LabelMapData {
  metadata: Metadata;
  labels: Map<string, Label>;
  spatialIndex: {
    byType: Record<string, string[]>;
    byPosition: Map<string, string[]>;
  };
}

// 视图状态
export interface ViewState {
  offsetX: number;
  offsetY: number;
  scale: number;
  isDarkMode: boolean;
}

// 编辑状态
export interface EditState {
  currentTool: 'draw' | 'territory' | 'location' | 'connection' | 'label';
  selectedId: string | null;
  isEditing: boolean;
}

// 缓存状态
export interface MapCache {
  mapData: WorldMapData;
  territoryData: TerritoryMapData;
  locationData: LocationMapData;
  labelData: LabelMapData;
  lastModified: number;
}

// 地图状态
export interface MapState {
  mapData: WorldMapData;
  territoryData: TerritoryMapData;
  locationData: LocationMapData;
  labelData: LabelMapData;
  viewState: ViewState;
  editState: EditState;
  cache: MapCache | null;
  isLoading: boolean;
}
