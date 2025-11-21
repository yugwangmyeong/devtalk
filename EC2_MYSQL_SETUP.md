# EC2에 MySQL 직접 설치 가이드 💰

RDS 대신 EC2 인스턴스에 MySQL을 직접 설치하는 방법입니다. 비용을 절감할 수 있습니다.

---

## 💰 비용 비교

| 구분 | RDS | EC2 내부 MySQL |
|------|-----|----------------|
| **추가 비용** | ~$15/월 (db.t3.micro) | **$0** (EC2 비용만) |
| **관리** | AWS 관리 | 직접 관리 필요 |
| **백업** | 자동 | 수동 설정 필요 |
| **권장 대상** | 프로덕션 | 테스트/개발, 소규모 프로젝트 |

**절감: 월 $15 정도**

---

## ✅ 장단점

### 장점
- ✅ **비용 절감** - RDS 비용 없음
- ✅ **완전한 제어** - 설정 자유롭게 변경 가능
- ✅ **빠른 설정** - 설치만 하면 바로 사용

### 단점
- ⚠️ **수동 관리** - 업데이트, 백업 등 직접 관리
- ⚠️ **데이터 백업 필요** - EBS 스냅샷 등으로 백업 설정 필요
- ⚠️ **성능 영향** - EC2 리소스를 DB와 앱이 공유

---

## 📦 1단계: MySQL 설치

EC2에 접속한 상태에서 다음 명령어를 실행하세요:

```bash
# 1. MySQL 서버 설치
sudo apt update
sudo apt install -y mysql-server

# 2. MySQL 버전 확인
mysql --version

# 3. MySQL 보안 설정 (권장)
sudo mysql_secure_installation
```

**mysql_secure_installation 실행 시:**
- Validate password plugin: `y` (비밀번호 강도 검사)
- Password validation policy: `0` (LOW) / `1` (MEDIUM) / `2` (STRONG)
  - LOW: 최소 8자
  - MEDIUM: 대소문자, 숫자, 특수문자 포함, 최소 8자
  - STRONG: MEDIUM + 사전 단어 금지
- 비밀번호 설정: **안전한 비밀번호 입력** ⚠️ (저장 필수!)
- Remove anonymous users: `y`
- Disallow root login remotely: `y` (로컬에서만 접속)
- Remove test database: `y`
- Reload privilege tables: `y`

**비밀번호 정책 오류 발생 시:**
- 방법 1: 강력한 비밀번호 사용 (대소문자 + 숫자 + 특수문자, 8자 이상)
- 방법 2: 정책 확인 및 완화 (아래 참고)

---

## 🔐 2단계: MySQL 설정

### 2.1 MySQL 루트 접속

```bash
# MySQL에 루트로 접속
sudo mysql -u root -p
# 위에서 설정한 비밀번호 입력
```

### 2.2 데이터베이스 및 사용자 생성

MySQL 프롬프트에서 다음 명령어 실행:

```sql
-- 데이터베이스 생성
CREATE DATABASE devtalk CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 애플리케이션용 사용자 생성
CREATE USER 'devtalk_user'@'localhost' IDENTIFIED BY '강력한 비밀번호';

-- 권한 부여
GRANT ALL PRIVILEGES ON devtalk.* TO 'devtalk_user'@'localhost';

-- 권한 적용
FLUSH PRIVILEGES;

-- 확인
SHOW DATABASES;
SELECT user, host FROM mysql.user;

-- 나가기
EXIT;
```

**중요:** `devtalk_user`의 비밀번호는 **안전하게 저장**하세요!

---

## 🔧 3단계: MySQL 원격 접속 설정 (선택사항)

보안상 권장하지 않지만, 필요한 경우:

```bash
# MySQL 설정 파일 편집
sudo nano /etc/mysql/mysql.conf.d/mysqld.cnf
```

다음 줄 찾기:
```
bind-address = 127.0.0.1
```

다음으로 변경:
```
# bind-address = 127.0.0.1  # 주석 처리
bind-address = 0.0.0.0      # 모든 IP 허용 (보안 위험)
```

**보안 강화:** 외부 접속이 필요 없다면 `127.0.0.1`로 유지하세요.

```bash
# MySQL 재시작
sudo systemctl restart mysql

# 자동 시작 설정
sudo systemctl enable mysql

# 상태 확인
sudo systemctl status mysql
```

---

## 📝 4단계: .env 파일 업데이트

```bash
nano ~/devtalk/.env
```

`DATABASE_URL`을 다음으로 변경:

```env
# EC2 내부 MySQL 사용
DATABASE_URL="mysql://devtalk_user:비밀번호@localhost:3306/devtalk"

# 또는
DATABASE_URL="mysql://devtalk_user:비밀번호@127.0.0.1:3306/devtalk"
```

**저장:** `Ctrl + O` → `Enter` → `Ctrl + X`

---

## ✅ 5단계: 연결 테스트

```bash
# MySQL 클라이언트로 접속 테스트
mysql -u devtalk_user -p devtalk
# 비밀번호 입력

# MySQL 프롬프트에서:
SHOW DATABASES;
USE devtalk;
SHOW TABLES;

# 나가기
EXIT;
```

---

## 🔄 6단계: 프로젝트 클론 및 Prisma 마이그레이션 실행

**⚠️ 중요: 이 단계는 프로젝트 코드가 EC2에 있어야 합니다!**

### 6.1 프로젝트 클론 (아직 안 했다면)

```bash
# 배포 디렉토리로 이동
cd ~/devtalk

# GitHub 저장소 클론
git clone https://github.com/your-username/devtalk.git repo
# 또는 실제 저장소 URL 사용

# 프로젝트 디렉토리로 이동
cd repo/devtalk
```

### 6.2 의존성 설치

```bash
# npm 패키지 설치
npm install

# .env 파일이 프로젝트 루트에 있는지 확인
# 만약 ~/devtalk/.env에 있다면 복사하거나 심볼릭 링크 생성
ln -s ~/devtalk/.env .env
# 또는
cp ~/devtalk/.env .env
```

### 6.3 Prisma 마이그레이션 실행

```bash
# Prisma Client 생성
npm run db:generate

# 데이터베이스 마이그레이션 (테이블 생성)
npm run db:push
# 또는
npm run db:migrate
```

**참고:** 
- `db:push`: 스키마를 직접 데이터베이스에 적용 (개발용)
- `db:migrate`: 마이그레이션 파일을 생성하고 적용 (프로덕션용)

---

## 💾 7단계: 백업 설정 (중요!)

EC2에 MySQL을 설치하면 **백업을 직접 설정**해야 합니다.

### 7.1 수동 백업 스크립트 생성

```bash
# 백업 디렉토리 생성
mkdir -p ~/mysql-backups

# 백업 스크립트 생성
nano ~/mysql-backup.sh
```

다음 내용 추가:

```bash
#!/bin/bash

# MySQL 백업 스크립트
BACKUP_DIR="$HOME/mysql-backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/devtalk_backup_$DATE.sql"

# MySQL 덤프 생성
mysqldump -u devtalk_user -p'비밀번호' devtalk > "$BACKUP_FILE"

# 7일 이상 된 백업 삭제
find "$BACKUP_DIR" -name "devtalk_backup_*.sql" -mtime +7 -delete

echo "백업 완료: $BACKUP_FILE"
```

**비밀번호는 실제 비밀번호로 변경하세요!**

```bash
# 실행 권한 부여
chmod +x ~/mysql-backup.sh

# 테스트 실행
~/mysql-backup.sh

# 확인
ls -lh ~/mysql-backups/
```

### 7.2 자동 백업 (Cron 설정)

```bash
# Crontab 편집
crontab -e
```

다음 줄 추가 (매일 새벽 2시에 백업):

```
0 2 * * * /home/ubuntu/mysql-backup.sh >> /home/ubuntu/mysql-backups/backup.log 2>&1
```

**저장:** `Ctrl + O` → `Enter` → `Ctrl + X`

### 7.3 EBS 스냅샷 백업 (AWS 콘솔에서)

1. **EC2 Console** → **Elastic Block Store** → **볼륨**
2. EC2 인스턴스의 볼륨 선택
3. **작업** → **스냅샷 생성**
4. 정기적으로 스냅샷 생성 (수동 또는 AWS Lambda 자동화)

---

## 🔒 8단계: 보안 설정

### 8.1 방화벽 확인

```bash
# MySQL 포트(3306)를 외부에 열지 않도록 확인
sudo ufw status

# 만약 필요하다면 (로컬에서만 접속)
sudo ufw allow from 127.0.0.1 to any port 3306
```

### 8.2 MySQL 사용자 확인

```bash
# MySQL 접속
sudo mysql -u root -p

# 사용자 목록 확인
SELECT user, host FROM mysql.user;

# 외부 접속 사용자가 있다면 제거
# DROP USER 'username'@'%';
```

---

## 🛠️ MySQL 관리 명령어

```bash
# MySQL 시작/중지/재시작
sudo systemctl start mysql
sudo systemctl stop mysql
sudo systemctl restart mysql
sudo systemctl status mysql

# MySQL 로그 확인
sudo tail -f /var/log/mysql/error.log

# MySQL 프로세스 확인
sudo systemctl status mysql

# MySQL 접속
mysql -u devtalk_user -p devtalk
```

---

## 🔄 RDS에서 EC2 MySQL로 마이그레이션 (선택사항)

만약 이미 RDS를 사용 중이라면:

```bash
# 1. RDS에서 덤프 다운로드
mysqldump -h RDS-엔드포인트 -u admin -p devtalk > rds_backup.sql

# 2. EC2 MySQL로 복원
mysql -u devtalk_user -p devtalk < rds_backup.sql
```

---

## 📊 성능 최적화 (선택사항)

EC2 리소스가 부족하다면 MySQL 설정 조정:

```bash
# MySQL 설정 파일 편집
sudo nano /etc/mysql/mysql.conf.d/mysqld.cnf
```

추가/수정:

```ini
[mysqld]
# 기본 설정에 추가
max_connections = 100
innodb_buffer_pool_size = 256M  # EC2 메모리의 50% 정도
```

```bash
# MySQL 재시작
sudo systemctl restart mysql
```

---

## ✅ 완료 체크리스트

- [ ] MySQL 서버 설치 완료
- [ ] 데이터베이스 `devtalk` 생성 완료
- [ ] 사용자 `devtalk_user` 생성 및 권한 부여 완료
- [ ] `.env` 파일의 `DATABASE_URL` 업데이트 완료
- [ ] 연결 테스트 성공
- [ ] 백업 스크립트 생성 및 테스트 완료
- [ ] 자동 백업 (Cron) 설정 완료

---

## 🆘 문제 해결

### 비밀번호 정책 오류 (ERROR 1819)

**현재 정책 확인:**
```sql
SHOW VARIABLES LIKE 'validate_password%';
```

**정책 완화 (선택사항):**
```sql
-- 정책을 LOW로 변경 (최소 8자만 필요)
SET GLOBAL validate_password.policy = LOW;
SET GLOBAL validate_password.length = 8;

-- 또는 정책을 완전히 비활성화 (보안상 권장하지 않음)
UNINSTALL PLUGIN validate_password;
```

**강력한 비밀번호 사용 (권장):**
- 대문자 + 소문자 + 숫자 + 특수문자 포함
- 예: `DevTalk2024!`, `Yoolove4131@`

### MySQL 시작 안 됨
```bash
sudo systemctl status mysql
sudo journalctl -u mysql -n 50  # 로그 확인
```

### 접속 실패
```bash
# MySQL 서비스 확인
sudo systemctl status mysql

# 사용자 권한 확인
sudo mysql -u root -p
SELECT user, host FROM mysql.user;
```

### 비밀번호 분실
```bash
# MySQL 재시작 (비밀번호 없이)
sudo systemctl stop mysql
sudo mysqld_safe --skip-grant-tables &

# 루트 비밀번호 재설정
sudo mysql -u root
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '새비밀번호';
FLUSH PRIVILEGES;
EXIT;

# MySQL 재시작
sudo systemctl restart mysql
```

---

**EC2 내부 MySQL 설정 완료! 이제 `.env` 파일을 업데이트하고 Prisma 마이그레이션을 실행하면 됩니다.** 🚀

