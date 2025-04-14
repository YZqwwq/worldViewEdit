/**
 * 主题管理工具
 * 负责处理应用主题的切换和持久化
 */

// 主题类型
export type ThemeType = 'light' | 'dark' | 'system';

// 主题管理类
class ThemeManager {
  private currentTheme: ThemeType = 'light';
  private systemThemeMediaQuery: MediaQueryList | null = null;
  private mediaQueryHandler: ((e: MediaQueryListEvent) => void) | null = null;
  
  constructor() {
    // 创建系统主题媒体查询
    if (window.matchMedia) {
      this.systemThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.setupSystemThemeListener();
    }
  }
  
  // 初始化主题管理器
  async initialize(): Promise<void> {
    try {
      // 从设置中读取主题
      if (window.electronAPI) {
        const settings = await window.electronAPI.data.readFile('settings.json');
        if (settings && typeof settings === 'object') {
          // 安全地获取主题，确保它是有效的
          const theme = settings.theme;
          if (theme && ['light', 'dark', 'system'].includes(theme)) {
            this.setTheme(theme);
            return;
          } else {
            console.warn('设置中的主题值无效:', theme);
          }
        } else {
          console.warn('读取到的设置不是有效对象:', settings);
        }
      } else {
        console.warn('electronAPI不可用，使用默认主题');
      }
      
      // 默认使用系统主题
      this.setTheme('system');
    } catch (error) {
      console.error('初始化主题失败:', error);
      // 出错时使用浅色主题
      this.setTheme('light');
    }
  }
  
  // 获取当前主题
  getTheme(): ThemeType {
    return this.currentTheme;
  }
  
  // 获取实际应用的主题（对system主题进行解析）
  getEffectiveTheme(): 'light' | 'dark' {
    if (this.currentTheme === 'system') {
      return this.getSystemTheme();
    }
    return this.currentTheme;
  }
  
  // 设置主题
  setTheme(theme: ThemeType): void {
    this.currentTheme = theme;
    
    // 应用主题到DOM
    const effectiveTheme = this.getEffectiveTheme();
    this.applyThemeToDOM(effectiveTheme);
    
    console.log(`主题已切换为: ${theme} (实际: ${effectiveTheme})`);
  }
  
  // 应用主题到DOM
  private applyThemeToDOM(theme: 'light' | 'dark'): void {
    // 设置根元素data-theme属性
    document.documentElement.setAttribute('data-theme', theme);
    
    // 设置body类
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(`theme-${theme}`);
    
    // 分发自定义事件，通知所有组件主题已更改
    const event = new CustomEvent('theme-changed', { 
      detail: { theme, effectiveTheme: theme } 
    });
    document.dispatchEvent(event);
  }
  
  // 获取系统主题
  private getSystemTheme(): 'light' | 'dark' {
    if (this.systemThemeMediaQuery && this.systemThemeMediaQuery.matches) {
      return 'dark';
    }
    return 'light';
  }
  
  // 监听系统主题变化
  private setupSystemThemeListener(): void {
    if (!this.systemThemeMediaQuery) return;
    
    // 移除旧的监听器（如果存在）
    if (this.mediaQueryHandler) {
      this.systemThemeMediaQuery.removeEventListener('change', this.mediaQueryHandler);
    }
    
    // 创建新的监听器
    this.mediaQueryHandler = (e: MediaQueryListEvent) => {
      if (this.currentTheme === 'system') {
        const newTheme = e.matches ? 'dark' : 'light';
        this.applyThemeToDOM(newTheme);
        console.log(`系统主题已变更为: ${newTheme}`);
      }
    };
    
    // 添加监听器
    this.systemThemeMediaQuery.addEventListener('change', this.mediaQueryHandler);
  }
}

// 创建单例实例
const themeManager = new ThemeManager();
export default themeManager; 