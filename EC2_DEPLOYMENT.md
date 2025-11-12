# EC2 배포 가이드 - 이미지 저장

## EC2 배포 시 이미지 저장 방식

EC2는 단일 서버이므로 로컬 파일시스템을 사용할 수 있습니다. 하지만 영구 저장과 확장성을 위해 몇 가지 옵션이 있습니다.

## 옵션 1: 로컬 파일시스템 (기본, EC2 권장)

### 장점
- 설정 간단
- 추가 비용 없음
- 빠른 접근 속도

### 설정 방법

1. **기본 설정 (자동)**
   - 환경 변수 설정 불필요
   - `public/uploads/profiles/` 폴더에 자동 저장

2. **EBS 볼륨 사용 (영구 저장 권장)**
   ```bash
   # EC2 인스턴스에 EBS 볼륨 마운트
   sudo mkdir -p /mnt/uploads
   sudo mount /dev/xvdf /mnt/uploads  # 볼륨 디바이스명 확인 필요
   
   # 환경 변수 설정 (.env 또는 시스템 환경 변수)
   UPLOAD_DIR=/mnt/uploads/profiles
   ```

3. **별도 디렉토리 사용**
   ```bash
   # 환경 변수 설정
   UPLOAD_DIR=/var/www/uploads/profiles
   ```

### 주의사항
- EC2 인스턴스 교체 시 파일 백업 필요
- 여러 EC2 인스턴스 사용 시 파일 공유 불가 (로드밸런서 사용 불가)
- EBS 볼륨 사용 시 스냅샷 백업 권장

## 옵션 2: AWS S3 (확장성 및 안정성)

### 장점
- 영구 저장 (인스턴스 교체와 무관)
- 여러 EC2 인스턴스 간 파일 공유 가능
- 자동 백업 및 버전 관리
- CDN 연동 가능 (CloudFront)

### 설정 방법

1. **S3 버킷 생성**
   ```bash
   # AWS CLI 사용
   aws s3 mb s3://your-bucket-name --region ap-northeast-2
   ```

2. **IAM 권한 설정**
   - EC2 인스턴스에 S3 접근 권한이 있는 IAM 역할 연결
   - 또는 Access Key 사용

3. **환경 변수 설정**
   ```env
   STORAGE_TYPE=s3
   AWS_S3_BUCKET=your-bucket-name
   AWS_S3_REGION=ap-northeast-2
   AWS_ACCESS_KEY_ID=your-access-key
   AWS_SECRET_ACCESS_KEY=your-secret-key
   ```

4. **패키지 설치** (S3 사용 시)
   ```bash
   npm install @aws-sdk/client-s3
   ```

5. **S3 버킷 정책 설정** (공개 읽기 허용)
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicReadGetObject",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::your-bucket-name/profiles/*"
       }
     ]
   }
   ```

## 옵션 3: Cloudinary (외부 서비스)

Cloudinary를 사용하려면 `STORAGE_SETUP.md` 참고

## EC2 배포 체크리스트

### 로컬 파일시스템 사용 시
- [ ] `public/uploads/profiles/` 디렉토리 생성
- [ ] 디렉토리 권한 설정 (`chmod 755`)
- [ ] EBS 볼륨 마운트 (선택사항, 영구 저장)
- [ ] 정기 백업 스크립트 설정 (선택사항)

### S3 사용 시
- [ ] S3 버킷 생성
- [ ] IAM 권한 설정
- [ ] 환경 변수 설정
- [ ] `@aws-sdk/client-s3` 패키지 설치
- [ ] 버킷 정책 설정

## 파일 서빙

### 로컬 파일시스템 사용 시
- `public/uploads/profiles/` 폴더의 파일은 Next.js가 자동으로 서빙
- URL: `http://your-domain/uploads/profiles/filename.jpg`

### S3 사용 시
- S3 URL 직접 사용 또는 CloudFront CDN 사용
- URL: `https://your-bucket.s3.ap-northeast-2.amazonaws.com/profiles/filename.jpg`

## 권장사항

### 소규모 서비스 (단일 EC2)
- **로컬 파일시스템 + EBS 볼륨** 사용
- 정기 백업 스크립트 설정

### 중대규모 서비스 (여러 EC2, 로드밸런서)
- **AWS S3** 사용 필수
- CloudFront CDN 연동 권장

