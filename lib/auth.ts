import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getRedisClient } from './redis';

const JWT_SECRET: string = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '7d';

// Hash password
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

// Verify password
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// Generate JWT token
export function generateToken(userId: string, email: string): string {
  return jwt.sign(
    { userId, email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
  );
}

// Add token to blacklist
export async function addTokenToBlacklist(token: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) {
    // Redis가 없으면 블랙리스트 기능을 사용할 수 없음 (개발 환경 등)
    return;
  }

  try {
    // JWT에서 만료 시간 추출
    const decoded = jwt.decode(token) as { exp?: number } | null;
    if (decoded && decoded.exp) {
      const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
      if (expiresIn > 0) {
        // 토큰의 만료 시간까지 Redis에 저장 (자동 삭제)
        await redis.setex(`blacklist:${token}`, expiresIn, '1');
      }
    }
  } catch (error) {
    console.error('Failed to add token to blacklist:', error);
  }
}

// Check if token is blacklisted
export async function isTokenBlacklisted(token: string): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) {
    // Redis가 없으면 블랙리스트 확인 불가 (개발 환경에서는 허용)
    return false;
  }

  try {
    const result = await redis.get(`blacklist:${token}`);
    return result !== null;
  } catch (error) {
    console.error('Failed to check token blacklist:', error);
    // 에러 발생 시 보안을 위해 false 반환 (토큰 사용 허용)
    return false;
  }
}

// Verify JWT token
export async function verifyToken(token: string): Promise<{ userId: string; email: string } | null> {
  try {
    // 먼저 블랙리스트 확인
    const isBlacklisted = await isTokenBlacklisted(token);
    if (isBlacklisted) {
      return null;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    return decoded;
  } catch (error) {
    return null;
  }
}

// Extract token from request headers
export function getTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

// Get token from cookies (for Next.js)
export function getTokenFromCookies(cookies: { get: (name: string) => { value: string } | undefined }): string | null {
  const tokenCookie = cookies.get('auth-token');
  return tokenCookie?.value || null;
}

