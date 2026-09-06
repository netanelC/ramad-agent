import cron from 'node-cron';
import { whatsAppService } from '../services/whatsapp.service.js';
import { geminiService } from '../services/gemini.service.js';
import { sheetsService } from '../services/sheets.service.js';
import { config } from '../config/env.js';

export function initializeCronJobs(): void {
  // Sunday 07:00 (Weekly opening - פתיחת שבוע)
  cron.schedule('0 7 * * 0', async () => {
    if (!config.allowedPhoneNumber) return;

    try {
      const systemContext = await sheetsService.getSystemContext();
      const prompt =
        'הפק הודעת פתיחת שבוע קשוחה, חדה וממוקדת לרמ"ד המבוססת על תמונת המצב החיה (משימות עומק P1, תג"בים השבוע, שחרורים ב-6 חודשים קרובים). עשה שימוש בעקרונות ה-doctrine ובדפוסים האישיים.';
      const agentResult = await geminiService.generateAgentResponse(prompt, systemContext);
      const text =
        agentResult.text || '🌅 בוקר טוב רמ"ד. שבוע חדש. להלן תמונת המצב לפתיחת שבוע...';

      await whatsAppService.sendMessage(config.allowedPhoneNumber, text);
    } catch (err: unknown) {
      console.error('Error executing Sunday weekly opening cron job:', err);
    }
  });

  // Mon-Wed 07:30 (Daily focus - מיקוד יומי)
  cron.schedule('30 7 * * 1-3', async () => {
    if (!config.allowedPhoneNumber) return;

    try {
      const systemContext = await sheetsService.getSystemContext();
      const prompt =
        'הפק הודעת בוקר קצרה וממוקדת לרמ"ד. שלוף משימות P1 וחריגות, בחר משרת/רש"צ אחד (מתוך הנתונים החיים) לשיחת 1-על-1 יזומה מהיום, וקבע 3 מיקודים דחופים.';
      const agentResult = await geminiService.generateAgentResponse(prompt, systemContext);
      const text = agentResult.text || '☀️ בוקר טוב. 3 המשימות הקריטיות להיום ושיחה אישית יזומה...';

      await whatsAppService.sendMessage(config.allowedPhoneNumber, text);
    } catch (err: unknown) {
      console.error('Error executing daily focus cron job:', err);
    }
  });

  // Sun-Thu 17:30 (Inbox baking - אפיית אינבוקס)
  cron.schedule('30 17 * * 0-4', async () => {
    if (!config.allowedPhoneNumber) return;

    try {
      const pendingDrafts = await sheetsService.getPendingDrafts();

      if (pendingDrafts.length === 0) {
        console.log('No pending drafts to bake at 17:30.');
        return;
      }

      const draftsList = pendingDrafts.map((d) => `• [${d.id}] "${d.text}"`).join('\n');
      const messageText = `📥 17:30 - יש ${pendingDrafts.length} טיוטות שנזרקו היום. בוא נסגור להן תג"ב וצוות עכשיו:\n${draftsList}`;

      await whatsAppService.sendMessage(config.allowedPhoneNumber, messageText);
    } catch (err: unknown) {
      console.error('Error executing 17:30 inbox baking cron job:', err);
    }
  });

  // Thursday 18:00 (Weekly review / mirror - מבט במראה)
  cron.schedule('0 18 * * 4', async () => {
    if (!config.allowedPhoneNumber) return;

    try {
      const systemContext = await sheetsService.getSystemContext();
      const prompt =
        'הפק דוח ביקורת עצמית וסגירת שבוע נוקב ("מבט במראה") לרמ"ד, המבוסס על 5 המדדים, היסטוריית הדחיות והשינויים בגיליונות, עקרונות ה-doctrine ונקודות התורפה של הרמ"ד.';
      const agentResult = await geminiService.generateAgentResponse(prompt, systemContext);
      const text =
        agentResult.text || '🪞 18:00 - סגירת שבוע: "מבט במראה" וביקורת עצמית לפי 5 המדדים...';

      await whatsAppService.sendMessage(config.allowedPhoneNumber, text);
    } catch (err: unknown) {
      console.error('Error executing Thursday weekly mirror cron job:', err);
    }
  });

  console.log('Cron jobs scheduled successfully with live data integrations.');
}
