import { createClient } from '@supabase/supabase-js';
import { normalizeAccessLevel, normalizeCategoryScope, normalizePlatformRole, type AccessLevel, type CategoryScope, type PlatformRole, type UserProfile } from '@/lib/access-control';

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

  const primaryResult = await supabase
    .from('profiles')
    .select('id, email, full_name, role, category_scope, access_level, is_active')
    .eq('id', user.id)
    .maybeSingle();

  let data = primaryResult.data;
  let error = primaryResult.error;

  if (error) {
    const fallbackResult = await supabase
      .from('perfiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    data = fallbackResult.data;
    error = fallbackResult.error;
  }

  if (error) return { ok: false as const, reason: error.message };
  if (!data) return { ok: false as const, reason: 'Tu usuario no tiene perfil asignado. Solicita rol y categoría al administrador.' };

  const profile = mapProfileRow({ ...data, email: readRowValue(data, ['email', 'correo_electronico', 'correo electrónico']) ?? user.email });
  if (!profile.isActive) return { ok: false as const, reason: 'Tu perfil está desactivado.' };

  return { ok: true as const, profile };
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

export type AuditLogRow = {
  id: string;
  actor_email?: string | null;
  actor_role?: string | null;
  action: string;
  table_name: string;
  record_id?: string | null;
  record_label?: string | null;
  created_at: string;
  before_data?: unknown;
  after_data?: unknown;
};

const readRowValue = (row: any, keys: string[]) => {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null) return row[key];
  }
  return undefined;
};

const mapProfileRow = (row: any): UserProfile => {
  const role = normalizePlatformRole(readRowValue(row, ['role', 'rol']));
  return {
    id: String(readRowValue(row, ['id', 'identificacion', 'identificación']) ?? ''),
    email: String(readRowValue(row, ['email', 'correo_electronico', 'correo electrónico']) ?? '').toLowerCase(),
    fullName: readRowValue(row, ['full_name', 'nombre_completo', 'nombre completo']) ?? null,
    role,
    categoryScope: normalizeCategoryScope(readRowValue(row, ['category_scope', 'ambito_de_categoria', 'ámbito_de_categoría', 'ambito categoria'])),
    accessLevel: normalizeAccessLevel(readRowValue(row, ['access_level', 'nivel_acceso', 'permiso']), role),
    isActive: readRowValue(row, ['is_active', 'activo']) === undefined ? true : Boolean(readRowValue(row, ['is_active', 'activo'])),
    createdAt: readRowValue(row, ['created_at', 'creado_en']) ?? undefined,
    updatedAt: readRowValue(row, ['updated_at', 'actualizado_en']) ?? undefined,
  };
};

export async function fetchProfiles() {
  if (!supabase || !tableSchemaSyncEnabled) return { ok: false as const, reason: 'Supabase no configurado.' };

  const rpcResult = await supabase.rpc('admin_list_profiles');
  if (!rpcResult.error) {
    return { ok: true as const, profiles: (rpcResult.data ?? []).map(mapProfileRow) };
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, category_scope, access_level, is_active, created_at, updated_at')
    .order('email', { ascending: true });

  if (!error) return { ok: true as const, profiles: (data ?? []).map(mapProfileRow) };

  const { data: spanishData, error: spanishError } = await supabase
    .from('perfiles')
    .select('*');

  if (!spanishError) return { ok: true as const, profiles: (spanishData ?? []).map(mapProfileRow) };

  return { ok: false as const, reason: rpcResult.error.message || error.message || spanishError.message };
}

export async function updateProfileAccess(profile: {
  id: string;
  fullName?: string | null;
  role: PlatformRole;
  categoryScope: CategoryScope;
  accessLevel: AccessLevel;
  isActive: boolean;
}) {
  if (!supabase || !tableSchemaSyncEnabled) return { ok: false as const, reason: 'Supabase no configurado.' };

  const rpcResult = await supabase.rpc('admin_update_profile', {
    profile_id: profile.id,
    profile_full_name: profile.fullName || null,
    profile_role: profile.role,
    profile_category_scope: profile.categoryScope,
    profile_access_level: profile.accessLevel,
    profile_is_active: profile.isActive,
  });

  if (!rpcResult.error) return { ok: true as const };

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: profile.fullName || null,
      role: profile.role,
      category_scope: profile.categoryScope,
      access_level: profile.accessLevel,
      is_active: profile.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id);

  if (!error) return { ok: true as const };

  const { error: spanishError } = await supabase
    .from('perfiles')
    .update({
      nombre_completo: profile.fullName || null,
      role: profile.role,
      ambito_de_categoria: profile.categoryScope,
      access_level: profile.accessLevel,
      activo: profile.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id);

  if (spanishError) return { ok: false as const, reason: rpcResult.error.message || error.message || spanishError.message };
  return { ok: true as const };
}

export async function fetchAuditLogsDetailed(limit = 120) {
  if (!supabase || !tableSchemaSyncEnabled) return { ok: false as const, reason: 'Supabase no configurado.' };
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, actor_email, actor_role, action, table_name, record_id, record_label, before_data, after_data, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return { ok: false as const, reason: error.message };
  return { ok: true as const, logs: (data ?? []) as AuditLogRow[] };
}
