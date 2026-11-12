import {it,after} from 'node:test';
import assert from 'node:assert/strict';
const orig=globalThis.fetch;
const settings={MT_SITE_URL:'https://demo.invalid/app/',SUPABASE_URL:'https://backend.invalid',SUPABASE_ANON_KEY:'test-anon',SUPABASE_SERVICE_ROLE_KEY:'test-server',MT_JOB_SECRET:'test-job',RESEND_API_KEY:'test-mail',MT_MAIL_FROM:'demo@example.test'};
let handler;
globalThis.Deno={env:{get:n=>settings[n]},serve:fn=>handler=fn};
await import('../supabase/functions/invite/index.ts');
const invite=handler;
await import('../supabase/functions/closing-mail/index.ts');
const closing=handler;
after(()=>{globalThis.fetch=orig;delete globalThis.Deno;});
const req=(headers={},body={})=>new Request('https://test.invalid',{method:'POST',headers,body:JSON.stringify(body)});
it('uitnodiging weigert vreemde origin, ontbrekende sessie en medewerker',async()=>{
 let calls=0; globalThis.fetch=async()=>{calls++;return Response.json({me:'u',people:[{id:'u',role:'employee'}]});};
 assert.equal((await invite(req({origin:'https://evil.invalid'}))).status,403);
 assert.equal((await invite(req())).status,401); assert.equal(calls,0);
 assert.equal((await invite(req({authorization:'Bearer dummy'}))).status,403); assert.equal(calls,1);
});
it('uitnodiging gebruikt gebruikersrechten voor autorisatie en kent geen rol uit de aanvraag toe',async()=>{
 let calls=[]; globalThis.fetch=async(url,options)=>{
   calls.push({url:String(url),...options});
   return Response.json(calls.length===1?{me:'u',people:[{id:'u',role:'admin',active:true}]}:{id:'invited'});
 };
 const result=await invite(req({authorization:'Bearer admin-session'}, {name:' Noa ',email:'noa@example.test',role:'admin'}));
 assert.equal(result.status,200);assert.equal(calls[0].headers.Authorization,'Bearer admin-session');
 assert.equal(calls[1].headers.Authorization,'Bearer test-server');
 assert.deepEqual(JSON.parse(calls[1].body),{email:'noa@example.test',data:{display_name:'Noa'}});
});
it('sluitjob weigert anonieme aanroep vóór databaseverkeer',async()=>{
 globalThis.fetch=async()=>assert.fail('Onverwachte databaseaanroep');
 assert.equal((await closing(req())).status,401);
});
it('sluitjob gebruikt hetzelfde verzendkenmerk na mailstoring en verstuurt geen personeelslijst',async()=>{
 const claims=[{day:'2026-11-12',recipient:'supervisor',kind:'closing',lease:'lease1',email:'demo@example.test'},null,
 {day:'2026-11-12',recipient:'supervisor',kind:'closing',lease:'lease2',email:'demo@example.test'},null];
 const mails=[],updates=[];
 globalThis.fetch=async (url,options)=>{
   const body=JSON.parse(options.body);
   if(url.endsWith('/mt_mail_claim'))return Response.json(claims.shift());
   if(url.endsWith('/mt_mail_finish')){updates.push(body);return new Response(null,{status:204});}
   if(url==='https://api.resend.com/emails'){mails.push(options);return Response.json({id:'fake-receipt'},{status:mails.length===1?503:200});}
   throw Error('Onverwacht adres');
 };
 assert.equal((await closing(req({'x-job-secret':'test-job'}))).status,503);
 assert.equal((await closing(req({'x-job-secret':'test-job'}))).status,200);
 assert.equal(mails[0].headers['Idempotency-Key'],mails[1].headers['Idempotency-Key']);
 assert.deepEqual(updates.map(x=>x.delivery_id),[null,'fake-receipt']);
 assert.match(JSON.parse(mails[1].body).text,/Open de app/);
});
