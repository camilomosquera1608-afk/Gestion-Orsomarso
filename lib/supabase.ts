import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const remoteSyncMode = process.env.NEXT_PUBLIC_REMOTE_SYNC_MODE;

export const remoteSyncEnabled = process.env.NEXT_PUBLIC_ENABLE_REMOTE_SYNC === 'true';
export const tableSchemaSyncEnabled = remoteSyncEnabled && remoteSyncMode === 'table_schema';
export const legacyAppStateSyncEnabled = remoteSyncEnabled && remoteSyncMode === 'legacy_app_state';
export const hasSupabaseConfig = Boolean(remoteSyncEnabled && (tableSchemaSyncEnabled || legacyAppStateSyncEnabled) && supabaseUrl && supabaseAnonKey);

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const APP_STATE_ROW_ID = 'orsomarso-primary';

export async function signInSupabase(email: string, password: string) {
  if (!supabase || !tableSchemaSyncEnabled) return { ok: false as const, reason: 'Supabase no está configurado en modo table_schema.' };

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password.trim();

  if (!normalizedEmail || !normalizedPassword) {
    return { ok: false as const, reason: 'Escribe email y contraseña.' };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: normalizedPassword,
  });

  if (error) return { ok: false as const, reason: error.message, status: error.status };
  return { ok: true as const, user: data.user };
}

export async function sendSupabasePasswordReset(email: string, redirectTo?: string) {
  if (!supabase || !tableSchemaSyncEnabled) {
    return { ok: false as const, reason: 'Supabase no está configurado en modo table_schema.' };
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return { ok: false as const, reason: 'Escribe el email de Supabase.' };

  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo,
  });

  if (error) return { ok: false as const, reason: error.message, status: error.status };
  return { ok: true as const };
}

export async function updateSupabasePassword(password: string) {
  if (!supabase || !tableSchemaSyncEnabled) {
    return { ok: false as const, reason: 'Supabase no está configurado en modo table_schema.' };
  }

  const normalizedPassword = password.trim();
  if (normalizedPassword.length < 6) {
    return { ok: false as const, reason: 'La contraseña debe tener al menos 6 caracteres.' };
  }

  const { error } = await supabase.auth.updateUser({ password: normalizedPassword });
  if (error) return { ok: false as const, reason: error.message, status: error.status };
  return { ok: true as const };
}

export async function signOutSupabase() {
  if (!supabase) return { ok: false as const };
  const { error } = await supabase.auth.signOut();
  return { ok: !error, error };
}

export async function getSupabaseUserEmail() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.email ?? null;
}

export async function fetchRemoteAppState() {
  if (!supabase || !legacyAppStateSyncEnabled) return null;

  const { data, error } = await supabase
    .from('app_state')
    .select('id, payload, updated_at')
    .eq('id', APP_STATE_ROW_ID)
    .maybeSingle();

  if (error) {
    console.error('Error cargando estado remoto legacy:', error.message);
    return null;
  }

  return data;
}

export async function saveRemoteAppState(payload: unknown) {
  if (!supabase || !legacyAppStateSyncEnabled) return { ok: false };

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
    console.error('Error guardando estado remoto legacy:', error.message);
    return { ok: false, error };
  }

  return { ok: true };
}

export async function fetchCurrentUserProfile() {
  if (!supabase || !tableSchemaSyncEnabled) {
    return { ok: false as const, reason: 'Supabase no está configurado en modo table_schema.' };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) return { ok: false as const, reason: userError.message };
  const user = userData.user;
  if (!user) return { ok: false as const, reason: 'No hay sesión activa.' };

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, category_scope, access_level, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (error) return { ok: false as const, reason: error.message };
  if (!data) return { ok: false as const, reason: 'Tu usuario no tiene perfil asignado. Solicita rol y categoría al administrador.' };
  if (data.is_active === false) return { ok: false as const, reason: 'Tu perfil está desactivado.' };

  return {
    ok: true as const,
    profile: {
      id: String(data.id),
      email: String(data.email ?? user.email ?? '').toLowerCase(),
      fullName: data.full_name ?? null,
      role: data.role,
      categoryScope: data.category_scope,
      accessLevel: data.access_level,
      isActive: Boolean(data.is_active),
    },
  };
}

export async function fetchAuditLogs(limit = 80) {
  if (!supabase || !tableSchemaSyncEnabled) return { ok: false as const, reason: 'Supabase no está configurado.' };
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, actor_email, actor_role, action, table_name, record_id, record_label, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return { ok: false as const, reason: error.message };
  return { ok: true as const, logs: data ?? [] };
}
