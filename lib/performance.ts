
export interface PerformanceMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  operation: string;
  metadata?: Record<string, any>;
}

const metrics: Map<string, PerformanceMetrics[]> = new Map();


export function startPerformanceMeasurement(operation: string, metadata?: Record<string, any>): string {
  const id = `${operation}_${Date.now()}_${Math.random()}`;
  const metric: PerformanceMetrics = {
    startTime: performance.now(),
    operation,
    metadata,
  };
  
  if (!metrics.has(operation)) {
    metrics.set(operation, []);
  }
  metrics.get(operation)!.push(metric);
  
  return id;
}


export function endPerformanceMeasurement(operation: string, id?: string): number {
  const operationMetrics = metrics.get(operation);
  if (!operationMetrics || operationMetrics.length === 0) {
    return 0;
  }
  
  const metric = operationMetrics[operationMetrics.length - 1];
  metric.endTime = performance.now();
  metric.duration = metric.endTime - metric.startTime;
  
  return metric.duration;
}


export async function measurePerformance<T>(
  operation: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  
  if (!metrics.has(operation)) {
    metrics.set(operation, []);
  }
  metrics.get(operation)!.push({
    startTime: start,
    endTime: performance.now(),
    duration,
    operation,
    metadata,
  });
  
  return { result, duration };
}


export function getPerformanceStats(operation: string) {
  const operationMetrics = metrics.get(operation) || [];
  if (operationMetrics.length === 0) {
    return null;
  }
  
  const durations = operationMetrics
    .filter(m => m.duration !== undefined)
    .map(m => m.duration!);
  
  if (durations.length === 0) {
    return null;
  }
  
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  const min = Math.min(...durations);
  const max = Math.max(...durations);
  
  // 중앙값 계산
  const sorted = [...durations].sort((a, b) => a - b);
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  
  return {
    count: durations.length,
    average: Math.round(avg * 100) / 100,
    min: Math.round(min * 100) / 100,
    max: Math.round(max * 100) / 100,
    median: Math.round(median * 100) / 100,
    latest: Math.round(durations[durations.length - 1] * 100) / 100,
  };
}

export function getAllPerformanceStats() {
  const stats: Record<string, any> = {};
  for (const [operation] of metrics) {
    stats[operation] = getPerformanceStats(operation);
  }
  return stats;
}

export function clearPerformanceStats(operation?: string) {
  if (operation) {
    metrics.delete(operation);
  } else {
    metrics.clear();
  }
}


export function generatePerformanceComparison(
  before: ReturnType<typeof getPerformanceStats>,
  after: ReturnType<typeof getPerformanceStats>
) {
  if (!before || !after) {
    return null;
  }
  
  const improvement = {
    average: ((before.average - after.average) / before.average * 100).toFixed(2),
    min: ((before.min - after.min) / before.min * 100).toFixed(2),
    max: ((before.max - after.max) / before.max * 100).toFixed(2),
    median: ((before.median - after.median) / before.median * 100).toFixed(2),
  };
  
  return {
    before,
    after,
    improvement: {
      average: `${improvement.average}% 개선`,
      min: `${improvement.min}% 개선`,
      max: `${improvement.max}% 개선`,
      median: `${improvement.median}% 개선`,
    },
  };
}

