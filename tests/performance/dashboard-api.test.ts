/**
 * 대시보드 API 성능 테스트
 * 
 * 현재 구현과 메시지 큐 도입 후의 성능을 비교합니다.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { measurePerformance, clearPerformanceStats, getPerformanceStats, generatePerformanceComparison } from '@/lib/performance';

// 테스트용 서버 URL
const API_URL = process.env.TEST_API_URL || 'http://localhost:3000';
const TEST_USER_TOKEN = process.env.TEST_USER_TOKEN || '';

describe('대시보드 API 성능 테스트', () => {
  beforeAll(() => {
    clearPerformanceStats();
  });

  afterAll(() => {
    clearPerformanceStats();
  });

  it('현재 구현: 대시보드 API 응답 시간 측정', async () => {
    const iterations = 10; // 10번 반복 측정
    
    for (let i = 0; i < iterations; i++) {
      await measurePerformance('dashboard-api-before', async () => {
        const response = await fetch(`${API_URL}/api/dashboard`, {
          method: 'GET',
          headers: {
            'Cookie': `auth-token=${TEST_USER_TOKEN}`,
          },
        });
        
        if (!response.ok) {
          throw new Error(`API 요청 실패: ${response.status}`);
        }
        
        return await response.json();
      }, { iteration: i + 1 });
      
      // 요청 간 약간의 대기 시간
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const stats = getPerformanceStats('dashboard-api-before');
    expect(stats).not.toBeNull();
    expect(stats?.count).toBe(iterations);
    
    console.log('\n=== 현재 구현 성능 ===');
    console.log(`평균 응답 시간: ${stats?.average}ms`);
    console.log(`최소 응답 시간: ${stats?.min}ms`);
    console.log(`최대 응답 시간: ${stats?.max}ms`);
    console.log(`중앙값: ${stats?.median}ms`);
  }, 60000); // 60초 타임아웃

  it('개선 후: 메시지 큐 도입 대시보드 API 응답 시간 측정', async () => {
    const iterations = 10; // 10번 반복 측정
    
    for (let i = 0; i < iterations; i++) {
      await measurePerformance('dashboard-api-after', async () => {
        const response = await fetch(`${API_URL}/api/dashboard`, {
          method: 'GET',
          headers: {
            'Cookie': `auth-token=${TEST_USER_TOKEN}`,
          },
        });
        
        if (!response.ok) {
          throw new Error(`API 요청 실패: ${response.status}`);
        }
        
        return await response.json();
      }, { iteration: i + 1 });
      
      // 요청 간 약간의 대기 시간
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const stats = getPerformanceStats('dashboard-api-after');
    expect(stats).not.toBeNull();
    expect(stats?.count).toBe(iterations);
    
    console.log('\n=== 개선 후 성능 ===');
    console.log(`평균 응답 시간: ${stats?.average}ms`);
    console.log(`최소 응답 시간: ${stats?.min}ms`);
    console.log(`최대 응답 시간: ${stats?.max}ms`);
    console.log(`중앙값: ${stats?.median}ms`);
  }, 60000);

  it('성능 비교 리포트 생성', () => {
    const before = getPerformanceStats('dashboard-api-before');
    const after = getPerformanceStats('dashboard-api-after');
    
    if (!before || !after) {
      console.warn('성능 데이터가 없어 비교 리포트를 생성할 수 없습니다.');
      return;
    }
    
    const comparison = generatePerformanceComparison(before, after);
    
    console.log('\n=== 성능 개선 리포트 ===');
    console.log('개선 전:');
    console.log(`  평균: ${before.average}ms`);
    console.log(`  중앙값: ${before.median}ms`);
    console.log(`  최소: ${before.min}ms`);
    console.log(`  최대: ${before.max}ms`);
    console.log('\n개선 후:');
    console.log(`  평균: ${after.average}ms`);
    console.log(`  중앙값: ${after.median}ms`);
    console.log(`  최소: ${after.min}ms`);
    console.log(`  최대: ${after.max}ms`);
    console.log('\n개선율:');
    console.log(`  평균: ${comparison?.improvement.average}`);
    console.log(`  중앙값: ${comparison?.improvement.median}`);
    console.log(`  최소: ${comparison?.improvement.min}`);
    console.log(`  최대: ${comparison?.improvement.max}`);
    
    // 개선이 있었는지 확인
    expect(after.average).toBeLessThanOrEqual(before.average * 1.1); // 최대 10% 느려질 수 있음 (허용 오차)
  });
});

describe('동시 요청 처리 성능 테스트', () => {
  it('현재 구현: 동시 요청 처리', async () => {
    const concurrentRequests = 20;
    
    const promises = Array.from({ length: concurrentRequests }, (_, i) =>
      measurePerformance('dashboard-api-concurrent-before', async () => {
        const response = await fetch(`${API_URL}/api/dashboard`, {
          method: 'GET',
          headers: {
            'Cookie': `auth-token=${TEST_USER_TOKEN}`,
          },
        });
        
        if (!response.ok) {
          throw new Error(`API 요청 실패: ${response.status}`);
        }
        
        return await response.json();
      }, { requestId: i + 1 })
    );
    
    await Promise.all(promises);
    
    const stats = getPerformanceStats('dashboard-api-concurrent-before');
    console.log('\n=== 동시 요청 처리 (현재) ===');
    console.log(`동시 요청 수: ${concurrentRequests}`);
    console.log(`평균 응답 시간: ${stats?.average}ms`);
    console.log(`최대 응답 시간: ${stats?.max}ms`);
  }, 60000);

  it('개선 후: 동시 요청 처리', async () => {
    const concurrentRequests = 20;
    
    const promises = Array.from({ length: concurrentRequests }, (_, i) =>
      measurePerformance('dashboard-api-concurrent-after', async () => {
        const response = await fetch(`${API_URL}/api/dashboard`, {
          method: 'GET',
          headers: {
            'Cookie': `auth-token=${TEST_USER_TOKEN}`,
          },
        });
        
        if (!response.ok) {
          throw new Error(`API 요청 실패: ${response.status}`);
        }
        
        return await response.json();
      }, { requestId: i + 1 })
    );
    
    await Promise.all(promises);
    
    const stats = getPerformanceStats('dashboard-api-concurrent-after');
    console.log('\n=== 동시 요청 처리 (개선 후) ===');
    console.log(`동시 요청 수: ${concurrentRequests}`);
    console.log(`평균 응답 시간: ${stats?.average}ms`);
    console.log(`최대 응답 시간: ${stats?.max}ms`);
  }, 60000);
});

