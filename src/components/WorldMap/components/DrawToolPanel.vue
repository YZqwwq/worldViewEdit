<template>
  <FloatingPanel title="绘图工具" :initialX="5" :initialY="60">
    <div class="draw-tool-panel">
      <!-- 地形类型选择 -->
      <div class="terrain-type">
        <h4>地形类型</h4>
        <select v-model="selectedTerrain" class="terrain-select">
          <option value="陆地">陆地</option>
          <option value="海洋">海洋</option>
          <option value="山地">山地</option>
          <option value="沙漠">沙漠</option>
          <option value="草原">草原</option>
          <option value="森林">森林</option>
        </select>
      </div>

      <!-- 绘图工具 -->
      <div class="drawing-tools">
        <h4>绘图工具</h4>
        <div class="tools-grid">
          <button 
            v-for="tool in drawingTools" 
            :key="tool.id"
            :class="['tool-btn', { active: currentTool === tool.id }]"
            :title="tool.name"
            @click="selectTool(tool.id)"
          >
            <i :class="tool.icon"></i>
          </button>
        </div>
      </div>

      <!-- 线条宽度 -->
      <div class="line-width">
        <h4>线条宽度</h4>
        <div class="width-control">
          <input 
            type="range" 
            v-model="lineWidth" 
            min="1" 
            max="20" 
            step="1"
            class="width-slider"
          />
          <span class="width-value">{{ lineWidth }}px</span>
        </div>
      </div>
    </div>
  </FloatingPanel>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import FloatingPanel from './FloatingPanel.vue';

// 绘图工具列表
const drawingTools = [
  { id: 'pen', name: '画笔', icon: 'fas fa-pen' },
  { id: 'eraser', name: '橡皮擦', icon: 'fas fa-eraser' },
  { id: 'select', name: '选区', icon: 'fas fa-vector-square' }
];

// 响应式状态
const selectedTerrain = ref('陆地');
const currentTool = ref('pen');
const lineWidth = ref(2);

// 选择工具
function selectTool(toolId: string) {
  currentTool.value = toolId;
  // 触发工具改变事件
  emit('tool-change', { tool: toolId });
}

// 定义事件
const emit = defineEmits(['tool-change', 'terrain-change', 'width-change']);

// 监听值变化
watch(selectedTerrain, (newValue: string) => {
  emit('terrain-change', newValue);
});

watch(lineWidth, (newValue: number) => {
  emit('width-change', newValue);
});
</script>

<style lang="scss" scoped>
.draw-tool-panel {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 15px;
  min-width: 200px;

  h4 {
    margin: 0 0 8px 0;
    font-size: 14px;
    color: var(--text-primary);
  }

  .terrain-select {
    width: 100%;
    padding: 6px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background-color: var(--bg-secondary);
    color: var(--text-primary);
  }

  .tools-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .tool-btn {
    padding: 8px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background-color: var(--bg-secondary);
    color: var(--text-primary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      background-color: var(--hover-color);
    }

    &.active {
      background-color: var(--accent-primary);
      color: white;
    }
  }

  .width-control {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .width-slider {
    flex: 1;
    -webkit-appearance: none;
    height: 4px;
    border-radius: 2px;
    background: var(--border-color);

    &::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: var(--accent-primary);
      cursor: pointer;
    }
  }

  .width-value {
    min-width: 40px;
    text-align: right;
    font-size: 12px;
    color: var(--text-secondary);
  }
}

:deep(.dark-mode) {
  .draw-tool-panel {
    background-color: var(--bg-primary-dark);
    
    .terrain-select,
    .tool-btn {
      background-color: var(--bg-secondary-dark);
      border-color: var(--border-color-dark);
      color: var(--text-primary-dark);
    }

    .tool-btn.active {
      background-color: var(--accent-primary-dark);
    }
  }
}
</style> 