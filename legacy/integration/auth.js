// Supabase Auth and PostgREST only. Every permission check runs again on the server.
export function createClient(config, options = {}) {
  const base = (config.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = config.SUPABASE_KEY || '';
  const configured = Boolean(base && key);
  const net = options.fetch || globalThis.fetch;
  const storage = options.storage || globalThis.localStorage;
  const slot = 'mt.auth.v1:' + base;
  const lock = options.locks || globalThis.navigator?.locks;
  let refreshInProgress;

  function session() {
    try { return JSON.parse(storage.getItem(slot)); }
    catch { return null; }
  }
  function keep(body) {
    if (!body.access_token || !body.refresh_token) throw new Error('Aanmelden is niet gelukt.');
    const record = {
      access_token: body.access_token,
      refresh_token: body.refresh_token,
      expires_at: body.expires_at || Math.floor(Date.now()/1000) + body.expires_in
    };
    storage.setItem(slot, JSON.stringify(record));
  }
  async function request(path, body, token, method = 'POST') {
    if (!configured) throw new Error('Deze omgeving heeft nog geen Supabase-verbinding.');
    const headers = { apikey: key, 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const response = await net(base + path, {
      method, headers, body: JSON.stringify(body), cache: 'no-store', referrerPolicy: 'no-referrer'
    });
    const raw = await response.text();
    let data;
    try { data = raw ? JSON.parse(raw) : null; }
    catch { data = null; }
    if (!response.ok) {
      const error = new Error(data?.message || data?.msg || data?.error_description || 'Het verzoek is mislukt. Probeer het opnieuw.');
      error.status = response.status;
      throw error;
    }
    return data;
  }
  async function token() {
    const current = session();
    if (!current) throw new Error('Log opnieuw in.');
    if (current.expires_at * 1000 > Date.now() + 30000) return current.access_token;
    async function refresh() {
      const before = session();
      if (!before) throw new Error('Log opnieuw in.');
      if (before.expires_at * 1000 > Date.now() + 30000) return before.access_token;
      try {
        const body = await request('/auth/v1/token?grant_type=refresh_token', { refresh_token: before.refresh_token });
        if (session()?.refresh_token !== before.refresh_token) throw new Error('De aangemelde gebruiker is gewijzigd.');
        keep(body);
        return body.access_token;
      } catch (err) {
        if ((err.status === 400 || err.status === 401 || err.status === 403) && session()?.refresh_token === before.refresh_token) storage.removeItem(slot);
        throw err;
      }
    }
    refreshInProgress ||= (lock ? lock.request(slot, refresh) : refresh()).finally(() => { refreshInProgress = null; });
    return refreshInProgress;
  }
  async function verify(email, code, type) {
    const data = await request('/auth/v1/verify', { email: email.trim(), token: code.trim(), type });
    keep(data);
  }
  return {
    configured,
    loggedIn: () => Boolean(session()?.access_token),
    sendCode: email => request('/auth/v1/otp', { email: email.trim(), create_user: false }),
    verifyCode: (email, code) => verify(email, code, 'email'),
    verifyInvitation: (email, code) => verify(email, code, 'invite'),
    verifyRecovery: (email, code) => verify(email, code, 'recovery'),
    loginPassword: async (email, password) => keep(await request('/auth/v1/token?grant_type=password', { email: email.trim(), password })),
    recover: email => request('/auth/v1/recover', { email: email.trim() }),
    setPassword: async password => request('/auth/v1/user', {password}, await token(), 'PUT'),
    state: async () => request('/rest/v1/rpc/mt_state', {}, await token()),
    act: async (action, payload) => request('/rest/v1/rpc/mt_act', { action, payload }, await token()),
    invite: async ({email,name}) => request('/functions/v1/invite', { email, name }, await token()),
    async logout() {
      const previous = session();
      storage.removeItem(slot);
      if (previous?.access_token) await request('/auth/v1/logout?scope=local', {}, previous.access_token);
    }
  };
}
