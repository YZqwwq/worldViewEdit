import { defineStore } from 'pinia';
import type { WorldData } from '../electron';

// 定义store的状态类型
interface WorldState {
  worldData: WorldData;
  isLoading: boolean;
  errorMsg: string;
  extractedTitles: Array<{title: string, level: number, position: number}>;
}

export const useWorldStore = defineStore('world', {

  state: (): WorldState => ({
    
    worldData: {
      id: '',
      name: '',
      createdAt: '',
      updatedAt: '',
      description: '',
      content: {}
    },

    isLoading: true,
    errorMsg: '',
    extractedTitles: []
  }),
  
  getters: {
    isDataLoaded(state: WorldState): boolean {
      return !!state.worldData.id && !state.isLoading;
    }
  },
  
  actions: {
    async loadWorldData(id: string) {
      this.isLoading = true;
      this.errorMsg = '';
      
      try {
        if (window.electronAPI) {
          console.log(`正在从文件读取世界观数据, ID: ${id}`);
          const data = await window.electronAPI.data.readFile(`world_${id}.json`);
          console.log('读取到的原始数据:', data);
          
          if (data) {
            this.worldData = data;
            console.log('赋值后的worldData:', JSON.stringify(this.worldData, null, 2));
            
            console.log('worldData ID:', this.worldData.id);
            console.log('worldData name:', this.worldData.name);
            console.log('worldData content结构:', 
              this.worldData.content ? 
              Object.keys(this.worldData.content).join(', ') : 
              'content为空');
            
            if(this.worldData.content?.main_setting_of_the_worldview?.content?.text) {
              console.log('世界观文本内容长度:', this.worldData.content.main_setting_of_the_worldview.content.text.length);
              console.log('世界观文本内容前50个字符:', this.worldData.content.main_setting_of_the_worldview.content.text.substring(0, 50));
            } else {
              console.log('没有找到世界观文本内容');
            }
          } else {
            this.errorMsg = `找不到ID为 ${id} 的世界观数据`;
          }
        } else {
          console.warn('electronAPI 不可用，可能在浏览器环境中运行');
          // 模拟数据用于浏览器开发环境
          const now = new Date().toISOString();
          this.worldData = {
            id: id,
            name: `世界观_${id.substring(0, 4)}`,
            createdAt: now,
            updatedAt: now,
            description: '这是一个模拟的世界观数据',
            content: {
              "text": "# aldskfja;"
            }
          };
        }
      } catch (error) {
        console.error('加载世界观数据失败:', error);
        this.errorMsg = '加载世界观数据失败: ' + (error instanceof Error ? error.message : String(error));
      } finally {
        this.isLoading = false;
      }
    },
    
    updateExtractedTitles(titles: Array<{title: string, level: number, position: number}>) {
      console.log('提取到标题数量:', titles.length);
      this.extractedTitles = titles;
    },
    
    updateContent(content: any) {
      console.log('更新内容，对象类型:', typeof content);
      
      try {
        // 更新世界观数据
        if (!this.worldData.content) {
          this.worldData.content = {};
        }
        
        // 确保content是对象类型
        if (typeof content === 'string') {
          try {
            // 尝试将字符串解析为JSON对象
            content = JSON.parse(content);
          } catch (parseError) {
            console.error('解析内容字符串失败:', parseError);
            // 如果解析失败，将内容保存到main_setting_of_the_worldview中
            if (!this.worldData.content.main_setting_of_the_worldview) {
              this.worldData.content.main_setting_of_the_worldview = {
                updatedAt: new Date().toISOString(),
                content: { text: content }
              };
            } else {
              this.worldData.content.main_setting_of_the_worldview.updatedAt = new Date().toISOString();
              this.worldData.content.main_setting_of_the_worldview.content = { text: content };
            }
            this.worldData.updatedAt = new Date().toISOString();
            this.saveWorldData();
            return;
          }
        }
        
        // 将内容合并到worldData.content中
        this.worldData.content = {
          ...content,
          // 确保main_setting_of_the_worldview存在
          main_setting_of_the_worldview: {
            updatedAt: new Date().toISOString(),
            content: content.main_setting_of_the_worldview?.content || {}
          },
          // 确保worldmaps存在
          worldmaps: content.worldmaps || {},
          // 确保characters存在
          characters: content.characters || {}
        };
        
        console.log('结构化内容已更新:', this.worldData.content);
      } catch (error) {
        console.error('处理内容更新失败:', error);
        
        // 如果发生其他错误，尝试作为纯文本处理
        if (typeof content === 'string') {
          if (!this.worldData.content) {
            this.worldData.content = { 
              main_setting_of_the_worldview: {
                updatedAt: new Date().toISOString(),
                content: { text: content }
              }
            };
          } else {
            if (!this.worldData.content.main_setting_of_the_worldview) {
              this.worldData.content.main_setting_of_the_worldview = {
                updatedAt: new Date().toISOString(),
                content: { text: content }
              };
            } else {
              this.worldData.content.main_setting_of_the_worldview.content = { text: content };
              this.worldData.content.main_setting_of_the_worldview.updatedAt = new Date().toISOString();
            }
          }
        }
      }
      
      // 更新时间戳
      this.worldData.updatedAt = new Date().toISOString();
      
      // 保存更新后的数据
      this.saveWorldData();
    },
    
    updateWorldData(updatedData: WorldData) {
      console.log('接收到完整世界观数据更新');
      
      // 直接使用更新的世界观数据
      this.worldData = updatedData;
      
      // 保存更新后的数据
      this.saveWorldData();
    },
    
    async saveWorldData() {
      try {
        if (window.electronAPI && this.worldData.id) {
          // 将Vue响应式对象转换为普通JavaScript对象
          const plainData = JSON.parse(JSON.stringify(this.worldData));
          
          // 使用Electron API保存数据
          await window.electronAPI.data.saveFile(`world_${this.worldData.id}.json`, plainData);
          console.log('世界观数据保存成功');
        } else {
          console.warn('无法保存数据，electronAPI不可用或worldId为空');
        }
      } catch (error) {
        console.error('保存世界观数据失败:', error);
      }
    }
  }
}); 