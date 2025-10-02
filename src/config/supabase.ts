import { createClient } from '@supabase/supabase-js';
import { env } from './env';

// Используем anon key (RLS отключен для публичного доступа)
export const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY
);
