/**
 * 성능 벤치마크 스크립트
 * 
 * 현재 구현과 개선 후의 성능을 비교하는 독립 실행형 스크립트
 * 
 * 사용법:
 *   tsx tests/performance/benchmark.ts
 */

import { measurePerformance, clearPerformanceStats, getPerformanceStats, generatePerformanceComparison } from '@/lib/performance';

const API_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_USER_TOKEN = process.env.TEST_USER_TOKEN || '';

interface BenchmarkResult {
  operation: string;
  iterations: number;
  stats: ReturnType<typeof getPerformanceStats>;
}

async function benchmarkDashboardAPI(operation: string, iterations: number = 10): Promise<BenchmarkResult> {
  console.log(`\n${operation} 벤치마크 시작 (${iterations}회 반복)...`);
  
  clearPerformanceStats(operation);
  
  for (let i = 0; i < iterations; i++) {
    try {
      await measurePerformance(operation, async () => {
        const response = await fetch(`${API_URL}/api/dashboard`, {
          method: 'GET',
          headers: {
            'Cookie': `auth-token=${TEST_USER_TOKEN}`,
          },
        });
        
        if (!response.ok) {
          throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`);
        }
        
        return await response.json();
      }, { iteration: i + 1 });
      
      process.stdout.write('.');
      
      // 요청 간 약간의 대기 시간
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`\n요청 ${i + 1} 실패:`, error);
    }
  }
  
  const stats = getPerformanceStats(operation);
  
  return {
    operation,
    iterations,
    stats: stats!,
  };
}

async function benchmarkConcurrentRequests(operation: string, concurrentRequests: number = 20): Promise<BenchmarkResult> {
  console.log(`\n${operation} 동시 요청 벤치마크 시작 (${concurrentRequests}개 동시 요청)...`);
  
  clearPerformanceStats(operation);
  
  const promises = Array.from({ length: concurrentRequests }, async (_, i) => {
    try {
      await measurePerformance(operation, async () => {
        const response = await fetch(`${API_URL}/api/dashboard`, {
          method: 'GET',
          headers: {
            'Cookie': `auth-token=${TEST_USER_TOKEN}`,
          },
        });
        
        if (!response.ok) {
          throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`);
        }
        
        return await response.json();
      }, { requestId: i + 1 });
    } catch (error) {
      console.error(`동시 요청 ${i + 1} 실패:`, error);
    }
  });
  
  await Promise.all(promises);
  
  const stats = getPerformanceStats(operation);
  
  return {
    operation,
    iterations: concurrentRequests,
    stats: stats!,
  };
}

function printResult(result: BenchmarkResult) {
  if (!result.stats) {
    console.log('결과 없음');
    return;
  }
  
  console.log(`\n=== ${result.operation} 결과 ===`);
  console.log(`반복 횟수: ${result.iterations}`);
  console.log(`평균 응답 시간: ${result.stats.average}ms`);
  console.log(`중앙값: ${result.stats.median}ms`);
  console.log(`최소: ${result.stats.min}ms`);
  console.log(`최대: ${result.stats.max}ms`);
}

function printComparison(before: BenchmarkResult, after: BenchmarkResult) {
  if (!before.stats || !after.stats) {
    console.log('비교할 데이터가 없습니다.');
    return;
  }
  
  const comparison = generatePerformanceComparison(before.stats, after.stats);
  
  console.log('\n=== 성능 개선 리포트 ===');
  console.log('\n[개선 전]');
  console.log(`  평균: ${before.stats.average}ms`);
  console.log(`  중앙값: ${before.stats.median}ms`);
  console.log(`  최소: ${before.stats.min}ms`);
  console.log(`  최대: ${before.stats.max}ms`);
  
  console.log('\n[개선 후]');
  console.log(`  평균: ${after.stats.average}ms`);
  console.log(`  중앙값: ${after.stats.median}ms`);
  console.log(`  최소: ${after.stats.min}ms`);
  console.log(`  최대: ${after.stats.max}ms`);
  
  console.log('\n[개선율]');
  console.log(`  평균: ${comparison?.improvement.average}`);
  console.log(`  중앙값: ${comparison?.improvement.median}`);
  console.log(`  최소: ${comparison?.improvement.min}`);
  console.log(`  최대: ${comparison?.improvement.max}`);
}

async function main() {
  console.log('=== 대시보드 API 성능 벤치마크 ===');
  console.log(`API URL: ${API_URL}`);
  console.log(`테스트 토큰: ${TEST_USER_TOKEN ? '설정됨' : '설정되지 않음'}`);
  
  if (!TEST_USER_TOKEN) {
    console.error('\n오류: TEST_USER_TOKEN 환경 변수가 설정되지 않았습니다.');
    console.error('사용법: TEST_USER_TOKEN=your_token tsx tests/performance/benchmark.ts');
    process.exit(1);
  }
  
  try {
    // 순차 요청 벤치마크
    const beforeSequential = await benchmarkDashboardAPI('dashboard-api-before', 10);
    printResult(beforeSequential);
    
    const afterSequential = await benchmarkDashboardAPI('dashboard-api-after', 10);
    printResult(afterSequential);
    
    printComparison(beforeSequential, afterSequential);
    
    // 동시 요청 벤치마크
    const beforeConcurrent = await benchmarkConcurrentRequests('dashboard-api-concurrent-before', 20);
    printResult(beforeConcurrent);
    
    const afterConcurrent = await benchmarkConcurrentRequests('dashboard-api-concurrent-after', 20);
    printResult(afterConcurrent);
    
    printComparison(beforeConcurrent, afterConcurrent);
    
    console.log('\n=== 벤치마크 완료 ===');
  } catch (error) {
    console.error('벤치마크 실행 중 오류:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

