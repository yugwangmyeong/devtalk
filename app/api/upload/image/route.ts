import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { getTokenFromCookies, verifyToken } from '@/lib/auth';

// 환경 변수로 스토리지 타입 선택 (local, s3, 또는 cloudinary)
const STORAGE_TYPE = process.env.STORAGE_TYPE || 'local';

// Cloudinary 설정
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

// AWS S3 설정
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET;
const AWS_S3_REGION = process.env.AWS_S3_REGION || 'ap-northeast-2';
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;

// 로컬 저장 경로 (EC2에서 영구 저장을 위해 환경 변수로 설정 가능)
const getUploadDir = () => {
  if (process.env.UPLOAD_DIR) {
    // 절대 경로인 경우 그대로 사용
    return process.env.UPLOAD_DIR.startsWith('/') || process.env.UPLOAD_DIR.match(/^[A-Za-z]:/) 
      ? process.env.UPLOAD_DIR 
      : join(process.cwd(), process.env.UPLOAD_DIR);
  }
  // 기본 경로
  return join(process.cwd(), 'public', 'uploads', 'profiles');
};

// Cloudinary에 업로드하는 함수
async function uploadToCloudinary(file: File): Promise<string> {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary 환경 변수가 설정되지 않았습니다.');
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const base64 = buffer.toString('base64');
  const dataURI = `data:${file.type};base64,${base64}`;

  const formData = new FormData();
  formData.append('file', dataURI);
  formData.append('upload_preset', 'devtalk_profiles'); // Cloudinary에서 미리 설정해야 함
  formData.append('folder', 'profiles');

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Cloudinary 업로드 실패');
  }

  const data = await response.json();
  return data.secure_url; // HTTPS URL 반환
}

// 로컬 파일시스템에 저장하는 함수 (EC2용)
async function saveToLocal(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const timestamp = Date.now();
  const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const fileName = `${timestamp}_${originalName}`;

  // 업로드 디렉토리 경로 가져오기
  const uploadDir = getUploadDir();
  
  // 디렉토리가 없으면 생성
  if (!existsSync(uploadDir)) {
    await mkdir(uploadDir, { recursive: true });
  }

  const filePath = join(uploadDir, fileName);
  await writeFile(filePath, buffer);

  // public 폴더 기준이면 상대 경로, 아니면 절대 URL
  if (uploadDir.includes('public')) {
    return `/uploads/profiles/${fileName}`;
  } else {
    // EC2에서 별도 디렉토리 사용 시 정적 파일 서빙 필요
    return `/api/uploads/profiles/${fileName}`;
  }
}

// AWS S3에 업로드하는 함수 (선택사항)
async function uploadToS3(file: File): Promise<string> {
  if (!AWS_S3_BUCKET || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    throw new Error('AWS S3 환경 변수가 설정되지 않았습니다.');
  }

  // S3 모듈을 동적으로 import (S3 사용 시에만 로드)
  const { uploadToS3: s3Upload } = await import('@/lib/s3-upload');
  return s3Upload(file, AWS_S3_BUCKET, AWS_S3_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY);
}

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const token = getTokenFromCookies(request.cookies);

    if (!token) {
      return NextResponse.json(
        { error: '인증되지 않았습니다.' },
        { status: 401 }
      );
    }

    const decoded = await verifyToken(token);

    if (!decoded) {
      return NextResponse.json(
        { error: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    // FormData에서 파일 가져오기
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: '파일이 제공되지 않았습니다.' },
        { status: 400 }
      );
    }

    // 파일 타입 검증 (이미지만 허용)
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: '이미지 파일만 업로드할 수 있습니다.' },
        { status: 400 }
      );
    }

    // 파일 크기 제한 (5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: '파일 크기는 5MB 이하여야 합니다.' },
        { status: 400 }
      );
    }

    // 스토리지 타입에 따라 업로드
    let fileUrl: string;
    
    if (STORAGE_TYPE === 's3' && AWS_S3_BUCKET) {
      // AWS S3에 업로드 (S3 사용 시에만 실행)
      try {
        fileUrl = await uploadToS3(file);
      } catch (error) {
        console.error('S3 upload failed, falling back to local:', error);
        // S3 업로드 실패 시 로컬로 폴백
        fileUrl = await saveToLocal(file);
      }
    } else if (STORAGE_TYPE === 'cloudinary' && CLOUDINARY_CLOUD_NAME) {
      // Cloudinary에 업로드
      fileUrl = await uploadToCloudinary(file);
    } else {
      // 로컬 파일시스템에 저장 (EC2 기본 방식)
      fileUrl = await saveToLocal(file);
    }

    return NextResponse.json(
      { url: fileUrl, message: '이미지가 업로드되었습니다.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Image upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '이미지 업로드 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
