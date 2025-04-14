<script setup lang="ts">
import { defineProps, defineEmits, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import type { WorldData } from '../../electron';

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
  (e: 'extractTitles', titles: {title: string, level: number, position: number}[]): void
}>();

// 编辑器内容
const editorContent = ref('');

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
  if (!props.isLoading && props.worldData.content && props.worldData.content.markdown) {
    editorContent.value = props.worldData.content.markdown;
  } else {
    // 提供默认模板
    editorContent.value = 
`# ${props.worldData.name || '世界观名称'}

## 背景设定

在这里描述世界的基本背景和设定...

## 主要时间线

### 远古时代

远古时代的重要事件...

### 中世纪

中世纪的重要事件...

## 世界规则

### 魔法系统

这个世界的魔法是如何运作的...

### 科技水平

这个世界的科技发展到了什么程度...

## 重要地点

## 重要人物
`;
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
  // 使用简单的正则表达式匹配标题行
  const titleRegex = new RegExp(`^(#{1,5})\\s+${titleName}$`, 'm');
  const match = editorContent.value.match(titleRegex);
  
  if (match && match.index !== undefined) {
    // 找到标题在文本中的位置
    const titlePosition = match.index;
    
    // 计算行号
    const contentBeforeTitle = editorContent.value.substring(0, titlePosition);
    const linesBefore = contentBeforeTitle.split('\n').length - 1;
    
    // 获取编辑器元素
    const editorElement = document.querySelector('.content-editor') as HTMLTextAreaElement;
    if (editorElement) {
      // 设置光标位置
      editorElement.focus();
      
      // 计算每行的平均高度
      const lineHeight = editorElement.scrollHeight / editorElement.value.split('\n').length;
      
      // 滚动到该行
      editorElement.scrollTop = lineHeight * linesBefore;
    }
  }
}

// 从内容中提取标题
function extractTitlesFromContent() {
  const titles: {title: string, level: number, position: number}[] = [];
  const lines = editorContent.value.split('\n');
  
  let position = 0;
  
  lines.forEach(line => {
    // 匹配Markdown标题格式: # 标题、## 标题、### 标题等
    const match = line.match(/^(#{1,5})\s+(.+)$/);
    if (match) {
      const level = match[1].length; // #的数量表示标题等级
      const title = match[2].trim();
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
  emit('updateContent', editorContent.value);
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
            </div>
          </div>
          
          <textarea 
            class="content-editor" 
            v-model="editorContent"
            @input="handleContentChange"
            placeholder="在此输入内容，使用Markdown语法创建标题..."
          ></textarea>
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

.content-editor {
  width: 100%;
  min-height: 500px;
  padding: 15px;
  border: 1px solid var(--border-color);
  border-radius: 0 0 4px 4px;
  font-size: 16px;
  line-height: 1.6;
  resize: vertical;
  font-family: 'Courier New', Courier, monospace;
  background-color: var(--editor-bg);
  color: var(--editor-text);
  
  &:focus {
    border-color: var(--accent-primary);
    outline: none;
  }
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