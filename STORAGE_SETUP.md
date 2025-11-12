# 이미지 스토리지 설정 가이드

## 현재 구현 방식

이미지 업로드는 환경 변수에 따라 두 가지 방식으로 동작합니다:

### 1. 로컬 파일시스템 (기본값, 개발 환경)
- 파일이 `public/uploads/profiles/` 폴더에 저장됩니다
- **문제점**: 서버리스 환경(Vercel 등)에서는 배포 시 파일이 사라집니다
- **사용 시나리오**: 로컬 개발, 단일 서버 배포

### 2. Cloudinary (프로덕션 권장)
- 클라우드 스토리지에 이미지를 저장합니다
- **장점**: 영구 저장, CDN 제공, 자동 최적화
- **사용 시나리오**: 프로덕션 배포, 서버리스 환경

## 설정 방법

### 로컬 파일시스템 사용 (기본)

환경 변수 설정 불필요. 기본적으로 로컬에 저장됩니다.

### Cloudinary 사용

1. **Cloudinary 계정 생성**
   - https://cloudinary.com 에서 무료 계정 생성

2. **환경 변수 설정**
   `.env.local` 또는 배포 플랫폼의 환경 변수에 추가:
   ```env
   STORAGE_TYPE=cloudinary
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

3. **Cloudinary Upload Preset 설정**
   - Cloudinary 대시보드에서 Settings > Upload > Upload presets
   - "Add upload preset" 클릭
   - Preset name: `devtalk_profiles`
   - Signing mode: `Unsigned` (또는 Signed로 설정 후 추가 인증 구현)
   - Folder: `profiles` (선택사항)
   - 저장

## 배포 환경별 권장사항

### Vercel 배포
- **필수**: Cloudinary 또는 다른 클라우드 스토리지 사용
- 로컬 파일시스템은 사용 불가 (서버리스 환경)

### AWS EC2 / 단일 서버 배포
- 로컬 파일시스템 사용 가능
- 또는 S3 사용 권장 (확장성)

### Docker 배포
- 볼륨 마운트로 파일 영구 저장 가능
- 또는 클라우드 스토리지 사용 권장

## 다른 클라우드 스토리지 옵션

### AWS S3
- 더 많은 제어가 필요할 때
- 직접 구현 필요

### Azure Blob Storage
- Azure 환경 사용 시
- 직접 구현 필요

### Cloudinary (현재 구현됨)
- 가장 간단한 설정
- 자동 이미지 최적화
- CDN 포함

