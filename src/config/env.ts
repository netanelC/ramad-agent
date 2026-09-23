import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  META_ACCESS_TOKEN: z.string().min(1, 'META_ACCESS_TOKEN is required'),
  PHONE_NUMBER_ID: z.string().min(1, 'PHONE_NUMBER_ID is required'),
  VERIFY_TOKEN: z.string().min(1, 'VERIFY_TOKEN is required'),
  ALLOWED_PHONE_NUMBER: z.string().min(1, 'ALLOWED_PHONE_NUMBER is required'),
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
  SPREADSHEET_ID: z.string().min(1, 'SPREADSHEET_ID is required'),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().default('./credentials.json'),
  CRON_SECRET: z.string().optional(),
  GEMINI_MODEL: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const errorDetails = parsedEnv.error.issues
    .map((e) => `  • ${e.path.join('.')}: ${e.message}`)
    .join('\n');
  console.error(`❌ Invalid environment configuration:\n${errorDetails}`);
  process.exit(1);
}

export const config = {
  port: parsedEnv.data.PORT,
  nodeEnv: parsedEnv.data.NODE_ENV,
  metaAccessToken: parsedEnv.data.META_ACCESS_TOKEN,
  phoneNumberId: parsedEnv.data.PHONE_NUMBER_ID,
  verifyToken: parsedEnv.data.VERIFY_TOKEN,
  allowedPhoneNumber: parsedEnv.data.ALLOWED_PHONE_NUMBER,
  geminiApiKey: parsedEnv.data.GEMINI_API_KEY,
  spreadsheetId: parsedEnv.data.SPREADSHEET_ID,
  googleCredentialsPath: parsedEnv.data.GOOGLE_APPLICATION_CREDENTIALS,
  cronSecret: parsedEnv.data.CRON_SECRET,
  geminiModel: parsedEnv.data.GEMINI_MODEL,
  logLevel: parsedEnv.data.LOG_LEVEL,
} as const;

export type Config = typeof config;
