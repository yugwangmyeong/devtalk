

import { getRedisClient, isRedisReady } from './redis';

export class Cache {
  private defaultTTL: number = 300; // 기본 5분

  private getRedis(): ReturnType<typeof getRedisClient> {
    return getRedisClient();
  }


  async set(key: string, value: any, ttl: number = this.defaultTTL): Promise<void> {
    const redis = this.getRedis();
    if (!redis) {
      return; 
    }

    try {
 
      if (!isRedisReady(redis)) {
       
        if (redis.status === 'connecting' || redis.status === 'reconnecting') {
          await new Promise(resolve => setTimeout(resolve, 100));
          if (!isRedisReady(redis)) {
            return; 
          }
        } else {
          return; 
        }
      }

      const serialized = JSON.stringify(value);
      await redis.setex(key, ttl, serialized);
      
      // console.log(`[Cache] Set: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      // 연결 관련 에러는 조용히 처리
      if (error instanceof Error && error.message.includes('Stream isn\'t writeable')) {
        return;
      }
      console.error(`[Cache] Set error for key ${key}:`, error);
    }
  }

 
  async get<T>(key: string): Promise<T | null> {
    const redis = this.getRedis();
    if (!redis) {
      // console.log(`[Cache] Miss (Redis not available): ${key}`);
      return null;
    }

    try {
     
      if (!isRedisReady(redis)) {
        
        if (redis.status === 'connecting' || redis.status === 'reconnecting') {
          await new Promise(resolve => setTimeout(resolve, 100));
          if (!isRedisReady(redis)) {
            return null; 
          }
        } else {
          return null; 
        }
      }

      const result = await redis.get(key);
      
      if (!result) {
        // console.log(`[Cache] Miss: ${key}`);
        return null;
      }

      try {
        const parsed = JSON.parse(result) as T;
        // console.log(`[Cache] Hit: ${key}`);
        return parsed;
      } catch (error) {
        console.error(`[Cache] Parse error for key ${key}:`, error);
        return null;
      }
    } catch (error) {
      
      if (error instanceof Error && error.message.includes('Stream isn\'t writeable')) {
        return null;
      }
      console.error(`[Cache] Get error for key ${key}:`, error);
      return null;
    }
  }

  
  async delete(key: string): Promise<void> {
    const redis = this.getRedis();
    if (!redis) {
      return;
    }

    await redis.del(key);
    // console.log(`[Cache] Deleted: ${key}`);
  }

  
  async deletePattern(pattern: string): Promise<void> {
    const redis = this.getRedis();
    if (!redis) {
      return;
    }

    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      // console.log(`[Cache] Deleted ${keys.length} keys matching pattern: ${pattern}`);
    }
  }

  
  async exists(key: string): Promise<boolean> {
    const redis = this.getRedis();
    if (!redis) {
      return false;
    }

    const result = await redis.exists(key);
    return result === 1;
  }

  
  async getTTL(key: string): Promise<number> {
    const redis = this.getRedis();
    if (!redis) {
      return -1;
    }

    return await redis.ttl(key);
  }
}



export const cache = new Cache();


export function getCacheKey(prefix: string, ...parts: (string | number)[]): string {
  return `cache:${prefix}:${parts.join(':')}`;
}

