<script setup lang="ts">
import { defineProps, defineEmits, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRouter, useRoute } from 'vue-router';

// 获取路由实例
const router = useRouter();
const route = useRoute();

// 定义接收的属性
const props = defineProps<{
  worldTitles?: Array<{title: string, level: number, position: number}>
}>();

// 定义事件
const emit = defineEmits<{
  (e: 'selectTitle', title: string): void
  (e: 'back'): void
}>();

// 展开状态
const isWorldExpanded = ref(false);

// 监听路由变化
watch(() => route.path, (newPath) => {
  // 如果路径包含世界观，则展开世界观菜单
  isWorldExpanded.value = newPath.includes('/editor/world');
});

// 监听主题变化事件
const componentKey = ref(0);
function refreshComponent() {
  componentKey.value += 1;
}

function handleThemeChange(event: CustomEvent) {
  console.log('侧边栏组件检测到主题变化:', event.detail.theme);
  setTimeout(() => {
    refreshComponent();
  }, 0);
}

// 监听事件
onMounted(() => {
  document.addEventListener('theme-changed', handleThemeChange as EventListener);
  // 初始化展开状态
  isWorldExpanded.value = route.path.includes('/editor/world');
});

onBeforeUnmount(() => {
  document.removeEventListener('theme-changed', handleThemeChange as EventListener);
});

// 处理世界观点击
function handleWorldClick() {
  // 如果当前不在世界观路由，则导航到世界观
  if (!route.path.includes('/editor/world')) {
    router.push('/editor/world');
  }
  
  // 切换展开/折叠状态
  isWorldExpanded.value = !isWorldExpanded.value;
}

// 选择标题
function selectTitle(title: string) {
  // 只触发事件，让父组件处理编辑器内的跳转
  emit('selectTitle', title);
}

// 返回主页面
function goBack() {
  router.push('/');
}

// 计算缩进空间
function getTitleIndentStyle(level: number) {
  const paddingLeft = (level - 1) * 12 + 20;
  return { paddingLeft: `${paddingLeft}px` };
}

// 获取标题显示文本（截断过长标题）
function getTitleDisplayText(title: string, level: number) {
  const maxLength = 28 - level * 2;
  if (title.length <= maxLength) return title;
  return title.substring(0, maxLength - 3) + '...';
}
</script>

<template>
  <div class="editor-sidebar" :key="componentKey">
    <div class="editor-title">
      Fantya world editor
    </div>
    
    <!-- 导航菜单项 -->
    <div class="nav-menu">
      <!-- 世界观项（可展开） -->
      <div class="nav-item-container">
        <div 
          class="nav-item with-arrow" 
          :class="{ 
            active: route.path.includes('/editor/world'),
            expanded: isWorldExpanded
          }"
          @click="handleWorldClick"
        >
          <span>世界观</span>
          <span class="arrow">{{ isWorldExpanded ? '▼' : '▶' }}</span>
        </div>
        
        <!-- 世界观子菜单 - 标题列表 -->
        <div class="sub-menu" v-show="isWorldExpanded">
          <div 
            v-for="(title, index) in worldTitles || []" 
            :key="index"
            class="sub-menu-item"
            :class="{ 
              active: route.path === `/editor/world/${title.title}`,
              'level-1': title.level === 1,
              'level-2': title.level === 2,
              'level-3': title.level === 3,
              'level-4': title.level === 4,
              'level-5': title.level === 5
            }"
            :style="getTitleIndentStyle(title.level)"
            @click.stop="selectTitle(title.title)"
          >
            <span class="title-text">{{ getTitleDisplayText(title.title, title.level) }}</span>
          </div>
          <div v-if="!worldTitles || worldTitles.length === 0" class="sub-menu-empty">
            暂无标题
          </div>
        </div>
      </div>
    </div>
    
    <!-- 返回按钮 -->
    <div class="back-button" @click="goBack">
      <i class="fas fa-arrow-left"></i>
      <span>返回</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.editor-sidebar {
  width: 180px;
  height: 100vh;
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow-y: auto;
  border-right: 1px solid var(--border-color);
  box-shadow: 2px 0 4px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.editor-title {
  padding: 20px 10px;
  font-size: 16px;
  font-weight: bold;
  border-bottom: 1px solid var(--border-color);
  text-align: center;
  color: var(--text-primary);
}

.nav-menu {
  display: flex;
  flex-direction: column;
  margin-top: 10px;
}

.nav-item-container {
  display: flex;
  flex-direction: column;
}

.nav-item {
  padding: 15px 10px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-color-light);
  text-align: center;
  transition: background-color 0.3s, color 0.3s;
  
  &:hover {
    background-color: var(--sidebar-hover-bg);
  }
  
  &.active {
    background-color: var(--sidebar-active-bg);
    color: var(--sidebar-active-text);
    font-weight: bold;
  }
  
  &.with-arrow {
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    .arrow {
      font-size: 12px;
      transition: transform 0.3s;
      color: var(--accent-primary);
    }
    
    &.expanded .arrow {
      transform: rotate(0deg);
    }
  }
}

.sub-menu {
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  max-height: 60vh;
  overflow-y: auto;
  transition: background-color 0.3s, border-color 0.3s;
}

.sub-menu-item {
  padding: 8px 10px;
  font-size: 13px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-color-light);
  display: flex;
  align-items: center;
  transition: background-color 0.3s, color 0.3s;
  
  &:last-child {
    border-bottom: none;
  }
  
  &:hover {
    background-color: var(--sidebar-hover-bg);
  }
  
  &.active {
    background-color: var(--sidebar-active-bg);
    color: var(--sidebar-active-text);
    font-weight: bold;
  }
  
  &.level-1 {
    font-weight: bold;
    font-size: 14px;
  }
  
  &.level-2 {
    font-weight: normal;
    font-size: 13px;
  }
  
  &.level-3, &.level-4, &.level-5 {
    font-weight: normal;
    font-size: 12px;
    color: var(--text-secondary);
  }
  
  .title-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.sub-menu-empty {
  padding: 10px;
  font-size: 12px;
  color: var(--text-tertiary);
  text-align: center;
  font-style: italic;
}

.back-button {
  margin-top: auto;
  padding: 20px 0;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  transition: background-color 0.3s;
  background-color: var(--error);
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  
  &:hover {
    background-color: var(--error-dark);
  }
}

.menu-item {
  padding: 15px 10px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-color-light);
  text-align: center;
  transition: background-color 0.3s, color 0.3s;
  
  &:hover {
    background-color: var(--sidebar-hover-bg);
  }
  
  &.active {
    background-color: var(--sidebar-active-bg);
    color: var(--sidebar-active-text);
    font-weight: bold;
  }
}
</style> 