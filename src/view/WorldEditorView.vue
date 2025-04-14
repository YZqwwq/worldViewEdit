<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import type { WorldData } from '../electron';
import EditorSidebar from '../components/WorldEditor/EditorSidebar.vue';
import EditorMain from '../components/WorldEditor/EditorMain.vue';

// 定义当前选中的侧边栏项
const activeItem = ref('世界观');
// 当前编辑的世界观ID
const worldId = ref('');
// 当前编辑的世界观数据
const worldData = ref<WorldData>({
  id: '',
  name: '',
  createdAt: '',
  updatedAt: '',
  description: '',
  content: {}
});

// 提取的标题列表
const extractedTitles = ref<Array<{title: string, level: number, position: number}>>([]);

// 加载状态
const isLoading = ref(true);
const errorMsg = ref('');

// 获取路由器实例和当前路由
const router = useRouter();
const route = useRoute();

// 在组件挂载时获取世界观ID
onMounted(() => {
  // 从URL参数中获取世界观ID
  const id = route.query.id as string;
  if (id) {
    worldId.value = id;
    // 加载世界观数据
    loadWorldData(id);
  } else {
    // 没有ID参数，显示错误
    isLoading.value = false;
    errorMsg.value = '未提供世界观ID';
  }
});

// 加载世界观数据
async function loadWorldData(id: string) {
  isLoading.value = true;
  errorMsg.value = '';
  
  try {
    if (window.electronAPI) {
      // 使用新的 API
      const data = await window.electronAPI.data.readFile(`world_${id}.json`);
      if (data) {
        worldData.value = data;
      } else {
        errorMsg.value = `找不到ID为 ${id} 的世界观数据`;
      }
    } else {
      console.warn('electronAPI 不可用，可能在浏览器环境中运行');
      // 模拟数据用于浏览器开发环境
      const now = new Date().toISOString();
      worldData.value = {
        id: id,
        name: `世界观_${id.substring(0, 4)}`,
        createdAt: now,
        updatedAt: now,
        description: '这是一个模拟的世界观数据',
        content: {}
      };
    }
  } catch (error) {
    console.error('加载世界观数据失败:', error);
    errorMsg.value = '加载世界观数据失败: ' + (error instanceof Error ? error.message : String(error));
  } finally {
    isLoading.value = false;
  }
}

// 当选择标题时的处理函数
function handleSelectTitle(title: string) {
  console.log('选择了标题:', title);
  // 标题选择的逻辑由EditorMain组件内部处理，这里不需要额外操作
}

// 处理从编辑器中提取的标题
function handleExtractTitles(titles: Array<{title: string, level: number, position: number}>) {
  console.log('提取到标题数量:', titles.length);
  extractedTitles.value = titles;
}

// 处理内容更新
function handleUpdateContent(content: string) {
  console.log('更新内容, 长度:', content.length);
  
  // 更新世界观数据
  if (!worldData.value.content) {
    worldData.value.content = {};
  }
  
  // 保存Markdown内容
  worldData.value.content.markdown = content;
  
  // 更新时间戳
  worldData.value.updatedAt = new Date().toISOString();
  
  // 保存更新后的数据
  saveWorldData();
}

// 保存世界观数据
async function saveWorldData() {
  try {
    if (window.electronAPI && worldId.value) {
      // 使用Electron API保存数据
      await window.electronAPI.data.saveFile(`world_${worldId.value}.json`, worldData.value);
      console.log('世界观数据保存成功');
    } else {
      console.warn('无法保存数据，electronAPI不可用或worldId为空');
    }
  } catch (error) {
    console.error('保存世界观数据失败:', error);
  }
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
      :worldTitles="extractedTitles"
      @back="goBack"
      @selectTitle="handleSelectTitle"
    />
    
    <!-- 使用主编辑区域组件 -->
    <EditorMain
      :isLoading="isLoading"
      :errorMsg="errorMsg"
      :worldData="worldData"
      :activeItem="activeItem"
      @back="goBack"
      @updateContent="handleUpdateContent"
      @extractTitles="handleExtractTitles"
    />
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
  background-color: #f5f5f5;
}
</style> 