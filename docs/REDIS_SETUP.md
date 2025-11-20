# Redis 설치 및 설정 가이드

## Redis란?

Redis는 **인메모리 데이터 저장소**로, 메시지 큐와 캐시로 사용됩니다. 
Node.js 애플리케이션과는 **별도의 프로세스/서버**로 실행됩니다.

## 아키텍처

```
┌─────────────────┐
│  Node.js App    │  ← DevTalk 애플리케이션
│  (포트 3000)    │
└────────┬────────┘
         │
         │ Redis 클라이언트 연결
         │ (ioredis 라이브러리)
         ▼
┌─────────────────┐
│  Redis Server   │  ← 별도 프로세스
│  (포트 6379)    │
└─────────────────┘
```

## 설치 방법

### Windows

#### 방법 1: WSL2 사용 (권장)

```bash
# WSL2에서 Ubuntu 실행
wsl

# Redis 설치
sudo apt update
sudo apt install redis-server

# Redis 시작
sudo service redis-server start

# Redis 상태 확인
redis-cli ping
# 응답: PONG
```

#### 방법 2: Docker 사용 (가장 쉬움)

```bash
# Docker Desktop 설치 후
docker run -d -p 6379:6379 --name redis redis:latest

# Redis 연결 확인
docker exec -it redis redis-cli ping
```

#### 방법 3: Windows 네이티브 설치

1. [Memurai](https://www.memurai.com/) 다운로드 (Redis 호환)
2. 또는 [Redis for Windows](https://github.com/microsoftarchive/redis/releases) (구버전)

### macOS

```bash
# Homebrew 사용
brew install redis

# Redis 시작
brew services start redis

# 또는 수동 시작
redis-server

# Redis 상태 확인
redis-cli ping
```

### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install redis-server

# Redis 시작
sudo systemctl start redis-server

# 부팅 시 자동 시작
sudo systemctl enable redis-server

# Redis 상태 확인
redis-cli ping
```

## 실행 확인

### 1. Redis 서버가 실행 중인지 확인

```bash
# Redis CLI로 연결 테스트
redis-cli ping

# 응답이 "PONG"이면 정상
```

### 2. 포트 확인

```bash
# Windows
netstat -an | findstr 6379

# macOS/Linux
lsof -i :6379
# 또는
netstat -an | grep 6379
```

### 3. Redis CLI 사용

```bash
# Redis CLI 실행
redis-cli

# 명령어 예시
> SET test "hello"
OK
> GET test
"hello"
> KEYS *
1) "test"
> DEL test
(integer) 1
> EXIT
```

## 프로젝트 설정

### 1. 환경 변수 설정

`.env` 파일에 추가:

```env
REDIS_URL=redis://localhost:6379
```

### 2. Redis 연결 확인

애플리케이션을 실행하면 콘솔에 다음 메시지가 표시됩니다:

```
Redis Client Connected
```

연결 실패 시:

```
Redis URL not configured. Redis features will be disabled.
```

## 개발 환경에서 실행 순서

### 1. Redis 서버 시작

**터미널 1:**
```bash
# 방법 1: 직접 실행
redis-server

# 방법 2: Docker
docker start redis

# 방법 3: WSL2
wsl
sudo service redis-server start
```

### 2. Node.js 애플리케이션 시작

**터미널 2:**
```bash
npm run dev
```

### 3. 워커 프로세스 시작 (선택사항)

**터미널 3:**
```bash
tsx workers/dashboard-worker.ts
```

## 프로덕션 환경

### 클라우드 Redis 서비스 사용

- **AWS ElastiCache**: AWS 환경
- **Redis Cloud**: 관리형 Redis 서비스
- **Azure Cache for Redis**: Azure 환경
- **Google Cloud Memorystore**: GCP 환경

### 환경 변수 예시

```env
# 로컬
REDIS_URL=redis://localhost:6379

# 클라우드 (비밀번호 포함)
REDIS_URL=redis://:password@redis.example.com:6379

# SSL/TLS 사용
REDIS_URL=rediss://:password@redis.example.com:6380
```

## 문제 해결

### 1. "Redis Client Error" 발생

**원인**: Redis 서버가 실행되지 않음

**해결**:
```bash
# Redis 서버 시작
redis-server

# 또는 Docker
docker start redis
```

### 2. "Connection refused" 오류

**원인**: Redis가 다른 포트에서 실행 중이거나 방화벽 문제

**해결**:
```bash
# Redis 포트 확인
redis-cli -p 6379 ping

# 다른 포트 사용 시
REDIS_URL=redis://localhost:6380
```

### 3. Windows에서 Redis 설치가 어려운 경우

**해결**: Docker 사용 (가장 간단)

```bash
# Docker Desktop 설치 후
docker run -d -p 6379:6379 --name redis redis:latest

# .env 파일
REDIS_URL=redis://localhost:6379
```

## Redis 모니터링

### Redis CLI로 모니터링

```bash
redis-cli

# 큐 길이 확인
> LLEN queue:dashboard

# 큐 내용 확인
> LRANGE queue:dashboard 0 9

# 캐시 키 확인
> KEYS cache:*

# 특정 키 값 확인
> GET cache:dashboard:user123

# 모든 키 삭제 (주의!)
> FLUSHALL
```

### Redis 정보 확인

```bash
redis-cli INFO

# 메모리 사용량
redis-cli INFO memory

# 클라이언트 연결 수
redis-cli INFO clients
```

## 요약

1. **Redis는 별도 서버/프로세스**로 실행됩니다
2. **Node.js 앱과는 네트워크로 연결**됩니다 (포트 6379)
3. **개발 환경**: 로컬에 Redis 설치 또는 Docker 사용
4. **프로덕션**: 클라우드 관리형 Redis 서비스 권장

## 빠른 시작 (Docker 사용)

```bash
# 1. Redis 컨테이너 실행
docker run -d -p 6379:6379 --name redis redis:latest

# 2. .env 파일 설정
echo "REDIS_URL=redis://localhost:6379" >> .env

# 3. 애플리케이션 실행
npm run dev
```

이제 Redis가 준비되었습니다! 🚀

