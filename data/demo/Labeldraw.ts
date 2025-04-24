// 标签类型枚举
enum LabelType {
    LOCATION = 'location',    // 位置标签
    TERRITORY = 'territory',  // 势力标签
    REGION = 'region',       // 区域标签
    CUSTOM = 'custom'        // 自定义标签
  }
  
  // 标签样式
  interface LabelStyle {
    fontSize: number;        // 字体大小
    color: string;          // 字体颜色
    backgroundColor?: string; // 背景颜色
    padding: number;        // 内边距
    borderRadius: number;   // 圆角
    borderWidth?: number;   // 边框宽度
    borderColor?: string;   // 边框颜色
  }
  
  // 标签数据
  interface Label {
    id: string;
    type: LabelType;
    text: string;           // 标签文本
    position: {
      longitude: number;
      latitude: number;
    };
    // 关联数据
    relatedId?: string;     // 关联的位置ID或势力ID
    // 显示控制
    isVisible: boolean;
    // 样式
    style: LabelStyle;
    // 元数据
    metadata: {
      createdAt: number;
      lastModified: number;
      createdBy: string;
    };
  }
  
  // 标签地图数据
  interface LabelMapData {
    metadata: {
      version: string;
      name: string;
      description: string;
      createdAt: number;
      lastModified: number;
    };
    
    // 标签数据
    labels: Map<string, Label>;
    
    // 空间索引
    spatialIndex: {
      // 按类型组织的索引
      byType: {
        [key in LabelType]: string[];  // 标签ID列表
      };
      // 按位置组织的索引
      byPosition: Map<string, string[]>;  // key: "经度_纬度"，value: 该位置的标签ID列表
    };
    
    // 编辑历史
    editHistory: {
      records: LabelEditRecord[];
      maxRecords: number;
    };
    
    // 显示配置
    displayConfig: {
      visibleTypes: LabelType[];  // 当前显示的标签类型
      minScale: number;           // 最小显示缩放值 (0.1)
      showBackground: boolean;    // 是否显示背景
      showBorder: boolean;        // 是否显示边框
    };
  }
  
  // 编辑记录
  interface LabelEditRecord {
    id: string;
    timestamp: number;
    type: 'create' | 'modify' | 'delete' | 'visibility';
    targetId: string;
    previousData?: any;
    newData?: any;
  }
  
  // 渲染配置
  interface LabelRenderConfig {
    scale: number;
    isDarkMode: boolean;  // 是否暗色模式
    // 缩放级别显示规则
    zoomRules: {
      [scale: number]: {
        enabled: boolean;        // 是否启用标签显示
        fontSize: number;        // 字体大小
        typeFilters: LabelType[]; // 显示的标签类型
      };
    };
  }
  
  // 标签控制类
  class LabelControl {
    // 检查标签是否应该显示
    shouldDisplayLabel(
      label: Label,
      scale: number,
      config: LabelRenderConfig
    ): boolean {
      if (scale < 0.1) return false;
      if (!label.isVisible) return false;
      
      const rules = config.zoomRules[scale];
      if (!rules?.enabled) return false;
      
      // 检查类型过滤
      if (!rules.typeFilters.includes(label.type)) return false;
      
      return true;
    }
    
    // 获取标签样式
    getLabelStyle(
      label: Label,
      config: LabelRenderConfig
    ): LabelStyle {
      const baseStyle = label.style;
      const scale = config.scale;
      
      return {
        ...baseStyle,
        fontSize: baseStyle.fontSize * scale,  // 根据缩放调整字体大小
        // 暗色模式调整
        color: config.isDarkMode ? this.adjustColorForDarkMode(baseStyle.color) : baseStyle.color,
        backgroundColor: config.isDarkMode ? this.adjustColorForDarkMode(baseStyle.backgroundColor) : baseStyle.backgroundColor
      };
    }
    
    // 暗色模式颜色调整
    private adjustColorForDarkMode(color?: string): string {
      if (!color) return '';
      // 实现暗色模式颜色调整逻辑
      return color;  // 这里需要实现具体的颜色调整算法
    }
  }
  
  // 使用示例
  const LabelRenderConfig: LabelRenderConfig = {
    scale: 0.15,
    isDarkMode: false,
    zoomRules: {
      0.15: {
        enabled: true,
        fontSize: 14,
        typeFilters: [LabelType.LOCATION, LabelType.TERRITORY]
      }
    }
  };
  
  // 创建标签控制实例
  const labelControl = new LabelControl();
  
  // 假设有一个标签对象
  const label: Label = {
    id: 'label1',
    type: LabelType.LOCATION,
    text: '首都',
    position: {
      longitude: 0,
      latitude: 0
    },
    isVisible: true,
    style: {
      fontSize: 14,
      color: '#000000',
      backgroundColor: '#FFFFFF',
      padding: 4,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: '#CCCCCC'
    },
    metadata: {
      createdAt: Date.now(),
      lastModified: Date.now(),
      createdBy: 'user1'
    }
  };
  
  // 检查是否应该显示
  const LabelshouldShow = labelControl.shouldDisplayLabel(label, 0.15, LabelRenderConfig);
