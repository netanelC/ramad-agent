import {
  sendDailyFocus,
  sendSundayWeeklyBrief,
  sendThursdayWeeklyRetro,
} from '../src/cron/scheduler.js';
import { logger } from '../src/common/logger.js';

async function main(): Promise<void> {
  const rawArg = (process.argv[2] || '').toLowerCase().trim();
  const cleanArg = rawArg.replace(/["״׳\-_ ]/g, '');

  if (
    cleanArg === 'boker' ||
    cleanArg === 'morning' ||
    cleanArg === 'daily' ||
    cleanArg === 'dailyfocus' ||
    cleanArg === 'בוקר' ||
    cleanArg === 'מיקודיומי'
  ) {
    console.log('🚀 Sending Daily Focus (מיקוד יומי) message to RAMAD...');
    const result = await sendDailyFocus();
    console.log('\n✅ Daily Focus sent successfully!\nPreview:\n', result);
  } else if (
    cleanArg === 'sunday' ||
    cleanArg === 'startweek' ||
    cleanArg === 'weekly' ||
    cleanArg === 'sundaybrief' ||
    cleanArg === 'תחילתשבוע' ||
    cleanArg === 'פתיחתשבוע'
  ) {
    console.log('🚀 Sending Sunday Weekly Brief (פתיחת שבוע) to RAMAD...');
    const result = await sendSundayWeeklyBrief();
    console.log('\n✅ Sunday Weekly Brief sent successfully!\nPreview:\n', result);
  } else if (
    cleanArg === 'weekend' ||
    cleanArg === 'retro' ||
    cleanArg === 'thursday' ||
    cleanArg === 'thursdayretro' ||
    cleanArg === 'סופש' ||
    cleanArg === 'סגירתשבוע' ||
    cleanArg === 'מבטבמראה'
  ) {
    console.log('🚀 Sending Weekly Retro (מבט במראה / סגירת שבוע) to RAMAD...');
    const result = await sendThursdayWeeklyRetro();
    console.log('\n✅ Weekly Retro sent successfully!\nPreview:\n', result);
  } else {
    console.error(`
❌ Unknown routine trigger: "${rawArg}"
Usage:
  npm run send:morning   (or: npx tsx scripts/send-routine.ts בוקר)
  npm run send:sunday    (or: npx tsx scripts/send-routine.ts תחילת-שבוע)
  npm run send:weekend   (or: npx tsx scripts/send-routine.ts סופש)
    `);
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  const errMsg = err instanceof Error ? err.message : String(err);
  logger.error({ err }, `CLI send-routine failed: ${errMsg}`);
  console.error(`❌ Failed to send routine message: ${errMsg}`);
  process.exit(1);
});
