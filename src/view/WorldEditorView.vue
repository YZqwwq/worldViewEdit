<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useWorldStore } from '../stores/worldStore';
import EditorSidebar from '../components/WorldEditor/EditorSidebar.vue';
import EditorMain from '../components/WorldEditor/EditorMain.vue';
import type { WorldData } from '../electron';

// 定义当前选中的侧边栏项
const activeItem = ref('世界观');

// 使用Pinia store
const worldStore = useWorldStore();

// 获取路由器实例和当前路由
const router = useRouter();
const route = useRoute();

// 在组件挂载时获取世界观ID
onMounted(() => {
  // 从URL参数中获取世界观ID
  const id = route.query.id as string;
  console.log('WorldEditorView mounted, id:', id);
  if (id) {
    // 使用store加载世界观数据
    worldStore.loadWorldData(id).then(() => {
      console.log('World data loaded:', worldStore.$state.worldData);
      // 将worldData添加到路由查询参数中
      router.push({
        path: route.path,
        query: {
          ...route.query,
          worldData: JSON.stringify(worldStore.$state.worldData)
        }
      });
    });
  } else {
    // 没有ID参数，显示错误
    worldStore.$patch({ 
      isLoading: false,
      errorMsg: '未提供世界观ID'
    });
  }
});

// 当选择标题时的处理函数
function handleSelectTitle(title: string) {
  // 更新当前选中的标题，添加前缀以区分
  activeItem.value = `世界观:${title}`;
}

// 处理从编辑器中提取的标题
function handleExtractTitles(titles: Array<{title: string, level: number, position: number}>) {
  worldStore.updateExtractedTitles(titles);
}

// 处理内容更新
function handleUpdateContent(content: any) {
  worldStore.updateContent(content);
}

// 处理完整世界观数据更新
function handleUpdateWorldData(updatedData: WorldData) {
  worldStore.updateWorldData(updatedData);
}

// 返回主页面
function goBack() {
  router.push('/');
}
</script>

<template>
  <div class="editor-container">
    <!-- 使用侧边栏组件 -->
    <EditorSidebar 
      v-model:activeItem="activeItem"
      :worldTitles="worldStore.$state.extractedTitles"
      @back="goBack"
      @selectTitle="handleSelectTitle"
    />
    
    <!-- 使用主编辑区域组件，使用store的isDataLoaded getter来确定何时渲染 -->
    <EditorMain
      v-if="worldStore.isDataLoaded"
      :isLoading="worldStore.$state.isLoading"
      :errorMsg="worldStore.$state.errorMsg || ''"
      :worldData="(worldStore.$state.worldData || {}) as WorldData"
      :activeItem="activeItem"
      @back="goBack"
      @updateContent="handleUpdateContent"
      @updateWorldData="handleUpdateWorldData"
      @extractTitles="handleExtractTitles"
    />
    
    <!-- 数据加载中的占位显示 -->
    <div v-else class="loading-container">
      <div class="loading-spinner"></div>
      <p>正在加载世界观数据...</p>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.editor-container {
  display: flex;
  height: 100vh;
  width: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
  position: relative;
  background-color: var(--bg-primary);
}

/* 添加加载中样式 */
.loading-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  
  .loading-spinner {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 3px solid rgba(0, 100, 200, 0.2);
    border-top-color: #0066cc;
    animation: spin 1s infinite linear;
  }
  
  p {
    margin-top: 1rem;
    color: var(--text-secondary);
  }
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style> 