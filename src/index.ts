import express from 'express';
import { config } from './config/env.js';
import { webhookController } from './controllers/webhook.controller.js';
import { cronController } from './controllers/cron.controller.js';
import { initializeCronJobs } from './cron/scheduler.js';

const app = express();
app.use(express.json());

// Health Check Endpoint (For Render pinging / uptime monitoring)
app.get('/health', (_req, res) => {
  res.status(200).send('alive');
});

// Protected HTTP Cron Endpoints (For Render Cron / External Cron Triggers)
app.all('/api/cron/:job', (req, res) => cronController.handleCronTrigger(req, res));
app.all('/cron/:job', (req, res) => cronController.handleCronTrigger(req, res));

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
  console.log(`Ramad Agent server running on port ${config.port}`);
});