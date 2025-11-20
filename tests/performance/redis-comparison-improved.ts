/**
 * Redis 성능 비교 테스트 (개선 버전)
 * 
 * 서버 로그를 확인하여 실제 캐시 히트/미스를 확인합니다.
 */

const API_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_USER_TOKEN = process.env.TEST_USER_TOKEN || '';
const TARGET_USER_ID = process.env.TARGET_USER_ID || ''; // 특정 사용자 ID로 테스트

interface TestResult {
  api: string;
  times: number[];
  average: number;
  median: number;
  min: number;
  max: number;
}

function calculateStats(times: number[]): Omit<TestResult, 'api'> {
  const sorted = [...times].sort((a, b) => a - b);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  
  return {
    times,
    average: Math.round(avg * 100) / 100,
    median: Math.round(median * 100) / 100,
    min: Math.round(Math.min(...times) * 100) / 100,
    max: Math.round(Math.max(...times) * 100) / 100,
  };
}

async function testAPI(apiPath: string, iterations: number = 10, skipFirst: boolean = true): Promise<TestResult> {
  console.log(`\n📊 테스트: ${apiPath}`);
  console.log(`   반복 횟수: ${iterations}회`);
  if (skipFirst) {
    console.log(`   ⚠️  첫 요청은 캐시 미스이므로 제외하고 측정합니다.`);
  }
  
  const times: number[] = [];
  
  // 워밍업 (첫 요청은 캐시 미스이므로 제외)
  if (skipFirst) {
    console.log('   워밍업 중 (첫 요청 - 캐시 미스, 제외)...');
    try {
      const warmupResponse = await fetch(`${API_URL}${apiPath}`, {
        method: 'GET',
        headers: {
          'Cookie': `auth-token=${TEST_USER_TOKEN}`,
        },
      });
      await warmupResponse.json();
      console.log('   ✅ 워밍업 완료, 캐시 저장됨');
      await new Promise(resolve => setTimeout(resolve, 500)); // 캐시 저장 대기
    } catch (error) {
      console.warn('   워밍업 실패:', error);
    }
  }
  
  console.log('   실제 측정 시작 (캐시 히트 측정)...');
  
  for (let i = 0; i < iterations; i++) {
    try {
      const startTime = performance.now();
      
      const response = await fetch(`${API_URL}${apiPath}`, {
        method: 'GET',
        headers: {
          'Cookie': `auth-token=${TEST_USER_TOKEN}`,
        },
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      if (!response.ok) {
        throw new Error(`API 요청 실패: ${response.status}`);
      }
      
      await response.json();
      times.push(duration);
      
      // 서버 측 시간 확인
      const serverTime = response.headers.get('X-Response-Time');
      if (serverTime) {
        console.log(`   요청 ${i + 1}: ${duration.toFixed(2)}ms (서버: ${serverTime})`);
      } else {
        console.log(`   요청 ${i + 1}: ${duration.toFixed(2)}ms`);
      }
      
      // 요청 간 대기 (캐시 효과 확인)
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`   요청 ${i + 1} 실패:`, error);
    }
  }
  
  const stats = calculateStats(times);
  
  return {
    api: apiPath,
    ...stats,
  };
}

function printComparison(off: TestResult, on: TestResult) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📈 ${off.api} 성능 비교`);
  console.log('='.repeat(60));
  
  console.log('\n[Redis OFF - 캐시 없음]');
  console.log(`  평균: ${off.average}ms`);
  console.log(`  중앙값: ${off.median}ms`);
  console.log(`  최소: ${off.min}ms`);
  console.log(`  최대: ${off.max}ms`);
  
  console.log('\n[Redis ON - 캐시 사용]');
  console.log(`  평균: ${on.average}ms`);
  console.log(`  중앙값: ${on.median}ms`);
  console.log(`  최소: ${on.min}ms`);
  console.log(`  최대: ${on.max}ms`);
  
  const avgImprovement = ((off.average - on.average) / off.average * 100).toFixed(2);
  const medianImprovement = ((off.median - on.median) / off.median * 100).toFixed(2);
  
  console.log('\n[개선율]');
  console.log(`  평균: ${avgImprovement}% 개선`);
  console.log(`  중앙값: ${medianImprovement}% 개선`);
  
  if (parseFloat(avgImprovement) > 50) {
    console.log('\n✅ 큰 성능 개선이 확인되었습니다!');
  } else if (parseFloat(avgImprovement) > 0) {
    console.log('\n⚠️  성능 개선이 있지만 예상보다 작습니다.');
    console.log('   서버 로그에서 캐시 히트/미스를 확인하세요.');
  } else {
    console.log('\n❌ 성능 개선이 없습니다.');
    console.log('   Redis 연결 및 캐시 설정을 확인하세요.');
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('🚀 Redis 성능 비교 테스트 (개선 버전)');
  console.log('='.repeat(60));
  console.log(`\nAPI URL: ${API_URL}`);
  console.log(`테스트 토큰: ${TEST_USER_TOKEN ? '✅ 설정됨' : '❌ 설정되지 않음'}`);
  
  if (!TEST_USER_TOKEN) {
    console.error('\n❌ 오류: TEST_USER_TOKEN 환경 변수가 필요합니다.');
    process.exit(1);
  }
  
  // Redis 상태 확인
  try {
    const { execSync } = require('child_process');
    const dockerCheck = execSync('docker ps --filter name=redis --format "{{.Status}}"', { encoding: 'utf-8' }).trim();
    if (dockerCheck && dockerCheck.includes('Up')) {
      console.log(`\n✅ Redis: 실행 중`);
    } else {
      console.log(`\n⚠️  Redis: 중지됨`);
    }
  } catch (error) {
    console.log(`\n⚠️  Redis 상태 확인 실패`);
  }
  
  console.log('\n💡 중요:');
  console.log('   1. 서버 로그에서 "[Cache] Hit" 또는 "[Cache] Miss" 메시지를 확인하세요.');
  console.log('   2. Redis OFF 테스트 후 Redis를 켜고 다시 테스트하세요.');
  console.log('   3. 각 테스트 사이에 애플리케이션을 재시작하는 것을 권장합니다.\n');
  
  // 테스트할 API 목록
  const apis = [
    '/api/teams',
    '/api/dashboard',
  ];
  
  // 사용자 ID 확인
  let targetUserId = TARGET_USER_ID;
  if (!targetUserId) {
    try {
      // 토큰에서 사용자 ID 추출
      const { verifyToken } = require('../lib/auth');
      const decoded = verifyToken(TEST_USER_TOKEN);
      if (decoded) {
        targetUserId = decoded.userId;
        console.log(`\n✅ 테스트 사용자 ID: ${targetUserId}`);
      }
    } catch (error) {
      console.warn('⚠️  사용자 ID를 가져올 수 없습니다:', error);
    }
  } else {
    console.log(`\n✅ 타겟 사용자 ID: ${targetUserId}`);
  }
  
  // 팀 ID 가져오기 (특정 사용자의 팀만)
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
        // 특정 사용자가 속한 첫 번째 팀 사용
        teamId = data.teams[0].id;
        console.log(`✅ 테스트 팀 ID: ${teamId}`);
        apis.push(`/api/teams/${teamId}`);
        apis.push(`/api/teams/${teamId}/channels`);
        apis.push(`/api/teams/${teamId}/events`);
      }
    }
  } catch (error) {
    console.error('팀 정보를 가져오는데 실패했습니다:', error);
  }
  
  if (targetUserId) {
    console.log(`\n💡 특정 사용자(${targetUserId})의 데이터만 조회합니다.`);
  }
  
  const redisState = process.env.REDIS_STATE || 'unknown';
  
  if (redisState === 'off' || redisState === 'unknown') {
    console.log('\n📝 Redis OFF 상태로 테스트합니다...\n');
  } else {
    console.log('\n📝 Redis ON 상태로 테스트합니다...\n');
  }
  
  const results: TestResult[] = [];
  
  for (const api of apis) {
    const result = await testAPI(api, 10);
    results.push(result);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 테스트 결과 요약');
  console.log('='.repeat(60));
  
  results.forEach(result => {
    console.log(`\n${result.api}:`);
    console.log(`  평균: ${result.average}ms`);
    console.log(`  중앙값: ${result.median}ms`);
    console.log(`  범위: ${result.min}ms ~ ${result.max}ms`);
  });
  
  console.log('\n💡 다음 단계:');
  console.log('   1. Redis 상태를 변경하세요 (OFF → ON 또는 ON → OFF)');
  console.log('   2. 애플리케이션을 재시작하세요');
  console.log('   3. 이 스크립트를 다시 실행하세요');
  console.log('   4. 두 결과를 비교하세요\n');
}

if (require.main === module) {
  main();
}

