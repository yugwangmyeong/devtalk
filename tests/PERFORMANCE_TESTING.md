# 성능 테스트 가이드

이 문서는 DevTalk 프로젝트의 백엔드 성능 개선을 위한 테스트 가이드입니다.

## 목적

- **문제**: 대시보드 API가 여러 개의 DB 쿼리를 순차적으로 실행하여 응답 시간이 느림
- **해결**: Redis 기반 메시지 큐를 활용하여 비동기 처리 및 배치 처리 도입
- **결과**: 응답 시간 개선 및 처리량 증가
- **도메인**: 실시간 협업 도구 (DevTalk)

## 테스트 환경 설정

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env` 파일에 다음 변수들을 설정하세요:

```env
# 데이터베이스
DATABASE_URL="mysql://..."

# Redis (메시지 큐용)
REDIS_URL="redis://localhost:6379"

# 테스트용 인증 토큰 (실제 사용자 토큰)
TEST_USER_TOKEN="your_auth_token_here"
```

### 3. 테스트 토큰 얻기

테스트를 실행하려면 유효한 인증 토큰이 필요합니다. 다음 중 하나의 방법으로 토큰을 얻을 수 있습니다:

1. 브라우저에서 로그인 후 개발자 도구의 쿠키에서 `auth-token` 값을 복사
2. API를 통해 로그인하고 쿠키에서 토큰 추출

## 테스트 실행 방법

### 1. Vitest를 사용한 단위 테스트

```bash
# 모든 성능 테스트 실행
npm run test:performance

# 모든 테스트 실행
npm run test

# 테스트를 watch 모드로 실행
npm run test:watch
```

### 2. 벤치마크 스크립트 실행

독립 실행형 벤치마크 스크립트를 사용하여 성능을 측정할 수 있습니다:

```bash
# 환경 변수와 함께 실행
TEST_USER_TOKEN=your_token npm run benchmark

# 또는 API URL도 지정
TEST_USER_TOKEN=your_token API_URL=http://localhost:3000 npm run benchmark
```

## 테스트 결과 해석

### 성능 지표

- **평균 응답 시간 (Average)**: 모든 요청의 평균 응답 시간
- **중앙값 (Median)**: 응답 시간의 중앙값 (이상치의 영향을 덜 받음)
- **최소 응답 시간 (Min)**: 가장 빠른 응답 시간
- **최대 응답 시간 (Max)**: 가장 느린 응답 시간

### 개선율 계산

```
개선율 = (개선 전 - 개선 후) / 개선 전 × 100%
```

예를 들어:
- 개선 전: 500ms
- 개선 후: 300ms
- 개선율: (500 - 300) / 500 × 100% = 40% 개선

## 테스트 시나리오

### 1. 순차 요청 테스트

10개의 순차적인 요청을 보내고 각 요청의 응답 시간을 측정합니다.

```bash
npm run test:performance
```

### 2. 동시 요청 테스트

20개의 동시 요청을 보내고 시스템의 동시 처리 능력을 측정합니다.

```bash
npm run test:performance
```

## 성능 개선 전략

### 현재 구현 (Before)

대시보드 API는 다음과 같은 순차적인 쿼리를 실행합니다:

1. 사용자의 팀 멤버십 조회
2. 다가오는 이벤트 조회
3. 최근 이벤트 생성 조회
4. 최근 채널 생성 조회
5. 최근 멤버 추가 조회

이 모든 쿼리가 순차적으로 실행되어 총 응답 시간이 길어집니다.

### 개선 후 (After)

메시지 큐를 활용하여:

1. 즉시 반환 가능한 데이터는 캐시에서 조회
2. 무거운 쿼리는 메시지 큐에 작업으로 등록
3. 백그라운드 워커가 큐에서 작업을 처리
4. 결과를 Redis 캐시에 저장
5. 다음 요청 시 캐시된 데이터 반환

## 성능 모니터링

### 실시간 모니터링

API 응답 헤더에 성능 정보가 포함됩니다:

```
X-Response-Time: 234.56ms
```

### 성능 통계 조회

성능 통계를 조회하려면 `lib/performance.ts`의 함수를 사용할 수 있습니다:

```typescript
import { getPerformanceStats, getAllPerformanceStats } from '@/lib/performance';

// 특정 작업의 통계
const stats = getPerformanceStats('dashboard-api');

// 모든 작업의 통계
const allStats = getAllPerformanceStats();
```

## 문제 해결

### 테스트가 실패하는 경우

1. **인증 토큰 오류**: `TEST_USER_TOKEN`이 유효한지 확인
2. **서버 연결 오류**: API 서버가 실행 중인지 확인 (`npm run dev`)
3. **Redis 연결 오류**: Redis 서버가 실행 중이고 `REDIS_URL`이 올바른지 확인
4. **데이터베이스 오류**: 데이터베이스 연결 및 스키마 확인

### 성능 개선이 보이지 않는 경우

1. 캐시가 제대로 작동하는지 확인
2. 메시지 큐 워커가 실행 중인지 확인
3. 데이터베이스 인덱스가 적절히 설정되어 있는지 확인
4. 네트워크 지연 시간 고려

## 다음 단계

1. 메시지 큐 시스템 구현 (`lib/queue.ts`)
2. 대시보드 API 개선 (`app/api/dashboard/route.ts`)
3. 백그라운드 워커 구현
4. 캐싱 전략 구현
5. 성능 테스트 실행 및 결과 비교

## 참고 자료

- [Vitest 문서](https://vitest.dev/)
- [Redis 문서](https://redis.io/docs/)
- [Prisma 성능 최적화](https://www.prisma.io/docs/guides/performance-and-optimization)

