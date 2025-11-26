import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getRedisClient, safeRedisOperation, isRedisReady } from './redis';

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
  // 안전한 Redis 작업으로 블랙리스트 추가
  await safeRedisOperation(
    async (redis) => {
      // JWT에서 만료 시간 추출
      const decoded = jwt.decode(token) as { exp?: number } | null;
      if (decoded && decoded.exp) {
        const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
        if (expiresIn > 0) {
          // 토큰의 만료 시간까지 Redis에 저장 (자동 삭제)
          await redis.setex(`blacklist:${token}`, expiresIn, '1');
        }
      }
    },
    undefined // Redis가 없으면 조용히 실패
  );
}

// Check if token is blacklisted
export async function isTokenBlacklisted(token: string): Promise<boolean> {
  // Redis가 없으면 블랙리스트 확인 불가 (토큰 허용)
  const redis = getRedisClient();
  if (!redis) {
    // console.log('[Auth] Redis not available, skipping blacklist check (token allowed)');
    return false; // Redis가 없으면 블랙리스트 확인 불가 = 토큰 허용
  }

  // Redis 연결 상태 확인
  if (!isRedisReady(redis)) {
    // console.log('[Auth] Redis not ready, skipping blacklist check (token allowed)');
    return false; // Redis가 준비되지 않았으면 블랙리스트 확인 불가 = 토큰 허용
  }

  // 안전한 Redis 작업으로 블랙리스트 확인
  const result = await safeRedisOperation(
    async (redis) => {
      try {
        const value = await redis.get(`blacklist:${token}`);
        const isBlacklisted = value !== null;
        if (isBlacklisted) {
          // console.log('[Auth] Token found in blacklist (Redis confirmed)');
        } else {
          // console.log('[Auth] Token not in blacklist');
        }
        return isBlacklisted;
      } catch (error) {
        console.error('[Auth] Error checking blacklist:', error);
        return false; // 에러 발생 시 false 반환 (토큰 사용 허용)
      }
    },
    false // Redis 연결 실패 시 false 반환 (토큰 사용 허용)
  );

  return result;
}

// Verify JWT token
export async function verifyToken(token: string): Promise<{ userId: string; email: string } | null> {
  try {
    // 먼저 JWT 자체가 유효한지 확인 (블랙리스트 확인 전에)
    let decoded: { userId: string; email: string };
    try {
      decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    } catch (jwtError) {
      // JWT 자체가 유효하지 않으면 블랙리스트 확인 불필요
      if (jwtError instanceof jwt.JsonWebTokenError) {
        console.error('[Auth] JWT verification error:', jwtError.name, jwtError.message);
      } else if (jwtError instanceof jwt.TokenExpiredError) {
        console.error('[Auth] Token expired:', jwtError.expiredAt);
      } else if (jwtError instanceof jwt.NotBeforeError) {
        console.error('[Auth] Token not active yet:', jwtError.date);
      } else {
        console.error('[Auth] Token verification error:', jwtError);
      }
      return null;
    }

    // JWT가 유효하면 블랙리스트 확인
    const isBlacklisted = await isTokenBlacklisted(token);
    if (isBlacklisted) {
      // console.log('[Auth] Token is blacklisted (valid JWT but blacklisted)');
      return null;
    }

    return decoded;
  } catch (error) {
    console.error('[Auth] Unexpected error in verifyToken:', error);
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

