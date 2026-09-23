import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConversationService } from '../../src/services/conversation.service.js';

describe('ConversationService', () => {
  it('should store and retrieve conversation history turns', () => {
    const service = new ConversationService();
    const phone = '972500000000';

    service.addTurn(phone, 'user', 'היי סוכן');
    service.addTurn(phone, 'model', 'שלום רמ"ד');

    const history = service.getHistory(phone);
    assert.equal(history.length, 2);
    assert.equal(history[0]?.role, 'user');
    assert.equal(history[0]?.text, 'היי סוכן');
    assert.equal(history[1]?.role, 'model');
    assert.equal(history[1]?.text, 'שלום רמ"ד');
  });

  it('should enforce max turns limit', () => {
    const service = new ConversationService();
    const phone = '972500000001';

    for (let i = 0; i < 25; i++) {
      service.addTurn(phone, 'user', `Message ${i}`);
    }

    const history = service.getHistory(phone);
    assert.equal(history.length, 20);
    assert.equal(history[history.length - 1]?.text, 'Message 24');
  });

  it('should correctly deduplicate incoming messages', () => {
    const service = new ConversationService();
    const msgId = 'wamid.test_unique_id_123';

    assert.equal(service.isDuplicateMessage(msgId), false);
    assert.equal(service.isDuplicateMessage(msgId), true);
    assert.equal(service.isDuplicateMessage('wamid.another_id'), false);
  });
});
