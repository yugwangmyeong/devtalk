#!/bin/bash

# .env 파일 생성 스크립트
# 사용법: bash create_env.sh

cd ~/devtalk

cat > .env << 'EOF'
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
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# AWS S3 (이미지 저장용, 선택사항)
STORAGE_TYPE=s3
AWS_S3_BUCKET=""
AWS_S3_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""

# 애플리케이션 URL - Elastic IP로 변경 필요
NEXT_PUBLIC_APP_URL="http://your-elastic-ip"
EOF

echo "✅ .env 파일이 생성되었습니다!"
echo ""
echo "다음 명령어로 내용을 확인하고 수정하세요:"
echo "  cat .env"
echo "  nano .env"

