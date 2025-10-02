import dotenv from 'dotenv';

dotenv.config();

export const env = {
  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

  // Groq AI
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',

  // Telegram Parser
  TELEGRAM_API_ID: process.env.TELEGRAM_API_ID || '',
  TELEGRAM_API_HASH: process.env.TELEGRAM_API_HASH || '',

  // Server
  PORT: parseInt(process.env.PORT || '3000'),
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Cron Security
  CRON_SECRET: process.env.CRON_SECRET || '',
};

// Validate required env vars
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GROQ_API_KEY'];
const missingEnvVars = requiredEnvVars.filter((key) => !env[key as keyof typeof env]);

if (missingEnvVars.length > 0 && process.env.NODE_ENV !== 'test') {
  console.warn(`⚠️  Missing environment variables: ${missingEnvVars.join(', ')}`);
}
