import cron from 'node-cron';
import { whatsAppService } from '../services/whatsapp.service.js';
import { config } from '../config/env.js';

export function initializeCronJobs(): void {
  // Sunday 07:00 (Weekly opening)
  cron.schedule('0 7 * * 0', async () => {
    if (config.allowedPhoneNumber) {
      await whatsAppService.sendMessage(
        config.allowedPhoneNumber,
        '🌅 בוקר טוב רמ"ד. שבוע חדש. להלן תמונת המצב לפתיחת שבוע...'
      );
    }
  });

  // Mon-Wed 07:30 (Daily focus)
  cron.schedule('30 7 * * 1-3', async () => {
    if (config.allowedPhoneNumber) {
      await whatsAppService.sendMessage(
        config.allowedPhoneNumber,
        '☀️ בוקר טוב. 3 המשימות הקריטיות להיום ושיחה אישית יזומה...'
      );
    }
  });

  // Sun-Thu 17:30 (Inbox baking)
  cron.schedule('30 17 * * 0-4', async () => {
    if (config.allowedPhoneNumber) {
      await whatsAppService.sendMessage(
        config.allowedPhoneNumber,
        '📥 17:30 - בוא נסגור תג"ב ועדיפות לטיוטות שנזרקו היום...'
      );
    }
  });

  // Thursday 18:00 (Weekly review)
  cron.schedule('0 18 * * 4', async () => {
    if (config.allowedPhoneNumber) {
      await whatsAppService.sendMessage(
        config.allowedPhoneNumber,
        '🪞 18:00 - סגירת שבוע: "מבט במראה" וביקורת עצמית לפי 5 המדדים...'
      );
    }
  });

  console.log('Cron jobs scheduled successfully.');
}
