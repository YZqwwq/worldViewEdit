import { defineStore } from 'pinia';

interface CharacterDescriptor {
  name: string;
  age: string;
  gender: string;
  occupation: string;
  character_profile: string;
  character_development: string;
}

interface CharacterRelationships {
  family: string[];
  friends: string[];
  enemies: string[];
  allies: string[];
}

interface Character {
  id: string;
  updatedAt: string;
  descriptors: CharacterDescriptor;
  relationships: CharacterRelationships;
}

interface CharacterState {
  characters: Record<string, Character>;
}

export const useCharacterStore = defineStore('character', {
  state: (): CharacterState => ({
    characters: {}
  }),

  actions: {
    addCharacter(id: string, character: Omit<Character, 'id' | 'updatedAt'>) {
      this.characters[id] = {
        id,
        updatedAt: new Date().toISOString(),
        ...character
      };
    },

    updateCharacter(id: string, data: Partial<Character>) {
      if (this.characters[id]) {
        this.characters[id] = {
          ...this.characters[id],
          ...data,
          updatedAt: new Date().toISOString()
        };
      }
    },

    updateCharacterDescriptor(id: string, descriptor: Partial<CharacterDescriptor>) {
      if (this.characters[id]) {
        this.characters[id].descriptors = {
          ...this.characters[id].descriptors,
          ...descriptor
        };
        this.characters[id].updatedAt = new Date().toISOString();
      }
    },

    updateCharacterRelationships(id: string, relationships: Partial<CharacterRelationships>) {
      if (this.characters[id]) {
        this.characters[id].relationships = {
          ...this.characters[id].relationships,
          ...relationships
        };
        this.characters[id].updatedAt = new Date().toISOString();
      }
    },

    removeCharacter(id: string) {
      delete this.characters[id];
    },

    addRelationship(id: string, type: keyof CharacterRelationships, targetId: string) {
      if (this.characters[id] && this.characters[targetId]) {
        if (!this.characters[id].relationships[type].includes(targetId)) {
          this.characters[id].relationships[type].push(targetId);
          this.characters[id].updatedAt = new Date().toISOString();
        }
      }
    },

    removeRelationship(id: string, type: keyof CharacterRelationships, targetId: string) {
      if (this.characters[id]) {
        this.characters[id].relationships[type] = 
          this.characters[id].relationships[type].filter(id => id !== targetId);
        this.characters[id].updatedAt = new Date().toISOString();
      }
    }
  }
}); 