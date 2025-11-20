# Redis 메시지 큐 사용 가이드

## 개요

DevTalk 프로젝트에서 Redis를 메시지 큐로 사용하여 백엔드 성능을 개선합니다.

## 아키텍처

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │ HTTP Request
       ▼
┌─────────────────┐
│  Dashboard API  │
│  /api/dashboard │
└──────┬──────────┘
       │
       ├─► Redis Cache (조회)
       │   └─► Hit: 즉시 반환 ✅
       │
       └─► Redis Queue (Miss)
           └─► Worker Process
               └─► DB Query (병렬)
                   └─► Redis Cache (저장)
```

## 구성 요소

### 1. 메시지 큐 (`lib/queue.ts`)

Redis List 자료구조를 사용한 FIFO 큐:

```typescript
import { dashboardQueue } from '@/lib/queue';

// 작업 추가
await dashboardQueue.enqueue({
  type: 'generate-dashboard',
  data: { userId: 'user123' },
});

// 작업 가져오기 (워커에서 사용)
const job = await dashboardQueue.dequeue(5); // 5초 타임아웃
```

**주요 기능:**
- `enqueue()`: 작업을 큐에 추가
- `dequeue()`: 큐에서 작업 가져오기 (블로킹)
- `dequeueNonBlocking()`: 큐에서 작업 가져오기 (논블로킹)
- `retry()`: 실패한 작업 재시도
- `length()`: 큐 길이 조회

### 2. 캐시 시스템 (`lib/cache.ts`)

Redis를 사용한 키-값 캐시:

```typescript
import { cache, getCacheKey } from '@/lib/cache';

// 캐시 저장
await cache.set('cache:dashboard:user123', data, 300); // 5분 TTL

// 캐시 조회
const data = await cache.get('cache:dashboard:user123');

// 캐시 삭제
await cache.delete('cache:dashboard:user123');
```

**주요 기능:**
- `set()`: 데이터 저장 (TTL 설정 가능)
- `get()`: 데이터 조회
- `delete()`: 캐시 삭제
- `deletePattern()`: 패턴으로 여러 키 삭제

### 3. 워커 프로세스 (`workers/dashboard-worker.ts`)

백그라운드에서 큐의 작업을 처리:

```typescript
import { startDashboardWorker } from '@/workers/dashboard-worker';

// 워커 시작
startDashboardWorker();
```

**동작 방식:**
1. 큐에서 작업을 가져옴 (5초 타임아웃)
2. DB 쿼리를 병렬로 실행 (성능 개선)
3. 결과를 Redis 캐시에 저장
4. 다음 작업 처리

## 사용 방법

### 1. 환경 변수 설정

`.env` 파일에 Redis URL 추가:

```env
REDIS_URL=redis://localhost:6379
```

### 2. 대시보드 API 개선

`app/api/dashboard/route.ts`에서:

```typescript
import { cache, getCacheKey } from '@/lib/cache';
import { dashboardQueue } from '@/lib/queue';

export async function GET(request: NextRequest) {
  // 1. 캐시에서 조회
  const cacheKey = getCacheKey('dashboard', userId);
  const cached = await cache.get(cacheKey);
  
  if (cached) {
    return NextResponse.json(cached); // 캐시 히트: 즉시 반환
  }
  
  // 2. 캐시 미스: 큐에 작업 추가
  await dashboardQueue.enqueue({
    type: 'generate-dashboard',
    data: { userId },
  });
  
  // 3. 기본 데이터 반환 (또는 로딩 상태)
  return NextResponse.json({
    upcomingEvents: [],
    teamActivities: [],
    loading: true, // 프론트엔드에서 폴링하도록 안내
  });
}
```

### 3. 워커 실행

#### 방법 1: 별도 프로세스로 실행

```bash
# 터미널 1: 메인 서버
npm run dev

# 터미널 2: 워커
tsx workers/dashboard-worker.ts
```

#### 방법 2: 서버 시작 시 함께 실행

`server.ts`에 추가:

```typescript
import { startDashboardWorker } from './workers/dashboard-worker';

// 워커를 별도 프로세스로 실행
if (process.env.NODE_ENV === 'production') {
  // 프로덕션에서는 PM2 등으로 별도 프로세스 관리 권장
  startDashboardWorker();
}
```

## 성능 개선 효과

### Before (순차 처리)

```
요청 → DB Query 1 (200ms)
     → DB Query 2 (150ms)
     → DB Query 3 (180ms)
     → DB Query 4 (120ms)
     → 응답 (총 650ms)
```

### After (메시지 큐 + 캐시)

**첫 요청:**
```
요청 → 큐에 작업 추가 (10ms)
     → 기본 응답 반환 (10ms)
     → [백그라운드] 워커가 병렬 쿼리 실행 (300ms)
     → 캐시 저장
총 응답 시간: 20ms ✅
```

**두 번째 요청 (캐시 히트):**
```
요청 → 캐시 조회 (5ms)
     → 응답 반환
총 응답 시간: 5ms ✅✅
```

## Redis 명령어 확인

Redis CLI에서 큐 상태 확인:

```bash
# Redis 연결
redis-cli

# 큐 길이 확인
LLEN queue:dashboard

# 큐 내용 확인 (최근 10개)
LRANGE queue:dashboard 0 9

# 캐시 키 확인
KEYS cache:dashboard:*

# 캐시 값 확인
GET cache:dashboard:user123
```

## 모니터링

### 큐 모니터링

```typescript
import { dashboardQueue } from '@/lib/queue';

// 큐 길이 확인
const length = await dashboardQueue.length();
console.log(`Queue length: ${length}`);

// 실패한 작업 확인
const failed = await dashboardQueue.getFailedJobs(10);
console.log(`Failed jobs: ${failed.length}`);
```

### 캐시 모니터링

```typescript
import { cache } from '@/lib/cache';

// 캐시 존재 여부
const exists = await cache.exists('cache:dashboard:user123');

// TTL 확인
const ttl = await cache.getTTL('cache:dashboard:user123');
console.log(`TTL: ${ttl} seconds`);
```

## 문제 해결

### 1. Redis 연결 실패

```
Redis URL not configured. Redis features will be disabled.
```

**해결:**
- `.env`에 `REDIS_URL` 설정 확인
- Redis 서버가 실행 중인지 확인: `redis-cli ping`

### 2. 워커가 작업을 처리하지 않음

**확인 사항:**
- 워커 프로세스가 실행 중인지 확인
- 큐에 작업이 있는지 확인: `LLEN queue:dashboard`
- Redis 연결 상태 확인

### 3. 캐시가 작동하지 않음

**확인 사항:**
- Redis 연결 확인
- 캐시 키가 올바르게 생성되는지 확인
- TTL이 만료되지 않았는지 확인

## 확장 가능성

### 1. 여러 워커 실행

여러 워커를 실행하여 처리량 증가:

```bash
# 워커 1
tsx workers/dashboard-worker.ts

# 워커 2 (다른 터미널)
tsx workers/dashboard-worker.ts
```

### 2. 우선순위 큐

중요한 작업을 우선 처리:

```typescript
// 우선순위 큐 생성
const priorityQueue = new MessageQueue('dashboard:priority');

// 일반 큐
const normalQueue = new MessageQueue('dashboard');
```

### 3. 지연 작업

특정 시간 후에 실행되는 작업:

```typescript
// Sorted Set을 사용한 지연 큐 구현 가능
await redis.zadd('delayed:queue', Date.now() + 60000, jobData);
```

## 참고 자료

- [Redis List 명령어](https://redis.io/commands/?group=list)
- [Redis Pub/Sub](https://redis.io/docs/manual/pubsub/)
- [ioredis 문서](https://github.com/redis/ioredis)

