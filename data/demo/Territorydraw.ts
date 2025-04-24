// 势力类型枚举
enum TerritoryType {
    COUNTRY = 'country',
    RELIGION = 'religion',
    CULTURE = 'culture',
    ALLIANCE = 'alliance'
  }
  
  // 势力等级枚举
  enum TerritoryLevel {
    MAJOR = 'major',      // 主要势力
    MEDIUM = 'medium',    // 中等势力
    MINOR = 'minor'       // 次要势力
  }
  
  // 势力数据
  interface Territory {
    id: string;
    name: string;
    type: TerritoryType;
    level: TerritoryLevel;
    color: {
      r: number;
      g: number;
      b: number;
      a: number;
    };
    isVisible: boolean;    // 是否显示
    // 势力关系
    relations: {
      allies: string[];    // 盟友ID列表
      enemies: string[];   // 敌对ID列表
      conflicts: string[]; // 冲突区域ID列表
    };
  }
  
  // 正六边形块数据
  interface HexCell {
    id: string;
    center: {
      longitude: number;
      latitude: number;
    };
    territoryId: string;      // 所属势力ID
    // 边界和重叠信息
    overlaps: {
      territoryId: string;    // 重叠的势力ID
      percentage: number;     // 重叠比例 (0-1)
    }[];
    isConflictZone: boolean;  // 是否是冲突区域
    // 显示控制
    displayPriority: number;  // 显示优先级
  }
  
  // 势力地图数据
  interface TerritoryMapData {
    metadata: {
      version: string;
      name: string;
      description: string;
      createdAt: number;
      lastModified: number;
    };
    
    // 势力数据
    territories: Map<string, Territory>;
    
    // 六边形网格数据
    hexGrid: {
      cells: Map<string, HexCell>;
      // 空间索引
      spatialIndex: {
        // 按势力类型和等级组织的索引
        byTypeAndLevel: {
          [key in TerritoryType]: {
            [key in TerritoryLevel]: string[];  // 六边形ID列表
          };
        };
        // 冲突区域索引
        conflictZones: string[];  // 冲突区域六边形ID列表
      };
    };
    
    // 编辑历史
    editHistory: {
      records: TerritoryEditRecord[];
      maxRecords: number;
    };
    
    // 显示配置
    displayConfig: {
      visibleTypes: TerritoryType[];  // 当前显示的势力类型
      minLevel: TerritoryLevel;       // 最小显示等级
      showConflicts: boolean;         // 是否显示冲突区域
      aggregationEnabled: boolean;    // 是否启用聚合显示
    };
  }
  
  // 编辑记录
  interface TerritoryEditRecord {
    id: string;
    timestamp: number;
    type: 'create' | 'modify' | 'delete' | 'merge' | 'split' | 'visibility';
    targetId: string;
    previousData?: any;
    newData?: any;
  }
  
  // 渲染配置
  interface TerritoryRenderConfig {
    scale: number;                    // 当前缩放比例
    showBorders: boolean;             // 是否显示边界
    showLabels: boolean;              // 是否显示标签
    colorMode: 'solid' | 'gradient';  // 颜色模式
    // 缩放级别显示规则
    zoomRules: {
      [scale: number]: {
        minTerritorySize: number;     // 最小显示势力大小
        showConflicts: boolean;       // 是否显示冲突区域
        aggregationThreshold: number; // 聚合阈值
      };
    };
  }