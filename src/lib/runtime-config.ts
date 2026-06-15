import type { SupabaseClient } from "@supabase/supabase-js";

export const DREAMFACE_IO_ENABLED_KEY = "dreamface_io_enabled";

function envDefaultEnabled() {
  return process.env.DREAMFACE_IO_ENABLED?.trim().toLowerCase() !== "false";
}

export async function isDreamfaceIoEnabled(admin: SupabaseClient | null) {
  if (!admin) return false;

  const { data, error } = await admin
    .from("runtime_settings")
    .select("value")
    .eq("key", DREAMFACE_IO_ENABLED_KEY)
    .maybeSingle();

  if (error) {
    return envDefaultEnabled();
  }

  const value = (data as { value?: unknown } | null)?.value;
  if (typeof value === "boolean") return value;
  if (value && typeof value === "object" && "enabled" in value) {
    return Boolean((value as { enabled?: unknown }).enabled);
  }
  return envDefaultEnabled();
}

export async function setDreamfaceIoEnabled(admin: SupabaseClient, enabled: boolean, updatedBy: string | null) {
  const { error } = await admin.from("runtime_settings").upsert(
    {
      key: DREAMFACE_IO_ENABLED_KEY,
      value: { enabled },
      updated_by: updatedBy,
      updated_at: new Date().toISOString()
    },
    { onConflict: "key" }
  );

  if (error) throw error;
  return enabled;
}
