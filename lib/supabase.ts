import { createClient } from '@supabase/supabase-js';

// Using the provided Supabase Project ID and API Key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bdzcvjnmxqblprwksvbi.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkemN2am5teHFibHByd2tzdmJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMDcxNTksImV4cCI6MjA4NjU4MzE1OX0.4bz3eqRbAcO3ZAcZFPXaLicUZAf_3zztwPmCqPf-4hg';

export const supabase = createClient(supabaseUrl, supabaseKey);

export const isMockSupabase = false;

// Robust helper to deterministically generate/map standard clean UUID strings from arbitrary strings.
// This guarantees we never trigger Postgres 'invalid input syntax for type uuid' errors.
export function toSafeUUID(str: string): string {
  if (!str) return '00000000-0000-4000-8000-000000000000';
  
  const cleanStr = str.trim();
  
  // Check if it is already a valid UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const looseUuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (uuidRegex.test(cleanStr) || looseUuidRegex.test(cleanStr)) {
    return cleanStr.toLowerCase();
  }

  // Deterministically hash the string to generate a 32-character hex sequence
  let hash1 = 0;
  let hash2 = 0;
  for (let i = 0; i < cleanStr.length; i++) {
    const char = cleanStr.charCodeAt(i);
    hash1 = (hash1 << 5) - hash1 + char;
    hash1 = hash1 & hash1; // 32bit int
    
    hash2 = (hash2 << 7) - hash2 + char;
    hash2 = hash2 & hash2; // 32bit int
  }

  const hex1 = Math.abs(hash1).toString(16).padEnd(16, 'f');
  const hex2 = Math.abs(hash2).toString(16).padEnd(16, 'e');
  const seed = (hex1 + hex2).substring(0, 32);

  // Construct a valid UUID format (8-4-4-4-12 hex characters)
  const part1 = seed.substring(0, 8);
  const part2 = seed.substring(8, 12);
  const part3 = '4' + seed.substring(13, 16); // Version 4
  const raw16 = seed.substring(16, 17);
  const hex16 = ['8', '9', 'a', 'b'][parseInt(raw16, 16) % 4] || '8';
  const part4 = hex16 + seed.substring(17, 20);
  const part5 = seed.substring(20, 32);

  return `${part1}-${part2}-${part3}-${part4}-${part5}`;
}

export function generateUUID(): string {
  if (typeof window !== "undefined" && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

