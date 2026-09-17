export type TaskWorker<T> = (data: T) => Promise<void>;

export class QueueService {
  private queues: Map<string, Array<() => Promise<void>>> = new Map();
  private isProcessing: Map<string, boolean> = new Map();

  public enqueue(key: string, task: () => Promise<void>): void {
    if (!this.queues.has(key)) {
      this.queues.set(key, []);
    }

    const queue = this.queues.get(key)!;
    queue.push(task);

    this.processQueue(key);
  }

  private async processQueue(key: string): Promise<void> {
    if (this.isProcessing.get(key)) {
      return; // Queue worker is already active for this key
    }

    const queue = this.queues.get(key);
    if (!queue || queue.length === 0) {
      return;
    }

    this.isProcessing.set(key, true);

    while (queue.length > 0) {
      const nextTask = queue.shift();
      if (nextTask) {
        try {
          await nextTask();
        } catch (err: unknown) {
          console.error(`Error processing task in queue [key: ${key}]:`, err);
        }
      }
    }

    this.isProcessing.set(key, false);
  }
}

export const queueService = new QueueService();
