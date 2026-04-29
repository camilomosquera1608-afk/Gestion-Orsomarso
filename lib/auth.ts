import { ClubCategory, StaffRole } from './types';

export const STAFF_AUTH_KEY = 'orsomarso_staff_auth_v2';

/**
 * Local demo access only.
 *
 * These credentials are intentionally non-sensitive placeholders so the app can
 * be tested locally before Supabase Auth is implemented. They must not be used
 * as production security. The production line should replace this local gate
 * with authenticated users, roles and RLS policies in Supabase.
 */
export const STAFF_CREDENTIALS: Record<StaffRole, { username: string; password: string; category?: ClubCategory; display: string }> = {
  sub15: { username: 'Sub15Local', password: 'local-sub15', category: 'Sub15', display: 'U15' },
  sub17: { username: 'Sub17Local', password: 'local-sub17', category: 'Sub17', display: 'U17' },
  sub20: { username: 'Sub20Local', password: 'local-sub20', category: 'Sub20', display: 'U20' },
  master: { username: 'MaestroLocal', password: 'local-maestro', display: 'Maestro' },
};

export type StaffSession = {
  isAuthenticated: boolean;
  role: StaffRole | null;
  category: ClubCategory | 'all';
  displayName: string;
};

const defaultSession: StaffSession = {
  isAuthenticated: false,
  role: null,
  category: 'all',
  displayName: '',
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

export const loginStaff = (user: string, password: string) => {
  const localDemoAuthEnabled = process.env.NEXT_PUBLIC_ENABLE_LOCAL_DEMO_AUTH !== 'false';
  if (!localDemoAuthEnabled) return { ok: false as const, session: defaultSession };

  const normalizedUser = user.trim().toLowerCase();
  const normalizedPassword = password.trim();
  const entry = Object.entries(STAFF_CREDENTIALS).find(([, value]) => value.username.toLowerCase() === normalizedUser && value.password === normalizedPassword);
  if (!entry) return { ok: false as const, session: defaultSession };
  const [role, value] = entry as [StaffRole, (typeof STAFF_CREDENTIALS)[StaffRole]];
  const session: StaffSession = {
    isAuthenticated: true,
    role,
    category: value.category ?? 'all',
    displayName: value.display,
  };
  if (typeof window !== 'undefined') {
    localStorage.setItem(STAFF_AUTH_KEY, JSON.stringify(session));
  }
  return { ok: true as const, session };
};

export const logoutStaff = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STAFF_AUTH_KEY);
  }
};

export const getAllowedCategory = (session: StaffSession): ClubCategory | 'all' => session.role === 'master' ? 'all' : session.category;
export const isMasterRole = (session: StaffSession) => session.role === 'master';
