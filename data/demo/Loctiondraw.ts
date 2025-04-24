// 位置类型枚举
enum LocationType {
  CAPITAL = 'capital',          // 首都
  FORTRESS = 'fortress',        // 军事要塞
  TRADE_CENTER = 'tradeCenter', // 贸易中心
  RELIGIOUS_SITE = 'religiousSite', // 宗教圣地
  BATTLEFIELD = 'battlefield',  // 战场
  DEFAUlT_LOCATION = 'defaultLocation', // 默认位置
  // ... 其他类型
}

// 位置重要性等级
enum LocationImportance {
  CRITICAL = 'critical',    // 关键
  IMPORTANT = 'important',  // 重要
  NORMAL = 'normal',        // 普通
  MINOR = 'minor'          // 次要
}

// 重要位置数据
interface Location {
  id: string;
  name: string;
  type: LocationType;
  importance: LocationImportance;
  position: {
    longitude: number;
    latitude: number;
  };
  description: string;
  // 所属势力
  territories: string[];  // 所属势力ID列表
  // 时间属性
  timeRange?: {
    start: number;  // 开始时间
    end?: number;   // 结束时间（可选）
  };
  // 显示控制
  isVisible: boolean;
  displayPriority: number;
}

// 连线类型枚举
enum ConnectionType {
  TRADE = 'trade',          // 贸易路线
  MILITARY = 'military',    // 军事路线
  RELIGIOUS = 'religious',  // 宗教传播
  CULTURAL = 'cultural',    // 文化交流
  POLITICAL = 'political'   // 政治联系
}

// 连线数据
interface Connection {
  id: string;
  type: ConnectionType;
  sourceId: string;    // 起点位置ID
  targetId: string;    // 终点位置ID
  isBidirectional: boolean;  // 是否双向
  // 权重信息
  weight: {
    value: number;     // 权重值
    type: 'trade' | 'military' | 'influence';  // 权重类型
  };
  // 时间属性
  timeRange?: {
    start: number;
    end?: number;
  };
  // 显示控制
  isVisible: boolean;
  style: {
    color: string;
    width: number;
    dashArray?: number[];  // 虚线样式
  };
}

// 位置和连线地图数据
interface LocationMapData {
  metadata: {
    version: string;
    name: string;
    description: string;
    createdAt: number;
    lastModified: number;
  };
  
  // 位置数据
  locations: Map<string, Location>;
  
  // 连线数据
  connections: Map<string, Connection>;
  
  // 空间索引
  spatialIndex: {
    // 按类型组织的索引
    byType: {
      [key in LocationType]: string[];  // 位置ID列表
    };
    // 按重要性组织的索引
    byImportance: {
      [key in LocationImportance]: string[];  // 位置ID列表
    };
    // 连线索引
    connectionsByLocation: Map<string, string[]>;  // key: 位置ID，value: 相关连线ID列表
  };
  
  // 编辑历史
  editHistory: {
    records: LocationEditRecord[];
    maxRecords: number;
  };
  
  // 显示配置
  displayConfig: {
    visibleTypes: LocationType[];  // 当前显示的位置类型
    minImportance: LocationImportance;  // 最小显示重要性
    showConnections: boolean;  // 是否显示连线
    connectionTypes: ConnectionType[];  // 当前显示的连线类型
  };
}

// 编辑记录
interface LocationEditRecord {
  id: string;
  timestamp: number;
  type: 'create' | 'modify' | 'delete' | 'visibility';
  targetType: 'location' | 'connection';
  targetId: string;
  previousData?: any;
  newData?: any;
}

// 修改 LocationRenderConfig 接口
interface LocationRenderConfig {
  scale: number;
  showLabels: boolean;
  // 缩放级别显示规则
  zoomRules: {
    [scale: number]: {
      minImportance: LocationImportance; // 最小显示重要性  
      showConnections: boolean; // 是否显示连线
      connectionWeightThreshold: number; // 连线显示权重阈值
      locationDisplayRules?: {
        enabled: boolean; // 是否启用位置显示规则
        importanceThreshold: number; // 重要性阈值
        typeFilters: LocationType[]; // 位置类型过滤
      };
      connectionDisplayRules?: {
        enabled: boolean; // 是否启用连线显示规则
        weightThreshold: number; // 连线显示权重阈值
        typeFilters: ConnectionType[]; // 连线类型过滤
      };
    };
  };
}

// 添加 DisplayControl 类
class DisplayControl {
  // 检查位置是否应该显示
  shouldDisplayLocation(
    location: Location,
    scale: number,
    config: LocationRenderConfig
  ): boolean {
    if (scale < 0.05) return false;
    if (!location.isVisible) return false;
    
    const rules = config.zoomRules[scale]?.locationDisplayRules;
    if (!rules?.enabled) return false;
    
    // 检查重要性阈值
    const importanceValue = this.getImportanceValue(location.importance);
    if (importanceValue < rules.importanceThreshold) return false;
    
    // 检查类型过滤
    if (!rules.typeFilters.includes(location.type)) return false;
    
    return true;
  }
  
  // 检查连线是否应该显示
  shouldDisplayConnection(
    connection: Connection,
    scale: number,
    config: LocationRenderConfig
  ): boolean {
    if (scale < 0.1) return false;
    if (!connection.isVisible) return false;
    
    const rules = config.zoomRules[scale]?.connectionDisplayRules;
    if (!rules?.enabled) return false;
    
    // 检查权重阈值
    if (connection.weight.value < rules.weightThreshold) return false;
    
    // 检查类型过滤
    if (!rules.typeFilters.includes(connection.type)) return false;
    
    return true;
  }
  
  // 获取重要性数值
  private getImportanceValue(importance: LocationImportance): number {
    const importanceMap = {
      [LocationImportance.CRITICAL]: 1.0,
      [LocationImportance.IMPORTANT]: 0.75,
      [LocationImportance.NORMAL]: 0.5,
      [LocationImportance.MINOR]: 0.25
    };
    return importanceMap[importance];
  }
}

// 使用示例
const LocationRenderConfig: LocationRenderConfig = {
  scale: 0.08,
  showLabels: true,
  zoomRules: {
    0.08: {
      minImportance: LocationImportance.NORMAL,
      showConnections: true,
      connectionWeightThreshold: 0.7,
      locationDisplayRules: {
        enabled: true,
        importanceThreshold: 0.5,
        typeFilters: [LocationType.CAPITAL, LocationType.FORTRESS]
      },
      connectionDisplayRules: {
        enabled: true,
        weightThreshold: 0.7,
        typeFilters: [ConnectionType.MILITARY, ConnectionType.TRADE]
      }
    }
  }
};

// 创建显示控制实例
const displayControl = new DisplayControl();

// 检查是否应该显示
const LocationshouldShow = displayControl.shouldDisplayLocation(location, 0.08, LocationRenderConfig);