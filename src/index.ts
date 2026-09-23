import express from 'express';
import type { Server } from 'http';
import { config } from './config/env.js';
import { webhookController } from './controllers/webhook.controller.js';
import { cronController } from './controllers/cron.controller.js';
import { initializeCronJobs, stopCronJobs } from './cron/scheduler.js';
import { securityMiddleware } from './common/middleware/security.js';
import { errorHandler } from './common/middleware/error-handler.js';
import { logger } from './common/logger.js';
import { queueService } from './services/queue.service.js';

const app = express();

// Security and body-parsing middleware
app.use(securityMiddleware);
app.use(express.json({ limit: '1mb' }));

// Health Check Endpoint (For Render pinging / uptime monitoring)
app.get('/health', (_req, res) => {
  res.status(200).send('alive');
});

// Protected HTTP Cron & Active Routine Endpoints
app.all('/api/cron/:job', (req, res, next) => {
  cronController.handleCronTrigger(req, res, next).catch(next);
});
app.all('/cron/:job', (req, res, next) => {
  cronController.handleCronTrigger(req, res, next).catch(next);
});
app.all('/api/send/:job', (req, res, next) => {
  cronController.handleCronTrigger(req, res, next).catch(next);
});
app.all('/api/trigger/:job', (req, res, next) => {
  cronController.handleCronTrigger(req, res, next).catch(next);
});

// Meta WhatsApp Webhook Endpoints
app.get('/webhook', (req, res) => {
  webhookController.verifyWebhook(req, res);
});
app.post('/webhook', (req, res, next) => {
  logger.debug({ body: req.body }, 'Incoming WhatsApp webhook POST');
  webhookController.handleWebhookPayload(req, res, next).catch(next);
});

// Centralized Express Error Handling Middleware
app.use(errorHandler);

// Initialize Automated In-Process Cron Scheduler
initializeCronJobs();

// Start Server
const server: Server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.nodeEnv }, `Ramad Agent server running on port ${config.port}`);
});

// ==========================================
// GRACEFUL SHUTDOWN & PROCESS-LEVEL SAFETY
// ==========================================

let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, `Received ${signal}. Starting graceful shutdown...`);

  // 1. Stop accepting new cron job executions
  stopCronJobs();

  // 2. Stop accepting new HTTP requests
  server.close(async () => {
    logger.info('HTTP server closed. Waiting for in-flight queue tasks to drain...');

    // 3. Wait for background queues to complete
    const drained = await queueService.waitForDrain(10000);
    if (!drained) {
      logger.warn('Forcing shutdown before all queues drained');
    } else {
      logger.info('All queues drained successfully');
    }

    logger.info('Graceful shutdown completed. Exiting process.');
    process.exit(0);
  });

  // Force exit after 15s timeout
  setTimeout(() => {
    logger.error('Forceful shutdown after timeout');
    process.exit(1);
  }, 15000).unref();
}

process.on('SIGTERM', () => {
  void gracefulShutdown('SIGTERM');
});

process.on('SIGINT', () => {
  void gracefulShutdown('SIGINT');
});

process.on('unhandledRejection', (reason: unknown) => {
  logger.error({ err: reason }, 'Unhandled Rejection detected');
});

process.on('uncaughtException', (err: Error) => {
  logger.fatal({ err }, 'Uncaught Exception detected');
  void gracefulShutdown('uncaughtException');
});