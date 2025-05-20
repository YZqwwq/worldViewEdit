import { ref, Ref } from 'vue';
import { DrawOptions, DrawPoint } from '../utils/DrawingEngine';
import { useMapCacheStore } from '../utils/mapCacheStore';
import { DrawToolType } from './useLayerTools';

// 历史记录项接口
export interface HistoryItem {
  id: number;                // 唯一操作ID
  type: DrawToolType;        // 操作类型：'pen' | 'eraser' | 'select'
  data: {
    points: DrawPoint[];     // 绘制点数据
    options: DrawOptions;    // 绘图选项(颜色、线宽等)
  };
  timestamp: number;         // 操作时间戳
  eventId?: number;          // 绘制事件ID，用于关联相同的绘制操作
}

// 历史记录管理器返回类型
export interface HistoryManagerReturn {
  addHistory: (item: HistoryItem) => void;    // 添加历史记录
  undo: () => HistoryItem | null;             // 撤销操作
  redo: () => HistoryItem | null;             // 重做操作
  clear: () => void;                          // 清空历史记录
  getCurrentHistoryState: () => HistoryItem[]; // 获取当前历史状态(所有应用的操作)
  getAllHistory: () => HistoryItem[];         // 获取所有历史记录
  canUndo: Ref<boolean>;                      // 是否可以撤销
  canRedo: Ref<boolean>;                      // 是否可以重做
  historyCount: Ref<number>;                  // 历史记录数量
}

/**
 * 历史记录管理器
 * 管理绘图操作的历史记录，支持撤销和重做
 * 
 * @param maxHistory 最大历史记录数，默认为30
 * @param layerId 图层ID，用于与mapCacheStore交互
 * @returns 历史记录管理器接口
 */
export function useLayerToolsHistory(
  maxHistory: number = 30,
  layerId: string = 'map'
): HistoryManagerReturn {
  // 历史记录数组
  const history: HistoryItem[] = [];
  
  // 重做栈
  const redoStack: HistoryItem[] = [];
  
  // 当前历史位置索引
  let currentIndex: number = -1;
  
  // 可观察的状态
  const canUndo = ref(false);
  const canRedo = ref(false);
  const historyCount = ref(0);
  
  // 获取缓存存储实例
  const mapCacheStore = useMapCacheStore();
  
  /**
   * 更新可观察状态
   */
  const updateState = (): void => {
    canUndo.value = currentIndex >= 0;
    canRedo.value = redoStack.length > 0;
    historyCount.value = history.length;
  };
  
  /**
   * 添加历史记录
   * @param item 历史记录项
   */
  const addHistory = (item: HistoryItem): void => {
    // 添加新记录时清空重做栈
    if (redoStack.length > 0) {
      redoStack.length = 0;
    }
    
    // 如果不是在历史记录末尾，删除当前位置之后的记录
    if (currentIndex < history.length - 1) {
      history.splice(currentIndex + 1);
    }
    
    // 添加新记录
    history.push({...item});
    currentIndex = history.length - 1;
    
    // 如果超出最大历史记录数，删除最早的记录
    if (history.length > maxHistory) {
      history.shift();
      currentIndex--;
    }
    
    // 更新mapCacheStore的历史状态 - 使用存在的方法
    // 注意：MapCache类中已经有saveHistory方法，但该方法未在store中暴露
    // 这里调用getLayer获取对应图层实例并直接调用其saveHistory方法
    const cacheLayer = mapCacheStore.getLayer(layerId);
    if (cacheLayer) {
      cacheLayer.saveHistory();
    }
    
    // 更新可观察状态
    updateState();
    
    console.log(`添加历史记录: ID=${item.id}, 类型=${item.type}, 总数=${history.length}`);
  };
  
  /**
   * 撤销操作
   * @returns 撤销后的当前状态，如果无法撤销则返回null
   */
  const undo = (): HistoryItem | null => {
    if (currentIndex < 0) return null;
    
    // 将当前状态移到重做栈
    const item = history[currentIndex];
    redoStack.push({...item});
    
    // 回退当前索引
    currentIndex--;
    
    // 通知mapCacheStore执行撤销
    mapCacheStore.undo(layerId);
    
    // 更新可观察状态
    updateState();
    
    console.log(`撤销操作: ID=${item.id}, 当前索引=${currentIndex}`);
    
    // 返回撤销后的当前状态
    return currentIndex >= 0 ? {...history[currentIndex]} : null;
  };
  
  /**
   * 重做操作
   * @returns 重做后应用的状态，如果无法重做则返回null
   */
  const redo = (): HistoryItem | null => {
    if (redoStack.length === 0) return null;
    
    // 从重做栈取出一项
    const item = redoStack.pop()!;
    
    // 将索引前进
    currentIndex++;
    
    // 如果因为历史限制丢失了原始记录，则重新添加
    if (currentIndex >= history.length) {
      history.push({...item});
    }
    
    // 通知mapCacheStore执行重做
    mapCacheStore.redo(layerId);
    
    // 更新可观察状态
    updateState();
    
    console.log(`重做操作: ID=${item.id}, 当前索引=${currentIndex}`);
    
    return {...item};
  };
  
  /**
   * 清空历史记录
   */
  const clear = (): void => {
    history.length = 0;
    redoStack.length = 0;
    currentIndex = -1;
    
    // 更新可观察状态
    updateState();
    
    console.log('清空历史记录');
  };
  
  /**
   * 获取当前历史状态下的所有已应用操作
   * @returns 当前状态下的所有操作数组(0到currentIndex)
   */
  const getCurrentHistoryState = (): HistoryItem[] => {
    return history.slice(0, currentIndex + 1).map(item => ({...item}));
  };
  
  /**
   * 获取所有历史记录
   * @returns 所有历史记录数组的副本
   */
  const getAllHistory = (): HistoryItem[] => {
    return [...history];
  };
  
  // 初始化状态
  updateState();
  
  return {
    addHistory,
    undo,
    redo,
    clear,
    getCurrentHistoryState,
    getAllHistory,
    canUndo,
    canRedo,
    historyCount
  };
}

/**
 * 创建标准的历史记录项
 * 工具函数，帮助创建符合HistoryItem接口的对象
 * 
 * @param type 操作类型
 * @param points 绘制点
 * @param options 绘图选项
 * @param eventId 可选的事件ID
 * @returns 创建的历史记录项
 */
export function createHistoryItem(
  type: DrawToolType, 
  points: DrawPoint[], 
  options: DrawOptions,
  eventId?: number
): HistoryItem {
  return {
    id: Date.now() + Math.floor(Math.random() * 1000), // 生成唯一ID
    type,
    data: {
      points: [...points], // 复制点数组
      options: {...options} // 复制选项对象
    },
    timestamp: Date.now(),
    eventId
  };
}
