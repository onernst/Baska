import { createClient } from '@supabase/supabase-js';

// Public connection details for the Baska Supabase project.
// The publishable key is designed to live in the browser; the database's
// security rules (supabase/setup.sql) decide what each person can see.
const SUPABASE_URL = 'https://xqomjzedaidbzuiweejc.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_c-y24cX4XXmOe6gopNXAng_BR7HGni9';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});
