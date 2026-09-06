import dotenv from 'dotenv';

dotenv.config();

export interface Config {
  port: number;
  metaAccessToken: string;
  phoneNumberId: string;
  verifyToken: string;
  allowedPhoneNumber: string;
  geminiApiKey: string;
  spreadsheetId: string;
  googleCredentialsPath: string;
}

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config: Config = {
  port: parseInt(process.env.PORT || '3000', 10),
  metaAccessToken: getEnvVar('META_ACCESS_TOKEN'),
  phoneNumberId: getEnvVar('PHONE_NUMBER_ID'),
  verifyToken: getEnvVar('VERIFY_TOKEN'),
  allowedPhoneNumber: getEnvVar('ALLOWED_PHONE_NUMBER'),
  geminiApiKey: getEnvVar('GEMINI_API_KEY'),
  spreadsheetId: getEnvVar('SPREADSHEET_ID'),
  googleCredentialsPath: getEnvVar('GOOGLE_APPLICATION_CREDENTIALS', './credentials.json'),
};
