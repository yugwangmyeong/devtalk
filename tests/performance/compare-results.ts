/**
 * Redis ON/OFF 성능 비교 결과 분석
 */

const redisOff = {
  '/api/teams': { average: 15.67, median: 15.7, min: 12.23, max: 18.74 },
  '/api/dashboard': { average: 22.52, median: 20.2, min: 17.16, max: 47.26 },
  '/api/teams/[id]': { average: 17.37, median: 16.34, min: 13.94, max: 22.21 },
  '/api/teams/[id]/channels': { average: 25.24, median: 24.04, min: 20.33, max: 33.64 },
  '/api/teams/[id]/events': { average: 23.37, median: 18.46, min: 15.1, max: 56.7 },
};

const redisOn = {
  '/api/teams': { average: 20.46, median: 20.81, min: 16.29, max: 27.85 },
  '/api/dashboard': { average: 27.27, median: 27.26, min: 22.83, max: 31.22 },
  '/api/teams/[id]': { average: 19.14, median: 17.78, min: 15.02, max: 26.19 },
  '/api/teams/[id]/channels': { average: 23.9, median: 21.89, min: 18.34, max: 32.77 },
  '/api/teams/[id]/events': { average: 19.22, median: 17.82, min: 14.85, max: 27.59 },
};

console.log('='.repeat(70));
console.log('📊 Redis 성능 비교 분석');
console.log('='.repeat(70));

Object.keys(redisOff).forEach(api => {
  const off = redisOff[api as keyof typeof redisOff];
  const on = redisOn[api as keyof typeof redisOn];
  
  const avgDiff = on.average - off.average;
  const avgPercent = ((avgDiff / off.average) * 100).toFixed(2);
  const medianDiff = on.median - off.median;
  const medianPercent = ((medianDiff / off.median) * 100).toFixed(2);
  
  console.log(`\n${api}:`);
  console.log(`  Redis OFF: 평균 ${off.average}ms, 중앙값 ${off.median}ms`);
  console.log(`  Redis ON:  평균 ${on.average}ms, 중앙값 ${on.median}ms`);
  console.log(`  차이: 평균 ${avgDiff > 0 ? '+' : ''}${avgDiff.toFixed(2)}ms (${avgPercent}%)`);
  console.log(`        중앙값 ${medianDiff > 0 ? '+' : ''}${medianDiff.toFixed(2)}ms (${medianPercent}%)`);
  
  if (avgDiff < -5) {
    console.log(`  ✅ Redis ON이 ${Math.abs(avgDiff).toFixed(2)}ms 더 빠름!`);
  } else if (avgDiff > 5) {
    console.log(`  ⚠️  Redis ON이 ${avgDiff.toFixed(2)}ms 더 느림 (오버헤드 가능성)`);
  } else {
    console.log(`  ➡️  차이 없음 (데이터가 적어서 캐시 효과가 작음)`);
  }
});

console.log('\n' + '='.repeat(70));
console.log('📝 결론');
console.log('='.repeat(70));
console.log('\n현재 결과 분석:');
console.log('1. Redis ON이 오히려 더 느린 경우가 있음');
console.log('   → Redis 연결 오버헤드 또는 캐시가 작동하지 않음');
console.log('2. 차이가 거의 없음 (5ms 이내)');
console.log('   → 데이터가 적어서 DB 쿼리 자체가 이미 빠름');
console.log('   → 캐시 효과를 보려면 더 많은 데이터 필요');
console.log('\n💡 권장사항:');
console.log('1. 서버 로그에서 "[Cache] Hit" 메시지 확인');
console.log('2. 랜덤 데이터 생성: npm run db:seed:performance');
console.log('3. 데이터 생성 후 다시 테스트');
console.log('4. 프로덕션 환경에서는 큰 효과 예상\n');


