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

export type ProfileSource = 'rpc_safe' | 'rpc_profiles' | 'rpc_perfiles' | 'direct_profiles' | 'direct_perfiles';

export type FetchProfilesResult =
  | { ok: true; profiles: UserProfile[]; source: ProfileSource; reason?: string }
  | { ok: false; reason: string; source?: ProfileSource };

export async function fetchCurrentUserProfile() {
  if (!supabase || !tableSchemaSyncEnabled) {
    return { ok: false as const, reason: 'Supabase no está configurado en modo table_schema.' };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) return { ok: false as const, reason: userError.message };
  const user = userData.user;
  if (!user) return { ok: false as const, reason: 'No hay sesión activa.' };

  const rpcResult = await supabase.rpc('current_user_profile_safe');
  if (!rpcResult.error && rpcResult.data) {
    const rows = Array.isArray(rpcResult.data) ? rpcResult.data : [rpcResult.data];
    const profile = mapProfileRow({ ...rows[0], email: readRowValue(rows[0], ['email', 'correo_electronico', 'correo electrónico']) ?? user.email });
    if (!profile.isActive) return { ok: false as const, reason: 'Tu perfil está desactivado.' };
    return { ok: true as const, profile };
  }

  const primaryResult = await supabase
    .from('profiles')
    .select('id, email, full_name, role, category_scope, access_level, is_active')
    .eq('id', user.id)
    .maybeSingle();

  let data = primaryResult.data;
  let error = primaryResult.error;

  if (error || !data) {
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

const booleanFromRowValue = (value: unknown, fallback = true) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'si', 'sí', 'activo', 'active'].includes(normalized)) return true;
  if (['false', '0', 'no', 'inactivo', 'inactive'].includes(normalized)) return false;
  return fallback;
};

const mapProfileRow = (row: any): UserProfile => {
  const role = normalizePlatformRole(readRowValue(row, ['role', 'rol', 'platform_role']));
  return {
    id: String(readRowValue(row, ['id', 'identificacion', 'identificación', 'profile_id']) ?? ''),
    email: String(readRowValue(row, ['email', 'correo_electronico', 'correo electrónico', 'correo', 'user_email']) ?? '').trim().toLowerCase(),
    fullName: readRowValue(row, ['full_name', 'nombre_completo', 'nombre completo', 'name', 'display_name']) ?? null,
    role,
    categoryScope: normalizeCategoryScope(readRowValue(row, ['category_scope', 'ambito_de_categoria', 'ámbito_de_categoría', 'ambito categoria', 'scope', 'categoria'])),
    accessLevel: normalizeAccessLevel(readRowValue(row, ['access_level', 'nivel_acceso', 'permiso', 'access']), role),
    isActive: booleanFromRowValue(readRowValue(row, ['is_active', 'activo', 'active']), true),
    createdAt: readRowValue(row, ['created_at', 'creado_en', 'created']) ?? undefined,
    updatedAt: readRowValue(row, ['updated_at', 'actualizado_en', 'updated']) ?? undefined,
  };
};

const runProfilesRpc = async (name: string, source: ProfileSource) => {
  if (!supabase) return null;
  const result = await supabase.rpc(name);
  if (result.error) return { ok: false as const, reason: result.error.message, source };
  return { ok: true as const, profiles: (result.data ?? []).map(mapProfileRow), source };
};

export async function fetchProfiles(): Promise<FetchProfilesResult> {
  if (!supabase || !tableSchemaSyncEnabled) return { ok: false as const, reason: 'Supabase no configurado.' };

  const rpcNames: Array<[string, ProfileSource]> = [
    ['admin_list_profiles_safe', 'rpc_safe'],
    ['admin_list_profiles', 'rpc_profiles'],
    ['admin_list_perfiles', 'rpc_perfiles'],
  ];
  const errors: string[] = [];

  for (const [name, source] of rpcNames) {
    const rpcResult = await runProfilesRpc(name, source);
    if (rpcResult?.ok) return rpcResult;
    if (rpcResult?.reason) errors.push(`${name}: ${rpcResult.reason}`);
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, category_scope, access_level, is_active, created_at, updated_at')
    .order('email', { ascending: true });

  if (!error) return { ok: true as const, profiles: (data ?? []).map(mapProfileRow), source: 'direct_profiles' };
  errors.push(`profiles: ${error.message}`);

  const { data: spanishData, error: spanishError } = await supabase
    .from('perfiles')
    .select('*');

  if (!spanishError) return { ok: true as const, profiles: (spanishData ?? []).map(mapProfileRow), source: 'direct_perfiles' };
  errors.push(`perfiles: ${spanishError.message}`);

  return { ok: false as const, reason: errors.join(' | ') || 'No se pudieron cargar perfiles.' };
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

  const rpcPayload = {
    profile_id: profile.id,
    profile_full_name: profile.fullName || null,
    profile_role: profile.role,
    profile_category_scope: profile.categoryScope,
    profile_access_level: profile.accessLevel,
    profile_is_active: profile.isActive,
  };

  const rpcNames = ['admin_update_profile_access_safe', 'admin_update_profile', 'admin_update_perfil'];
  const errors: string[] = [];
  for (const name of rpcNames) {
    const rpcResult = await supabase.rpc(name, rpcPayload);
    if (!rpcResult.error) return { ok: true as const };
    errors.push(`${name}: ${rpcResult.error.message}`);
  }

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
  errors.push(`profiles: ${error.message}`);

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

  if (spanishError) return { ok: false as const, reason: [...errors, `perfiles: ${spanishError.message}`].join(' | ') };
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
