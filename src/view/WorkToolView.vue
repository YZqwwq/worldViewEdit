<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useWorldStore } from '../stores/worldStore';

// 使用Pinia store
const worldStore = useWorldStore();

// 获取路由器实例和当前路由
const router = useRouter();
const route = useRoute();

// 在组件挂载时获取世界观ID
onMounted(() => {
  // 从URL参数中获取世界观ID
  const id = route.query.id as string;
  if (id) {
    worldStore.loadWorldData(id);
  }
});

// 返回主页面
function goBack() {
  router.push('/');
}

// 跳转到地图编辑器
function goToMap() {
  if (worldStore.$state.id) {
    router.push({
      path: '/map',
      query: { id: worldStore.$state.id }
    });
  }
}

// 跳转到角色编辑器
function goToCharacters() {
  if (worldStore.$state.id) {
    router.push({
      path: '/characters',
      query: { id: worldStore.$state.id }
    });
  }
}

// 跳转到世界观编辑器
function goToWorldView() {
  if (worldStore.$state.id) {
    router.push({
      path: '/editor/world',
      query: { id: worldStore.$state.id }
    });
  }
}
</script>

<template>
  <div class="tool-container">
    <div class="tool-header">
      <h1>世界观工具</h1>
      <button class="back-btn" @click="goBack">返回</button>
    </div>
    
    <div class="tool-buttons">
      <button class="tool-btn" @click="goToWorldView">
        <i class="fas fa-globe"></i>
        <span>世界观编辑器</span>
      </button>
      
      <button class="tool-btn" @click="goToMap">
        <i class="fas fa-map"></i>
        <span>地图编辑器</span>
      </button>
      
      <button class="tool-btn" @click="goToCharacters">
        <i class="fas fa-users"></i>
        <span>角色编辑器</span>
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.tool-container {
  padding: 20px;
  
  .tool-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
    
    h1 {
      margin: 0;
      font-size: 24px;
    }
    
    .back-btn {
      padding: 8px 16px;
      background-color: var(--error);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      
      &:hover {
        background-color: var(--error-dark);
      }
    }
  }
  
  .tool-buttons {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
    
    .tool-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background-color: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      
      &:hover {
        background-color: var(--bg-hover);
        transform: translateY(-2px);
      }
      
      i {
        font-size: 32px;
        margin-bottom: 10px;
        color: var(--accent-primary);
      }
      
      span {
        font-size: 16px;
        color: var(--text-primary);
      }
    }
  }
}
</style>
