# EC2 첫 설정 가이드 🚀

EC2에 접속한 후 바로 시작할 수 있는 단계별 가이드입니다.

---

## ✅ 1단계: 필수 패키지 설치 (약 5분)

다음 명령어를 **순서대로** 실행하세요:

```bash
# 1. 시스템 업데이트
sudo apt update && sudo apt upgrade -y

# 2. Node.js 20.x 설치
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. 설치 확인
node --version  # v20.x.x 나와야 함
npm --version

# 4. PM2 설치 (프로세스 매니저)
sudo npm install -g pm2

# 5. Git 설치
sudo apt install -y git

# 6. Nginx 설치 (리버스 프록시)
sudo apt install -y nginx

# 7. MySQL 클라이언트 설치 (RDS 연결 테스트용)
sudo apt install -y mysql-client

# 8. Redis 클라이언트 설치 (ElastiCache 연결 테스트용)
sudo apt install -y redis-tools

# 설치 확인
pm2 --version
git --version
nginx -v
```

**모든 명령어가 성공하면 다음 단계로!**

---

## 📁 2단계: 배포 디렉토리 생성

```bash
# 배포 디렉토리 생성
mkdir -p ~/devtalk
cd ~/devtalk
```

---

## 🔐 3단계: 환경 변수 파일 생성

이 단계는 **RDS와 ElastiCache를 먼저 생성한 후** 진행하는 것이 좋습니다.

### RDS와 ElastiCache 엔드포인트가 준비되었다면:

```bash
# .env 파일 생성
nano .env
```

다음 내용을 **복사하여 붙여넣기** (값들을 실제 값으로 변경):

```env
# Node.js
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0

# Database (RDS) - RDS 엔드포인트로 변경 필요
DATABASE_URL="mysql://admin:비밀번호@devtalk-db.xxxxx.ap-northeast-2.rds.amazonaws.com:3306/devtalk"

# Redis (ElastiCache) - ElastiCache 엔드포인트로 변경 필요
REDIS_URL="redis://devtalk-redis.xxxxx.cache.amazonaws.com:6379"

# JWT - 강력한 랜덤 문자열로 변경 필요
JWT_SECRET="your-very-strong-jwt-secret-key-here-change-this-to-random-string"

# Google OAuth (사용하는 경우에만)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# AWS S3 (이미지 저장용, 선택사항)
STORAGE_TYPE=s3
AWS_S3_BUCKET=your-bucket-name
AWS_S3_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# 애플리케이션 URL - Elastic IP 사용 (권장)
NEXT_PUBLIC_APP_URL="http://your-elastic-ip"
# 또는 일반 퍼블릭 IP 사용 (인스턴스 재시작 시 변경될 수 있음)
# NEXT_PUBLIC_APP_URL="http://your-ec2-ip"
# 또는 도메인이 있으면
# NEXT_PUBLIC_APP_URL="https://your-domain.com"
```

**저장 방법:**
1. `Ctrl + O` (저장)
2. `Enter` (확인)
3. `Ctrl + X` (나가기)

---

## 🔧 4단계: Nginx 설정

### 4.1 Nginx 설정 파일 생성

```bash
sudo nano /etc/nginx/sites-available/devtalk
```

다음 내용을 **복사하여 붙여넣기**:

```nginx
server {
    listen 80;
    server_name _;  # 모든 도메인/IP 허용

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

**저장:** `Ctrl + O`, `Enter`, `Ctrl + X`

### 4.2 Nginx 활성화 및 시작

```bash
# 심볼릭 링크 생성
sudo ln -s /etc/nginx/sites-available/devtalk /etc/nginx/sites-enabled/

# 기본 설정 비활성화 (선택사항, 충돌 방지)
sudo rm /etc/nginx/sites-enabled/default 2>/dev/null || true

# 설정 테스트 (에러가 없어야 함)
sudo nginx -t

# Nginx 시작 및 자동 시작 설정
sudo systemctl restart nginx
sudo systemctl enable nginx

# 상태 확인
sudo systemctl status nginx
```

---

## ✅ 5단계: 설치 확인

다음 명령어로 모든 설치가 제대로 되었는지 확인:

```bash
# Node.js 버전
node --version

# npm 버전
npm --version

# PM2 버전
pm2 --version

# Git 버전
git --version

# Nginx 버전
nginx -v

# Nginx 상태
sudo systemctl status nginx

# 현재 디렉토리
pwd  # /home/ubuntu/devtalk 나와야 함
```

---

## 🎯 다음 단계

### 아직 RDS와 ElastiCache를 생성하지 않았다면:

1. **RDS MySQL 생성** (AWS 콘솔에서)
   - 엔드포인트 주소 복사
   - `.env` 파일의 `DATABASE_URL` 업데이트

2. **ElastiCache Redis 생성** (AWS 콘솔에서)
   - Primary Endpoint 복사
   - `.env` 파일의 `REDIS_URL` 업데이트

### RDS와 ElastiCache가 준비되었다면:

1. **연결 테스트:**
   ```bash
   # RDS 연결 테스트 (비밀번호 입력 필요)
   mysql -h devtalk-db.xxxxx.ap-northeast-2.rds.amazonaws.com -u admin -p devtalk
   # 연결되면: SHOW DATABASES; 후 exit
   
   # Redis 연결 테스트
   redis-cli -h devtalk-redis.xxxxx.cache.amazonaws.com -p 6379 ping
   # 응답: PONG (성공)
   ```

2. **GitHub Actions 설정** (자동 배포)
   - GitHub 저장소 → Settings → Secrets 설정
   - 자세한 내용: `AWS_DEPLOYMENT_CHECKLIST.md` 참고

3. **첫 배포:**
   ```bash
   # 수동 배포 (테스트용)
   cd ~/devtalk
   git clone https://github.com/your-username/devtalk.git repo
   cd repo/devtalk
   npm install
   npm run db:generate
   npm run build
   
   # PM2로 실행
   pm2 start npm --name "devtalk" -- start
   pm2 save
   
   # 로그 확인
   pm2 logs devtalk
   ```

---

## 🆘 문제 해결

### Node.js 버전이 안 나온다면:
```bash
which node
# /usr/bin/node 없으면 재설치
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Nginx 시작 안 된다면:
```bash
sudo nginx -t  # 설정 파일 문법 확인
sudo systemctl status nginx  # 에러 메시지 확인
sudo journalctl -u nginx -n 50  # 최근 로그 확인
```

### 권한 오류가 나면:
모든 `sudo` 명령어 앞에 `sudo`가 있는지 확인하세요.

---

## 📝 빠른 참조 명령어

```bash
# 현재 위치 확인
pwd

# 파일 목록 확인
ls -la

# 환경 변수 파일 확인
cat ~/devtalk/.env

# 환경 변수 파일 수정
nano ~/devtalk/.env

# PM2 관리
pm2 list          # 실행 중인 프로세스 확인
pm2 logs devtalk  # 로그 확인
pm2 restart devtalk  # 재시작
pm2 stop devtalk     # 중지
pm2 delete devtalk   # 삭제

# Nginx 관리
sudo systemctl restart nginx  # 재시작
sudo systemctl status nginx   # 상태 확인
sudo nginx -t                 # 설정 테스트
```

---

**준비 완료! 이제 RDS와 ElastiCache를 생성하고, 환경 변수를 설정한 후 배포를 진행하세요!** 🚀

