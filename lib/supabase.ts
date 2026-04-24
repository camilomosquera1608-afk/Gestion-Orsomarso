import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

export const APP_STATE_ROW_ID = 'orsomarso-primary';

export async function fetchRemoteAppState() {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('app_state')
    .select('id, payload, updated_at')
    .eq('id', APP_STATE_ROW_ID)
    .maybeSingle();

  if (error) {
    console.error('Error cargando estado remoto:', error.message);
    return null;
  }

  return data;
}

export async function saveRemoteAppState(payload: unknown) {
  if (!supabase) return { ok: false };

  const { error } = await supabase
    .from('app_state')
    .upsert(
      {
        id: APP_STATE_ROW_ID,
        payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

  if (error) {
    console.error('Error guardando estado remoto:', error.message);
    return { ok: false, error };
  }

  return { ok: true };
}
