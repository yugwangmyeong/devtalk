/**
 * Redis 기반 캐시 시스템
 * 
 * 대시보드 데이터와 같은 자주 조회되는 데이터를 캐싱
 */

import { getRedisClient } from './redis';

export class Cache {
  private defaultTTL: number = 300; // 기본 5분

  /**
   * Redis 클라이언트 가져오기 (매번 최신 상태 확인)
   */
  private getRedis(): ReturnType<typeof getRedisClient> {
    return getRedisClient();
  }

  /**
   * 캐시에 데이터 저장
   */
  async set(key: string, value: any, ttl: number = this.defaultTTL): Promise<void> {
    const redis = this.getRedis();
    if (!redis) {
      return; // Redis가 없으면 캐싱하지 않음
    }

    const serialized = JSON.stringify(value);
    await redis.setex(key, ttl, serialized);
    
    console.log(`[Cache] Set: ${key} (TTL: ${ttl}s)`);
  }

  /**
   * 캐시에서 데이터 조회
   */
  async get<T>(key: string): Promise<T | null> {
    const redis = this.getRedis();
    if (!redis) {
      console.log(`[Cache] Miss (Redis not available): ${key}`);
      return null;
    }

    try {
      const result = await redis.get(key);
      
      if (!result) {
        console.log(`[Cache] Miss: ${key}`);
        return null;
      }

      try {
        const parsed = JSON.parse(result) as T;
        console.log(`[Cache] Hit: ${key}`);
        return parsed;
      } catch (error) {
        console.error(`[Cache] Parse error for key ${key}:`, error);
        return null;
      }
    } catch (error) {
      console.error(`[Cache] Get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * 캐시 삭제
   */
  async delete(key: string): Promise<void> {
    const redis = this.getRedis();
    if (!redis) {
      return;
    }

    await redis.del(key);
    console.log(`[Cache] Deleted: ${key}`);
  }

  /**
   * 패턴으로 여러 키 삭제
   */
  async deletePattern(pattern: string): Promise<void> {
    const redis = this.getRedis();
    if (!redis) {
      return;
    }

    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`[Cache] Deleted ${keys.length} keys matching pattern: ${pattern}`);
    }
  }

  /**
   * 캐시 키 존재 여부 확인
   */
  async exists(key: string): Promise<boolean> {
    const redis = this.getRedis();
    if (!redis) {
      return false;
    }

    const result = await redis.exists(key);
    return result === 1;
  }

  /**
   * TTL 조회
   */
  async getTTL(key: string): Promise<number> {
    const redis = this.getRedis();
    if (!redis) {
      return -1;
    }

    return await redis.ttl(key);
  }
}

/**
 * 전역 캐시 인스턴스
 */
export const cache = new Cache();

/**
 * 캐시 키 생성 헬퍼
 */
export function getCacheKey(prefix: string, ...parts: (string | number)[]): string {
  return `cache:${prefix}:${parts.join(':')}`;
}

