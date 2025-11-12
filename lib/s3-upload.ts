// AWS S3 업로드 함수 (선택사항)
// S3를 사용하지 않을 경우 이 파일은 사용되지 않습니다.

export async function uploadToS3(
  file: File,
  bucket: string,
  region: string,
  accessKeyId: string,
  secretAccessKey: string
): Promise<string> {
  try {
    // AWS SDK 동적 import (S3 사용 시에만 필요)
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    const timestamp = Date.now();
    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `profiles/${timestamp}_${originalName}`;

    const s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: fileName,
      Body: buffer,
      ContentType: file.type,
      ACL: 'public-read', // 또는 버킷 정책으로 설정
    });

    await s3Client.send(command);

    // S3 URL 반환
    return `https://${bucket}.s3.${region}.amazonaws.com/${fileName}`;
  } catch (error) {
    // @aws-sdk/client-s3 패키지가 설치되지 않은 경우
    if (error instanceof Error && error.message.includes('Cannot find module')) {
      throw new Error('S3를 사용하려면 @aws-sdk/client-s3 패키지를 설치해주세요: npm install @aws-sdk/client-s3');
    }
    throw error;
  }
}

