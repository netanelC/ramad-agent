import type { Request, Response } from 'express';
import { runSundayWeeklyBrief, runDailyFocus, runThursdayWeeklyRetro } from '../cron/scheduler.js';
import { config } from '../config/env.js';

export class CronController {
  public async handleCronTrigger(req: Request, res: Response): Promise<void> {
    const authHeader = req.headers['authorization'];
    const expectedToken = process.env.CRON_SECRET || config.verifyToken;

    if (expectedToken && authHeader !== `Bearer ${expectedToken}` && req.query.token !== expectedToken) {
      res.status(401).json({ error: 'Unauthorized cron request' });
      return;
    }

    const job = req.params.job;
    console.log(`Received external cron trigger for job: ${job}`);

    try {
      if (job === 'sunday-brief' || job === 'sunday') {
        await runSundayWeeklyBrief();
        res.status(200).json({ status: 'ok', job, message: 'Sunday weekly brief executed successfully' });
      } else if (job === 'daily-focus' || job === 'daily') {
        await runDailyFocus();
        res.status(200).json({ status: 'ok', job, message: 'Daily focus executed successfully' });
      } else if (job === 'thursday-retro' || job === 'thursday') {
        await runThursdayWeeklyRetro();
        res.status(200).json({ status: 'ok', job, message: 'Thursday weekly retro executed successfully' });
      } else {
        res.status(400).json({ error: `Unknown cron job: ${job}` });
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`Error executing cron job "${job}":`, errorMsg);
      res.status(500).json({ error: errorMsg });
    }
  }
}

export const cronController = new CronController();
