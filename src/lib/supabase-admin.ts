import { createMysqlSupabaseAdapter } from "./mysql-supabase-adapter";

export function createSupabaseAdminClient() {
  try {
    return createMysqlSupabaseAdapter();
  } catch {
    return null;
  }
}
