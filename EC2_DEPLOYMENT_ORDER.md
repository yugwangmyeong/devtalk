# EC2 배포 순서 가이드 📋

EC2에 처음 배포할 때 **정확한 순서**를 안내합니다.

---

## ✅ 완료해야 할 작업 순서

### 1단계: EC2 기본 설정 ✅
- [x] EC2 인스턴스 생성
- [x] SSH 접속
- [x] 필수 패키지 설치 (Node.js, PM2, Git, Nginx)
- [x] 배포 디렉토리 생성 (`~/devtalk`)

### 2단계: MySQL 설치 및 설정 ✅
- [x] MySQL 서버 설치
- [x] 데이터베이스 생성 (`devtalk`)
- [x] 사용자 생성 및 권한 부여 (`devtalk_user`)
- [ ] `.env` 파일에 `DATABASE_URL` 설정

### 3단계: 프로젝트 클론 (현재 단계) 🔄
- [ ] GitHub 저장소 클론
- [ ] 의존성 설치 (`npm install`)
- [ ] `.env` 파일 설정/확인

### 4단계: Prisma 마이그레이션
- [ ] Prisma Client 생성 (`npm run db:generate`)
- [ ] 데이터베이스 마이그레이션 (`npm run db:push`)

### 5단계: 애플리케이션 빌드 및 실행
- [ ] 애플리케이션 빌드 (`npm run build`)
- [ ] PM2로 실행 (`pm2 start`)
- [ ] 테스트

---

## 🚀 지금 해야 할 작업 (3단계)

### 프로젝트 클론

EC2에 접속한 상태에서:

```bash
# 1. 배포 디렉토리로 이동
cd ~/devtalk

# 2. GitHub 저장소 클론 (실제 저장소 URL로 변경)
git clone https://github.com/your-username/devtalk.git repo

# 3. 프로젝트 디렉토리로 이동
cd repo/devtalk

# 4. 현재 위치 확인
pwd  # /home/ubuntu/devtalk/repo/devtalk 나와야 함

# 5. 파일 목록 확인
ls -la
```

**⚠️ 참고:**
- `your-username`을 실제 GitHub 사용자명으로 변경
- 또는 저장소가 private이면 인증 필요

### .env 파일 설정

프로젝트를 클론한 후 `.env` 파일을 설정해야 합니다:

```bash
# 방법 1: 기존 .env 파일 복사
cp ~/devtalk/.env ~/devtalk/repo/devtalk/.env

# 방법 2: 심볼릭 링크 생성
ln -s ~/devtalk/.env ~/devtalk/repo/devtalk/.env

# 방법 3: 직접 생성 (프로젝트 루트에)
cd ~/devtalk/repo/devtalk
nano .env
```

`.env` 파일 내용 (MySQL 사용 시):

```env
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0

# EC2 내부 MySQL
DATABASE_URL="mysql://devtalk_user:비밀번호@localhost:3306/devtalk"

# Redis (아직 안 만들었으면 나중에)
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="강력한-랜덤-문자열"

# 애플리케이션 URL
NEXT_PUBLIC_APP_URL="http://your-elastic-ip"
```

**저장:** `Ctrl + O` → `Enter` → `Ctrl + X`

---

## 📝 다음 단계 (4단계): Prisma 마이그레이션

프로젝트 클론 및 `.env` 설정 완료 후:

```bash
# 1. 프로젝트 디렉토리로 이동 (이미 있으면 생략)
cd ~/devtalk/repo/devtalk

# 2. 의존성 설치
npm install

# 3. Prisma Client 생성
npm run db:generate

# 4. 데이터베이스 마이그레이션 (테이블 생성)
npm run db:push
```

**예상 출력:**
```
✔ Generated Prisma Client
✔ Pushed database schema
```

---

## 🔍 문제 해결

### Git Clone 실패

**인증 오류 (Private 저장소):**
```bash
# SSH 키 사용
git clone git@github.com:your-username/devtalk.git repo

# 또는 Personal Access Token 사용
git clone https://TOKEN@github.com/your-username/devtalk.git repo
```

**저장소 URL 확인:**
- GitHub 저장소 페이지 → "Code" 버튼 → URL 복사

### npm install 실패

```bash
# Node.js 버전 확인
node --version  # v20.x.x 나와야 함

# npm 캐시 정리
npm cache clean --force

# 다시 설치
npm install
```

### Prisma 오류

```bash
# .env 파일 확인
cat .env | grep DATABASE_URL

# MySQL 연결 테스트
mysql -u devtalk_user -p devtalk

# Prisma 스키마 확인
cat prisma/schema.prisma
```

---

## ✅ 체크리스트

현재 진행 상황 확인:

- [ ] EC2 접속 가능
- [ ] 필수 패키지 설치 완료 (Node.js, PM2, Git, Nginx)
- [ ] MySQL 설치 및 데이터베이스 생성 완료
- [ ] 프로젝트 클론 완료 (`git clone`)
- [ ] `.env` 파일 설정 완료
- [ ] `npm install` 완료
- [ ] Prisma 마이그레이션 완료 (`npm run db:push`)

**다음 단계:**
- [ ] 애플리케이션 빌드 (`npm run build`)
- [ ] PM2로 실행 (`pm2 start npm --name "devtalk" -- start`)
- [ ] Nginx 설정 확인
- [ ] 웹사이트 접속 테스트

---

**현재 단계: 프로젝트 클론! Git Clone을 진행하세요.** 🚀

