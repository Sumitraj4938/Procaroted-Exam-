import { createClient } from '@supabase/supabase-js';

// Using the provided Supabase Project ID and API Key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hsliulkmkjxnmknaxfkw.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_fsNr89qBv21JVUk5bET1bg_e_Jg7fmm';

export const supabase = createClient(supabaseUrl, supabaseKey);

export const isMockSupabase = false;
