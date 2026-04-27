import { ClubCategory, StaffRole } from './types';

export const STAFF_AUTH_KEY = 'orsomarso_staff_auth_v2';

export const STAFF_CREDENTIALS: Record<StaffRole, { username: string; password: string; category?: ClubCategory; display: string }> = {
  sub15: { username: 'UsuarioSub15', password: 'OrsoS15!2026', category: 'Sub15', display: 'U15' },
  sub17: { username: 'UsuarioSub17', password: 'OrsoS17!2026', category: 'Sub17', display: 'U17' },
  sub20: { username: 'UsuarioSub20', password: 'OrsoS20!2026', category: 'Sub20', display: 'U20' },
  master: { username: 'UsuarioMaestro', password: 'OrsoMaster!2026', display: 'Maestro' },
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
  const entry = Object.entries(STAFF_CREDENTIALS).find(([, value]) => value.username === user && value.password === password);
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
