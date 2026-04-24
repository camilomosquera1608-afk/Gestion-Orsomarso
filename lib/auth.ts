export const STAFF_USER = 'Orsomarso';
export const STAFF_PASSWORD = 'Divisiones2026';
export const STAFF_AUTH_KEY = 'orsomarso_staff_auth';

export const isStaffAuthenticated = () => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STAFF_AUTH_KEY) === 'true';
};

export const loginStaff = (user: string, password: string) => {
  const ok = user === STAFF_USER && password === STAFF_PASSWORD;
  if (ok && typeof window !== 'undefined') {
    localStorage.setItem(STAFF_AUTH_KEY, 'true');
  }
  return ok;
};

export const logoutStaff = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STAFF_AUTH_KEY);
  }
};
