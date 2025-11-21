#!/bin/bash

# EC2 초기 설정 스크립트
# 이 스크립트는 EC2 인스턴스에 처음 접속했을 때 실행하는 스크립트입니다.

set -e  # 오류 발생 시 중단

echo "🚀 EC2 초기 설정을 시작합니다..."
echo ""

# 1. 시스템 업데이트
echo "📦 [1/7] 시스템 업데이트 중..."
sudo apt update && sudo apt upgrade -y
echo "✅ 시스템 업데이트 완료"
echo ""

# 2. Node.js 설치
echo "📦 [2/7] Node.js 20.x 설치 중..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
echo "✅ Node.js 설치 완료"
node --version
npm --version
echo ""

# 3. PM2 설치
echo "📦 [3/7] PM2 설치 중..."
sudo npm install -g pm2
echo "✅ PM2 설치 완료"
pm2 --version
echo ""

# 4. Git 설치
echo "📦 [4/7] Git 설치 중..."
sudo apt install -y git
echo "✅ Git 설치 완료"
git --version
echo ""

# 5. Nginx 설치
echo "📦 [5/7] Nginx 설치 중..."
sudo apt install -y nginx
echo "✅ Nginx 설치 완료"
nginx -v
echo ""

# 6. MySQL 클라이언트 설치 (RDS 연결 테스트용)
echo "📦 [6/7] MySQL 클라이언트 설치 중..."
sudo apt install -y mysql-client
echo "✅ MySQL 클라이언트 설치 완료"
echo ""

# 7. Redis 클라이언트 설치 (ElastiCache 연결 테스트용)
echo "📦 [7/7] Redis 클라이언트 설치 중..."
sudo apt install -y redis-tools
echo "✅ Redis 클라이언트 설치 완료"
echo ""

# 디렉토리 생성
echo "📁 배포 디렉토리 생성 중..."
mkdir -p ~/devtalk
echo "✅ 디렉토리 생성 완료"
echo ""

echo "✨ 모든 설치가 완료되었습니다!"
echo ""
echo "다음 단계:"
echo "1. 환경 변수 설정: cd ~/devtalk && nano .env"
echo "2. Nginx 설정: sudo nano /etc/nginx/sites-available/devtalk"
echo "3. 체크리스트의 다음 단계를 따라주세요."
echo ""

