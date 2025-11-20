# Redis를 사용하는 API 정리

이 문서는 프로젝트에서 Redis를 사용하는 API 엔드포인트들을 정리한 것입니다.

## 📌 간단 요약

**네, 맞습니다!** Redis는 **팀/워크스페이스 같은 복잡한 정보를 많이 가져오는 API에만 사용**하고 있습니다.

### ✅ Redis를 사용하는 API (실제 사용 중)
1. **`/api/teams`** - 팀 목록 조회 (여러 팀 + 멤버 정보)
2. **`/api/teams/[teamId]`** - 팀 상세 정보 (팀 + 모든 멤버 정보)

### ❌ Redis를 사용하지 않는 API
- `/api/auth/me` - 단순 사용자 정보 (1개 쿼리)
- `/api/chat/messages` - 채팅 메시지 (실시간 데이터)
- `/api/chat/rooms` - 채팅방 목록 (자주 변경됨)
- `/api/dashboard` - 대시보드 (아직 Redis 미사용, 최적화 버전만 있음)

### 💡 Redis를 사용하는 이유
- **복잡한 조회**: 여러 테이블을 조인해서 많은 데이터를 가져옴
- **자주 조회**: 같은 데이터를 반복해서 조회함
- **변경 빈도 낮음**: 팀 정보는 자주 바뀌지 않음
- **성능 향상**: 캐시 히트 시 DB 조회 없이 빠르게 응답

## Redis 사용 방식

프로젝트에서는 Redis를 두 가지 용도로 사용합니다:

1. **캐시 (Cache)**: 자주 조회되는 데이터를 캐싱하여 성능 향상
2. **메시지 큐 (Message Queue)**: 무거운 작업을 비동기로 처리

## Redis 관련 라이브러리

### 1. `lib/redis.ts`
- Redis 클라이언트 초기화 및 관리
- `getRedisClient()`: Redis 클라이언트 반환 (연결 실패 시 null)

### 2. `lib/cache.ts`
- Redis 기반 캐시 시스템
- `cache.set(key, value, ttl)`: 캐시 저장
- `cache.get<T>(key)`: 캐시 조회
- `cache.delete(key)`: 캐시 삭제
- `cache.deletePattern(pattern)`: 패턴으로 여러 키 삭제

### 3. `lib/queue.ts`
- Redis 기반 메시지 큐 시스템
- `dashboardQueue`: 대시보드 데이터 생성 작업 큐
- `enqueue(job)`: 작업을 큐에 추가
- `dequeue(timeout)`: 큐에서 작업 가져오기 (블로킹)
- `dequeueNonBlocking()`: 큐에서 작업 가져오기 (논블로킹)

---

## Redis를 사용하는 API 엔드포인트

### ✅ 실제 사용 중인 API

#### 1. `/api/teams` (팀 목록 조회)

**파일**: `app/api/teams/route.ts`

**사용 방식**: 
- **캐시**: 팀 목록 데이터를 캐싱

**가져오는 데이터**:
- 사용자가 속한 모든 팀 목록
- 각 팀의 멤버 정보 (이름, 이메일, 프로필 이미지)
- 팀 생성자 정보
- 멤버 수, 채팅방 수 등

**동작 흐름**:
1. 사용자 ID로 캐시 키 생성: `cache:teams:{userId}`
2. 캐시에서 데이터 조회 시도
3. 캐시 히트 시: 캐시된 데이터 반환 (빠름!)
4. 캐시 미스 시:
   - 데이터베이스에서 팀 정보 조회 (여러 테이블 조인)
   - 결과를 캐시에 저장 (5분 TTL)
   - 데이터 반환

**캐시 TTL**: 5분 (300초)

**캐시 무효화**: 
- 새 팀 생성 시 (`POST /api/teams`)
- 팀 정보 수정 시 (`PATCH /api/teams/[teamId]`)

---

#### 2. `/api/teams/[teamId]` (팀 상세 정보 조회)

**파일**: `app/api/teams/[teamId]/route.ts`

**사용 방식**: 
- **캐시**: 특정 팀의 상세 정보를 캐싱

**가져오는 데이터**:
- 팀 기본 정보 (이름, 설명, 아이콘)
- 팀 멤버 전체 목록
- 팀 생성자 정보
- 멤버 수, 채팅방 수

**동작 흐름**:
1. 팀 ID와 사용자 ID로 캐시 키 생성: `cache:team:{teamId}:{userId}`
2. 캐시에서 데이터 조회 시도
3. 캐시 히트 시: 캐시된 데이터 반환
4. 캐시 미스 시:
   - 데이터베이스에서 팀 상세 정보 조회
   - 결과를 캐시에 저장 (5분 TTL)
   - 데이터 반환

**캐시 TTL**: 5분 (300초)

**캐시 무효화**: 
- 팀 정보 수정 시 (`PATCH /api/teams/[teamId]`)

---

### 📝 참고용 (아직 사용 안 함)

#### 3. `/api/dashboard` (최적화 버전)

**파일**: `app/api/dashboard/route.optimized.ts`

**사용 방식**: 
- **캐시**: 대시보드 데이터를 캐싱
- **큐**: 캐시 미스 시 작업을 큐에 추가

**동작 흐름**:
1. 사용자 ID로 캐시 키 생성: `cache:dashboard:{userId}`
2. 캐시에서 데이터 조회 시도
3. 캐시 히트 시: 캐시된 데이터 반환
4. 캐시 미스 시:
   - `dashboardQueue`에 작업 추가
   - 기본 응답 반환 (로딩 상태)

**캐시 TTL**: 5분 (300초)

**참고**: 현재는 `route.optimized.ts`가 참고용으로만 존재하며, 실제 사용 중인 `route.ts`는 Redis를 사용하지 않습니다.

---

## Redis를 사용하는 워커

### 1. Dashboard Worker

**파일**: `workers/dashboard-worker.ts`

**역할**: 
- `dashboardQueue`에서 작업을 가져와서 처리
- 처리 결과를 Redis 캐시에 저장

**동작 흐름**:
1. `dashboardQueue.dequeue(5)`: 큐에서 작업 가져오기 (5초 타임아웃)
2. 대시보드 데이터 생성 (Prisma 쿼리 실행)
3. 결과를 캐시에 저장: `cache.set(cacheKey, result, 300)`
4. 다음 작업 대기

**실행 방법**:
```bash
# 독립 프로세스로 실행
node workers/dashboard-worker.ts
```

---

## Redis 사용 패턴

### 캐시 키 패턴
```
cache:dashboard:{userId}
```

### 큐 이름 패턴
```
queue:dashboard          # 대시보드 작업 큐
queue:dashboard:retry   # 재시도 큐
queue:dashboard:failed  # 실패 큐
```

---

## 현재 상태

### ✅ 실제 사용 중인 API
1. **`/api/teams`** - Redis 캐시 사용 중
   - 팀 목록 조회 시 캐시에서 먼저 확인
   - 캐시 미스 시 DB 조회 후 캐시 저장

2. **`/api/teams/[teamId]`** - Redis 캐시 사용 중
   - 팀 상세 정보 조회 시 캐시에서 먼저 확인
   - 캐시 미스 시 DB 조회 후 캐시 저장

### 📝 최적화 버전 (참고용, 아직 사용 안 함)
- `app/api/dashboard/route.optimized.ts`: Redis 캐시와 큐를 사용하는 최적화 버전
- `workers/dashboard-worker.ts`: 큐 작업을 처리하는 워커

### ❌ Redis를 사용하지 않는 API
- `/api/dashboard` - 현재는 Redis 미사용 (최적화 버전만 있음)
- `/api/chat/*` - 실시간 데이터라서 캐시 부적합
- `/api/auth/*` - 단순 조회라서 캐시 불필요

---

## Redis 활성화 방법

Redis를 사용하려면:

1. **환경 변수 설정**:
   ```env
   REDIS_URL=redis://localhost:6379
   ```

2. **API 교체**:
   - `app/api/dashboard/route.ts`를 `route.optimized.ts`의 내용으로 교체

3. **워커 실행**:
   - `dashboard-worker.ts`를 별도 프로세스로 실행

---

## Redis 연결 실패 시 동작

- Redis가 연결되지 않아도 애플리케이션은 정상 동작합니다.
- `getRedisClient()`가 `null`을 반환하면:
  - 캐시: 조회 시 `null` 반환 (캐시 미스로 처리)
  - 큐: 에러 발생 (큐 작업은 Redis 필수)

---

## 성능 개선 효과

Redis 캐시를 사용하면:
- 대시보드 API 응답 시간 단축
- 데이터베이스 부하 감소
- 동시 사용자 처리 능력 향상

자세한 성능 비교는 다음 문서를 참고하세요:
- `docs/PERFORMANCE_ANALYSIS.md`
- `tests/PERFORMANCE_COMPARISON.md`
- `tests/performance/LOAD_TEST_COMPARISON.md`

