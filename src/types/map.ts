// 基础类型
export interface Position {
  offsetX: number;
  offsetY: number;
}

// 地图数据 - 整合所有数据结构
export interface WorldMapData {
  // 元数据
  metadata: {
    version: string; // 版本号
    name: string; // 地图名称
    description: string; // 地图描述
    createdAt: number; // 创建时间
    lastModified: number; // 最后修改时间
  };
  
  // 视图状态
  viewState: {
    offsetX: number; // 偏移量x  
    offsetY: number; // 偏移量y
    scale: number; // 缩放比例
    isDarkMode: boolean; // 是否为暗黑模式
  };
  
  // 编辑状态
  editState: {
    currentTool: 'mapdraw' | 'territory' | 'location' | 'connection' | 'label' | 'select' ; // 当前工具 先写死方便未来检查
    selectedId: string | null; // 选中的ID
    isEditing: boolean; // 是否处于编辑状态
  };

  mapfiles:string[];
  
  // 重要位置数据
  locations: Map<string, {
    id: string; // 位置ID
    name: string; // 位置名称
    type: string; // 位置类型
    importance: string; // 位置重要性
    position: Position; // 位置坐标
    description: string; // 位置描述
    territories: string[]; // 位置所属势力
    isVisible: boolean; // 位置是否可见
    displayPriority: number; // 位置显示优先级
    connections: string[]; // 位置连接
  }>;
  
  // 连接数据
  connections: Map<string, {
    id: string; // 连接ID
    start: string; // 起始位置ID
    end: string; // 终止位置ID
    type: string; // 连接类型
    weight: {
      value: number; // 连接权重
      description: string; // 连接描述
    };
    description: string; // 连接描述
    isVisible: boolean; // 连接是否可见
  }>;
  
  // 势力数据
  territories: Map<string, {
    id: string; // 势力ID
    name: string; // 势力名称
    type: string; // 势力类型
    color: string; // 势力颜色
    description: string; // 势力描述
    members: string[]; // 势力成员
    isVisible: boolean;
    displayPriority: number;
  }>;
  
  // 标签数据
  labels: Map<string, {
    id: string; // 标签ID
    type: string; // 标签类型
    text: string; // 标签文本
    position: Position; // 标签位置
    relatedId?: string; // 关联ID
    isVisible: boolean; // 标签是否可见
    style: {  
      fontSize: number; // 字体大小
      color: string; // 字体颜色
      backgroundColor?: string; // 背景颜色
      padding: number; // 内边距
      borderRadius: number; // 边框圆角
      borderWidth?: number; // 边框宽度
      borderColor?: string; // 边框颜色
    };
    metadata: {
      createdAt: number; // 创建时间
      lastModified: number; // 最后修改时间
    };
  }>;
}

// 地图状态
export interface MapState {
  mapData: WorldMapData;
  isLoading: boolean;
}