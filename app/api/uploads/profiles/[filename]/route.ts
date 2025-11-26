import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// 업로드된 이미지 파일을 서빙하는 API
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> | { filename: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const { filename } = resolvedParams;

    // 파일 경로 결정
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

    const uploadDir = getUploadDir();
    const filePath = join(uploadDir, filename);

    // 파일 존재 확인
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: '파일을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 파일 읽기
    const fileBuffer = await readFile(filePath);

    // Content-Type 결정
    const ext = filename.split('.').pop()?.toLowerCase();
    const contentTypeMap: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
    };
    const contentType = contentTypeMap[ext || ''] || 'application/octet-stream';

    // 이미지 반환
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Image serving error:', error);
    return NextResponse.json(
      { error: '이미지를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

