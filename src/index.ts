import express from 'express';
import { config } from './config/env.js';
import { webhookController } from './controllers/webhook.controller.js';
import {
  initializeCronJobs,
  runSundayWeeklyBrief,
  runDailyFocus,
  runThursdayWeeklyRetro,
} from './cron/scheduler.js';

const app = express();
app.use(express.json());

// Health Check Endpoint (For Render pinging / uptime monitoring)
app.get('/health', (_req, res) => {
  res.status(200).send('alive');
});

// Helper for Token Authorization on Cron Endpoints
function isTokenValid(req: express.Request): boolean {
  if (!config.verifyToken) return true;
  const token = req.query.token || req.headers['x-cron-token'];
  return !token || token === config.verifyToken;
}

// HTTP Trigger Endpoints for Cron Routines (Prevents Render Sleep Issues)
app.get('/cron/weekly-brief', async (req, res) => {
  if (!isTokenValid(req)) {
    return res.status(403).json({ error: 'Unauthorized token' });
  }
  try {
    await runSundayWeeklyBrief();
    res.status(200).json({ status: 'success', message: 'Weekly brief executed' });
  } catch (err: unknown) {
    const errorDetails = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorDetails });
  }
});

app.get('/cron/daily-focus', async (req, res) => {
  if (!isTokenValid(req)) {
    return res.status(403).json({ error: 'Unauthorized token' });
  }
  try {
    await runDailyFocus();
    res.status(200).json({ status: 'success', message: 'Daily focus executed' });
  } catch (err: unknown) {
    const errorDetails = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorDetails });
  }
});

app.get('/cron/weekly-retro', async (req, res) => {
  if (!isTokenValid(req)) {
    return res.status(403).json({ error: 'Unauthorized token' });
  }
  try {
    await runThursdayWeeklyRetro();
    res.status(200).json({ status: 'success', message: 'Weekly retro executed' });
  } catch (err: unknown) {
    const errorDetails = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errorDetails });
  }
});

// Meta WhatsApp Webhook Endpoints
app.get('/webhook', (req, res) => webhookController.verifyWebhook(req, res));
app.post('/webhook', (req, res) => {
  console.log('>>> Incoming Webhook POST:', JSON.stringify(req.body, null, 2));
  webhookController.handleWebhookPayload(req, res).catch((err) => {
    console.error('Unhandled error handling webhook:', err);
  });
});

// Initialize Automated In-Process Cron Scheduler
initializeCronJobs();

// Start Server
app.listen(config.port, () => {
  console.log(`Ramad Agent server running locally on port ${config.port}`);
});