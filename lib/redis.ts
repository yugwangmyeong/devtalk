import Redis from 'ioredis';

let redis: Redis | null | undefined = undefined;

export function getRedisClient(): Redis | null {
  if (!process.env.REDIS_URL) {
    return null;
  }


  if (redis) {
    return redis;
  }


  if (redis === null) {
    return null;
  }

  redis = new Redis(process.env.REDIS_URL, {
    retryStrategy: (times) => {
      if (times > 3) {
        console.warn('Redis connection failed after 3 attempts. Redis features will be disabled.');
        redis = null; 
        return null; 
      }
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: null,
    enableOfflineQueue: true, 
    lazyConnect: true, 
  });

  redis.on('error', (err: Error & { code?: string }) => {
    if (err.code === 'ECONNREFUSED') {
      console.warn('Redis server is not available. Redis features will be disabled.');
      redis = null;
      return;
    }
    console.error('Redis Client Error:', err);
  });

  redis.on('connect', () => {
    // console.log('✅ Redis Client Connected');
  });

  redis.on('ready', () => {
    // console.log('✅ Redis Client Ready (캐시 사용 가능)');
  });

  redis.connect().catch((err) => {
    console.warn('⚠️ Redis 연결 시도 실패:', err.message);
  });

  return redis;
}

export function isRedisReady(redisClient: Redis | null): boolean {
  if (!redisClient) {
    return false;
  }

  const status = redisClient.status;
  return status === 'ready' || status === 'connect';
}


export async function safeRedisOperation<T>(
  operation: (redis: Redis) => Promise<T>,
  fallback: T
): Promise<T> {
  const redis = getRedisClient();
  if (!redis) {
    return fallback;
  }

  if (!isRedisReady(redis)) {

    if (redis.status === 'connecting' || redis.status === 'reconnecting') {
  
      await new Promise(resolve => setTimeout(resolve, 100));
      if (!isRedisReady(redis)) {
        return fallback;
      }
    } else {
      return fallback;
    }
  }

  try {
    return await operation(redis);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Stream isn\'t writeable')) {
        return fallback;
      }
      console.warn('[Redis] Operation error, using fallback:', error.message);
      return fallback;
    }
    console.error('[Redis] Unknown error:', error);
    return fallback;
  }
}

export async function closeRedisConnection() {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

