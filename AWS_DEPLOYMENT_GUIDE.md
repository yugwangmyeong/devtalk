# AWS 배포 가이드 - Next.js + Redis

이 가이드는 Next.js 애플리케이션과 Redis를 AWS에 배포하는 방법을 설명합니다.

## 📋 목차

1. [배포 옵션 개요](#배포-옵션-개요)
2. [Redis 배포 (ElastiCache)](#1-redis-배포-elasticache)
3. [Next.js 배포 방법](#2-nextjs-배포-방법)
   - [옵션 A: EC2 직접 배포](#옵션-a-ec2-직접-배포)
   - [옵션 B: ECS/Fargate (Docker)](#옵션-b-ecsfargate-docker)
   - [옵션 C: Elastic Beanstalk](#옵션-c-elastic-beanstalk)

---

## 배포 옵션 개요

이 프로젝트는 **커스텀 서버(`server.ts`)**와 **Socket.IO**를 사용하므로, 다음과 같은 배포 옵션이 있습니다:

| 옵션 | 장점 | 단점 | 권장 대상 |
|------|------|------|----------|
| **EC2 직접 배포** | 설정 간단, 저렴, 완전한 제어 | 수동 관리 필요 | 소규모 프로젝트, 학습용 |
| **ECS/Fargate** | 확장성 좋음, Docker 표준 | 설정 복잡, 비용 높음 | 프로덕션, 확장 예상 |
| **Elastic Beanstalk** | 자동 스케일링, 관리 편리 | 유연성 낮음 | 중간 규모 |
| **Amplify** | 설정 매우 간단 | 커스텀 서버 미지원 ❌ | 사용 불가 |

**권장: EC2 직접 배포 (소규모) 또는 ECS/Fargate (프로덕션)**

---

## 1. Redis 배포 (ElastiCache)

### 1.1 ElastiCache Redis 클러스터 생성

#### AWS 콘솔에서 생성

1. **AWS 콘솔** → **ElastiCache** 이동

2. **Redis 클러스터 생성** 클릭

3. **설정 구성:**
   ```
   클러스터 이름: devtalk-redis
   엔진: Redis
   버전: 7.x (최신 안정 버전)
   노드 유형: cache.t3.micro (테스트) / cache.t3.small (프로덕션)
   노드 개수: 1 (단일 노드) 또는 2 (Multi-AZ)
   포트: 6379 (기본값)
   ```

4. **보안 그룹 설정:**
   - EC2 보안 그룹과 동일한 VPC 선택
   - 인바운드 규칙: 포트 6379를 EC2 보안 그룹에서만 허용

5. **서브넷 그룹:** EC2와 동일한 VPC/서브넷 선택

6. **백업 설정 (선택):**
   - 자동 백업 활성화 권장
   - 백업 유지 기간: 1일

7. **생성** 클릭 (5-10분 소요)

#### AWS CLI로 생성

```bash
# 서브넷 그룹 생성
aws elasticache create-cache-subnet-group \
  --cache-subnet-group-name devtalk-subnet-group \
  --cache-subnet-group-description "DevTalk Redis subnet group" \
  --subnet-ids subnet-xxx subnet-yyy

# Redis 클러스터 생성
aws elasticache create-cache-cluster \
  --cache-cluster-id devtalk-redis \
  --engine redis \
  --cache-node-type cache.t3.micro \
  --num-cache-nodes 1 \
  --cache-subnet-group-name devtalk-subnet-group \
  --security-group-ids sg-xxx \
  --preferred-availability-zone ap-northeast-2a
```

### 1.2 엔드포인트 확인

생성 완료 후, ElastiCache 콘솔에서 **Primary Endpoint**를 확인합니다:

```
devtalk-redis.xxxxx.cache.amazonaws.com:6379
```

### 1.3 보안 그룹 설정

EC2에서 ElastiCache에 접근하려면:

1. **EC2 보안 그룹** → 아웃바운드 규칙
   - 타입: Custom TCP
   - 포트: 6379
   - 대상: ElastiCache 보안 그룹

2. **ElastiCache 보안 그룹** → 인바운드 규칙
   - 타입: Custom TCP
   - 포트: 6379
   - 소스: EC2 보안 그룹

---

## 2. Next.js 배포 방법

### 옵션 A: EC2 직접 배포

#### A-1. EC2 인스턴스 준비

1. **EC2 인스턴스 생성:**
   ```
   OS: Ubuntu 22.04 LTS
   인스턴스 타입: t3.small (2GB RAM) 이상 권장
   보안 그룹: HTTP(80), HTTPS(443), SSH(22) 허용
   키 페어: 생성하여 다운로드
   ```

2. **Elastic IP 할당** (선택, 권장)

#### A-2. EC2 환경 설정

```bash
# SSH 접속
ssh -i your-key.pem ubuntu@your-ec2-ip

# 시스템 업데이트
sudo apt update && sudo apt upgrade -y

# Node.js 설치 (Node.js 20 LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PM2 설치 (프로세스 매니저)
sudo npm install -g pm2

# Git 설치
sudo apt install -y git

# 확인
node --version  # v20.x.x
npm --version
pm2 --version
```

#### A-3. 애플리케이션 배포

```bash
# 프로젝트 디렉토리 생성
cd /home/ubuntu
git clone https://github.com/your-username/devtalk.git
cd devtalk/devtalk

# 의존성 설치
npm install

# Prisma 설정
npm run db:generate

# 환경 변수 파일 생성
nano .env
```

#### A-4. 환경 변수 설정

`.env` 파일에 다음 내용 추가:

```env
# Node.js
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0

# Database (Prisma)
DATABASE_URL="postgresql://user:password@your-rds-endpoint:5432/devtalk"
# 또는 기존 PostgreSQL 사용 시

# Redis (ElastiCache)
REDIS_URL="redis://devtalk-redis.xxxxx.cache.amazonaws.com:6379"

# JWT
JWT_SECRET="your-jwt-secret-key-here"

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
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

#### A-5. 빌드 및 실행

```bash
# 빌드
npm run build

# PM2로 실행
pm2 start npm --name "devtalk" -- start

# PM2 자동 시작 설정
pm2 startup
pm2 save

# 상태 확인
pm2 status
pm2 logs devtalk
```

#### A-6. Nginx 리버스 프록시 설정 (HTTPS 포함)

```bash
# Nginx 설치
sudo apt install -y nginx

# Nginx 설정 파일 생성
sudo nano /etc/nginx/sites-available/devtalk
```

다음 내용 추가:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # HTTP → HTTPS 리다이렉트 (Let's Encrypt 후 활성화)
    # return 301 https://$server_name$request_uri;

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

```bash
# 심볼릭 링크 생성
sudo ln -s /etc/nginx/sites-available/devtalk /etc/nginx/sites-enabled/

# 설정 테스트
sudo nginx -t

# Nginx 재시작
sudo systemctl restart nginx
sudo systemctl enable nginx
```

#### A-7. HTTPS 설정 (Let's Encrypt)

```bash
# Certbot 설치
sudo apt install -y certbot python3-certbot-nginx

# SSL 인증서 발급 (도메인 필요)
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# 자동 갱신 테스트
sudo certbot renew --dry-run
```

---

### 옵션 B: ECS/Fargate (Docker)

#### B-1. Dockerfile 생성

프로젝트 루트에 `Dockerfile` 생성:

```dockerfile
# Dockerfile
FROM node:20-alpine AS base

# 의존성 설치 단계
FROM base AS deps
WORKDIR /app
COPY package*.json ./
COPY devtalk/package*.json ./devtalk/
RUN cd devtalk && npm ci --only=production

# 빌드 단계
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY devtalk/ ./devtalk/
WORKDIR /app/devtalk

# Prisma 생성
RUN npx prisma generate

# Next.js 빌드
RUN npm run build

# 프로덕션 단계
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# 비root 사용자 생성
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 필요한 파일 복사
COPY --from=builder /app/devtalk/next.config.ts ./
COPY --from=builder /app/devtalk/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/devtalk/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/devtalk/.next/static ./.next/static
COPY --from=builder /app/devtalk/prisma ./prisma
COPY --from=builder /app/devtalk/node_modules/.prisma ./node_modules/.prisma

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

**주의:** Next.js 16의 standalone 출력을 사용하려면 `next.config.ts` 수정 필요:

```typescript
// devtalk/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone', // ECS 배포를 위해 추가
};

export default nextConfig;
```

#### B-2. .dockerignore 생성

```dockerignore
node_modules
.next
.git
.env
*.log
.DS_Store
```

#### B-3. ECR에 이미지 푸시

```bash
# AWS CLI 설정
aws configure

# ECR 로그인
aws ecr get-login-password --region ap-northeast-2 | docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.ap-northeast-2.amazonaws.com

# 리포지토리 생성
aws ecr create-repository --repository-name devtalk --region ap-northeast-2

# 이미지 빌드
docker build -t devtalk .

# 태그 지정
docker tag devtalk:latest YOUR_ACCOUNT_ID.dkr.ecr.ap-northeast-2.amazonaws.com/devtalk:latest

# 푸시
docker push YOUR_ACCOUNT_ID.dkr.ecr.ap-northeast-2.amazonaws.com/devtalk:latest
```

#### B-4. ECS 클러스터 및 서비스 생성

1. **ECS 콘솔** → **클러스터 생성**

2. **태스크 정의 생성:**
   - 컨테이너 이미지: ECR 이미지 URI
   - 포트 매핑: 3000
   - 환경 변수: 위의 `.env` 내용 입력
   - 메모리: 512MB (최소)
   - CPU: 0.25 vCPU

3. **서비스 생성:**
   - 태스크 정의 선택
   - Fargate 선택
   - 서브넷: 퍼블릭 서브넷
   - 보안 그룹: HTTP(80), HTTPS(443), 커스텀(3000)
   - 로드 밸런서 연결 (선택사항)

#### B-5. 환경 변수는 ECS Secrets Manager 또는 파라미터 스토어 사용 권장

---

### 옵션 C: Elastic Beanstalk

#### C-1. 프로젝트 준비

```bash
# .ebignore 생성 (선택사항)
echo "node_modules
.next
.git
.env" > .ebignore

# 애플리케이션 압축
cd devtalk
zip -r ../devtalk-app.zip . -x "node_modules/*" ".git/*" ".next/*"
```

#### C-2. Elastic Beanstalk 애플리케이션 생성

1. **Elastic Beanstalk 콘솔** → **애플리케이션 생성**

2. **플랫폼:** Node.js

3. **애플리케이션 코드:** 업로드 또는 Git 연동

4. **환경 설정:**
   - 환경 변수 추가 (위의 `.env` 내용)

5. **구성 수정:**
   - 인스턴스 타입: t3.small 이상
   - 환경 변수에서 `PORT=3000` 설정

#### C-3. 배포

```bash
# EB CLI 설치 (선택사항)
pip install awsebcli

# 배포
eb init
eb create devtalk-env
eb deploy
```

---

## 3. 배포 후 확인 사항

### 3.1 Redis 연결 확인

```bash
# EC2에서 Redis 연결 테스트
redis-cli -h devtalk-redis.xxxxx.cache.amazonaws.com -p 6379 ping
# 응답: PONG
```

### 3.2 애플리케이션 로그 확인

**EC2 (PM2):**
```bash
pm2 logs devtalk
pm2 monit
```

**ECS:**
- ECS 콘솔 → 태스크 → 로그 탭
- CloudWatch Logs 확인

### 3.3 성능 모니터링

- **CloudWatch:** CPU, 메모리, 네트워크 모니터링
- **ElastiCache:** 캐시 히트율, 연결 수 모니터링

---

## 4. 환경 변수 체크리스트

배포 전 확인:

- [ ] `DATABASE_URL` - Prisma 데이터베이스 연결
- [ ] `REDIS_URL` - ElastiCache 엔드포인트
- [ ] `JWT_SECRET` - 강력한 시크릿 키
- [ ] `NEXT_PUBLIC_APP_URL` - 프로덕션 도메인
- [ ] Google OAuth (사용 시)
- [ ] AWS S3 (이미지 저장 시)

---

## 5. 보안 체크리스트

- [ ] EC2/ECS 보안 그룹: 필요한 포트만 열기
- [ ] ElastiCache 보안 그룹: EC2에서만 접근 허용
- [ ] HTTPS 적용 (Let's Encrypt)
- [ ] 환경 변수: 민감 정보는 Secrets Manager 사용
- [ ] 정기 백업: RDS 스냅샷, ElastiCache 백업

---

## 6. 비용 예상 (월간)

### 소규모 (EC2 + ElastiCache)

- EC2 t3.small: ~$15
- ElastiCache cache.t3.micro: ~$15
- RDS db.t3.micro: ~$15 (PostgreSQL 사용 시)
- 데이터 전송: ~$5
- **총계: ~$50/월**

### 프로덕션 (ECS + ElastiCache)

- ECS Fargate (0.5 vCPU, 1GB): ~$20
- ElastiCache cache.t3.small: ~$25
- ALB (로드 밸런서): ~$20
- RDS db.t3.small: ~$30
- 데이터 전송: ~$10
- **총계: ~$105/월**

---

## 7. 트러블슈팅

### Redis 연결 실패

```bash
# 보안 그룹 확인
aws ec2 describe-security-groups --group-ids sg-xxx

# VPC 확인 (EC2와 ElastiCache가 같은 VPC에 있어야 함)
# ElastiCache는 퍼블릭 IP 없음 - 같은 VPC 필수
```

### Socket.IO 연결 실패

```nginx
# Nginx 설정에서 WebSocket 프록시 확인
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

### 빌드 오류

```bash
# Node.js 버전 확인 (20.x 필요)
node --version

# Prisma 생성 확인
npm run db:generate
```

---

## 8. 추가 리소스

- [AWS ElastiCache Redis 가이드](https://docs.aws.amazon.com/ko_kr/AmazonElastiCache/latest/red-ug/WhatIs.html)
- [Next.js 프로덕션 배포](https://nextjs.org/docs/deployment)
- [PM2 가이드](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [ECS 배포 가이드](https://docs.aws.amazon.com/ko_kr/AmazonECS/latest/developerguide/getting-started.html)

---

## 9. GitHub Actions를 통한 자동 배포 (CI/CD)

### 9.1 GitHub Actions 설정

프로젝트 루트에 `.github/workflows/deploy-ec2.yml` 파일이 있습니다.

#### GitHub Secrets 설정

GitHub 저장소 → Settings → Secrets and variables → Actions → New repository secret:

1. **EC2_SSH_PRIVATE_KEY**: EC2 SSH 비공개 키 (전체 내용, `-----BEGIN`부터 `-----END`까지)
   ```bash
   # 로컬에서 키 내용 복사
   cat ~/.ssh/your-key.pem
   ```

2. **EC2_HOST**: EC2 퍼블릭 IP 또는 도메인
   ```
   123.45.67.89
   # 또는
   ec2.example.com
   ```

3. **EC2_USER**: EC2 사용자 (보통 `ubuntu` 또는 `ec2-user`)
   ```
   ubuntu
   ```

4. **DATABASE_URL** (선택): Prisma 데이터베이스 URL
   ```
   postgresql://user:password@host:5432/dbname
   ```

5. **REDIS_URL** (선택): Redis 연결 URL
   ```
   redis://your-redis.cache.amazonaws.com:6379
   ```

#### 워크플로우 사용 방법

1. **자동 배포**: `main` 또는 `master` 브랜치에 push하면 자동 배포
   ```bash
   git push origin main
   ```

2. **수동 배포**: GitHub Actions 탭 → "Deploy to AWS EC2" → "Run workflow"

### 9.2 배포 워크플로우 옵션

#### 옵션 A: 완전 자동화 (권장)
- 파일: `.github/workflows/deploy-ec2.yml`
- **특징:**
  - GitHub Actions에서 빌드
  - 빌드된 파일만 EC2로 전송
  - 빠른 배포, EC2 리소스 절약
  - 빌드 실패 시 배포 중단 (안전)

#### 옵션 B: EC2에서 빌드
- 파일: `.github/workflows/deploy-ec2-simple.yml`
- **특징:**
  - EC2에서 직접 빌드
  - 더 간단한 설정
  - EC2 리소스 사용 (느림)

### 9.3 EC2 초기 설정 (첫 배포 전)

```bash
# EC2 접속
ssh -i key.pem ubuntu@your-ec2-ip

# 필수 패키지 설치
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx git

# PM2 설치
sudo npm install -g pm2

# 배포 디렉토리 생성
mkdir -p ~/devtalk

# 환경 변수 설정 (중요!)
cd ~/devtalk
nano .env
# 위의 환경 변수 섹션 참고하여 입력

# Nginx 설정
sudo nano /etc/nginx/sites-available/devtalk
# 위의 Nginx 설정 참고

sudo ln -s /etc/nginx/sites-available/devtalk /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 9.4 배포 프로세스

1. **테스트 및 빌드** (GitHub Actions)
   - 코드 체크아웃
   - 의존성 설치
   - Lint 실행 (선택)
   - 테스트 실행 (선택)
   - Prisma Client 생성
   - Next.js 빌드

2. **배포** (EC2)
   - 빌드된 파일 전송
   - 기존 배포 백업
   - 파일 압축 해제
   - PM2 재시작
   - 헬스 체크

### 9.5 배포 로그 확인

**GitHub Actions:**
- GitHub 저장소 → Actions 탭에서 로그 확인

**EC2:**
```bash
ssh -i key.pem ubuntu@your-ec2-ip
pm2 logs devtalk
pm2 monit
```

---

## 10. 빠른 시작 (EC2 + GitHub Actions)

### 초기 설정

```bash
# 1. EC2 접속
ssh -i key.pem ubuntu@ec2-ip

# 2. 필수 패키지 설치
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx git
sudo npm install -g pm2

# 3. 배포 디렉토리 생성
mkdir -p ~/devtalk
cd ~/devtalk

# 4. 환경 변수 설정
nano .env  # 위의 환경 변수 입력

# 5. Nginx 설정
sudo nano /etc/nginx/sites-available/devtalk
# 위의 Nginx 설정 참고
sudo ln -s /etc/nginx/sites-available/devtalk /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### GitHub 설정

1. **GitHub Secrets 추가** (위의 9.1 섹션 참고)

2. **첫 배포 실행:**
   ```bash
   git push origin main
   ```

3. **배포 확인:**
   - GitHub Actions 탭에서 진행 상황 확인
   - 배포 완료 후 웹사이트 접속 확인

---

## 11. 배포 옵션 비교 (GitHub Actions 포함)

| 옵션 | 초기 설정 | CI/CD | 비용 | 복잡도 | 권장 대상 |
|------|----------|-------|------|--------|----------|
| **EC2 + GitHub Actions** | 중간 | ✅ 쉽고 강력 | 저렴 | 중간 | **소규모 프로젝트** ⭐ |
| **ECS + GitHub Actions** | 높음 | ✅ 강력 | 높음 | 높음 | 프로덕션, 확장성 중요 |
| **EC2 수동 배포** | 쉬움 | ❌ | 저렴 | 낮음 | 학습용, 테스트 |

**결론: GitHub Actions까지 고려하면 옵션 1 (EC2 직접 배포)이 가장 실용적입니다!** 🎯

---

**문제가 발생하면 로그를 확인하고, 위의 트러블슈팅 섹션을 참고하세요!** 🚀

