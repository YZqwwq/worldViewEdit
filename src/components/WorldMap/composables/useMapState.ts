import { ref, computed } from 'vue';
import { useMapStore } from '../../../stores/mapStore';
import type { ViewState } from '../../../types/map';
import { debounce } from 'lodash';

// 定义基础状态类型
interface BaseState {
  offsetX: number;
  offsetY: number;
  scale: number;
  isDarkMode: boolean;
  isEditing: boolean;
  currentTool: string;
  layerVisibility: Record<string, boolean>;
}

// 定义系统错误类型
interface SystemError extends Error {
  code?: string;
  isSystemError?: boolean;
}

/**
 * 地图状态管理
 * 包含所有与地图状态相关的响应式变量和方法
 */
export function useMapState() {
  const mapStore = useMapStore();
  
  // 1. 基础状态（直接暴露）
  const baseState = {
    offsetX: ref(0),
    offsetY: ref(0),
    scale: ref(1),
    isDarkMode: ref(false),
    isEditing: ref(false),
    currentTool: ref('draw'),
    layerVisibility: ref<Record<string, boolean>>({})
  } as const;
  
  // 2. 派生状态（通过方法访问）
  const derivedState = {
    // 视口相关
    viewportTiles: computed(() => {
      // 计算当前视口内的瓦片坐标
      return {
        x: Math.floor(baseState.offsetX.value / 30),
        y: Math.floor(baseState.offsetY.value / 30)
      };
    }),
    
    // 图层相关
    layerBlendResult: computed(() => {
      // 计算图层混合结果
      return Object.entries(baseState.layerVisibility.value)
        .filter(([_, visible]) => visible)
        .map(([id]) => id);
    })
  };
  
  // 3. 状态同步
  const syncToStore = () => {
    const state: Partial<ViewState> = {
      offsetX: baseState.offsetX.value,
      offsetY: baseState.offsetY.value,
      scale: baseState.scale.value,
      isDarkMode: baseState.isDarkMode.value
    };
    mapStore.updateViewState(state);
  };
  
  // 防抖的状态同步
  const debouncedSyncToStore = debounce(syncToStore, 300);
  
  // 4. 状态更新方法
  const updateMethods = {
    // 批量更新
    batchUpdate(updates: Partial<BaseState>) {
      Object.entries(updates).forEach(([key, value]) => {
        const stateKey = key as keyof typeof baseState;
        if (stateKey in baseState) {
          baseState[stateKey].value = value;
        }
      });
      
      // 延迟同步到 store
      debouncedSyncToStore();
    },
    
    // 立即更新
    immediateUpdate(updates: Partial<BaseState>) {
      Object.entries(updates).forEach(([key, value]) => {
        const stateKey = key as keyof typeof baseState;
        if (stateKey in baseState) {
          baseState[stateKey].value = value;
        }
      });
      
      // 立即同步到 store
      syncToStore();
    },
    
    // 特定业务更新方法
    updateLayerVisibility(layerId: string, visible: boolean) {
      try {
        const newVisibility = { ...baseState.layerVisibility.value };
        newVisibility[layerId] = visible;
        baseState.layerVisibility.value = newVisibility;
        
        // 立即同步到 store
        syncToStore();
      } catch (error) {
        if (isSystemError(error)) {
          // 处理系统错误
          handleSystemError(error);
        } else {
          // 透传业务错误
          throw error;
        }
      }
    }
  };
  
  // 5. 错误处理
  const isSystemError = (error: unknown): error is SystemError => {
    return error instanceof Error && 'isSystemError' in error;
  };
  
  const handleSystemError = (error: SystemError) => {
    console.error('系统错误:', error);
    // 可以添加错误通知等
  };
  
  return {
    // 基础状态
    ...baseState,
    
    // 派生状态访问方法
    getViewportTiles: () => derivedState.viewportTiles.value,
    getLayerBlendResult: () => derivedState.layerBlendResult.value,
    
    // 状态更新方法
    ...updateMethods
  };
} 