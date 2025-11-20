/**
 * Redis 캐시 효과 부하 테스트
 * 
 * 동시 요청을 보내서 Redis 캐시가 서버 부하를 얼마나 줄이는지 측정
 * 
 * 사용법:
 *   TEST_USER_TOKEN=your_token tsx tests/performance/load-test.ts
 * 
 * 환경 변수:
 *   - TEST_USER_TOKEN: 인증 토큰 (필수)
 *   - API_URL: API 서버 URL (기본: http://localhost:3000)
 *   - CONCURRENT_REQUESTS: 동시 요청 수 (기본: 50)
 *   - REQUESTS_PER_API: 각 API당 요청 수 (기본: 100)
 */

const API_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_USER_TOKEN = process.env.TEST_USER_TOKEN || '';
const CONCURRENT_REQUESTS = parseInt(process.env.CONCURRENT_REQUESTS || '50', 10);
const REQUESTS_PER_API = parseInt(process.env.REQUESTS_PER_API || '100', 10);

interface RequestResult {
  success: boolean;
  duration: number;
  serverTime?: number;
  statusCode: number;
  error?: string;
}

interface LoadTestResult {
  api: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  medianDuration: number;
  p95Duration: number;
  p99Duration: number;
  avgServerTime?: number;
  throughput: number; // requests per second
  errors: string[];
}

/**
 * 단일 요청 실행
 */
async function makeRequest(apiPath: string): Promise<RequestResult> {
  const start = performance.now();
  try {
    const response = await fetch(`${API_URL}${apiPath}`, {
      method: 'GET',
      headers: {
        'Cookie': `auth-token=${TEST_USER_TOKEN}`,
      },
    });
    const end = performance.now();
    const duration = end - start;
    
    const serverTime = response.headers.get('X-Response-Time');
    const serverTimeMs = serverTime ? parseFloat(serverTime.replace('ms', '')) : undefined;
    
    if (!response.ok) {
      return {
        success: false,
        duration,
        serverTime: serverTimeMs,
        statusCode: response.status,
        error: `HTTP ${response.status}`,
      };
    }
    
    await response.json();
    
    return {
      success: true,
      duration,
      serverTime: serverTimeMs,
      statusCode: response.status,
    };
  } catch (error) {
    const end = performance.now();
    return {
      success: false,
      duration: end - start,
      statusCode: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 동시 요청 실행 (배치 처리)
 */
async function runConcurrentRequests(
  apiPath: string,
  totalRequests: number,
  concurrency: number
): Promise<RequestResult[]> {
  const results: RequestResult[] = [];
  const batches: Promise<RequestResult[]>[] = [];
  
  // 배치로 나누어 실행
  for (let i = 0; i < totalRequests; i += concurrency) {
    const batchSize = Math.min(concurrency, totalRequests - i);
    const batch = Promise.all(
      Array.from({ length: batchSize }, () => makeRequest(apiPath))
    );
    batches.push(batch);
  }
  
  // 모든 배치 실행
  const batchResults = await Promise.all(batches);
  
  // 결과 합치기
  for (const batch of batchResults) {
    results.push(...batch);
  }
  
  return results;
}

/**
 * 통계 계산
 */
function calculateStats(results: RequestResult[]): LoadTestResult {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const durations = results.map(r => r.duration).sort((a, b) => a - b);
  const serverTimes = results
    .filter(r => r.serverTime !== undefined)
    .map(r => r.serverTime!);
  
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const minDuration = durations[0] || 0;
  const maxDuration = durations[durations.length - 1] || 0;
  const medianDuration = durations[Math.floor(durations.length / 2)] || 0;
  const p95Duration = durations[Math.floor(durations.length * 0.95)] || 0;
  const p99Duration = durations[Math.floor(durations.length * 0.99)] || 0;
  
  const totalTime = Math.max(...durations) || 1;
  const throughput = results.length / (totalTime / 1000); // requests per second
  
  const avgServerTime = serverTimes.length > 0
    ? serverTimes.reduce((a, b) => a + b, 0) / serverTimes.length
    : undefined;
  
  const errors = [...new Set(failed.map(r => r.error || `HTTP ${r.statusCode}`))];
  
  return {
    api: '',
    totalRequests: results.length,
    successfulRequests: successful.length,
    failedRequests: failed.length,
    successRate: (successful.length / results.length) * 100,
    avgDuration,
    minDuration,
    maxDuration,
    medianDuration,
    p95Duration,
    p99Duration,
    avgServerTime,
    throughput,
    errors,
  };
}

/**
 * 부하 테스트 실행
 */
async function runLoadTest(apiPath: string): Promise<LoadTestResult> {
  console.log(`\n📊 부하 테스트: ${apiPath}`);
  console.log(`   동시 요청: ${CONCURRENT_REQUESTS}개, 총 요청: ${REQUESTS_PER_API}개`);
  
  const startTime = Date.now();
  const results = await runConcurrentRequests(apiPath, REQUESTS_PER_API, CONCURRENT_REQUESTS);
  const endTime = Date.now();
  const totalTime = (endTime - startTime) / 1000;
  
  const stats = calculateStats(results);
  stats.api = apiPath;
  
  console.log(`   ⏱️  총 소요 시간: ${totalTime.toFixed(2)}초`);
  console.log(`   ✅ 성공: ${stats.successfulRequests}/${stats.totalRequests} (${stats.successRate.toFixed(1)}%)`);
  console.log(`   📈 처리량: ${stats.throughput.toFixed(2)} req/s`);
  console.log(`   ⚡ 평균 응답 시간: ${stats.avgDuration.toFixed(2)}ms`);
  if (stats.avgServerTime) {
    console.log(`   🖥️  평균 서버 시간: ${stats.avgServerTime.toFixed(2)}ms`);
  }
  console.log(`   📊 응답 시간 분포:`);
  console.log(`      - 최소: ${stats.minDuration.toFixed(2)}ms`);
  console.log(`      - 중간값: ${stats.medianDuration.toFixed(2)}ms`);
  console.log(`      - 95%: ${stats.p95Duration.toFixed(2)}ms`);
  console.log(`      - 99%: ${stats.p99Duration.toFixed(2)}ms`);
  console.log(`      - 최대: ${stats.maxDuration.toFixed(2)}ms`);
  
  if (stats.errors.length > 0) {
    console.log(`   ⚠️  에러: ${stats.errors.join(', ')}`);
  }
  
  return stats;
}

/**
 * 결과 비교 및 출력
 */
function compareResults(redisOn: LoadTestResult[], redisOff: LoadTestResult[]) {
  console.log('\n' + '='.repeat(80));
  console.log('📊 부하 테스트 결과 비교');
  console.log('='.repeat(80));
  
  const comparison = redisOn.map((onResult, index) => {
    const offResult = redisOff[index];
    if (!offResult || onResult.api !== offResult.api) {
      return null;
    }
    
    const throughputImprovement = ((onResult.throughput - offResult.throughput) / offResult.throughput) * 100;
    const latencyImprovement = ((offResult.avgDuration - onResult.avgDuration) / offResult.avgDuration) * 100;
    const serverTimeImprovement = onResult.avgServerTime && offResult.avgServerTime
      ? ((offResult.avgServerTime - onResult.avgServerTime) / offResult.avgServerTime) * 100
      : 0;
    
    return {
      api: onResult.api,
      redisOn,
      redisOff: offResult,
      throughputImprovement,
      latencyImprovement,
      serverTimeImprovement,
    };
  }).filter(Boolean);
  
  comparison.forEach(comp => {
    if (!comp) return;
    
    console.log(`\n${comp.api}:`);
    console.log(`  처리량 (Throughput):`);
    console.log(`    Redis OFF: ${comp.redisOff.throughput.toFixed(2)} req/s`);
    console.log(`    Redis ON:  ${comp.redisOn.throughput.toFixed(2)} req/s`);
    console.log(`    개선: ${comp.throughputImprovement > 0 ? '+' : ''}${comp.throughputImprovement.toFixed(1)}%`);
    
    console.log(`  평균 응답 시간:`);
    console.log(`    Redis OFF: ${comp.redisOff.avgDuration.toFixed(2)}ms`);
    console.log(`    Redis ON:  ${comp.redisOn.avgDuration.toFixed(2)}ms`);
    console.log(`    개선: ${comp.latencyImprovement > 0 ? '+' : ''}${comp.latencyImprovement.toFixed(1)}%`);
    
    if (comp.redisOn.avgServerTime && comp.redisOff.avgServerTime) {
      console.log(`  서버 처리 시간:`);
      console.log(`    Redis OFF: ${comp.redisOff.avgServerTime.toFixed(2)}ms`);
      console.log(`    Redis ON:  ${comp.redisOn.avgServerTime.toFixed(2)}ms`);
      console.log(`    개선: ${comp.serverTimeImprovement > 0 ? '+' : ''}${comp.serverTimeImprovement.toFixed(1)}%`);
    }
    
    console.log(`  성공률:`);
    console.log(`    Redis OFF: ${comp.redisOff.successRate.toFixed(1)}%`);
    console.log(`    Redis ON:  ${comp.redisOn.successRate.toFixed(1)}%`);
    
    if (comp.throughputImprovement > 20 || comp.latencyImprovement > 20) {
      console.log(`  ✅ Redis 캐시가 큰 효과를 보이고 있습니다!`);
    } else if (comp.throughputImprovement > 0 || comp.latencyImprovement > 0) {
      console.log(`  ⚠️  Redis 캐시 효과가 있지만 작습니다.`);
    } else {
      console.log(`  ❌ Redis 캐시 효과가 없거나 오히려 느립니다.`);
    }
  });
}

async function main() {
  console.log('='.repeat(80));
  console.log('🔥 Redis 캐시 부하 테스트');
  console.log('='.repeat(80));
  console.log(`\nAPI URL: ${API_URL}`);
  console.log(`동시 요청 수: ${CONCURRENT_REQUESTS}`);
  console.log(`각 API당 총 요청 수: ${REQUESTS_PER_API}`);
  console.log(`테스트 토큰: ${TEST_USER_TOKEN ? '✅ 설정됨' : '❌ 설정되지 않음'}`);
  
  if (!TEST_USER_TOKEN) {
    console.error('\n❌ 오류: TEST_USER_TOKEN 환경 변수가 필요합니다.');
    process.exit(1);
  }
  
  // Redis 상태 확인
  let redisStatus = '알 수 없음';
  try {
    const { execSync } = require('child_process');
    const dockerCheck = execSync('docker ps --filter name=redis --format "{{.Status}}"', { encoding: 'utf-8' }).trim();
    if (dockerCheck && dockerCheck.includes('Up')) {
      redisStatus = '실행 중';
    } else {
      redisStatus = '중지됨';
    }
  } catch (error) {
    // Docker 명령 실패 시 무시
  }
  console.log(`Redis 상태: ${redisStatus}`);
  
  // 테스트할 API 목록 가져오기
  const apis: string[] = [];
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
        console.log(`\n✅ 테스트할 API: ${apis.length}개`);
      } else {
        console.error('❌ 팀이 없습니다. 먼저 팀을 생성하세요.');
        process.exit(1);
      }
    }
  } catch (error) {
    console.error('❌ 팀 정보를 가져오는데 실패했습니다:', error);
    process.exit(1);
  }
  
  console.log('\n💡 부하 테스트 시작...');
  console.log('   각 API에 대해 동시 요청을 보내서 성능을 측정합니다.\n');
  
  // 부하 테스트 실행
  const results: LoadTestResult[] = [];
  
  for (const api of apis) {
    try {
      const result = await runLoadTest(api);
      results.push(result);
      
      // API 간 간격 (서버 부하 완화)
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`\n❌ ${api} 테스트 실패:`, error);
    }
  }
  
  // 결과 요약
  console.log('\n' + '='.repeat(80));
  console.log('📈 전체 결과 요약');
  console.log('='.repeat(80));
  
  const totalRequests = results.reduce((sum, r) => sum + r.totalRequests, 0);
  const totalSuccessful = results.reduce((sum, r) => sum + r.successfulRequests, 0);
  const avgThroughput = results.reduce((sum, r) => sum + r.throughput, 0) / results.length;
  const avgLatency = results.reduce((sum, r) => sum + r.avgDuration, 0) / results.length;
  
  console.log(`\n총 요청 수: ${totalRequests}`);
  console.log(`성공한 요청: ${totalSuccessful} (${((totalSuccessful / totalRequests) * 100).toFixed(1)}%)`);
  console.log(`평균 처리량: ${avgThroughput.toFixed(2)} req/s`);
  console.log(`평균 응답 시간: ${avgLatency.toFixed(2)}ms`);
  
  console.log('\n💡 해석:');
  console.log('   - 처리량(Throughput)이 높을수록 서버가 더 많은 요청을 처리할 수 있습니다.');
  console.log('   - 응답 시간이 낮을수록 사용자 경험이 좋습니다.');
  console.log('   - Redis 캐시가 작동하면 처리량이 증가하고 응답 시간이 감소합니다.');
  console.log('   - 서버 로그에서 "[Cache] Hit" 메시지를 확인하여 캐시 사용을 확인하세요.\n');
}

if (require.main === module) {
  main().catch(console.error);
}

