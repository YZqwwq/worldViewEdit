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
  },
  
  actions: {
    async loadWorldData(id: string) {
      this.isLoading = true;
      this.errorMsg = null;
      try {
        if (window.electronAPI) {
          const data = await window.electronAPI.data.readFile(`world_${id}.json`);
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
              mapStore.$patch({ mapData: data.content.world_map });
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

          const data = {
            id: this.id,
            name: this.name,
            description: this.description,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            content: {
              main_setting_of_the_worldview: this.content.main_setting_of_the_worldview,
              world_map: mapStore.$state,
              character: characterStore.characters,
              factions: factionsStore.factions
            }
          };

          await window.electronAPI.data.saveFile(`world_${this.id}.json`, data);
        }
      } catch (error) {
        console.error('保存世界观数据失败:', error);
        this.errorMsg = '保存世界观数据失败';
      }
    }
  }
}); 