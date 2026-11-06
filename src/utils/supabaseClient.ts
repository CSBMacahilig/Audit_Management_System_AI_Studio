import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  'https://lpsxrwesflgkoosncyrc.supabase.co';

const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxwc3hyd2VzZmxna29vc25jeXJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5NTkyMDgsImV4cCI6MjEwOTUzNTIwOH0.9VlSqKrbzPoYTaKrV1tTQlxruGsKk-UWQxqrZAqjl4k';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
