import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { WebhookController } from '../../src/controllers/webhook.controller.js';
import { agentService } from '../../src/services/agent.service.js';
import { config } from '../../src/config/env.js';
import type { Request, Response } from 'express';

describe('WebhookController', () => {
  describe('verifyWebhook', () => {
    it('should accept valid verification challenge', () => {
      const controller = new WebhookController();
      let sentStatus = 0;
      let sentBody = '';

      const req = {
        query: {
          'hub.mode': 'subscribe',
          'hub.verify_token': config.verifyToken,
          'hub.challenge': 'challenge_code_12345',
        },
      } as unknown as Request;

      const res = {
        status(code: number) {
          sentStatus = code;
          return this;
        },
        send(body: string) {
          sentBody = body;
          return this;
        },
        sendStatus(code: number) {
          sentStatus = code;
          return this;
        },
      } as unknown as Response;

      controller.verifyWebhook(req, res);

      assert.equal(sentStatus, 200);
      assert.equal(sentBody, 'challenge_code_12345');
    });

    it('should reject invalid verification challenge with 403', () => {
      const controller = new WebhookController();
      let sentStatus = 0;

      const req = {
        query: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong_token',
          'hub.challenge': 'challenge_code_12345',
        },
      } as unknown as Request;

      const res = {
        status(code: number) {
          sentStatus = code;
          return this;
        },
        send() {
          return this;
        },
        sendStatus(code: number) {
          sentStatus = code;
          return this;
        },
      } as unknown as Response;

      controller.verifyWebhook(req, res);

      assert.equal(sentStatus, 403);
    });
  });

  describe('handleWebhookPayload', () => {
    it('should return 200 EVENT_RECEIVED immediately and ignore invalid payload', async () => {
      const controller = new WebhookController();
      let sentStatus = 0;
      let sentBody = '';

      const req = {
        body: { not_a_whatsapp_payload: true },
      } as unknown as Request;

      const res = {
        status(code: number) {
          sentStatus = code;
          return this;
        },
        send(body: string) {
          sentBody = body;
          return this;
        },
      } as unknown as Response;

      await controller.handleWebhookPayload(req, res, () => {});

      assert.equal(sentStatus, 200);
      assert.equal(sentBody, 'EVENT_RECEIVED');
    });

    it('should return 200 EVENT_RECEIVED and dispatch to agentService for valid webhook structure', async () => {
      const controller = new WebhookController();
      let sentStatus = 0;
      let sentBody = '';
      let receivedFrom = '';
      let receivedText = '';
      let receivedMessageId: string | undefined = '';

      const originalProcess = agentService.processIncomingMessage;
      agentService.processIncomingMessage = async (from: string, text: string, messageId?: string) => {
        receivedFrom = from;
        receivedText = text;
        receivedMessageId = messageId;
      };

      try {
        const req = {
          body: {
            object: 'whatsapp_business_account',
            entry: [
              {
                id: '12345',
                changes: [
                  {
                    value: {
                      messaging_product: 'whatsapp',
                      messages: [
                        {
                          from: '972546811053',
                          id: 'wamid.sample_test_id',
                          timestamp: '1700000000',
                          type: 'text',
                          text: { body: 'בדיקת טקסט' },
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        } as unknown as Request;

        const res = {
          status(code: number) {
            sentStatus = code;
            return this;
          },
          send(body: string) {
            sentBody = body;
            return this;
          },
        } as unknown as Response;

        await controller.handleWebhookPayload(req, res, () => {});

        assert.equal(sentStatus, 200);
        assert.equal(sentBody, 'EVENT_RECEIVED');
        assert.equal(receivedFrom, '972546811053');
        assert.equal(receivedText, 'בדיקת טקסט');
        assert.equal(receivedMessageId, 'wamid.sample_test_id');
      } finally {
        agentService.processIncomingMessage = originalProcess;
      }
    });
  });
});
