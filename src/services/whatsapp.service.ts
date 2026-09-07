import axios from 'axios';
import { config } from '../config/env.js';

export function formatTextForWhatsApp(text: string): string {
  if (!text) return '';

  return text
    .replace(/^(?:#{1,6})\s+(.+)$/gm, '*$1*')
    .replace(/\*\*(.*?)\*\*/g, '*$1*');
}

export class WhatsAppService {
  public async sendMessage(to: string, text: string): Promise<void> {
    const formattedText = formatTextForWhatsApp(text);

    try {
      await axios.post(
        `https://graph.facebook.com/v20.0/${config.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: formattedText },
        },
        {
          headers: {
            Authorization: `Bearer ${config.metaAccessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error('Failed to send WhatsApp message:', error.response?.data || error.message);
      } else if (error instanceof Error) {
        console.error('Failed to send WhatsApp message:', error.message);
      } else {
        console.error('Failed to send WhatsApp message:', error);
      }
    }
  }

  public async sendReaction(to: string, messageId: string, emoji: string): Promise<void> {
    if (!to || !messageId) return;

    try {
      await axios.post(
        `https://graph.facebook.com/v20.0/${config.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'reaction',
          reaction: {
            message_id: messageId,
            emoji,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${config.metaAccessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error('Failed to send WhatsApp reaction:', error.response?.data || error.message);
      } else if (error instanceof Error) {
        console.error('Failed to send WhatsApp reaction:', error.message);
      } else {
        console.error('Failed to send WhatsApp reaction:', error);
      }
    }
  }
}

export const whatsAppService = new WhatsAppService();
