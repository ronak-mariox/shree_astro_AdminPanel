/**
 * Who is signed into the panel.
 *
 * The tokens are also set as httpOnly cookies by the API, which is what a
 * browser would normally use. They are kept here as well so the panel can send
 * an `Authorization` header, which works whether or not the API is on the same
 * origin — and so a page can read the signed-in admin's name and permissions
 * without asking the server again.
 *
 * `sessionStorage`, not `localStorage`: closing the tab ends the session, which
 * is the right default for a console that can move money.
 */

const KEY = 'shreeastro.admin.session';

let session = read();
const listeners = new Set();

function read() {
  try {
    const stored = sessionStorage.getItem(KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function write(next) {
  session = next;

  try {
    if (next) {
      sessionStorage.setItem(KEY, JSON.stringify(next));
    } else {
      sessionStorage.removeItem(KEY);
    }
  } catch {
    /** Private browsing can refuse storage; the session still works in memory. */
  }

  for (const listener of listeners) {
    listener(next);
  }
}

/**
 * Subscribes to sign-in and sign-out. Returns the unsubscribe function.
 *
 * This is how the shell reacts to a session it did not itself end — a refresh
 * token the API refuses takes the admin back to the sign-in screen from
 * wherever they were.
 */
export function onSessionChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getSession = () => session;
export const getAdmin = () => session?.admin ?? null;
export const getAccessToken = () => session?.accessToken ?? null;
export const getRefreshToken = () => session?.refreshToken ?? null;
export const isSignedIn = () => session !== null;

/** Whether the signed-in admin holds a permission — the panel's own gate. */
export const can = (permission) =>
  Boolean(session?.admin?.permissions?.includes(permission));

/** Records a new session, after a successful sign-in. */
export function saveSession({ accessToken, refreshToken, admin }) {
  write({ accessToken, refreshToken, admin });
}

/** Replaces just the tokens, after a silent refresh. */
export function setTokens({ accessToken, refreshToken }) {
  if (session) {
    write({ ...session, accessToken, refreshToken });
  }
}

export function clearSession() {
  write(null);
}
