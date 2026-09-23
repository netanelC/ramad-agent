import axios, { type AxiosInstance } from 'axios';
import { config } from '../config/env.js';
import { logger } from '../common/logger.js';
import { ExternalServiceError } from '../common/errors/app-error.js';

export function formatTextForWhatsApp(text: string): string {
  if (!text) return '';

  return text
    .replace(/^(?:#{1,6})\s+(.+)$/gm, '*$1*')
    .replace(/\*\*(.*?)\*\*/g, '*$1*');
}

export class WhatsAppService {
  private client: AxiosInstance;
  private apiVersion: string = 'v22.0';

  constructor() {
    this.client = axios.create({
      baseURL: `https://graph.facebook.com/${this.apiVersion}/${config.phoneNumberId}`,
      timeout: 15000,
      headers: {
        Authorization: `Bearer ${config.metaAccessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  public async sendMessage(to: string, text: string): Promise<void> {
    const formattedText = formatTextForWhatsApp(text);

    try {
      await this.client.post('/messages', {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: formattedText },
      });
      logger.debug({ to }, 'WhatsApp message delivered to Graph API');
    } catch (error: unknown) {
      const errDetails = axios.isAxiosError(error)
        ? error.response?.data || error.message
        : error instanceof Error
          ? error.message
          : String(error);

      logger.error({ to, err: errDetails }, 'Failed to send WhatsApp message via Meta API');
      throw new ExternalServiceError('Meta WhatsApp API', typeof errDetails === 'string' ? errDetails : JSON.stringify(errDetails));
    }
  }

  public async sendReaction(to: string, messageId: string, emoji: string): Promise<void> {
    if (!to || !messageId) return;

    try {
      await this.client.post('/messages', {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'reaction',
        reaction: {
          message_id: messageId,
          emoji,
        },
      });
      logger.debug({ to, messageId, emoji }, 'WhatsApp reaction delivered to Graph API');
    } catch (error: unknown) {
      const errDetails = axios.isAxiosError(error)
        ? error.response?.data || error.message
        : error instanceof Error
          ? error.message
          : String(error);

      logger.warn({ to, messageId, emoji, err: errDetails }, 'Failed to send WhatsApp reaction via Meta API');
      // Reactions are progressive enhancements; do not throw to avoid failing the main workflow
    }
  }
}

export const whatsAppService = new WhatsAppService();
