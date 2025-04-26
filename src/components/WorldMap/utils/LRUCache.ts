/**
 * LRU (Least Recently Used) 缓存实现
 */
export class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, V>;
  private keys: K[];

  constructor(capacity: number) {
    this.capacity = capacity;
    this.cache = new Map();
    this.keys = [];
  }

  /**
   * 获取缓存项
   */
  get(key: K): V | undefined {
    const item = this.cache.get(key);
    
    if (item) {
      // 更新使用时间
      const index = this.keys.indexOf(key);
      this.keys.splice(index, 1);
      this.keys.push(key);
    }
    
    return item;
  }

  /**
   * 设置缓存项
   */
  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      // 更新现有项
      this.cache.set(key, value);
      const index = this.keys.indexOf(key);
      this.keys.splice(index, 1);
      this.keys.push(key);
    } else {
      // 添加新项
      if (this.keys.length >= this.capacity) {
        // 删除最久未使用的项
        const oldestKey = this.keys.shift();
        if (oldestKey) {
          this.cache.delete(oldestKey);
        }
      }
      this.cache.set(key, value);
      this.keys.push(key);
    }
  }

  /**
   * 删除缓存项
   */
  delete(key: K): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      const index = this.keys.indexOf(key);
      this.keys.splice(index, 1);
    }
    return deleted;
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    this.keys = [];
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 获取缓存容量
   */
  getCapacity(): number {
    return this.capacity;
  }

  /**
   * 设置缓存容量
   */
  setCapacity(newCapacity: number): void {
    this.capacity = newCapacity;
    while (this.keys.length > this.capacity) {
      const oldestKey = this.keys.shift();
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
  }
} 