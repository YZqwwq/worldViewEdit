import { defineStore } from 'pinia';
import type { WorldData } from '../electron';
import { useMapStore } from './mapStore';
import { useCharacterStore } from './characterStore';
import { useFactionsStore } from './factionsStore';

// 定义store的状态类型
interface WorldState {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  isLoading: boolean;
  errorMsg: string | null;
  worldData: WorldData | null;
  extractedTitles: Array<{title: string, level: number, position: number}>;
  content: {
    main_setting_of_the_worldview: {
      updatedAt: string;
      content: {
        text: string;
      };
    };
  };
}

export const useWorldStore = defineStore('world', {
  state: (): WorldState => ({
    id: '',
    name: '',
    description: '',
    createdAt: '',
    updatedAt: '',
    isLoading: false,
    errorMsg: null,
    worldData: null,
    extractedTitles: [],
    content: {
      main_setting_of_the_worldview: {
        updatedAt: '',
        content: {
          text: ''
        }
      }
    }
  }),
  
  getters: {
    isDataLoaded(state: WorldState): boolean {
      return !!state.id && !state.isLoading;
    },
    // 文件夹路径计算属性
    worldFolderPath(state: WorldState): string {
      return `world_${state.id}`;
    },
    // 设置文件路径计算属性
    worldSettingPath(state: WorldState): string {
      return `${this.worldFolderPath}/world_setting.json`;
    },
    // 图片目录路径计算属性
    worldImagesPath(state: WorldState): string {
      return `${this.worldFolderPath}/images`;
    }
  },
  
  actions: {
    async loadWorldData(id: string) {
      this.isLoading = true;
      this.errorMsg = null;
      try {
        if (window.electronAPI) {
          // 修改为新的文件路径
          const folderPath = `world_${id}`;
          const settingPath = `${folderPath}/world_setting.json`;
          
          // 检查文件夹是否存在，不存在则创建
          const folderExists = await window.electronAPI.data.exists(folderPath);
          if (!folderExists) {
            await window.electronAPI.data.createFolder(folderPath);
            await window.electronAPI.data.createFolder(`${folderPath}/images`);
          }
          
          // 尝试读取setting文件
          const data = await window.electronAPI.data.readFile(settingPath);
          
          if (data) {
            this.$patch({
              id: data.id,
              name: data.name,
              description: data.description,
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
              worldData: data,
              content: {
                main_setting_of_the_worldview: data.content.main_setting_of_the_worldview
              }
            });

            // 加载其他store的数据
            const mapStore = useMapStore();
            const characterStore = useCharacterStore();
            const factionsStore = useFactionsStore();

            if (data.content.world_map) {
              mapStore.loadMapDataFromJson(data.content.world_map);
            }

            if (data.content.character) {
              Object.entries(data.content.character).forEach(([id, char]) => {
                characterStore.addCharacter(id, char as any);
              });
            }

            if (data.content.factions) {
              Object.entries(data.content.factions).forEach(([id, faction]) => {
                factionsStore.addFaction(id, faction as any);
              });
            }
          }
        }
      } catch (error) {
        console.error('加载世界观数据失败:', error);
        this.errorMsg = '加载世界观数据失败';
      } finally {
        this.isLoading = false;
      }
    },
    
    updateWorldSetting(text: string) {
      this.content.main_setting_of_the_worldview = {
        updatedAt: new Date().toISOString(),
        content: { text }
      };
      this.updatedAt = new Date().toISOString();
      this.saveWorldData();
    },
    
    updateExtractedTitles(titles: Array<{title: string, level: number, position: number}>) {
      this.extractedTitles = titles;
    },
    
    updateContent(content: any) {
      if (this.worldData) {
        this.worldData.content = content;
        this.updatedAt = new Date().toISOString();
        this.saveWorldData();
      }
    },
    
    updateWorldData(updatedData: any) {
      this.worldData = updatedData;
      this.updatedAt = new Date().toISOString();
      this.saveWorldData();
    },
    
    async saveWorldData() {
      try {
        if (window.electronAPI && this.id) {
          const mapStore = useMapStore();
          const characterStore = useCharacterStore();
          const factionsStore = useFactionsStore();

          // 创建纯 JavaScript 对象，确保所有数据都是可序列化的
          const data = {
            id: this.id,
            name: this.name,
            description: this.description,
            createdAt: this.createdAt,
            updatedAt: new Date().toISOString(),
            content: {
              main_setting_of_the_worldview: {
                updatedAt: this.content.main_setting_of_the_worldview.updatedAt,
                content: {
                  text: this.content.main_setting_of_the_worldview.content.text
                }
              },
              world_map: {
                // 修复类型错误，引用正确的mapData属性
                version: mapStore.mapData.metadata?.version || '1.0.0',
                name: mapStore.mapData.metadata?.name || '',
                description: mapStore.mapData.metadata?.description || '',
                createdAt: mapStore.mapData.metadata?.createdAt || Date.now(),
                lastModified: Date.now(),
                viewState: mapStore.mapData.viewState,
                editState: mapStore.mapData.editState,
                locations: Array.from(mapStore.mapData.locations.values()),
                connections: Array.from(mapStore.mapData.connections.values()),
                territories: Array.from(mapStore.mapData.territories.values()),
                labels: Array.from(mapStore.mapData.labels.values())
              },
              character: JSON.parse(JSON.stringify(characterStore.characters || {})),
              factions: JSON.parse(JSON.stringify(factionsStore.factions || {}))
            }
          };

          // 确保文件夹存在
          const folderPath = `world_${this.id}`;
          const folderExists = await window.electronAPI.data.exists(folderPath);
          if (!folderExists) {
            await window.electronAPI.data.createFolder(folderPath);
            await window.electronAPI.data.createFolder(`${folderPath}/images`);
          }
          
          // 保存到新路径
          await window.electronAPI.data.saveFile(`${folderPath}/world_setting.json`, data);
        }
      } catch (error) {
        console.error('保存世界观数据失败:', error);
        this.errorMsg = '保存世界观数据失败';
      }
    }
  }
}); 