/**
 * 개선된 대시보드 API (메시지 큐 + 캐시 사용)
 * 
 * 이 파일은 성능 비교를 위한 참고용입니다.
 * 실제 사용 시 route.ts를 이 버전으로 교체하세요.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromCookies, verifyToken } from '@/lib/auth';
import { measurePerformance } from '@/lib/performance';
import { cache, getCacheKey } from '@/lib/cache';
import { dashboardQueue } from '@/lib/queue';

// Get dashboard data: upcoming events and team activities (Optimized with Queue + Cache)
export async function GET(request: NextRequest) {
  try {
    const { result, duration } = await measurePerformance('dashboard-api-optimized', async () => {
      const token = getTokenFromCookies(request.cookies);

      if (!token) {
        return NextResponse.json(
          { error: '인증되지 않았습니다.' },
          { status: 401 }
        );
      }

      const decoded = verifyToken(token);

      if (!decoded) {
        return NextResponse.json(
          { error: '유효하지 않은 토큰입니다.' },
          { status: 401 }
        );
      }

      const userId = decoded.userId;
      const cacheKey = getCacheKey('dashboard', userId);

      // 1. 캐시에서 조회 시도
      const cached = await cache.get(cacheKey);
      
      if (cached) {
        console.log(`[Dashboard API] Cache hit for user ${userId}`);
        return cached;
      }

      // 2. 캐시 미스: 큐에 작업 추가
      console.log(`[Dashboard API] Cache miss for user ${userId}, enqueueing job`);
      await dashboardQueue.enqueue({
        type: 'generate-dashboard',
        data: { userId },
      });

      // 3. 기본 데이터 반환 (워커가 처리 중)
      // 프론트엔드에서 짧은 시간 후 다시 요청하거나 폴링하도록 안내
      return {
        upcomingEvents: [],
        teamActivities: [],
        loading: true,
        message: '데이터를 생성 중입니다. 잠시 후 다시 시도해주세요.',
      };
    });

    // 성능 정보를 응답 헤더에 추가
    const response = NextResponse.json(result, { status: 200 });
    response.headers.set('X-Response-Time', `${duration.toFixed(2)}ms`);
    
    return response;
  } catch (error) {
    console.error('[GET /api/dashboard] Error:', error);
    return NextResponse.json(
      { error: '대시보드 데이터를 가져오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

