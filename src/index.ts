import express from 'express';
import { config } from './config/env.js';
import { webhookController } from './controllers/webhook.controller.js';
import { initializeCronJobs } from './cron/scheduler.js';

const app = express();
app.use(express.json());

// Meta WhatsApp Webhook endpoints
app.get('/webhook', (req, res) => webhookController.verifyWebhook(req, res));
app.post('/webhook', (req, res) => {
  console.log('>>> Incoming Webhook POST:', JSON.stringify(req.body, null, 2));
  webhookController.handleWebhookPayload(req, res).catch((err) => {
    console.error('Unhandled error handling webhook:', err);
  });
});

// Initialize automated schedule
initializeCronJobs();

// Start application server
app.listen(config.port, () => {
  console.log(`Ramad Agent server running locally on port ${config.port}`);
});