import Redis from 'ioredis';

// undefined: 아직 초기화 안 됨
// null: 연결 실패로 명시적으로 비활성화됨
// Redis 인스턴스: 정상 연결됨
let redis: Redis | null | undefined = undefined;

export function getRedisClient(): Redis | null {
  if (!process.env.REDIS_URL) {
    // 환경 변수가 없으면 조용히 null 반환 (개발 중일 수 있음)
    return null;
  }

  // 이미 Redis 인스턴스가 있으면 반환
  if (redis) {
    return redis;
  }

  // 이전에 연결 실패한 경우 null 반환 (명시적으로 실패로 표시된 경우)
  if (redis === null) {
    return null;
  }

  // Redis 인스턴스 생성 (초기값은 undefined이므로 여기 도달)
  redis = new Redis(process.env.REDIS_URL, {
    retryStrategy: (times) => {
      // 최대 3번만 재시도, 그 이후에는 null 반환
      if (times > 3) {
        console.warn('Redis connection failed after 3 attempts. Redis features will be disabled.');
        redis = null; // 연결 실패로 표시하여 이후 호출 시 null 반환
        return null; // 재시도 중단
      }
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: null, // 자동 재시도 비활성화
    enableOfflineQueue: false, // 오프라인 큐 비활성화
    lazyConnect: true, // 지연 연결
  });

  redis.on('error', (err: Error & { code?: string }) => {
    // ECONNREFUSED는 조용히 처리 (Redis가 꺼져 있을 때 정상)
    if (err.code === 'ECONNREFUSED') {
      console.warn('Redis server is not available. Redis features will be disabled.');
      redis = null; // 연결 실패 시 null로 설정
      return;
    }
    console.error('Redis Client Error:', err);
  });

  redis.on('connect', () => {
    console.log('✅ Redis Client Connected');
  });

  redis.on('ready', () => {
    console.log('✅ Redis Client Ready (캐시 사용 가능)');
  });

  // 연결 시도 (비동기)
  redis.connect().catch((err) => {
    console.warn('⚠️ Redis 연결 시도 실패:', err.message);
    // 연결 실패는 error 이벤트에서 처리
  });

  return redis;
}

export async function closeRedisConnection() {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

