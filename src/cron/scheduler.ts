import cron, { type ScheduledTask } from 'node-cron';
import { whatsAppService } from '../services/whatsapp.service.js';
import { geminiService } from '../services/gemini.service.js';
import { sheetsService } from '../services/sheets.service.js';
import { config } from '../config/env.js';
import { logger } from '../common/logger.js';

const activeCronTasks: ScheduledTask[] = [];

export type ActiveRoutineType = 'daily_focus' | 'weekly_opening' | 'weekly_retro';

/**
 * Matches user text against known active routine triggers:
 * - 'בוקר' / 'מיקוד יומי' -> daily_focus
 * - 'תחילת שבוע' / 'פתיחת שבוע' -> weekly_opening
 * - 'סופ"ש' / 'רטרו' / 'סגירת שבוע' -> weekly_retro
 */
export function getActiveRoutineTrigger(rawText: string): ActiveRoutineType | null {
  if (!rawText || !rawText.trim()) return null;
  const text = rawText.trim().toLowerCase().replace(/["״׳\-_]/g, '');

  // Daily focus ("בוקר" / "מיקוד יומי")
  const isDailyFocus =
    /^(בוקר|בוקר טוב|מיקוד|מיקוד יומי|מיקוד בוקר|הודעת בוקר|daily|morning)$/i.test(text) ||
    /^(תן לי|שלח לי|הפק|תכין)?\s*(מיקוד יומי|מיקוד לבוקר|הודעת בוקר)/i.test(text);

  if (isDailyFocus) return 'daily_focus';

  // Sunday weekly brief ("תחילת שבוע" / "פתיחת שבוע")
  const isWeeklyOpening =
    /^(תחילת שבוע|פתיחת שבוע|שבוע טוב|פתיח שבוע|תכנון שבועי|sunday|weekly start)$/i.test(text) ||
    /^(תן לי|שלח לי|הפק|תכין)?\s*(פתיחת שבוע|תחילת שבוע|תכנון שבועי)/i.test(text);

  if (isWeeklyOpening) return 'weekly_opening';

  // Thursday / Weekend retro ("סופ"ש" / "סופש" / "רטרו" / "סגירת שבוע")
  const isWeeklyRetro =
    /^(סופש|סוף שבוע|סגירת שבוע|מבט במראה|רטרו|רטרו שבועי|סיכום שבוע|weekend|retro)$/i.test(text) ||
    /^(תן לי|שלח לי|הפק|תכין)?\s*(סגירת שבוע|מבט במראה|רטרו שבועי|סיכום שבוע)/i.test(text);

  if (isWeeklyRetro) return 'weekly_retro';

  return null;
}

export async function generateSundayWeeklyBrief(
  systemContext?: string,
  userInstruction?: string
): Promise<string> {
  const context = systemContext ?? (await sheetsService.getSystemContext());
  let prompt =
    'הפק הודעת פתיחת שבוע קשוחה, חדה וממוקדת לרמ"ד המבוססת על תמונת המצב החיה (משימות עומק P1, תג"בים השבוע, שחרורים ב-6 חודשים קרובים). עשה שימוש בעקרונות ה-doctrine ובדפוסים האישיים.';
  if (userInstruction && userInstruction.trim()) {
    prompt += `\nדגש/הנחיה ספציפית מהרמ"ד להודעה זו: "${userInstruction.trim()}"`;
  }
  const agentResult = await geminiService.generateAgentResponse(prompt, [], context);
  return agentResult.text || '🌅 בוקר טוב רמ"ד. שבוע חדש. להלן תמונת המצב לפתיחת שבוע...';
}

export async function generateDailyFocus(
  systemContext?: string,
  userInstruction?: string
): Promise<string> {
  const context = systemContext ?? (await sheetsService.getSystemContext());
  let prompt =
    'הפק הודעת בוקר קצרה וממוקדת לרמ"ד. שלוף משימות P1 וחריגות, בחר משרת/רש"צ אחד (מתוך הנתונים החיים) לשיחת 1-על-1 יזומה מהיום, וקבע 3 מיקודים דחופים.';
  if (userInstruction && userInstruction.trim()) {
    prompt += `\nדגש/הנחיה ספציפית מהרמ"ד להודעה זו: "${userInstruction.trim()}"`;
  }
  const agentResult = await geminiService.generateAgentResponse(prompt, [], context);
  return agentResult.text || '☀️ בוקר טוב. 3 המשימות הקריטיות להיום ושיחה אישית יזומה...';
}

export async function generateThursdayWeeklyRetro(
  systemContext?: string,
  userInstruction?: string
): Promise<string> {
  const context = systemContext ?? (await sheetsService.getSystemContext());
  let prompt =
    'הפק דוח ביקורת עצמית וסגירת שבוע נוקב ("מבט במראה") לרמ"ד, המבוסס על 5 המדדים, היסטוריית הדחיות והשינויים בגיליונות, עקרונות ה-doctrine ונקודות התורפה של הרמ"ד.';
  if (userInstruction && userInstruction.trim()) {
    prompt += `\nדגש/הנחיה ספציפית מהרמ"ד להודעה זו: "${userInstruction.trim()}"`;
  }
  const agentResult = await geminiService.generateAgentResponse(prompt, [], context);
  return agentResult.text || '🪞 18:00 - סגירת שבוע: "מבט במראה" וביקורת עצמית לפי 5 המדדים...';
}

export async function sendSundayWeeklyBrief(
  recipientPhone?: string,
  userInstruction?: string
): Promise<string> {
  const targetPhone = recipientPhone || config.allowedPhoneNumber;
  if (!targetPhone) {
    logger.warn('Cannot send Sunday weekly brief: No recipient phone configured');
    return '';
  }

  try {
    logger.info({ targetPhone }, 'Executing Sunday weekly opening brief routine');
    const text = await generateSundayWeeklyBrief(undefined, userInstruction);
    await whatsAppService.sendMessage(targetPhone, text);
    logger.info({ targetPhone }, 'Sunday weekly brief sent successfully');
    return text;
  } catch (err: unknown) {
    logger.error({ err, targetPhone }, 'Error executing Sunday weekly opening routine');
    throw err;
  }
}

export async function sendDailyFocus(
  recipientPhone?: string,
  userInstruction?: string
): Promise<string> {
  const targetPhone = recipientPhone || config.allowedPhoneNumber;
  if (!targetPhone) {
    logger.warn('Cannot send daily focus: No recipient phone configured');
    return '';
  }

  try {
    logger.info({ targetPhone }, 'Executing Daily focus morning routine');
    const text = await generateDailyFocus(undefined, userInstruction);
    await whatsAppService.sendMessage(targetPhone, text);
    logger.info({ targetPhone }, 'Daily focus sent successfully');
    return text;
  } catch (err: unknown) {
    logger.error({ err, targetPhone }, 'Error executing daily focus routine');
    throw err;
  }
}

export async function sendThursdayWeeklyRetro(
  recipientPhone?: string,
  userInstruction?: string
): Promise<string> {
  const targetPhone = recipientPhone || config.allowedPhoneNumber;
  if (!targetPhone) {
    logger.warn('Cannot send Thursday weekly retro: No recipient phone configured');
    return '';
  }

  try {
    logger.info({ targetPhone }, 'Executing Thursday weekly mirror routine');
    const text = await generateThursdayWeeklyRetro(undefined, userInstruction);
    await whatsAppService.sendMessage(targetPhone, text);
    logger.info({ targetPhone }, 'Thursday weekly retro sent successfully');
    return text;
  } catch (err: unknown) {
    logger.error({ err, targetPhone }, 'Error executing Thursday weekly mirror routine');
    throw err;
  }
}

// Scheduled Cron Handlers
export const runSundayWeeklyBrief = (): Promise<string> => sendSundayWeeklyBrief();
export const runDailyFocus = (): Promise<string> => sendDailyFocus();
export const runThursdayWeeklyRetro = (): Promise<string> => sendThursdayWeeklyRetro();


export function initializeCronJobs(): void {
  const cronOptions = { timezone: 'Asia/Jerusalem' };

  // Sunday 07:00 (Weekly opening - פתיחת שבוע)
  const sundayJob = cron.schedule(
    '0 7 * * 0',
    () => {
      runSundayWeeklyBrief().catch((e) => logger.error({ err: e }, 'Sunday weekly cron failed'));
    },
    cronOptions
  );
  activeCronTasks.push(sundayJob);

  // Mon-Wed 07:30 (Daily focus - מיקוד יומי)
  const dailyFocusJob = cron.schedule(
    '30 7 * * 1-3',
    () => {
      runDailyFocus().catch((e) => logger.error({ err: e }, 'Daily focus cron failed'));
    },
    cronOptions
  );
  activeCronTasks.push(dailyFocusJob);

  // Thursday 18:00 (Weekly review / mirror - מבט במראה)
  const thursdayJob = cron.schedule(
    '0 18 * * 4',
    () => {
      runThursdayWeeklyRetro().catch((e) => logger.error({ err: e }, 'Thursday weekly retro cron failed'));
    },
    cronOptions
  );
  activeCronTasks.push(thursdayJob);

  logger.info(
    'Cron jobs scheduled successfully with timezone Asia/Jerusalem (Sunday 07:00, Mon-Wed 07:30, Thursday 18:00)'
  );
}

export function stopCronJobs(): void {
  logger.info(`Stopping ${activeCronTasks.length} active cron jobs`);
  for (const task of activeCronTasks) {
    task.stop();
  }
  activeCronTasks.length = 0;
}
