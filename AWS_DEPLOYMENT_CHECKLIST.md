# AWS 배포 체크리스트 ✅

이 문서는 AWS 배포를 위한 단계별 작업 목록입니다. 순서대로 진행하세요.

---

## 📋 전체 개요

다음 AWS 서비스를 설정해야 합니다:

**옵션 A: RDS 사용 (권장 - 프로덕션)**
1. **RDS** - MySQL 데이터베이스 (Prisma 사용)
2. **ElastiCache** - Redis 캐시
3. **EC2** - Next.js 애플리케이션 서버
**비용: ~$50/월**

**옵션 B: EC2 내부 MySQL (비용 절감 - 테스트/개발)**
1. **EC2** - Next.js 애플리케이션 서버 + MySQL
2. **ElastiCache** - Redis 캐시
**비용: ~$30/월 (RDS 비용 절감)**

> 💡 **비용 절감을 원한다면:** EC2 내부에 MySQL 설치 가능! `EC2_MYSQL_SETUP.md` 참고

---

## 🔵 1단계: RDS (MySQL 데이터베이스) 설정

### 1.1 RDS 인스턴스 생성

#### AWS 콘솔에서:

1. **AWS 콘솔** → **RDS** 서비스 이동
2. **데이터베이스 생성** 클릭
3. **설정 구성:**

   ```
   엔진 유형: MySQL
   버전: 8.0.x (최신 안정 버전)
   
   템플릿: 
   - 테스트/개발: Dev/Test (단일 AZ, 비용 절감) ✅ 처음 배포 시 권장
   - 프로덕션: Production (Multi-AZ, 고가용성)
   
   가용성 및 내구성:
   - ✅ 단일 AZ DB 인스턴스 배포 (인스턴스 1개) - 테스트/개발용 권장
   - Multi-AZ DB 인스턴스 배포 - 프로덕션용 (비용 2배, 고가용성)
   
   설정:
   - DB 인스턴스 식별자: devtalk-db
   - 마스터 사용자 이름: admin (또는 원하는 이름)
   - 마스터 암호: 강력한 비밀번호 생성 ⚠️ (저장 필수!)
   
   인스턴스 구성:
   - DB 인스턴스 클래스: db.t3.micro (테스트) / db.t3.small (프로덕션)
   - 스토리지: 20GB (최소)
   - 스토리지 자동 확장: 활성화 권장
   
   연결:
   - VPC: 기본 VPC 또는 EC2와 동일한 VPC ⚠️ (중요!)
   - 퍼블릭 액세스: 아니오 (보안 권장)
   - 가용 영역: ap-northeast-2a (EC2와 동일하게)
   - VPC 보안 그룹: 새로 생성 또는 기존 사용
     - 이름: devtalk-rds-sg
   
   데이터베이스 인증:
   - 비밀번호 인증 사용 (기본값)
   
   초기 데이터베이스 이름: devtalk
   ```

4. **백업 설정:**
   - 자동 백업: 활성화
   - 백업 보관 기간: 7일
   - 백업 윈도우: 기본값 또는 설정

5. **생성** 클릭 (5-10분 소요)

#### 생성 후 확인:

- **엔드포인트 주소** 확인 (예: `devtalk-db.xxxxx.ap-northeast-2.rds.amazonaws.com`)
- **포트**: 3306 (기본값)
- **데이터베이스 이름**: devtalk

### 1.2 RDS 보안 그룹 설정

1. **EC2 Console** → **보안 그룹** 이동
2. RDS 보안 그룹 선택 (`devtalk-rds-sg`)
3. **인바운드 규칙 편집:**

   ```
   타입: MySQL/Aurora
   프로토콜: TCP
   포트: 3306
   소스: 
   - EC2 보안 그룹 ID (추천)
   - 또는 EC2 프라이빗 IP 주소
   ```

4. **저장**

### 1.3 연결 정보 기록

```
RDS 엔드포인트: devtalk-db.xxxxx.ap-northeast-2.rds.amazonaws.com
포트: 3306
데이터베이스 이름: devtalk
사용자 이름: admin
비밀번호: [생성한 비밀번호]
```

이 정보로 `DATABASE_URL`을 만들 수 있습니다:
```
mysql://admin:비밀번호@devtalk-db.xxxxx.ap-northeast-2.rds.amazonaws.com:3306/devtalk
```

---

## 🔴 2단계: ElastiCache (Redis) 설정

### 2.1 ElastiCache Redis 클러스터 생성

#### AWS 콘솔에서:

1. **AWS 콘솔** → **ElastiCache** 서비스 이동
2. **Redis** 선택 → **생성** 클릭

3. **설정 구성:**

   ```
   클러스터 이름: devtalk-redis
   
   위치:
   - 네트워크 유형: IPv4
   - 엔진: Redis
   - 버전: 7.x (최신 안정 버전)
   
   노드 설정:
   - 노드 유형: cache.t3.micro (테스트) / cache.t3.small (프로덕션)
   - 포트: 6379 (기본값)
   - 파라미터 그룹: default.redis7.x (또는 새로 생성)
   
   서브넷 그룹:
   - 새 서브넷 그룹 생성
     - 이름: devtalk-subnet-group
     - VPC: RDS와 동일한 VPC 선택 ⚠️ (중요!)
     - 가용 영역: ap-northeast-2a, ap-northeast-2c
     - 서브넷: 프라이빗 서브넷 선택
   
   보안:
   - 암호화 전송: 비활성화 (필요시 활성화)
   - Redis AUTH: 비활성화 (필요시 활성화)
   - 보안 그룹: 새로 생성
     - 이름: devtalk-redis-sg
   
   백업:
   - 자동 백업: 활성화 (권장)
   - 백업 보관 기간: 1일
   - 백업 윈도우: 기본값
   
   유지 관리:
   - 유지 관리 윈도우: 기본값
   ```

4. **생성** 클릭 (5-10분 소요)

### 2.2 ElastiCache 보안 그룹 설정

1. **EC2 Console** → **보안 그룹** 이동
2. ElastiCache 보안 그룹 선택 (`devtalk-redis-sg`)
3. **인바운드 규칙 편집:**

   ```
   타입: Custom TCP
   프로토콜: TCP
   포트: 6379
   소스: EC2 보안 그룹 ID
   ```

4. **저장**

### 2.3 EC2 보안 그룹에서 아웃바운드 설정

1. **EC2 보안 그룹** (EC2용) 선택
2. **아웃바운드 규칙 편집:**

   ```
   타입: Custom TCP
   프로토콜: TCP
   포트: 6379
   대상: devtalk-redis-sg 보안 그룹
   ```

3. **저장**

### 2.4 Redis 엔드포인트 확인

1. **ElastiCache 콘솔** → **Redis 클러스터** 선택
2. **Primary Endpoint** 복사:
   ```
   devtalk-redis.xxxxx.cache.amazonaws.com:6379
   ```

이 정보로 `REDIS_URL`을 만들 수 있습니다:
```
redis://devtalk-redis.xxxxx.cache.amazonaws.com:6379
```

---

## 🟢 3단계: EC2 인스턴스 설정

### 3.1 EC2 인스턴스 생성

#### AWS 콘솔에서:

1. **AWS 콘솔** → **EC2** 서비스 이동
2. **인스턴스 시작** 클릭

3. **설정 구성:**

   ```
   이름: devtalk-server
   
   애플리케이션 및 OS 이미지:
   - Ubuntu Server 22.04 LTS (HVM) - SSD Volume Type
   
   인스턴스 유형:
   - t3.small (2 vCPU, 2GB RAM) - 프로덕션 권장
   - t3.micro (2 vCPU, 1GB RAM) - 테스트용 (제한적)
   
   키 페어:
   - 새 키 페어 생성
     - 이름: devtalk-key
     - 유형: RSA
     - 프라이빗 키 파일 형식: .pem
   - 다운로드 필수! ⚠️
   
   네트워크 설정:
   - VPC: RDS, ElastiCache와 동일한 VPC ⚠️ (중요!)
   - 서브넷: 퍼블릭 서브넷
   - 자동 할당 퍼블릭 IP: 활성화
   - 보안 그룹: 새 보안 그룹 생성
     - 이름: devtalk-ec2-sg
     - 규칙 추가:
       - SSH (22): 내 IP
       - HTTP (80): 0.0.0.0/0
       - HTTPS (443): 0.0.0.0/0
       - Custom TCP (3000): 0.0.0.0/0 (개발/테스트용)
   
   스토리지:
   - 크기: 20GB (최소)
   - 볼륨 유형: gp3
   
   고급 세부 정보:
   - IAM 인스턴스 프로필: 선택사항 (S3 사용 시 권장)
   ```

4. **인스턴스 시작** 클릭

### 3.2 Elastic IP 할당 (선택, 권장)

1. **EC2 Console** → **네트워크 및 보안** → **Elastic IP 주소**
2. **Elastic IP 주소 할당**
3. **작업** → **Elastic IP 주소 연결**
4. 인스턴스 선택 → 연결

### 3.3 EC2 초기 설정

#### SSH 접속:

```bash
# 키 파일 권한 설정 (Windows는 생략 가능)
chmod 400 devtalk-key.pem

# SSH 접속
ssh -i devtalk-key.pem ubuntu@your-ec2-ip
```

#### 필수 패키지 설치:

```bash
# 시스템 업데이트
sudo apt update && sudo apt upgrade -y

# Node.js 20 설치
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 확인
node --version  # v20.x.x
npm --version

# PM2 설치 (프로세스 매니저)
sudo npm install -g pm2

# Git 설치
sudo apt install -y git

# Nginx 설치 (리버스 프록시)
sudo apt install -y nginx

# 확인
pm2 --version
git --version
nginx -v
```

### 3.4 환경 변수 설정

```bash
# 배포 디렉토리 생성
mkdir -p ~/devtalk
cd ~/devtalk

# .env 파일 생성
nano .env
```

`.env` 파일에 다음 내용 입력:

```env
# Node.js
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0

# Database (RDS)
DATABASE_URL="mysql://admin:비밀번호@devtalk-db.xxxxx.ap-northeast-2.rds.amazonaws.com:3306/devtalk"

# Redis (ElastiCache)
REDIS_URL="redis://devtalk-redis.xxxxx.cache.amazonaws.com:6379"

# JWT
JWT_SECRET="your-very-strong-jwt-secret-key-here-change-this"

# Google OAuth (사용하는 경우)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# AWS S3 (이미지 저장용, 선택사항)
STORAGE_TYPE=s3
AWS_S3_BUCKET=your-bucket-name
AWS_S3_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# 애플리케이션 URL
# Elastic IP 사용 (권장 - 인스턴스 재시작 후에도 IP 변경 안 됨)
NEXT_PUBLIC_APP_URL=http://your-elastic-ip
# 또는 일반 퍼블릭 IP (재시작 시 변경될 수 있음)
# NEXT_PUBLIC_APP_URL=http://your-ec2-ip
# 또는 도메인이 있으면
# NEXT_PUBLIC_APP_URL=https://your-domain.com
```

**저장:** `Ctrl + O`, `Enter`, `Ctrl + X`

### 3.5 Nginx 설정

```bash
# Nginx 설정 파일 생성
sudo nano /etc/nginx/sites-available/devtalk
```

다음 내용 입력:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    # 또는 IP만 사용: server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.IO WebSocket 지원
    location /api/socket {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }
}
```

**저장 후:**

```bash
# 심볼릭 링크 생성
sudo ln -s /etc/nginx/sites-available/devtalk /etc/nginx/sites-enabled/

# 기본 설정 비활성화 (선택사항)
sudo rm /etc/nginx/sites-enabled/default

# 설정 테스트
sudo nginx -t

# Nginx 재시작
sudo systemctl restart nginx
sudo systemctl enable nginx
```

---

## 🔐 4단계: GitHub Actions 설정

### 4.1 GitHub Secrets 설정

1. **GitHub 저장소** → **Settings** → **Secrets and variables** → **Actions**

2. **New repository secret** 클릭하여 다음 추가:

   #### 필수 Secrets:

   ```
   이름: EC2_SSH_PRIVATE_KEY
   값: devtalk-key.pem 파일의 전체 내용
   (-----BEGIN RSA PRIVATE KEY----- 부터 -----END RSA PRIVATE KEY----- 까지)
   ```

   ```
   이름: EC2_HOST
   값: EC2 Elastic IP 또는 퍼블릭 IP
   예: 123.45.67.89
   ```

   ```
   이름: EC2_USER
   값: ubuntu
   ```

   #### 선택적 Secrets (테스트/빌드용):

   ```
   이름: DATABASE_URL
   값: mysql://admin:비밀번호@devtalk-db.xxxxx.ap-northeast-2.rds.amazonaws.com:3306/devtalk
   ```

   ```
   이름: REDIS_URL
   값: redis://devtalk-redis.xxxxx.cache.amazonaws.com:6379
   ```

### 4.2 첫 배포 테스트

```bash
# 로컬에서
git add .
git commit -m "Initial deployment setup"
git push origin main

# GitHub Actions에서 배포 진행 확인
# GitHub 저장소 → Actions 탭
```

---

## 🧪 5단계: 연결 테스트

### 5.1 EC2에서 RDS 연결 테스트

```bash
# EC2 접속
ssh -i devtalk-key.pem ubuntu@your-ec2-ip

# MySQL 클라이언트 설치
sudo apt install -y mysql-client

# 연결 테스트
mysql -h devtalk-db.xxxxx.ap-northeast-2.rds.amazonaws.com \
      -u admin \
      -p \
      devtalk

# 비밀번호 입력 후 연결 확인
# MySQL 프롬프트에서:
SHOW DATABASES;
exit;
```

### 5.2 EC2에서 Redis 연결 테스트

```bash
# Redis 클라이언트 설치
sudo apt install -y redis-tools

# 연결 테스트
redis-cli -h devtalk-redis.xxxxx.cache.amazonaws.com -p 6379 ping

# 응답: PONG (성공)
```

### 5.3 애플리케이션 배포 및 테스트

```bash
# 첫 배포는 수동으로 해보기
cd ~/devtalk
git clone https://github.com/your-username/devtalk.git repo
cd repo/devtalk
npm install
npm run db:generate
npm run build
pm2 start npm --name "devtalk" -- start
pm2 save

# 로그 확인
pm2 logs devtalk

# 브라우저에서 접속
# http://your-ec2-ip
```

---

## 📊 6단계: 모니터링 설정

### 6.1 CloudWatch 설정 (선택사항)

- EC2 인스턴스 → 모니터링 → 고급 모니터링 활성화
- CloudWatch에서 CPU, 메모리, 네트워크 모니터링

### 6.2 로그 확인 명령어

```bash
# PM2 로그
pm2 logs devtalk

# PM2 모니터
pm2 monit

# Nginx 로그
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# 시스템 로그
sudo journalctl -u nginx -f
```

---

## ✅ 최종 체크리스트

배포 전 최종 확인:

- [ ] RDS MySQL 인스턴스 생성 완료
- [ ] RDS 보안 그룹 설정 완료 (EC2 접근 허용)
- [ ] ElastiCache Redis 클러스터 생성 완료
- [ ] ElastiCache 보안 그룹 설정 완료 (EC2 접근 허용)
- [ ] EC2 인스턴스 생성 완료
- [ ] EC2 보안 그룹 설정 완료 (HTTP, HTTPS, SSH)
- [ ] EC2에 Node.js, PM2, Nginx 설치 완료
- [ ] EC2 환경 변수 설정 완료 (.env 파일)
- [ ] Nginx 설정 완료
- [ ] GitHub Secrets 설정 완료
- [ ] RDS 연결 테스트 성공
- [ ] Redis 연결 테스트 성공
- [ ] 애플리케이션 배포 성공
- [ ] 웹사이트 접속 확인 성공

---

## 💰 비용 예상 (월간)

### 소규모 (테스트/개발):

- **RDS**: db.t3.micro - ~$15
- **ElastiCache**: cache.t3.micro - ~$15
- **EC2**: t3.small - ~$15
- **데이터 전송**: ~$5
- **총계**: **약 $50/월**

### 프로덕션:

- **RDS**: db.t3.small - ~$30
- **ElastiCache**: cache.t3.small - ~$25
- **EC2**: t3.small (또는 t3.medium) - ~$15-30
- **Elastic IP**: 무료 (EC2에 연결 시)
- **데이터 전송**: ~$10
- **총계**: **약 $80-95/월**

---

## 🆘 문제 발생 시

### RDS 연결 실패:

1. 보안 그룹 확인 (EC2 → RDS 접근 허용)
2. VPC 확인 (EC2와 RDS가 같은 VPC)
3. RDS 엔드포인트 확인

### Redis 연결 실패:

1. 보안 그룹 확인 (EC2 → ElastiCache 접근 허용)
2. VPC 확인 (EC2와 ElastiCache가 같은 VPC)
3. ElastiCache 엔드포인트 확인
4. `redis-cli`로 직접 연결 테스트

### 애플리케이션 오류:

1. PM2 로그 확인: `pm2 logs devtalk`
2. 환경 변수 확인: `cat ~/devtalk/.env`
3. 포트 확인: `netstat -tulpn | grep 3000`
4. Nginx 로그 확인: `sudo tail -f /var/log/nginx/error.log`

---

## 📚 추가 참고 자료

- [AWS_DEPLOYMENT_GUIDE.md](./AWS_DEPLOYMENT_GUIDE.md) - 상세 가이드
- [EC2_DEPLOYMENT.md](./EC2_DEPLOYMENT.md) - EC2 이미지 저장 가이드
- AWS 공식 문서:
  - [RDS 가이드](https://docs.aws.amazon.com/ko_kr/AmazonRDS/latest/UserGuide/Welcome.html)
  - [ElastiCache 가이드](https://docs.aws.amazon.com/ko_kr/AmazonElastiCache/latest/red-ug/Welcome.html)
  - [EC2 가이드](https://docs.aws.amazon.com/ko_kr/AWSEC2/latest/UserGuide/concepts.html)

---

**모든 설정이 완료되면 `git push origin main`으로 자동 배포가 시작됩니다!** 🚀

