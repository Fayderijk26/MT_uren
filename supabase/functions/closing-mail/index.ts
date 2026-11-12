import { apiHeaders, json, setting } from '../_shared/http.ts';

async function matches(a:string,b:string) {
  const bytes = new TextEncoder();
  const hash = async (s:string) => new Uint8Array(await crypto.subtle.digest('SHA-256',bytes.encode(s)));
  const [x,y] = await Promise.all([hash(a),hash(b)]);
  let mismatch=0;
  for (let i=0;i<x.length;i++) mismatch |= x[i]^y[i];
  return mismatch===0;
}

Deno.serve(async (req:Request) => {
  if (req.method !== 'POST') return json({},405);
  try {
    if (!await matches(req.headers.get('x-job-secret')||'',setting('MT_JOB_SECRET'))) return json({},401);
    const base=setting('SUPABASE_URL'), key=setting('SUPABASE_SERVICE_ROLE_KEY');
    const apiKey=setting('RESEND_API_KEY'), sender=setting('MT_MAIL_FROM'), site=setting('MT_SITE_URL');
    const time=Deno.env.get('MT_CLOSING_TIME') || '18:15';
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Ongeldige tijd.');
    async function rpc(name:string,args:Record<string,unknown>) {
      const result=await fetch(base+'/rest/v1/rpc/'+name,{method:'POST',headers:apiHeaders(key),body:JSON.stringify(args)});
      if (!result.ok) throw new Error('Database niet beschikbaar.');
      const body=await result.text();
      return body ? JSON.parse(body) : null;
    }
    let sent=0,failed=0;
    for (let i=0;i<40;i++) {
      const item=await rpc('mt_mail_claim',{after_time:time});
      if (!item) break;
      const closing=item.kind.startsWith('closing');
      const next=item.kind.endsWith('_next');
      const subject=(next?'Herinnering · ':'')+(closing?'Dagcontrole':'Uren invullen')+' · '+item.day;
      const sections:string[]=[];
      for(const [status,label] of [['missing','Ontbreekt'],['returned','Aanpassen (wacht op medewerker)'],['pending','Ter beoordeling']]){
        const lines=(item.details||[]).filter((r:{status:string})=>r.status===status).map((r:{name:string,start:string,end:string,actualStart:string,actualEnd:string})=>{
          const changed=r.actualStart&&(r.start!==r.actualStart||r.end!==r.actualEnd);
          return r.name+' · '+r.start+'–'+r.end+(changed?' · ingediend '+r.actualStart+'–'+r.actualEnd:'');
        });
        if(lines.length)sections.push(label+'\n'+lines.join('\n'));
      }
      const message=sections.join('\n\n');
      let providerId=null;
      try {
        const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{
          Authorization:'Bearer '+apiKey,'Content-Type':'application/json',
          'Idempotency-Key':['mt',item.day,item.recipient,item.kind].join('-')
        },body:JSON.stringify({from:sender,to:[item.email],subject,text:message+'\n\nOpen de app: '+site})});
        if (response.ok) providerId=(await response.json()).id || null;
      } catch { /* A timeout may follow acceptance. The next attempt reuses the provider key. */ }
      await rpc('mt_mail_finish',{claim_id:item.lease,delivery_id:providerId});
      if (providerId) sent++; else failed++;
    }
    return json({sent,failed}, failed?503:200);
  } catch { return json({message:'Controleer de serverconfiguratie of probeer opnieuw.'},503); }
});
