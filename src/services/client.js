/**
 * Every request the panel makes goes through here.
 *
 * One place decides where the API lives, attaches the session token, and turns
 * a failure into an error a page can print. Pages only ever see `error.message`,
 * which is always safe to show.
 */

import { clearSession, getAccessToken, getRefreshToken, setTokens } from './session';

/**
 * Where the API lives.
 *
 * `VITE_API_URL` overrides it for a deployed build; in development the panel and
 * the API run on the same machine.
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

/** What a page catches: a message worth showing, and the reason behind it. */
export class ApiError extends Error {
  constructor(message, status, fields, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fields = fields;
    this.code = code;
  }
}

/**
 * The refresh in flight, if any.
 *
 * A page usually loads several things at once, so several requests expire
 * together. They must not each refresh — the first would spend the refresh
 * token and the rest would race behind it. They all await this one promise.
 */
let refreshing = null;

async function refreshTokens() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new ApiError('Please sign in again.', 401, undefined, 'no_refresh_token');
  }

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    throw new ApiError('Your session has expired.', 401, undefined, 'session_expired');
  }

  const data = await response.json();
  setTokens(data);
  return data.accessToken;
}

function refreshOnce() {
  refreshing = refreshing ?? refreshTokens().finally(() => { refreshing = null; });
  return refreshing;
}

/** Turns the query object a page passes into `?a=1&b=2`, dropping empties. */
function queryString(query) {
  if (!query) {
    return '';
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '' && value !== 'all') {
      params.set(key, Array.isArray(value) ? value.join(',') : String(value));
    }
  }

  const text = params.toString();
  return text ? `?${text}` : '';
}

/**
 * One request.
 *
 * A 401 with `code: "token_expired"` is not a sign-out — it means the access
 * token is merely old, so the request is retried once behind a refresh. Any
 * other 401 means the session is dead, and clearing it is what sends the panel
 * back to the sign-in screen.
 */
async function request(method, path, { body, query, auth = true, retried = false } = {}) {
  const headers = {};
  const token = getAccessToken();

  if (auth && token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}${queryString(query)}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    /** No response at all — the API is not running, or the network is down. */
    throw new ApiError('Cannot reach the server. Is the API running?', 0);
  }

  /** 204 and friends carry no body. */
  const data = response.status === 204 ? {} : await response.json().catch(() => ({}));

  if (response.ok) {
    return data;
  }

  if (response.status === 401 && auth) {
    if (data.code === 'token_expired' && !retried && getRefreshToken()) {
      try {
        await refreshOnce();
        return request(method, path, { body, query, auth, retried: true });
      } catch {
        /** The refresh token is spent — fall through to signing out. */
      }
    }
    clearSession();
  }

  throw new ApiError(
    data.error || data.message || 'Something went wrong. Please try again.',
    response.status,
    data.fields,
    data.code,
  );
}

export const api = {
  get: (path, query) => request('GET', path, { query }),
  post: (path, body, options) => request('POST', path, { body, ...options }),
  put: (path, body) => request('PUT', path, { body }),
  patch: (path, body) => request('PATCH', path, { body }),
  delete: (path) => request('DELETE', path, {}),
};
