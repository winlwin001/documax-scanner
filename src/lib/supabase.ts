import { createClient } from '@supabase/supabase-js';

// Supabase client initialization - triggers Vercel redeploy to load env variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mock-project-url.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'mock-anon-key';

export const isSupabaseConfigured = 
  import.meta.env.VITE_SUPABASE_URL && 
  import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase environment variables are missing. The app is running in Local Offline / Guest mode. ' +
    'To enable cloud sync, set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export default supabase;
