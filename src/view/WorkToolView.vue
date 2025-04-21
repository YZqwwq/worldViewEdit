<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useWorldStore } from '../stores/worldStore';
import WorkToolMainPanel from '../components/WorkTool/WorkToolMainPanel.vue';

const router = useRouter();
const route = useRoute();
const worldStore = useWorldStore();

// 世界观ID
const worldId = ref('');

// 在组件挂载时获取并处理世界观ID
onMounted(() => {
  const id = route.query.id as string;
  if (id) {
    worldId.value = id;
    // 预加载世界观数据
    worldStore.loadWorldData(id);
  }
});

// 打开工具
function handleToolSelect(path: string) {
  // 如果有世界观ID，则传递给目标路由
  if (worldId.value) {
    router.push({
      path: path,
      query: { id: worldId.value }
    });
  } else {
    router.push(path);
  }
}

// 返回主页面
function goBack() {
  router.push('/');
}
</script>

<template>
  <div class="work-tool-container">
    <div class="tool-header">
      <button class="back-button" @click="goBack">
        <i class="fas fa-arrow-left"></i>
        返回
      </button>
      <h1>工具</h1>
    </div>
    
    <WorkToolMainPanel @select-tool="handleToolSelect" />
  </div>
</template>

<style lang="scss" scoped>
.work-tool-container {
  height: 100vh;
  width: 100%;
  background-color: var(--bg-primary);
  display: flex;
  flex-direction: column;
  
  .tool-header {
    display: flex;
    align-items: center;
    padding: 1rem;
    background-color: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    
    .back-button {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 4px;
      background-color: var(--accent-primary);
      color: white;
      cursor: pointer;
      transition: background-color 0.2s;
      
      &:hover {
        background-color: var(--accent-secondary);
      }
      
      i {
        font-size: 0.9rem;
      }
    }
    
    h1 {
      margin: 0 0 0 1rem;
      font-size: 1.5rem;
      color: var(--text-primary);
    }
  }
}
</style>
