import type { Request, Response } from 'express';
import { config } from '../config/env.js';
import { agentService } from '../services/agent.service.js';
import { whatsAppService } from '../services/whatsapp.service.js';
import type { WhatsAppWebhookPayload } from '../types/whatsapp.js';

export class WebhookController {
  public verifyWebhook(req: Request, res: Response): void {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === config.verifyToken) {
      console.log('Webhook verified successfully by Meta');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }

  public async handleWebhookPayload(req: Request, res: Response): Promise<void> {
    res.sendStatus(200); // Immediate 200 response for Meta webhook API

    const body = req.body as WhatsAppWebhookPayload;
    if (body.object !== 'whatsapp_business_account') return;

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message || message.type !== 'text' || !message.text) return;

    const from = message.from;
    const messageId = message.id;
    const text = message.text.body.trim();

    // 1. Immediate reaction emoji ⏳ to signal request is received & processing
    if (messageId) {
      await whatsAppService.sendReaction(from, messageId, '⏳');
    }

    try {
      await agentService.processIncomingMessage(from, text, messageId);
    } catch (err: unknown) {
      const errorDetails = err instanceof Error ? err.message : String(err);
      console.error('Unhandled error in Webhook Controller:', errorDetails);

      if (messageId) {
        await whatsAppService.sendReaction(from, messageId, '❌');
      }

      const errorMessage = `⚠️ נתקלתי בשגיאה בעיבוד הבקשה. פרטים: ${errorDetails || 'שגיאה לא צפויה'}`;
      try {
        await whatsAppService.sendMessage(from || config.allowedPhoneNumber, errorMessage);
      } catch (sendErr: unknown) {
        console.error('Failed to send error notification via WhatsApp from controller:', sendErr);
      }
    }
  }
}

export const webhookController = new WebhookController();
