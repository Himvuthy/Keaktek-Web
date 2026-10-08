// ============================================================================
// Supabase API shim core.
// Replaces the old Express server: screens keep calling fetch-style endpoints
// ("/lessons", "/users/12/children" ...) and handlers answer them using Supabase.
// This file is IDENTICAL in the web and mobile apps (both have ../supabaseClient).
// ============================================================================
import { supabase } from '../supabaseClient';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Throw helpers ---------------------------------------------------------------
export const fail = (status, message) => { throw new ApiError(status, message); };

/** Turn a supabase-js `{ data, error }` result into data, or throw an ApiError. */
export function unwrap(result, notFoundMessage) {
  const { data, error } = result;
  if (error) {
    // 42501 = RLS / permission denied, PGRST116 = .single() found no rows
    if (error.code === '42501') throw new ApiError(403, 'Access denied.');
    if (error.code === 'PGRST116') throw new ApiError(404, notFoundMessage || 'Not found.');
    if (error.code === '23505') throw new ApiError(409, 'Already exists.');
    throw new ApiError(500, error.message || 'Internal server error.');
  }
  if (notFoundMessage && (data === null || (Array.isArray(data) && data.length === 0))) {
    throw new ApiError(404, notFoundMessage);
  }
  return data;
}

/** Return from a handler to send a non-200 status. */
export const respond = (data, status = 200) => ({ __respond: true, status, data });

// Current user -----------------------------------------------------------------
let cachedMe = null;
let cachedAuthId = null;
supabase.auth.onAuthStateChange((_event, session) => {
  if (!session || session.user.id !== cachedAuthId) { cachedMe = null; cachedAuthId = null; }
});

/**
 * Returns the logged-in user's profile row in the shape the old JWT/login response used:
 * { uid, roleId, roleName, username, email, firstName, lastName, profilePictureURL, xp, birthYear, grade, phoneNumber }
 * Throws 401 if nobody is logged in.
 */
export async function getMe({ force = false } = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new ApiError(401, 'Access denied. No token provided.');
  if (!force && cachedMe && cachedAuthId === session.user.id) return cachedMe;
  const { data, error } = await supabase
    .from('User')
    .select('uid, roleid, username, email, firstname, lastname, bio, profilepictureurl, xp, birth_year, grade, phone_number, role(rolename)')
    .eq('auth_id', session.user.id)
    .maybeSingle();
  if (error) throw new ApiError(500, error.message);
  if (!data) throw new ApiError(401, 'Profile not found for this account.');
  cachedAuthId = session.user.id;
  cachedMe = {
    uid: data.uid,
    roleId: data.roleid,
    roleName: data.role?.rolename,
    username: data.username,
    email: data.email,
    firstName: data.firstname,
    lastName: data.lastname,
    bio: data.bio,
    profilePictureURL: data.profilepictureurl,
    xp: data.xp,
    birthYear: data.birth_year,
    grade: data.grade,
    phoneNumber: data.phone_number,
  };
  return cachedMe;
}

export function clearMeCache() { cachedMe = null; cachedAuthId = null; }

/** Like authorizeRoles(...) in the old server. Returns the user. */
export async function requireRole(...roles) {
  const me = await getMe();
  if (!roles.includes(me.roleName)) {
    throw new ApiError(403, `Access denied. Required role: ${roles.join(' or ')}`);
  }
  return me;
}

// Router -----------------------------------------------------------------------
const routes = [];

/**
 * route('GET', '/users/:uid/children', async ({ params, query, body }) => data)
 * Handlers return the same JSON the Express route returned (same keys & casing).
 * Use respond(data, 201) for non-200 statuses.
 */
export function route(method, pattern, handler) {
  const keys = [];
  const source = pattern.replace(/:([A-Za-z_]+)/g, (_m, k) => { keys.push(k); return '([^/]+)'; });
  routes.push({ method: method.toUpperCase(), re: new RegExp(`^${source}/?$`), keys, handler });
}

function parsePath(rawPath) {
  let p = String(rawPath || '');
  p = p.replace(/^https?:\/\/[^/]+/, ''); // strip origin
  p = p.replace(/^\/api(?=\/|$)/, '');     // strip /api prefix
  const [pathname, qs = ''] = p.split('?');
  const query = {};
  new URLSearchParams(qs).forEach((v, k) => { query[k] = v; });
  return { pathname: pathname || '/', query };
}

/** Core dispatcher. Resolves with data (or throws ApiError). */
export async function dispatch(method, rawPath, body) {
  const { pathname, query } = parsePath(rawPath);
  const m = String(method || 'GET').toUpperCase();
  for (const r of routes) {
    if (r.method !== m) continue;
    const match = r.re.exec(pathname);
    if (!match) continue;
    const params = {};
    r.keys.forEach((k, i) => { params[k] = decodeURIComponent(match[i + 1]); });
    try {
      const out = await r.handler({ params, query, body: body || {} });
      return out && out.__respond ? out : { __respond: true, status: 200, data: out };
    } catch (err) {
      if (err instanceof ApiError) return { __respond: true, status: err.status, data: { error: err.message } };
      console.error(`[api] ${m} ${pathname} failed:`, err);
      return { __respond: true, status: 500, data: { error: err?.message || 'Internal server error.' } };
    }
  }
  return { __respond: true, status: 404, data: { error: `No handler for ${m} ${pathname}` } };
}

/**
 * Drop-in replacement for fetch(url, { method, headers, body }).
 * Returns a Response-like object: { ok, status, json(), text() }.
 * Any Authorization header is ignored; the Supabase session is used instead.
 */
export async function apiFetch(url, init = {}) {
  let body;
  if (init.body !== undefined && init.body !== null) {
    if (typeof init.body === 'string') {
      try { body = JSON.parse(init.body); } catch { body = init.body; }
    } else {
      body = init.body; // FormData or object; handlers decide
    }
  }
  const out = await dispatch(init.method || 'GET', url, body);
  return {
    ok: out.status >= 200 && out.status < 300,
    status: out.status,
    json: async () => out.data,
    text: async () => JSON.stringify(out.data),
  };
}

/** Same as apiFetch but returns data directly and throws Error(.status) on failure (used by mobile). */
export async function request(method, path, body) {
  const out = await dispatch(method, path, body);
  if (out.status < 200 || out.status >= 300) {
    const e = new Error(out.data?.error || `Request failed (${out.status})`);
    e.status = out.status;
    throw e;
  }
  return out.data;
}
