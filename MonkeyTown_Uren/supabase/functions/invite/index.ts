import { apiHeaders, json, setting } from '../_shared/http.ts';

Deno.serve(async (req: Request) => {
  const siteURL = setting('MT_SITE_URL');
  const origin = req.headers.get('origin');
  if (origin && origin !== new URL(siteURL).origin) return json({message:'Onbekende website.'},403);
  const cors = {
    'Access-Control-Allow-Origin': new URL(siteURL).origin,
    'Access-Control-Allow-Headers':'authorization, apikey, content-type',
    'Access-Control-Allow-Methods':'POST, OPTIONS', Vary:'Origin'
  };
  const reply = (message: string, status: number) => json({message}, status, cors);
  if (req.method === 'OPTIONS') return new Response(null, {status:204, headers:cors});
  if (req.method !== 'POST') return reply('Gebruik POST.',405);
  const bearer = req.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if (!bearer) return reply('Log in.',401);
  try {
    const base = setting('SUPABASE_URL');
    const headers = apiHeaders(setting('SUPABASE_ANON_KEY'),bearer);
    const state = await fetch(base+'/rest/v1/rpc/mt_state',{method:'POST',headers,body:'{}'});
    if (!state.ok) return reply('Geen toegang.',403);
    const {me,people} = await state.json();
    if (!people.some((p: {id:string,role:string,active?:boolean}) => p.id===me && p.role==='admin' && p.active!==false)) return reply('Alleen de bedrijfsleider kan uitnodigen.',403);
    const {email,name} = await req.json();
    if (typeof email!=='string' || email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
        typeof name!=='string' || !name.trim() || name.length>100) return reply('Vul een geldige naam en een e-mailadres in.',400);
    const url = new URL(base+'/auth/v1/invite');
    url.searchParams.set('redirect_to',siteURL);
    const invited = await fetch(url,{method:'POST',headers:apiHeaders(setting('SUPABASE_SERVICE_ROLE_KEY')),
      body:JSON.stringify({email:email.trim(),data:{display_name:name.trim()}})});
    return invited.ok ? reply('Uitnodiging verzonden.',200) : reply('Uitnodigen mislukt. Controleer of het account al bestaat en of de maildienst beschikbaar is.',422);
  } catch { return reply('Uitnodigen is tijdelijk niet beschikbaar.',503); }
});
