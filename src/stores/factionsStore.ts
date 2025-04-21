import { defineStore } from 'pinia';

interface Faction {
  id: string;
  name: string;
  description: string;
  members: string[];
  updatedAt: string;
}

interface FactionsState {
  factions: Record<string, Faction>;
}

export const useFactionsStore = defineStore('factions', {
  state: (): FactionsState => ({
    factions: {}
  }),

  actions: {
    addFaction(id: string, faction: Omit<Faction, 'id' | 'updatedAt'>) {
      this.factions[id] = {
        id,
        updatedAt: new Date().toISOString(),
        ...faction
      };
    },

    updateFaction(id: string, data: Partial<Faction>) {
      if (this.factions[id]) {
        this.factions[id] = {
          ...this.factions[id],
          ...data,
          updatedAt: new Date().toISOString()
        };
      }
    },

    removeFaction(id: string) {
      delete this.factions[id];
    },

    addMember(factionId: string, characterId: string) {
      if (this.factions[factionId] && !this.factions[factionId].members.includes(characterId)) {
        this.factions[factionId].members.push(characterId);
        this.factions[factionId].updatedAt = new Date().toISOString();
      }
    },

    removeMember(factionId: string, characterId: string) {
      if (this.factions[factionId]) {
        this.factions[factionId].members = 
          this.factions[factionId].members.filter(id => id !== characterId);
        this.factions[factionId].updatedAt = new Date().toISOString();
      }
    },

    updateFactionName(id: string, name: string) {
      if (this.factions[id]) {
        this.factions[id].name = name;
        this.factions[id].updatedAt = new Date().toISOString();
      }
    },

    updateFactionDescription(id: string, description: string) {
      if (this.factions[id]) {
        this.factions[id].description = description;
        this.factions[id].updatedAt = new Date().toISOString();
      }
    }
  }
}); 