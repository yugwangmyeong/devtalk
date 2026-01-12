
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


  async dequeue(timeout: number = 5): Promise<QueueJob | null> {
    if (!this.redis) {
      throw new Error('Redis client is not available');
    }


    const result = await this.redis.brpop(this.queueName, timeout);
    
    if (!result || result.length < 2) {
      return null;
    }

    const jobData = JSON.parse(result[1]) as QueueJob;
    // console.log(`[Queue] Job dequeued: ${jobData.id} (type: ${jobData.type})`);
    
    return jobData;
  }


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

    const retryQueue = `${this.queueName}:retry`;
    const retryJob = {
      ...job,
      attempts,
      retryAt: Date.now() + (attempts * 1000), // 지수 백오프
    };
    
    await this.redis.lpush(retryQueue, JSON.stringify(retryJob));
    // console.log(`[Queue] Job retry scheduled: ${job.id} (attempt ${attempts})`);
  }


  async length(): Promise<number> {
    if (!this.redis) {
      return 0;
    }

    return await this.redis.llen(this.queueName);
  }


  async clear(): Promise<void> {
    if (!this.redis) {
      return;
    }

    await this.redis.del(this.queueName);
    // console.log(`[Queue] Cleared: ${this.queueName}`);
  }


  async getFailedJobs(limit: number = 10): Promise<QueueJob[]> {
    if (!this.redis) {
      return [];
    }

    const failedQueue = `${this.queueName}:failed`;
    const results = await this.redis.lrange(failedQueue, 0, limit - 1);
    
    return results.map(r => JSON.parse(r) as QueueJob);
  }
}


export const dashboardQueue = new MessageQueue('dashboard');

