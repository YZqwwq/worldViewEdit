<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import WorkToolMainPanel from '../components/WorkTool/WorkToolMainPanel.vue';

const router = useRouter();

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
    
    <WorkToolMainPanel />
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
