import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/env.js';
import { agentService } from '../services/agent.service.js';
import { conversationService } from '../services/conversation.service.js';
import { logger } from '../common/logger.js';
import { whatsAppWebhookPayloadSchema } from '../types/whatsapp.js';

export class WebhookController {
  public verifyWebhook(req: Request, res: Response): void {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === config.verifyToken) {
      logger.info('Meta WhatsApp webhook verification challenge accepted');
      res.status(200).send(challenge);
    } else {
      logger.warn({ mode, token }, 'Meta WhatsApp webhook verification failed: Token mismatch');
      res.sendStatus(403);
    }
  }

  public async handleWebhookPayload(req: Request, res: Response, _next: NextFunction): Promise<void> {
    // Meta expects an immediate 200 response to acknowledge event receipt
    res.status(200).send('EVENT_RECEIVED');

    const parseResult = whatsAppWebhookPayloadSchema.safeParse(req.body);
    if (!parseResult.success) {
      logger.debug({ issues: parseResult.error.issues }, 'Ignored webhook payload: did not match WhatsApp schema');
      return;
    }

    const body = parseResult.data;
    if (body.object !== 'whatsapp_business_account' || !body.entry) return;

    for (const entry of body.entry) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const messages = change.value.messages || [];
        for (const message of messages) {
          if (message.type !== 'text' || !message.text) continue;

          const from = message.from;
          const messageId = message.id;
          const text = message.text.body.trim();

          if (conversationService.isDuplicateMessage(messageId)) {
            logger.info({ messageId }, 'Duplicate message skipped');
            continue;
          }

          try {
            await agentService.processIncomingMessage(from, text, messageId);
          } catch (err: unknown) {
            logger.error({ err, messageId, from }, 'Error initiating agent processing for incoming message');
          }
        }
      }
    }
  }
}

export const webhookController = new WebhookController();
