import { ClubCategory, StaffRole } from './types';
import type { AccessLevel, CategoryScope, PlatformRole, UserProfile } from './access-control';

export const STAFF_AUTH_KEY = 'orsomarso_staff_auth_v2';

/**
 * Local demo access only.
 *
 * The production flow uses Supabase Auth from /login. These credentials remain
 * only as an optional fallback for development when explicitly enabled.
 */
export const STAFF_CREDENTIALS: Record<StaffRole, { username: string; password: string; category?: ClubCategory; display: string }> = {
  sub15: { username: 'Sub15Local', password: 'local-sub15', category: 'Sub15', display: 'U15' },
  sub17: { username: 'Sub17Local', password: 'local-sub17', category: 'Sub17', display: 'U17' },
  sub20: { username: 'Sub20Local', password: 'local-sub20', category: 'Sub20', display: 'U20' },
  master: { username: 'MaestroLocal', password: 'local-maestro', display: 'Dirección' },
};

export type StaffSession = {
  isAuthenticated: boolean;
  role: StaffRole | null;
  category: ClubCategory | 'all';
  displayName: string;
  email?: string;
  authProvider?: 'supabase' | 'local_demo';
  platformRole?: PlatformRole;
  categoryScope?: CategoryScope;
  accessLevel?: AccessLevel;
  profileId?: string;
};

const defaultSession: StaffSession = {
  isAuthenticated: false,
  role: null,
  category: 'all',
  displayName: '',
};

const roleFromCategory = (category: ClubCategory | 'all'): StaffRole => {
  if (category === 'Sub15') return 'sub15';
  if (category === 'Sub17') return 'sub17';
  if (category === 'Sub20') return 'sub20';
  return 'master';
};

const displayFromCategory = (category: ClubCategory | 'all') => {
  if (category === 'Sub15') return 'U15';
  if (category === 'Sub17') return 'U17';
  if (category === 'Sub20') return 'U20';
  return 'Dirección';
};

export const getStaffSession = (): StaffSession => {
  if (typeof window === 'undefined') return defaultSession;
  try {
    const raw = localStorage.getItem(STAFF_AUTH_KEY);
    if (!raw) return defaultSession;
    const parsed = JSON.parse(raw) as StaffSession;
    if (!parsed?.isAuthenticated || !parsed.role) return defaultSession;
    return parsed;
  } catch {
    return defaultSession;
  }
};

export const isStaffAuthenticated = () => getStaffSession().isAuthenticated;

export const setStaffSession = (session: StaffSession) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STAFF_AUTH_KEY, JSON.stringify(session));
  }
};

export const createSupabaseStaffSession = (email: string, category: ClubCategory | 'all' = 'Sub20'): StaffSession => {
  const role = roleFromCategory(category);
  const session: StaffSession = {
    isAuthenticated: true,
    role,
    category,
    categoryScope: category === 'all' ? 'ALL' : category,
    accessLevel: 'full',
    platformRole: category === 'all' ? 'admin' : 'category_admin',
    displayName: displayFromCategory(category),
    email: email.trim().toLowerCase(),
    authProvider: 'supabase',
  };
  setStaffSession(session);
  return session;
};

export const createSupabaseStaffSessionFromProfile = (profile: UserProfile): StaffSession => {
  const category = profile.categoryScope === 'ALL' ? 'all' : profile.categoryScope;
  const role = roleFromCategory(category);
  const session: StaffSession = {
    isAuthenticated: true,
    role,
    category,
    categoryScope: profile.categoryScope,
    accessLevel: profile.accessLevel,
    platformRole: profile.role,
    profileId: profile.id,
    displayName: profile.fullName || displayFromCategory(category),
    email: profile.email.trim().toLowerCase(),
    authProvider: 'supabase',
  };
  setStaffSession(session);
  return session;
};

export const loginStaff = (user: string, password: string) => {
  const localDemoAuthEnabled = process.env.NEXT_PUBLIC_ENABLE_LOCAL_DEMO_AUTH === 'true';
  if (!localDemoAuthEnabled) return { ok: false as const, session: defaultSession };

  const normalizedUser = user.trim().toLowerCase();
  const normalizedPassword = password.trim();
  const entry = Object.entries(STAFF_CREDENTIALS).find(([, value]) => value.username.toLowerCase() === normalizedUser && value.password === normalizedPassword);
  if (!entry) return { ok: false as const, session: defaultSession };
  const [role, value] = entry as [StaffRole, (typeof STAFF_CREDENTIALS)[StaffRole]];
  const category = value.category ?? 'all';
  const session: StaffSession = {
    isAuthenticated: true,
    role,
    category,
    categoryScope: category === 'all' ? 'ALL' : category,
    accessLevel: 'full',
    platformRole: category === 'all' ? 'admin' : 'category_admin',
    displayName: value.display,
    authProvider: 'local_demo',
  };
  setStaffSession(session);
  return { ok: true as const, session };
};

export const logoutStaff = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STAFF_AUTH_KEY);
  }
};

export const getAllowedCategory = (session: StaffSession): ClubCategory | 'all' => session.categoryScope === 'ALL' || session.role === 'master' ? 'all' : session.category;
export const isMasterRole = (session: StaffSession) => session.categoryScope === 'ALL' || session.role === 'master' || session.platformRole === 'admin';
