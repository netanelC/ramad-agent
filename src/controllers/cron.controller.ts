import type { Request, Response, NextFunction } from 'express';
import { runSundayWeeklyBrief, runDailyFocus, runThursdayWeeklyRetro } from '../cron/scheduler.js';
import { config } from '../config/env.js';
import { UnauthorizedError, BadRequestError } from '../common/errors/app-error.js';
import { logger } from '../common/logger.js';

export class CronController {
  public async handleCronTrigger(req: Request, res: Response, next: NextFunction): Promise<void> {
    const authHeader = req.headers['authorization'];
    const expectedToken = config.cronSecret || config.verifyToken;

    if (expectedToken && authHeader !== `Bearer ${expectedToken}` && req.query['token'] !== expectedToken) {
      next(new UnauthorizedError('Invalid or missing cron authorization token'));
      return;
    }

    const paramVal = req.params['job'];
    const rawJob = (Array.isArray(paramVal) ? paramVal[0] || '' : paramVal || '').toLowerCase().trim();
    const cleanJob = decodeURIComponent(rawJob).replace(/["״׳\-_ ]/g, '');
    logger.info({ rawJob, cleanJob }, `Received trigger for job/routine: ${rawJob}`);

    try {
      if (
        cleanJob === 'sundaybrief' ||
        cleanJob === 'sunday' ||
        cleanJob === 'startweek' ||
        cleanJob === 'weekly' ||
        cleanJob === 'תחילתשבוע' ||
        cleanJob === 'פתיחתשבוע'
      ) {
        const text = await runSundayWeeklyBrief();
        res.status(200).json({ status: 'ok', job: rawJob, message: 'Sunday weekly brief executed successfully', text });
      } else if (
        cleanJob === 'dailyfocus' ||
        cleanJob === 'daily' ||
        cleanJob === 'boker' ||
        cleanJob === 'morning' ||
        cleanJob === 'בוקר' ||
        cleanJob === 'מיקודיומי'
      ) {
        const text = await runDailyFocus();
        res.status(200).json({ status: 'ok', job: rawJob, message: 'Daily focus executed successfully', text });
      } else if (
        cleanJob === 'thursdayretro' ||
        cleanJob === 'thursday' ||
        cleanJob === 'weekend' ||
        cleanJob === 'retro' ||
        cleanJob === 'סופש' ||
        cleanJob === 'סגירתשבוע' ||
        cleanJob === 'מבטבמראה'
      ) {
        const text = await runThursdayWeeklyRetro();
        res.status(200).json({ status: 'ok', job: rawJob, message: 'Thursday weekly retro executed successfully', text });
      } else {
        next(new BadRequestError(`Unknown routine/cron job: ${rawJob}`));
      }
    } catch (err: unknown) {
      next(err);
    }
  }
}

export const cronController = new CronController();
