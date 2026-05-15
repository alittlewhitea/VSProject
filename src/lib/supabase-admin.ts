import { createClient } from "@supabase/supabase-js";

const SUPABASE_TIMEOUT_MS = 35000;

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUPABASE_TIMEOUT_MS);

  return fetch(input, {
    ...init,
    signal: init?.signal || controller.signal
  }).finally(() => clearTimeout(timer));
}

export function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    global: {
      fetch: fetchWithTimeout
    }
  });
}
