<script setup lang="ts">
import { defineProps, defineEmits, ref, watch, onMounted, onBeforeUnmount, computed } from 'vue';
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
  const content = editorContent.value;
  if (!content) {
    emit('extractTitles', []);
    return;
  }
  
  // 使用正则表达式匹配所有标题
  const titleRegex = /^(#{1,6})\s+(.+)$/gm;
  const titles = [];
  let match;
  
  while ((match = titleRegex.exec(content)) !== null) {
    titles.push({
      title: match[2].trim(),
      level: match[1].length,
      position: match.index
    });
  }
  
  console.log('提取到标题数量:', titles.length);
  emit('extractTitles', titles);
}

// 当内容变化时自动提取标题
function handleContentChange() {
  extractTitlesFromContent();
}

// 保存内容
function saveContent() {
  // 提取新的标题
  extractTitlesFromContent();
  
  // 更新内容
  handleContentChange();
  
  console.log('手动保存内容');
}

// 返回主页面
function goBack() {
  emit('back');
}

// 定义是否是世界观内容
const isWorldviewContent = computed(() => {
  // 世界观相关的内容
  return props.activeItem === '世界观' || 
         props.activeItem.startsWith('世界观:') || 
         props.activeItem === '地图' ||
         props.activeItem === '人物';
});

// 获取标题函数
function getHeaderTitle() {
  if (props.activeItem === '世界观') {
    return '世界观总览';
  } else if (props.activeItem.startsWith('世界观:')) {
    return props.activeItem.substring(4); // 移除"世界观:"前缀
  } else if (props.activeItem === '地图') {
    return '地图编辑';
  } else if (props.activeItem === '人物') {
    return '人物管理';
  }
  return props.activeItem;
}
</script>

<template>
  <div class="editor-main" :key="componentKey">
    <!-- 加载状态 -->
    <div v-if="isLoading" class="editor-loading">
      <div class="loading-spinner"></div>
      <p>正在加载内容...</p>
    </div>
    
    <!-- 错误提示 -->
    <div v-else-if="errorMsg" class="editor-error">
      <p>{{ errorMsg }}</p>
    </div>
    
    <!-- 编辑器区域 -->
    <div v-else class="editor-container">
      <!-- 世界观内容编辑器 -->
      <div v-if="isWorldviewContent" class="editor-content-container">
        <div class="editor-header">
          <h2>{{ getHeaderTitle() }}</h2>
        </div>
        
        <div class="editor-content-wrapper">
          <ProseMirrorEditor
            ref="editorRef"
            v-model="editorContent"
            placeholder="开始创作你的世界观..."
            @change="handleContentChange"
          />
        </div>
      </div>
      
      <!-- 其他内容类型的显示容器 -->
      <div v-else class="other-content-container">
        <!-- 这里可以根据activeItem显示不同的内容编辑组件 -->
        <p>{{ activeItem }} 编辑器开发中...</p>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.editor-main {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background-color: var(--bg-primary);

  // 编辑器容器
  .editor-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  // 编辑器内容容器
  .editor-content-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    
    .editor-header {
      padding: 1rem;
      border-bottom: 1px solid var(--border-color);
      background-color: var(--bg-secondary);
      
      h2 {
        margin: 0;
        font-size: 1.4rem;
        color: var(--text-primary);
      }
    }
    
    .editor-content-wrapper {
      flex: 1;
      height: calc(100% - 60px); // 减去header高度
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
  }

  // 加载状态
  .editor-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    
    .loading-spinner {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: 3px solid rgba(var(--accent-primary-rgb), 0.2);
      border-top-color: var(--accent-primary);
      animation: spin 1s infinite linear;
    }
    
    p {
      margin-top: 1rem;
      color: var(--text-secondary);
    }
  }
  
  // 错误提示
  .editor-error {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 2rem;
    color: var(--error-color, #f44336);
    text-align: center;
  }
  
  // 其他内容容器
  .other-content-container {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-secondary);
    text-align: center;
  }
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style> 