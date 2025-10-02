import { createClient } from '@supabase/supabase-js';
import { env } from './env';

// Используем service_role для backend (полный доступ к БД)
// API будет публичным, но backend имеет полные права
export const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);
