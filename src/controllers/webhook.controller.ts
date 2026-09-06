import type { Request, Response } from 'express';
import { config } from '../config/env.js';
import { agentService } from '../services/agent.service.js';
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
    const text = message.text.body.trim();

    await agentService.processIncomingMessage(from, text);
  }
}

export const webhookController = new WebhookController();
