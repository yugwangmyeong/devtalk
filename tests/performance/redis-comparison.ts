/**
 * Redis 켜짐/꺼짐 성능 비교 테스트
 * 
 * 사용법:
 *   tsx tests/performance/redis-comparison.ts
 */

import { measurePerformance, clearPerformanceStats, getPerformanceStats, generatePerformanceComparison } from '@/lib/performance';

const API_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_USER_TOKEN = process.env.TEST_USER_TOKEN || '';

interface TestResult {
  scenario: string;
  api: string;
  stats: ReturnType<typeof getPerformanceStats> | null;
}

async function testAPI(apiPath: string, iterations: number = 10): Promise<TestResult> {
  const operation = `api-${apiPath.replace(/\//g, '-').replace(/\[|\]/g, '')}`;
  
  clearPerformanceStats(operation);
  
  console.log(`\n테스트 중: ${apiPath} (${iterations}회 반복)...`);
  
  // 워밍업 요청 (첫 요청은 컴파일 시간 포함되므로 제외)
  try {
    await fetch(`${API_URL}${apiPath}`, {
      method: 'GET',
      headers: {
        'Cookie': `auth-token=${TEST_USER_TOKEN}`,
      },
    });
    console.log('워밍업 완료, 실제 측정 시작...');
    await new Promise(resolve => setTimeout(resolve, 500)); // 워밍업 후 대기
  } catch (error) {
    console.warn('워밍업 실패:', error);
  }
  
  for (let i = 0; i < iterations; i++) {
    try {
      await measurePerformance(operation, async () => {
        const startTime = Date.now();
        const response = await fetch(`${API_URL}${apiPath}`, {
          method: 'GET',
          headers: {
            'Cookie': `auth-token=${TEST_USER_TOKEN}`,
          },
        });
        
        if (!response.ok) {
          throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        const endTime = Date.now();
        
        // 응답 헤더에서 서버 측 시간 확인
        const serverTime = response.headers.get('X-Response-Time');
        if (serverTime) {
          console.log(`\n  요청 ${i + 1}: 클라이언트 ${endTime - startTime}ms, 서버 ${serverTime}`);
        }
        
        return data;
      }, { iteration: i + 1 });
      
      process.stdout.write('.');
      
      // 요청 간 충분한 대기 시간 (캐시 효과를 보기 위해)
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`\n요청 ${i + 1} 실패:`, error);
    }
  }
  
  const stats = getPerformanceStats(operation);
  
  return {
    scenario: operation,
    api: apiPath,
    stats,
  };
}

function printResult(result: TestResult) {
  if (!result.stats) {
    console.log('  결과 없음');
    return;
  }
  
  console.log(`\n  평균: ${result.stats.average}ms`);
  console.log(`  중앙값: ${result.stats.median}ms`);
  console.log(`  최소: ${result.stats.min}ms`);
  console.log(`  최대: ${result.stats.max}ms`);
}

function printComparison(before: TestResult, after: TestResult) {
  if (!before.stats || !after.stats) {
    console.log('비교할 데이터가 없습니다.');
    return;
  }
  
  const comparison = generatePerformanceComparison(before.stats, after.stats);
  
  console.log(`\n=== ${before.api} 성능 비교 ===`);
  console.log('\n[Redis OFF]');
  console.log(`  평균: ${before.stats.average}ms`);
  console.log(`  중앙값: ${before.stats.median}ms`);
  console.log(`  최소: ${before.stats.min}ms`);
  console.log(`  최대: ${before.stats.max}ms`);
  
  console.log('\n[Redis ON]');
  console.log(`  평균: ${after.stats.average}ms`);
  console.log(`  중앙값: ${after.stats.median}ms`);
  console.log(`  최소: ${after.stats.min}ms`);
  console.log(`  최대: ${after.stats.max}ms`);
  
  console.log('\n[개선율]');
  console.log(`  평균: ${comparison?.improvement.average}`);
  console.log(`  중앙값: ${comparison?.improvement.median}`);
  console.log(`  최소: ${comparison?.improvement.min}`);
  console.log(`  최대: ${comparison?.improvement.max}`);
  
  // 개선율 계산
  const avgImprovement = parseFloat(comparison?.improvement.average.replace('% 개선', '') || '0');
  if (avgImprovement > 0) {
    console.log(`\n✅ 평균 ${avgImprovement.toFixed(1)}% 성능 개선!`);
  } else {
    console.log(`\n⚠️ 성능 개선이 없거나 오히려 느려졌습니다.`);
  }
}

async function main() {
  console.log('=== Redis 성능 비교 테스트 ===');
  console.log(`API URL: ${API_URL}`);
  console.log(`테스트 토큰: ${TEST_USER_TOKEN ? '설정됨' : '설정되지 않음'}`);
  
  if (!TEST_USER_TOKEN) {
    console.error('\n오류: TEST_USER_TOKEN 환경 변수가 설정되지 않았습니다.');
    console.error('사용법: TEST_USER_TOKEN=your_token tsx tests/performance/redis-comparison.ts');
    process.exit(1);
  }
  
  // 테스트할 API 목록
  const apis = [
    '/api/teams',
    '/api/dashboard',
  ];
  
  // 팀 ID가 필요하면 먼저 가져오기
  let teamId: string | null = null;
  try {
    const response = await fetch(`${API_URL}/api/teams`, {
      method: 'GET',
      headers: {
        'Cookie': `auth-token=${TEST_USER_TOKEN}`,
      },
    });
    if (response.ok) {
      const data = await response.json();
      if (data.teams && data.teams.length > 0) {
        teamId = data.teams[0].id;
        apis.push(`/api/teams/${teamId}`);
        apis.push(`/api/teams/${teamId}/channels`);
        apis.push(`/api/teams/${teamId}/events`);
      }
    }
  } catch (error) {
    console.error('팀 정보를 가져오는데 실패했습니다:', error);
  }
  
  console.log('\n⚠️  중요: 이 테스트를 실행하기 전에:');
  console.log('1. Redis를 중지하세요: docker stop redis');
  console.log('2. 애플리케이션을 재시작하세요');
  console.log('3. 이 스크립트를 실행하세요 (Redis OFF 테스트)');
  console.log('4. Redis를 시작하세요: docker start redis');
  console.log('5. 애플리케이션을 재시작하세요');
  console.log('6. 이 스크립트를 다시 실행하세요 (Redis ON 테스트)');
  console.log('\n또는 자동으로 테스트하려면 REDIS_STATE 환경 변수를 사용하세요:');
  console.log('  REDIS_STATE=off tsx tests/performance/redis-comparison.ts');
  console.log('  REDIS_STATE=on tsx tests/performance/redis-comparison.ts\n');
  
  // Redis 상태 확인
  const redisState = process.env.REDIS_STATE || 'unknown';
  
  // Docker로 Redis 상태 확인 시도
  try {
    const { execSync } = require('child_process');
    const dockerCheck = execSync('docker ps --filter name=redis --format "{{.Status}}"', { encoding: 'utf-8' }).trim();
    if (dockerCheck && dockerCheck.includes('Up')) {
      console.log(`\n✅ Redis 상태: 실행 중 (${dockerCheck})`);
    } else {
      console.log(`\n⚠️  Redis 상태: 중지됨`);
      console.log('   Redis가 꺼져 있으면 캐시 없이 DB 쿼리만 실행됩니다.');
    }
  } catch (error) {
    console.log(`\n현재 Redis 상태: ${redisState}`);
  }
  
  if (redisState === 'unknown') {
    console.log('\n테스트를 계속 진행합니다...\n');
  }
  
  const results: TestResult[] = [];
  
  for (const api of apis) {
    const result = await testAPI(api, 10);
    results.push(result);
    printResult(result);
  }
  
  console.log('\n=== 테스트 완료 ===');
  console.log(`\nRedis 상태: ${redisState}`);
  console.log('\n결과 요약:');
  results.forEach(result => {
    if (result.stats) {
      console.log(`  ${result.api}: 평균 ${result.stats.average}ms`);
    }
  });
  
  console.log('\n💡 팁: Redis OFF와 ON 상태에서 각각 실행한 후 결과를 비교하세요!');
}

if (require.main === module) {
  main();
}

