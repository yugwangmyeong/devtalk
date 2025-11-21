/**
 * 특정 사용자 데이터로 Redis 캐시 효과 테스트
 * 
 * 사용법:
 *   TARGET_USER_ID=cmi2vnyv80000ti2ch1zm1aeb TEST_USER_TOKEN=your_token tsx tests/performance/test-specific-user.ts
 */

const API_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_USER_TOKEN = process.env.TEST_USER_TOKEN || '';
const TARGET_USER_ID = process.env.TARGET_USER_ID || '';

interface TestResult {
  api: string;
  cacheMiss: number; // 첫 요청 (캐시 미스)
  cacheHits: number[]; // 두 번째 이후 요청 (캐시 히트)
  averageHit: number;
  improvement: number;
}

async function testAPIWithCache(apiPath: string): Promise<TestResult> {
  console.log(`\n📊 테스트: ${apiPath}`);
  
  // 1. 첫 요청 (캐시 미스) - DB 쿼리
  console.log('   1️⃣  첫 요청 (캐시 미스 - DB 쿼리)...');
  const missStart = performance.now();
  const missResponse = await fetch(`${API_URL}${apiPath}`, {
    method: 'GET',
    headers: {
      'Cookie': `auth-token=${TEST_USER_TOKEN}`,
    },
  });
  const missEnd = performance.now();
  const cacheMiss = missEnd - missStart;
  
  if (!missResponse.ok) {
    throw new Error(`API 요청 실패: ${missResponse.status}`);
  }
  await missResponse.json();
  
  const serverMissTime = missResponse.headers.get('X-Response-Time');
  console.log(`      ⏱️  ${cacheMiss.toFixed(2)}ms (서버: ${serverMissTime || 'N/A'})`);
  
  // 캐시 저장 대기
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // 2. 두 번째 이후 요청 (캐시 히트) - 10회 반복
  console.log('   2️⃣  캐시 히트 측정 (10회 반복)...');
  const cacheHits: number[] = [];
  
  for (let i = 0; i < 10; i++) {
    const hitStart = performance.now();
    const hitResponse = await fetch(`${API_URL}${apiPath}`, {
      method: 'GET',
      headers: {
        'Cookie': `auth-token=${TEST_USER_TOKEN}`,
      },
    });
    const hitEnd = performance.now();
    const cacheHit = hitEnd - hitStart;
    
    if (!hitResponse.ok) {
      throw new Error(`API 요청 실패: ${hitResponse.status}`);
    }
    await hitResponse.json();
    cacheHits.push(cacheHit);
    
    const serverHitTime = hitResponse.headers.get('X-Response-Time');
    console.log(`      요청 ${i + 1}: ${cacheHit.toFixed(2)}ms (서버: ${serverHitTime || 'N/A'})`);
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  const averageHit = cacheHits.reduce((a, b) => a + b, 0) / cacheHits.length;
  const improvement = ((cacheMiss - averageHit) / cacheMiss * 100);
  
  return {
    api: apiPath,
    cacheMiss,
    cacheHits,
    averageHit: Math.round(averageHit * 100) / 100,
    improvement: Math.round(improvement * 100) / 100,
  };
}

async function main() {
  console.log('='.repeat(70));
  console.log('🎯 특정 사용자 데이터로 Redis 캐시 효과 테스트');
  console.log('='.repeat(70));
  console.log(`\nAPI URL: ${API_URL}`);
  console.log(`테스트 토큰: ${TEST_USER_TOKEN ? '✅ 설정됨' : '❌ 설정되지 않음'}`);
  console.log(`타겟 사용자 ID: ${TARGET_USER_ID || '❌ 설정되지 않음 (토큰에서 자동 추출)'}`);
  
  if (!TEST_USER_TOKEN) {
    console.error('\n❌ 오류: TEST_USER_TOKEN 환경 변수가 필요합니다.');
    process.exit(1);
  }
  
  // 사용자 ID 확인
  let targetUserId = TARGET_USER_ID;
  if (!targetUserId) {
    try {
      const { verifyToken } = require('../../lib/auth');
      const decoded = verifyToken(TEST_USER_TOKEN);
      if (decoded) {
        targetUserId = decoded.userId;
        console.log(`\n✅ 사용자 ID (토큰에서 추출): ${targetUserId}`);
      }
    } catch (error) {
      console.error('❌ 토큰에서 사용자 ID를 추출할 수 없습니다:', error);
      process.exit(1);
    }
  }
  
  // Redis 상태 확인
  try {
    const { execSync } = require('child_process');
    const dockerCheck = execSync('docker ps --filter name=redis --format "{{.Status}}"', { encoding: 'utf-8' }).trim();
    if (dockerCheck && dockerCheck.includes('Up')) {
      console.log(`\n✅ Redis: 실행 중`);
    } else {
      console.log(`\n⚠️  Redis: 중지됨`);
      console.log('   Redis가 꺼져 있으면 캐시 효과를 확인할 수 없습니다.');
    }
  } catch (error) {
    console.log(`\n⚠️  Redis 상태 확인 실패`);
  }
  
  console.log('\n💡 테스트 방법:');
  console.log('   1. 첫 요청: 캐시 미스 (DB 쿼리) - 느림');
  console.log('   2. 두 번째 이후: 캐시 히트 (Redis 조회) - 빠름');
  console.log('   3. 서버 로그에서 "[Cache] Hit" 메시지 확인\n');
  
  // 테스트할 API 목록
  const apis: string[] = [];
  
  // 팀 정보 가져오기
  try {
    const teamsResponse = await fetch(`${API_URL}/api/teams`, {
      method: 'GET',
      headers: {
        'Cookie': `auth-token=${TEST_USER_TOKEN}`,
      },
    });
    if (teamsResponse.ok) {
      const data = await teamsResponse.json();
      if (data.teams && data.teams.length > 0) {
        const teamId = data.teams[0].id;
        apis.push('/api/teams');
        apis.push('/api/dashboard');
        apis.push(`/api/teams/${teamId}`);
        apis.push(`/api/teams/${teamId}/channels`);
        apis.push(`/api/teams/${teamId}/events`);
        console.log(`✅ 테스트할 API: ${apis.length}개\n`);
      } else {
        console.error('❌ 팀이 없습니다. 먼저 팀을 생성하세요.');
        process.exit(1);
      }
    }
  } catch (error) {
    console.error('❌ 팀 정보를 가져오는데 실패했습니다:', error);
    process.exit(1);
  }
  
  const results: TestResult[] = [];
  
  for (const api of apis) {
    try {
      const result = await testAPIWithCache(api);
      results.push(result);
    } catch (error) {
      console.error(`\n❌ ${api} 테스트 실패:`, error);
    }
  }
  
  // 결과 출력
  console.log('\n' + '='.repeat(70));
  console.log('📊 테스트 결과 요약');
  console.log('='.repeat(70));
  
  results.forEach(result => {
    console.log(`\n${result.api}:`);
    console.log(`  캐시 미스 (첫 요청): ${result.cacheMiss.toFixed(2)}ms`);
    console.log(`  캐시 히트 (평균): ${result.averageHit.toFixed(2)}ms`);
    console.log(`  개선율: ${result.improvement > 0 ? '+' : ''}${result.improvement.toFixed(2)}%`);
    
    if (result.improvement > 50) {
      console.log(`  ✅ 큰 성능 개선! (${(result.cacheMiss - result.averageHit).toFixed(2)}ms 빠름)`);
    } else if (result.improvement > 0) {
      console.log(`  ⚠️  작은 개선 (${(result.cacheMiss - result.averageHit).toFixed(2)}ms 빠름)`);
    } else {
      console.log(`  ❌ 개선 없음 (오히려 ${Math.abs(result.improvement).toFixed(2)}% 느림)`);
    }
  });
  
  // 전체 평균
  const avgMiss = results.reduce((sum, r) => sum + r.cacheMiss, 0) / results.length;
  const avgHit = results.reduce((sum, r) => sum + r.averageHit, 0) / results.length;
  const avgImprovement = ((avgMiss - avgHit) / avgMiss * 100);
  
  console.log('\n' + '='.repeat(70));
  console.log('📈 전체 평균');
  console.log('='.repeat(70));
  console.log(`  캐시 미스 평균: ${avgMiss.toFixed(2)}ms`);
  console.log(`  캐시 히트 평균: ${avgHit.toFixed(2)}ms`);
  console.log(`  평균 개선율: ${avgImprovement > 0 ? '+' : ''}${avgImprovement.toFixed(2)}%`);
  console.log(`  평균 개선 시간: ${(avgMiss - avgHit).toFixed(2)}ms`);
  
  if (avgImprovement > 50) {
    console.log('\n✅ Redis 캐시가 큰 효과를 보이고 있습니다!');
  } else if (avgImprovement > 0) {
    console.log('\n⚠️  Redis 캐시 효과가 있지만 작습니다.');
    console.log('   데이터가 적어서 DB 쿼리 자체가 이미 빠를 수 있습니다.');
  } else {
    console.log('\n❌ Redis 캐시 효과가 없습니다.');
    console.log('   서버 로그에서 "[Cache] Hit" 메시지를 확인하세요.');
  }
  
  console.log('\n💡 서버 로그 확인:');
  console.log('   - "[Cache] Miss" - 첫 요청 (DB 쿼리)');
  console.log('   - "[Cache] Hit" - 두 번째 이후 (Redis 조회)');
  console.log('   - "[Cache] Set" - 캐시 저장\n');
}

if (require.main === module) {
  main();
}


