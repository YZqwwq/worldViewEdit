<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useWorldStore } from '../stores/worldStore';
import { useMapStore } from '../stores/mapStore';
import { useCharacterStore } from '../stores/characterStore';
import { useFactionsStore } from '../stores/factionsStore';

// 使用 Pinia stores
const worldStore = useWorldStore();
const mapStore = useMapStore();
const router = useRouter();
const route = useRoute();

// 加载状态和错误状态
const isLoading = ref(false);
const error = ref<string | null>(null);

// 在组件挂载时加载数据
onMounted(async () => {
  const id = route.query.id as string;
  console.log('WorkToolView mounted, id:', id);
  if (!id) {
    error.value = '未找到世界ID';
    return;
  }

  try {
    isLoading.value = true;
    await worldStore.loadWorldData(id);
    
    // 确保地图数据已加载
    if (worldStore.worldData?.content?.world_map) {
      const mapData = worldStore.worldData.content.world_map;
      
      // 更新地图数据
      mapStore.updateMapData({
        metadata: {
          version: '1.0.0',
          name: mapData.name || '',
          description: mapData.description || '',
          createdAt: Date.now(),
          lastModified: Date.now()
        },
        viewState: {
          offsetX: mapData.viewState?.offsetX || 0,
          offsetY: mapData.viewState?.offsetY || 0,
          scale: mapData.viewState?.scale || 0.35,
          isDarkMode: mapData.viewState?.isDarkMode || false
        },
        editState: {
          currentTool: 'select',
          selectedId: null,
          isEditing: false
        },
        locations: new Map(Object.entries(mapData.locations || {})),
        connections: new Map(Object.entries(mapData.connections || {})),
        territories: new Map(Object.entries(mapData.territories || {})),
        labels: new Map(Object.entries(mapData.labels || {}))
      });
    }

    console.log("mapStore,worktoolview",mapStore.mapData.viewState.scale)
    
    // 确保角色数据已加载
    if (worldStore.worldData?.content?.character) {
      const characterStore = useCharacterStore();
      Object.entries(worldStore.worldData.content.character).forEach(([id, char]) => {
        characterStore.addCharacter(id, char as any);
      });
    }
    
    // 确保阵营数据已加载
    if (worldStore.worldData?.content?.factions) {
      const factionsStore = useFactionsStore();
      Object.entries(worldStore.worldData.content.factions).forEach(([id, faction]) => {
        factionsStore.addFaction(id, faction as any);
      });
    }
    
    isLoading.value = false;
  } catch (e) {
    error.value = '加载世界数据失败：' + (e instanceof Error ? e.message : String(e));
    isLoading.value = false;
  }
});

// 返回主页面
function goBack() {
  router.push('/');
}

// 跳转到地图编辑器
function goToMap() {
  if (!worldStore.$state.id) {
    error.value = '请先选择一个世界';
    return;
  }
  router.push({
    path: '/map',
    query: { id: worldStore.$state.id }
  });
}

// 跳转到角色编辑器
function goToCharacters() {
  if (!worldStore.$state.id) {
    error.value = '请先选择一个世界';
    return;
  }
  router.push({
    path: '/characters',
    query: { id: worldStore.$state.id }
  });
}

// 跳转到世界观编辑器
function goToWorldView() {
  if (!worldStore.$state.id) {
    error.value = '请先选择一个世界';
    console.log(worldStore.$state.content.main_setting_of_the_worldview.content.text);
    return;
  }
  router.push({
    path: '/editor/world',
    query: { id: worldStore.$state.id }
  });
}
</script>

<template>
  <div class="tool-container">
    <div class="tool-header">
      <h1>世界观工具</h1>
      <button class="back-btn" @click="goBack">返回</button>
    </div>
    
    <div v-if="isLoading" class="loading-state">
      <i class="fas fa-spinner fa-spin"></i>
      <span>加载中...</span>
    </div>
    
    <div v-else-if="error" class="error-state">
      <i class="fas fa-exclamation-circle"></i>
      <span>{{ error }}</span>
    </div>
    
    <div v-else class="tool-buttons">
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
  
  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    text-align: center;
    
    i {
      font-size: 32px;
      margin-bottom: 16px;
    }
    
    span {
      font-size: 16px;
    }
  }
  
  .error-state {
    color: var(--error);
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
