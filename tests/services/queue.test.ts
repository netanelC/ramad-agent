import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { QueueService } from '../../src/services/queue.service.js';

describe('QueueService', () => {
  it('should execute queued tasks sequentially for the same key', async () => {
    const queue = new QueueService();
    const order: number[] = [];

    queue.enqueue('user-1', async () => {
      await new Promise((r) => setTimeout(r, 50));
      order.push(1);
    });

    queue.enqueue('user-1', async () => {
      order.push(2);
    });

    const drained = await queue.waitForDrain(1000);
    assert.equal(drained, true);
    assert.deepEqual(order, [1, 2]);
    assert.equal(queue.isIdle(), true);
  });

  it('should isolate tasks of different keys concurrently', async () => {
    const queue = new QueueService();
    const executed: string[] = [];

    queue.enqueue('key-a', async () => {
      executed.push('a');
    });

    queue.enqueue('key-b', async () => {
      executed.push('b');
    });

    const drained = await queue.waitForDrain(1000);
    assert.equal(drained, true);
    assert.equal(executed.length, 2);
  });
});
