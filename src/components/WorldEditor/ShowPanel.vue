<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { defineProps } from 'vue';

const props = defineProps<{
  activeItem: string;
  worldTitles?: Array<{title: string, level: number, position: number}>;
}>();

const selectedTitle = ref('');

// 监听主题变化事件
function handleThemeChange(event: CustomEvent) {
  console.log('ShowPanel组件检测到主题变化:', event.detail.theme);
  // 在下一个微任务中执行DOM更新，确保CSS变量已应用
  setTimeout(() => {
    refreshComponent();
  }, 0);
}

// 强制组件刷新
const componentKey = ref(0);
function refreshComponent() {
  componentKey.value += 1;
}

// 监听事件
onMounted(() => {
  // 添加主题变化监听
  document.addEventListener('theme-changed', handleThemeChange as EventListener);
  
  // 根据activeItem设置初始选中标题
  if (props.activeItem.startsWith('世界观:')) {
    selectedTitle.value = props.activeItem.substring(4);
  }
  
  // 初始化时记录当前主题
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  console.log('ShowPanel组件初始化，当前主题:', currentTheme);
});

onBeforeUnmount(() => {
  document.removeEventListener('theme-changed', handleThemeChange as EventListener);
});

// 监听activeItem变化
watch(() => props.activeItem, (newValue) => {
  if (newValue.startsWith('世界观:')) {
    selectedTitle.value = newValue.substring(4);
  } else {
    selectedTitle.value = '';
  }
});

// 根据当前activeItem返回要显示的内容
const panelContent = computed(() => {
  if (props.activeItem === '开始') {
    return 'start';
  } else if (props.activeItem === '角色') {
    return 'characters';
  } else if (props.activeItem === '地点') {
    return 'locations';
  } else if (props.activeItem === '事件') {
    return 'events';
  } else if (props.activeItem === '时间线') {
    return 'timeline';
  } else if (props.activeItem === '设定集') {
    return 'settings';
  } else if (props.activeItem.startsWith('世界观:')) {
    return 'worldview';
  } else if (props.activeItem === '世界观') {
    return 'worldview-all';
  }
  return 'start';
});

// 查找标题下的子标题(仅查找直接子标题)
const childTitles = computed(() => {
  if (!props.worldTitles || selectedTitle.value === '') return [];
  
  const currentTitle = props.worldTitles.find(t => t.title === selectedTitle.value);
  if (!currentTitle) return [];
  
  const currentLevel = currentTitle.level;
  const currentPosition = currentTitle.position;
  
  // 查找紧跟其后且级别为currentLevel+1的标题
  return props.worldTitles.filter(t => {
    return t.position > currentPosition && 
           t.level === currentLevel + 1 && 
           t.position < (props.worldTitles?.find(next => 
             next.position > currentPosition && 
             next.level <= currentLevel)?.position || Infinity);
  });
});

// 获取当前标题的内容(模拟)
function getCurrentTitleContent() {
  return `这是《${selectedTitle.value}》的详细内容...

这里将来会显示编辑器中的实际内容，目前仅作为界面演示。

当前标题: ${selectedTitle.value}
层级: ${props.worldTitles?.find(t => t.title === selectedTitle.value)?.level || '未知'}
`;
}

function getFunctionalName(key: string | null): string {
  const nameMap: Record<string, string> = {
    'characters': '角色管理',
    'locations': '地点管理',
    'events': '事件管理',
    'timeline': '时间线管理',
    'settings': '设定集管理',
    'worldview': '世界观'
  };
  
  return key && nameMap[key] ? nameMap[key] : '功能';
}
</script>

<template>
  <div class="show-panel" :key="componentKey">
    <!-- 开始页面 -->
    <div v-if="panelContent === 'start'" class="panel-container welcome-panel">
      <h1>欢迎使用世界观编辑器</h1>
      <p class="welcome-text">请从左侧菜单选择功能开始创作</p>
      <div class="feature-list">
        <div class="feature-item">
          <div class="feature-icon">📝</div>
          <div class="feature-title">世界观</div>
          <div class="feature-desc">构建完整的世界观体系</div>
        </div>
        <div class="feature-item">
          <div class="feature-icon">👤</div>
          <div class="feature-title">角色</div>
          <div class="feature-desc">创建和管理故事中的角色</div>
        </div>
        <div class="feature-item">
          <div class="feature-icon">🏙️</div>
          <div class="feature-title">地点</div>
          <div class="feature-desc">设计故事发生的场景和地点</div>
        </div>
        <div class="feature-item">
          <div class="feature-icon">⏰</div>
          <div class="feature-title">时间线</div>
          <div class="feature-desc">梳理故事的时间脉络</div>
        </div>
      </div>
    </div>

    <!-- 世界观标题内容 -->
    <div v-else-if="panelContent === 'worldview' && selectedTitle" class="panel-container worldview-content">
      <div class="content-header">
        <h2>{{ selectedTitle }}</h2>
        <div class="header-actions">
          <button class="action-button edit-button">编辑</button>
          <button class="action-button delete-button">删除</button>
        </div>
      </div>
      
      <div class="subtitle-section" v-if="childTitles.length > 0">
        <h3>子标题</h3>
        <div class="subtitle-list">
          <div 
            v-for="title in childTitles" 
            :key="title.title"
            class="subtitle-item"
          >
            {{ title.title }}
          </div>
        </div>
      </div>
      
      <div class="content-body">
        <p class="content-text">{{ getCurrentTitleContent() }}</p>
      </div>
    </div>

    <!-- 世界观总览 -->
    <div v-else-if="panelContent === 'worldview-all'" class="panel-container worldview-overview">
      <h2>世界观总览</h2>
      <p v-if="!worldTitles || worldTitles.length === 0" class="empty-message">
        还没有创建任何世界观内容，点击左侧"+"按钮开始创建
      </p>
      <div v-else class="worldview-tree">
        <div 
          v-for="title in worldTitles" 
          :key="title.position"
          class="tree-item"
          :style="{ paddingLeft: `${(title.level - 1) * 20 + 10}px` }"
        >
          <span class="tree-item-title">{{ title.title }}</span>
        </div>
      </div>
    </div>

    <!-- 其他功能页（角色/地点/事件/时间线/设定集） -->
    <div v-else class="panel-container coming-soon">
      <h2>功能开发中</h2>
      <p>{{ getFunctionalName(panelContent) }} 正在开发中...</p>
      <div class="coming-soon-icon">🚧</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.show-panel {
  flex-grow: 1;
  height: 100vh;
  overflow-y: auto;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  transition: background-color 0.3s, color 0.3s;
}

.panel-container {
  padding: 30px;
  max-width: 1200px;
  margin: 0 auto;
}

.welcome-panel {
  text-align: center;
  
  h1 {
    margin-bottom: 20px;
    color: var(--text-primary);
    font-size: 28px;
    font-weight: bold;
  }
  
  .welcome-text {
    font-size: 16px;
    color: var(--text-secondary);
    margin-bottom: 40px;
  }
}

.feature-list {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 30px;
  margin-top: 40px;
}

.feature-item {
  width: 180px;
  padding: 20px;
  border-radius: 10px;
  background-color: var(--bg-secondary);
  box-shadow: var(--box-shadow);
  cursor: pointer;
  transition: transform 0.3s, box-shadow 0.3s, background-color 0.3s;
  
  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 6px 15px rgba(0, 0, 0, 0.25);
    background-color: var(--bg-hover);
  }
  
  .feature-icon {
    font-size: 36px;
    margin-bottom: 15px;
  }
  
  .feature-title {
    font-size: 18px;
    font-weight: bold;
    margin-bottom: 8px;
    color: var(--accent-primary);
  }
  
  .feature-desc {
    font-size: 14px;
    color: var(--text-secondary);
  }
}

.worldview-content {
  .content-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
    padding-bottom: 15px;
    border-bottom: 1px solid var(--border-color);
    
    h2 {
      font-size: 24px;
      font-weight: bold;
      color: var(--text-primary);
    }
  }
  
  .header-actions {
    display: flex;
    gap: 10px;
  }
  
  .action-button {
    padding: 8px 15px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
    transition: background-color 0.3s;
    
    &.edit-button {
      background-color: var(--accent-primary);
      color: white;
      
      &:hover {
        background-color: var(--accent-primary-dark);
      }
    }
    
    &.delete-button {
      background-color: var(--error);
      color: white;
      
      &:hover {
        background-color: var(--error-dark);
      }
    }
  }
  
  .subtitle-section {
    margin-bottom: 30px;
    
    h3 {
      font-size: 18px;
      margin-bottom: 15px;
      color: var(--text-primary);
    }
  }
  
  .subtitle-list {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  
  .subtitle-item {
    padding: 8px 15px;
    background-color: var(--bg-secondary);
    border-radius: 4px;
    font-size: 14px;
    cursor: pointer;
    border: 1px solid var(--border-color);
    transition: background-color 0.3s;
    
    &:hover {
      background-color: var(--bg-hover);
    }
  }
  
  .content-body {
    background-color: var(--bg-secondary);
    padding: 20px;
    border-radius: 6px;
    border: 1px solid var(--border-color);
    margin-top: 20px;
    
    .content-text {
      white-space: pre-line;
      line-height: 1.6;
      color: var(--text-primary);
    }
  }
}

.worldview-overview {
  h2 {
    margin-bottom: 30px;
    font-size: 24px;
    font-weight: bold;
    color: var(--text-primary);
  }
  
  .empty-message {
    color: var(--text-tertiary);
    font-style: italic;
    padding: 30px 0;
    text-align: center;
  }
  
  .worldview-tree {
    background-color: var(--bg-secondary);
    border-radius: 6px;
    border: 1px solid var(--border-color);
    padding: 10px 0;
    margin-top: 20px;
  }
  
  .tree-item {
    padding: 10px;
    transition: background-color 0.3s;
    display: flex;
    align-items: center;
    
    &:hover {
      background-color: var(--bg-hover);
    }
    
    .tree-item-title {
      font-size: 14px;
      color: var(--text-primary);
    }
  }
}

.coming-soon {
  text-align: center;
  padding-top: 100px;
  
  h2 {
    margin-bottom: 20px;
    font-size: 24px;
    font-weight: bold;
    color: var(--text-primary);
  }
  
  p {
    color: var(--text-secondary);
    margin-bottom: 40px;
  }
  
  .coming-soon-icon {
    font-size: 60px;
    margin-top: 40px;
  }
}
</style> 