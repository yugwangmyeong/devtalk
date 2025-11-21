# Redis 성능 비교 테스트 가이드

## 목적

Redis를 켰을 때와 안 켰을 때의 성능 차이를 측정합니다.

## 테스트 방법

### 방법 1: 자동 테스트 (권장)

#### 1단계: Redis 켜진 상태에서 테스트

```bash
# Redis 상태 확인
docker ps --filter name=redis

# Redis가 실행 중이면 테스트 실행
TEST_USER_TOKEN=your_token npm run test:redis
```

#### 2단계: Redis 중지

```bash
# Redis 중지
docker stop redis

# 애플리케이션 재시작 (새 터미널)
npm run dev
```

#### 3단계: Redis 꺼진 상태에서 테스트

```bash
# Redis 상태 확인 (중지되어 있어야 함)
docker ps --filter name=redis

# 테스트 실행
REDIS_STATE=off TEST_USER_TOKEN=your_token npm run test:redis
```

#### 4단계: Redis 다시 시작

```bash
# Redis 시작
docker start redis

# 애플리케이션 재시작
npm run dev
```

#### 5단계: Redis 켜진 상태에서 다시 테스트

```bash
REDIS_STATE=on TEST_USER_TOKEN=your_token npm run test:redis
```

### 방법 2: 수동 비교

#### Redis OFF 테스트

```bash
# 1. Redis 중지
docker stop redis

# 2. 애플리케이션 재시작
npm run dev

# 3. 브라우저에서 API 호출 시간 측정
# 개발자 도구 > Network 탭에서 확인
```

#### Redis ON 테스트

```bash
# 1. Redis 시작
docker start redis

# 2. 애플리케이션 재시작
npm run dev

# 3. 브라우저에서 같은 API 호출 시간 측정
```

## 예상 결과

### Redis OFF (캐시 없음)

- 첫 요청: 200-500ms (DB 쿼리)
- 두 번째 요청: 200-500ms (매번 DB 쿼리)
- 세 번째 요청: 200-500ms (매번 DB 쿼리)

### Redis ON (캐시 사용)

- 첫 요청: 200-500ms (DB 쿼리 + 캐시 저장)
- 두 번째 요청: 5-50ms (캐시에서 조회) ✅
- 세 번째 요청: 5-50ms (캐시에서 조회) ✅

## 성능 개선 효과

예상 개선율:
- **평균 응답 시간**: 70-90% 개선
- **최대 응답 시간**: 80-95% 개선
- **처리량**: 10-20배 증가

## 테스트할 API

1. `GET /api/teams` - 팀 목록
2. `GET /api/dashboard` - 대시보드
3. `GET /api/teams/[teamId]` - 팀 상세
4. `GET /api/teams/[teamId]/channels` - 채널 목록
5. `GET /api/teams/[teamId]/events` - 이벤트 목록

## 결과 해석

### 좋은 결과

```
[Redis OFF]
  평균: 350ms
  중앙값: 320ms

[Redis ON]
  평균: 25ms
  중앙값: 18ms

[개선율]
  평균: 92.86% 개선 ✅
  중앙값: 94.38% 개선 ✅
```

### 캐시가 작동하지 않는 경우

```
[Redis OFF]
  평균: 350ms

[Redis ON]
  평균: 340ms

[개선율]
  평균: 2.86% 개선 ⚠️
```

**원인 확인:**
- Redis 연결 확인
- 캐시 키 확인
- 로그에서 "Cache hit" 메시지 확인

## 빠른 테스트

```bash
# 1. 토큰 설정 (한 번만)
export TEST_USER_TOKEN=your_token_here

# 2. Redis OFF 테스트
docker stop redis
npm run dev  # 새 터미널
REDIS_STATE=off npm run test:redis

# 3. Redis ON 테스트
docker start redis
npm run dev  # 새 터미널
REDIS_STATE=on npm run test:redis
```

## 문제 해결

### "Redis URL not configured" 경고

`.env` 파일 확인:
```env
REDIS_URL=redis://localhost:6379
```

### 캐시가 작동하지 않음

1. Redis 연결 확인:
   ```bash
   docker exec -it redis redis-cli ping
   ```

2. 캐시 키 확인:
   ```bash
   docker exec -it redis redis-cli
   > KEYS cache:*
   ```

3. 애플리케이션 로그 확인:
   - `[Cache] Hit` 메시지가 있는지 확인
   - `[Cache] Set` 메시지가 있는지 확인

