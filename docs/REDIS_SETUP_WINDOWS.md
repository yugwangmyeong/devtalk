# Windows에서 Redis 설치 및 실행 가이드

## 문제 해결: Docker 오류

```
docker: error during connect: Head "http://%2F%2F.%2Fpipe%2FdockerDesktopLinuxEngine/_ping": 
open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.
```

이 오류는 **Docker Desktop이 실행되지 않았을 때** 발생합니다.

## 해결 방법

### 방법 1: Docker Desktop 실행 (가장 쉬움)

1. **Docker Desktop 시작**
   - Windows 시작 메뉴에서 "Docker Desktop" 검색 후 실행
   - 시스템 트레이에 Docker 아이콘이 나타날 때까지 대기 (1-2분)

2. **Docker 상태 확인**
   ```bash
   docker ps
   ```
   - 오류가 없으면 정상 실행 중

3. **Redis 컨테이너 실행**
   ```bash
   docker run -d -p 6379:6379 --name redis redis:latest
   ```

4. **Redis 연결 확인**
   ```bash
   docker exec -it redis redis-cli ping
   ```
   - 응답: `PONG`

### 방법 2: WSL2 사용 (Docker Desktop 없이)

#### 1. WSL2 설치 확인

```bash
wsl --version
```

WSL2가 없으면:
1. PowerShell을 관리자 권한으로 실행
2. 다음 명령 실행:
   ```powershell
   wsl --install
   ```
3. 컴퓨터 재시작

#### 2. WSL2에서 Redis 설치

```bash
# WSL2 Ubuntu 실행
wsl

# Redis 설치
sudo apt update
sudo apt install redis-server -y

# Redis 시작
sudo service redis-server start

# Redis 상태 확인
redis-cli ping
# 응답: PONG
```

#### 3. Windows에서 WSL2의 Redis에 연결

`.env` 파일:
```env
REDIS_URL=redis://localhost:6379
```

WSL2의 Redis는 자동으로 Windows localhost에 포워딩됩니다.

#### 4. Redis 자동 시작 설정 (선택사항)

WSL2에서:
```bash
# systemd 사용 (WSL2 최신 버전)
sudo systemctl enable redis-server
sudo systemctl start redis-server

# 또는 수동 시작 스크립트 생성
echo 'sudo service redis-server start' >> ~/.bashrc
```

### 방법 3: Windows 네이티브 Redis (Memurai)

Docker나 WSL2를 사용하지 않고 싶다면:

1. **Memurai 다운로드**
   - https://www.memurai.com/get-memurai
   - Windows용 Redis 호환 서버

2. **설치 및 실행**
   - 설치 후 자동으로 서비스로 실행됨
   - 포트: 6379 (기본값)

3. **연결 확인**
   ```bash
   # Memurai CLI 사용 (설치 시 포함됨)
   memurai-cli ping
   ```

### 방법 4: 클라우드 Redis (프로덕션 권장)

개발 환경이 아니라면 클라우드 서비스 사용:

- **Redis Cloud** (무료 티어 제공)
  - https://redis.com/try-free/
  - 무료: 30MB 메모리

- **Upstash** (서버리스 Redis)
  - https://upstash.com/
  - 무료: 10,000 요청/일

사용 예:
```env
REDIS_URL=redis://default:password@redis-12345.upstash.io:6379
```

## 빠른 시작 (권장 순서)

### 1순위: Docker Desktop (이미 설치되어 있다면)

```bash
# 1. Docker Desktop 실행 확인
docker ps

# 2. Redis 컨테이너 실행
docker run -d -p 6379:6379 --name redis redis:latest

# 3. 확인
docker exec -it redis redis-cli ping
```

### 2순위: WSL2 (Docker Desktop 없이)

```bash
# 1. WSL2 실행
wsl

# 2. Redis 설치
sudo apt update && sudo apt install redis-server -y

# 3. Redis 시작
sudo service redis-server start

# 4. 확인
redis-cli ping
```

## 환경 변수 설정

어떤 방법을 사용하든 `.env` 파일에 추가:

```env
REDIS_URL=redis://localhost:6379
```

## Redis 연결 테스트

애플리케이션 실행 시 콘솔에 다음 메시지가 나타나면 성공:

```
Redis Client Connected
```

연결 실패 시:
```
Redis URL not configured. Redis features will be disabled.
```

## 문제 해결

### 1. "Connection refused" 오류

**원인**: Redis 서버가 실행되지 않음

**해결**:
- Docker: `docker start redis`
- WSL2: `sudo service redis-server start`
- Memurai: Windows 서비스에서 "Memurai" 시작

### 2. 포트 6379가 이미 사용 중

**원인**: 다른 Redis 인스턴스가 실행 중

**해결**:
```bash
# Windows에서 포트 확인
netstat -ano | findstr :6379

# 다른 포트 사용
REDIS_URL=redis://localhost:6380
```

### 3. WSL2에서 Redis가 시작되지 않음

**해결**:
```bash
# Redis 수동 시작
sudo redis-server --daemonize yes

# 또는
sudo service redis-server restart
```

## 개발 워크플로우

### 매일 개발 시작 시

**Docker 사용:**
```bash
docker start redis
npm run dev
```

**WSL2 사용:**
```bash
wsl
sudo service redis-server start
exit
npm run dev
```

### 개발 종료 시 (선택사항)

**Docker:**
```bash
docker stop redis
```

**WSL2:**
```bash
wsl
sudo service redis-server stop
```

## 요약

| 방법 | 난이도 | 추천도 | 비고 |
|------|--------|--------|------|
| Docker Desktop | ⭐ 쉬움 | ⭐⭐⭐⭐⭐ | 가장 간단 |
| WSL2 | ⭐⭐ 보통 | ⭐⭐⭐⭐ | Docker 없이 가능 |
| Memurai | ⭐ 쉬움 | ⭐⭐⭐ | Windows 네이티브 |
| 클라우드 | ⭐ 쉬움 | ⭐⭐⭐⭐⭐ | 프로덕션 권장 |

**개발 환경 추천**: Docker Desktop 또는 WSL2
**프로덕션 환경 추천**: 클라우드 Redis 서비스

