import { logger } from '../common/logger.js';

export class QueueService {
  private queues: Map<string, Array<() => Promise<void>>> = new Map();
  private isProcessing: Map<string, boolean> = new Map();

  public enqueue(key: string, task: () => Promise<void>): void {
    let queue = this.queues.get(key);
    if (!queue) {
      queue = [];
      this.queues.set(key, queue);
    }

    queue.push(task);
    void this.processQueue(key);
  }

  public isIdle(): boolean {
    for (const [, active] of this.isProcessing) {
      if (active) return false;
    }
    return true;
  }

  public async waitForDrain(timeoutMs: number = 10000): Promise<boolean> {
    const startTime = Date.now();
    while (!this.isIdle()) {
      if (Date.now() - startTime > timeoutMs) {
        logger.warn('Queue drain timeout reached while waiting for tasks to finish');
        return false;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return true;
  }

  private async processQueue(key: string): Promise<void> {
    if (this.isProcessing.get(key)) {
      return;
    }

    const queue = this.queues.get(key);
    if (!queue || queue.length === 0) {
      this.cleanup(key);
      return;
    }

    this.isProcessing.set(key, true);

    try {
      while (queue.length > 0) {
        const nextTask = queue.shift();
        if (nextTask) {
          try {
            await nextTask();
          } catch (err: unknown) {
            logger.error({ key, err }, `Error executing queued task for key [${key}]`);
          }
        }
      }
    } finally {
      this.cleanup(key);
    }
  }

  private cleanup(key: string): void {
    const queue = this.queues.get(key);
    if (!queue || queue.length === 0) {
      this.queues.delete(key);
      this.isProcessing.delete(key);
    } else {
      this.isProcessing.set(key, false);
    }
  }
}

export const queueService = new QueueService();
