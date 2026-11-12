export function json(value: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(value), {
    status, headers: { 'Content-Type': 'application/json', 'Cache-Control':'no-store', ...headers }
  });
}

export function setting(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error('Configuratie ontbreekt.');
  return value;
}

export function apiHeaders(key: string, bearer = key) {
  return { 'Content-Type': 'application/json', apikey: key, Authorization: 'Bearer ' + bearer };
}
