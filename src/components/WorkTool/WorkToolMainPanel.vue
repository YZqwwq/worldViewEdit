<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();

// 工具列表
const tools = [
  {
    id: 'world-text',
    name: '世界观文本编辑器',
    icon: 'fa-file-alt',
    path: '/editor/world'
  },
  {
    id: 'world-map',
    name: '世界地图编辑器',
    icon: 'fa-map',
    path: '/editor/map'
  },
  {
    id: 'character',
    name: '角色设定编辑器',
    icon: 'fa-user',
    path: '/editor/characters'
  }
];

// 打开工具
function openTool(path: string) {
  router.push(path);
}
</script>

<template>
  <div class="tool-panel">
    <div class="tool-grid">
      <div 
        v-for="tool in tools" 
        :key="tool.id"
        class="tool-card"
        @click="openTool(tool.path)"
      >
        <div class="tool-icon">
          <i :class="['fas', tool.icon]"></i>
        </div>
        <div class="tool-name">{{ tool.name }}</div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.tool-panel {
  flex: 1;
  padding: 2rem;
  overflow-y: auto;
  
  .tool-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 2rem;
    max-width: 1200px;
    margin: 0 auto;
  }
  
  .tool-card {
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    cursor: pointer;
    transition: all 0.3s;
    
    &:hover {
      transform: translateY(-5px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      border-color: var(--accent-primary);
      
      .tool-icon {
        background-color: var(--accent-primary);
        color: white;
      }
    }
    
    .tool-icon {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background-color: var(--bg-tertiary);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s;
      
      i {
        font-size: 24px;
        color: var(--text-primary);
      }
    }
    
    .tool-name {
      font-size: 1.1rem;
      font-weight: 500;
      color: var(--text-primary);
      text-align: center;
    }
  }
}
</style>
