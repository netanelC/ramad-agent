import axios from 'axios';
import { config } from '../config/env.js';

export class WhatsAppService {
  public async sendMessage(to: string, text: string): Promise<void> {
    try {
      await axios.post(
        `https://graph.facebook.com/v20.0/${config.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: text },
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
}

export const whatsAppService = new WhatsAppService();
