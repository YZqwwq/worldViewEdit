<script setup lang="ts">
import { defineProps, defineEmits, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import type { WorldData } from '../../electron';
import ProseMirrorEditor from './ProseMirrorEditor.vue';

// 定义接收的属性
const props = defineProps<{
  isLoading: boolean,
  errorMsg: string,
  worldData: WorldData,
  activeItem: string 
}>();

// 定义事件
const emit = defineEmits<{
  (e: 'back'): void,
  (e: 'updateContent', content: string): void,
  (e: 'updateWorldData', worldData: WorldData): void,
  (e: 'extractTitles', titles: {title: string, level: number, position: number}[]): void
}>();

// 编辑器内容
const editorContent = ref('');

// 编辑器实例引用
const editorRef = ref(null);

// 组件刷新机制
const componentKey = ref(0);
function refreshComponent() {
  componentKey.value += 1;
}

// 监听主题变化事件
function handleThemeChange(event: CustomEvent) {
  console.log('EditorMain组件检测到主题变化:', event.detail.theme);
  setTimeout(() => {
    refreshComponent();
  }, 0);
}

// 当选中的项目变化时，自动滚动到对应标题位置
watch(() => props.activeItem, (newValue) => {
  if (newValue.startsWith('世界观:')) {
    const titleName = newValue.substring(4);
    scrollToTitle(titleName);
  }
});

// 在组件挂载后初始化内容
onMounted(() => {
  // 添加主题变化监听
  document.addEventListener('theme-changed', handleThemeChange as EventListener);
  
  // 初始化编辑器内容
  if (!props.isLoading && props.worldData.content) {
    // 优先从main_setting_of_the_worldview中获取内容
    if (props.worldData.content.main_setting_of_the_worldview?.content?.text) {
      editorContent.value = props.worldData.content.main_setting_of_the_worldview.content.text;
    } 
    // 兼容旧版数据，尝试加载markdown字段
    else if (props.worldData.content.markdown) {
      editorContent.value = props.worldData.content.markdown;
    } 
    // 不再提供默认模板，使用空字符串
    else {
      editorContent.value = '';
    }
  } else {
    // 不再提供默认模板，使用空字符串
    editorContent.value = '';
  }
  
  // 初始提取标题
  extractTitlesFromContent();
  
  // 初始化时记录当前主题
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  console.log('EditorMain组件初始化，当前主题:', currentTheme);
});

onBeforeUnmount(() => {
  document.removeEventListener('theme-changed', handleThemeChange as EventListener);
});

// 滚动到指定标题
function scrollToTitle(titleName: string) {
  // 暂时不实现，后续需要通过ProseMirror实现
  console.log('请求滚动到标题:', titleName);
}

// 从内容中提取标题
function extractTitlesFromContent() {
  const titles: {title: string, level: number, position: number}[] = [];
  const lines = editorContent.value.split('\n');
  
  let position = 0;
  
  lines.forEach(line => {
    // 匹配Markdown标题格式: # 标题、## 标题、### 标题等
    // 修改正则表达式，使其也支持没有空格的标题格式，如 #标题、##标题
    const match = line.match(/^(#{1,5})(\s+)?(.+)$/);
    if (match) {
      const level = match[1].length; // #的数量表示标题等级
      const title = match[3].trim();
      titles.push({
        title,
        level,
        position
      });
    }
    position += line.length + 1; // +1 是换行符
  });
  
  // 发送提取的标题到父组件
  emit('extractTitles', titles);
}

// 当内容变化时自动提取标题
function handleContentChange() {
  extractTitlesFromContent();
}

// 保存内容
function saveContent() {
  // 创建当前时间戳
  const now = new Date().toISOString();
  
  // 准备要更新的完整世界观数据
  const updatedWorldData: WorldData = {
    ...props.worldData,
    updatedAt: now,
    content: {
      ...props.worldData.content,
      main_setting_of_the_worldview: {
        updatedAt: now,
        content: {
          text: editorContent.value
        }
      }
    }
  };
  
  // 发送更新整个世界观数据的事件
  emit('updateWorldData', updatedWorldData);
  
  console.log('保存的世界观数据:', updatedWorldData);
}

// 返回主页面
function goBack() {
  emit('back');
}
</script>

<template>
  <div class="editor-main" :key="componentKey">
    <div class="editor-content">
      <!-- 加载状态或错误信息 -->
      <div v-if="isLoading" class="loading-state">
        <span class="loading-text">正在加载世界观数据...</span>
      </div>
      
      <div v-else-if="errorMsg" class="error-state">
        <span class="error-text">{{ errorMsg }}</span>
        <button class="back-to-home-button" @click="goBack">返回主页</button>
      </div>
      
      <!-- 世界观编辑器 -->
      <div v-else-if="worldData.id" class="world-editor">
        <div class="editor-header">
          <h1 class="world-title">{{ worldData.name }}</h1>
          <div class="world-meta">
            <div class="world-info">
              <p>创建时间: {{ new Date(worldData.createdAt).toLocaleString() }}</p>
              <p>更新时间: {{ new Date(worldData.updatedAt).toLocaleString() }}</p>
              <p>存储位置: store/world_{{ worldData.id }}.json</p>
            </div>
            <div class="action-buttons">
              <button class="save-button" @click="saveContent">保存内容</button>
            </div>
          </div>
        </div>
        
        <!-- Markdown编辑区域 -->
        <div class="markdown-editor">
          <div class="editor-toolbar">
            <div class="toolbar-tip">
              使用 # 创建一级标题，## 创建二级标题，以此类推（最多支持五级标题 #####）
              <br>注：标题符号与文字之间的空格可选，如 ##标题 或 ## 标题 均有效
            </div>
          </div>
          
          <!-- 使用ProseMirror编辑器替代textarea -->
          <ProseMirrorEditor 
            ref="editorRef"
            v-model="editorContent"
            @change="handleContentChange"
            placeholder="在此输入内容，使用Markdown语法创建标题..."
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.editor-main {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  background-color: var(--bg-primary);
  overflow-y: auto;
}

.editor-content {
  width: 100%;
  max-width: 1000px;
  padding: 20px;
}

.editor-header {
  margin-bottom: 30px;
}

.world-title {
  font-size: 28px;
  color: var(--text-primary);
  margin-bottom: 10px;
}

.world-meta {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.world-info {
  background-color: var(--bg-secondary);
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 20px;
  flex: 1;
  
  p {
    margin: 5px 0;
    font-size: 14px;
    color: var(--text-secondary);
  }
}

.action-buttons {
  margin-left: 15px;
}

.editor-toolbar {
  background-color: var(--bg-secondary);
  padding: 10px 15px;
  border-radius: 4px 4px 0 0;
  border: 1px solid var(--border-color);
  border-bottom: none;
}

.toolbar-tip {
  font-size: 12px;
  color: var(--text-tertiary);
  font-style: italic;
}

.save-button {
  padding: 8px 15px;
  background-color: var(--button-primary-bg);
  color: var(--button-primary-text);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s;
  
  &:hover {
    background-color: var(--accent-primary-dark);
  }
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  width: 100%;
}

.loading-text {
  font-size: 18px;
  color: var(--text-secondary);
}

.error-text {
  font-size: 18px;
  color: var(--error);
  margin-bottom: 20px;
}

.back-to-home-button {
  padding: 8px 16px;
  background-color: var(--button-primary-bg);
  color: var(--button-primary-text);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s;
  
  &:hover {
    background-color: var(--accent-primary-dark);
  }
}
</style> 