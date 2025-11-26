/**
 * Redis 기반 메시지 큐 시스템
 * 
 * 대시보드 데이터와 같은 무거운 작업을 비동기로 처리하기 위한 큐 시스템
 */

import { getRedisClient } from './redis';

export interface QueueJob {
  id: string;
  type: string;
  data: any;
  createdAt: number;
  attempts?: number;
  maxAttempts?: number;
}

export class MessageQueue {
  private redis = getRedisClient();
  private queueName: string;

  constructor(queueName: string = 'default') {
    this.queueName = `queue:${queueName}`;
  }

  /**
   * 작업을 큐에 추가
   */
  async enqueue(job: Omit<QueueJob, 'id' | 'createdAt'>): Promise<string> {
    if (!this.redis) {
      throw new Error('Redis client is not available');
    }

    const jobId = `job:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
    const queueJob: QueueJob = {
      id: jobId,
      ...job,
      createdAt: Date.now(),
      attempts: job.attempts || 0,
      maxAttempts: job.maxAttempts || 3,
    };

    // List의 왼쪽에 추가 (FIFO)
    await this.redis.lpush(this.queueName, JSON.stringify(queueJob));
    
    // console.log(`[Queue] Job enqueued: ${jobId} (type: ${job.type})`);
    
    return jobId;
  }

  /**
   * 큐에서 작업 가져오기 (블로킹)
   */
  async dequeue(timeout: number = 5): Promise<QueueJob | null> {
    if (!this.redis) {
      throw new Error('Redis client is not available');
    }

    // BRPOP: List의 오른쪽에서 요소를 가져옴 (FIFO)
    // timeout 초 동안 대기, 없으면 null 반환
    const result = await this.redis.brpop(this.queueName, timeout);
    
    if (!result || result.length < 2) {
      return null;
    }

    const jobData = JSON.parse(result[1]) as QueueJob;
    // console.log(`[Queue] Job dequeued: ${jobData.id} (type: ${jobData.type})`);
    
    return jobData;
  }

  /**
   * 큐에서 작업 가져오기 (논블로킹)
   */
  async dequeueNonBlocking(): Promise<QueueJob | null> {
    if (!this.redis) {
      throw new Error('Redis client is not available');
    }

    const result = await this.redis.rpop(this.queueName);
    
    if (!result) {
      return null;
    }

    const jobData = JSON.parse(result) as QueueJob;
    // console.log(`[Queue] Job dequeued: ${jobData.id} (type: ${jobData.type})`);
    
    return jobData;
  }

  /**
   * 실패한 작업을 재시도 큐에 추가
   */
  async retry(job: QueueJob, error?: Error): Promise<void> {
    if (!this.redis) {
      throw new Error('Redis client is not available');
    }

    const attempts = (job.attempts || 0) + 1;
    
    if (attempts >= (job.maxAttempts || 3)) {
      // 최대 재시도 횟수 초과 - 실패 큐로 이동
      await this.redis.lpush(`${this.queueName}:failed`, JSON.stringify({
        ...job,
        attempts,
        error: error?.message,
        failedAt: Date.now(),
      }));
      // console.log(`[Queue] Job failed after ${attempts} attempts: ${job.id}`);
      return;
    }

    // 재시도 큐에 추가 (지연 후 처리)
    const retryQueue = `${this.queueName}:retry`;
    const retryJob = {
      ...job,
      attempts,
      retryAt: Date.now() + (attempts * 1000), // 지수 백오프
    };
    
    await this.redis.lpush(retryQueue, JSON.stringify(retryJob));
    // console.log(`[Queue] Job retry scheduled: ${job.id} (attempt ${attempts})`);
  }

  /**
   * 큐 길이 조회
   */
  async length(): Promise<number> {
    if (!this.redis) {
      return 0;
    }

    return await this.redis.llen(this.queueName);
  }

  /**
   * 큐 비우기
   */
  async clear(): Promise<void> {
    if (!this.redis) {
      return;
    }

    await this.redis.del(this.queueName);
    // console.log(`[Queue] Cleared: ${this.queueName}`);
  }

  /**
   * 실패한 작업 목록 조회
   */
  async getFailedJobs(limit: number = 10): Promise<QueueJob[]> {
    if (!this.redis) {
      return [];
    }

    const failedQueue = `${this.queueName}:failed`;
    const results = await this.redis.lrange(failedQueue, 0, limit - 1);
    
    return results.map(r => JSON.parse(r) as QueueJob);
  }
}

/**
 * 전역 대시보드 큐 인스턴스
 */
export const dashboardQueue = new MessageQueue('dashboard');

