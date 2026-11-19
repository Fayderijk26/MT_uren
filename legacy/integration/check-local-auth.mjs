// End-to-end account test for a disposable Supabase CLI stack with Mailpit.
// Run after applying migrations. This creates one fictitious employee per run.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from './auth.js';

const base=process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const mailbox=process.env.MAILPIT_URL || 'http://127.0.0.1:54324';
for (const url of [base,mailbox]) {
  if (!['127.0.0.1','localhost','[::1]'].includes(new URL(url).hostname)) throw Error('Gebruik een lokaal wegwerpproject voor deze accountproef.');
}
const key=process.env.SUPABASE_KEY, admin=process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key || !admin) throw Error('Stel SUPABASE_KEY en SUPABASE_SERVICE_ROLE_KEY in met sleutels uit je lokale CLI.');
const email='mt-auth-'+randomUUID()+'@example.test';
const storageMap=new Map();
const storage={getItem:k=>storageMap.get(k),setItem:(k,v)=>storageMap.set(k,v),removeItem:k=>storageMap.delete(k)};
const api=createClient({SUPABASE_URL:base,SUPABASE_KEY:key},{storage});
const readMail=async (subjectWords)=>{
  for(let attempt=0;attempt<24;attempt++){
    const response=await fetch(mailbox+'/api/v1/search?query='+encodeURIComponent('to:'+email));
    assert.ok(response.ok,'Mailpit is bereikbaar');
    const list=await response.json();
    const row=(list.messages||[]).find(m=>m.Subject?.toLowerCase().includes(subjectWords));
    if(row){
      const msg=await (await fetch(mailbox+'/api/v1/message/'+encodeURIComponent(row.ID))).json();
      const code=(msg.Text || msg.HTML || '').match(/\b(\d{6})\b/)?.[1];
      assert.ok(code,'E-mail bevat een zescijferige code');
      return code;
    }
    await new Promise(r=>setTimeout(r,500));
  }
  throw Error('Lokale testmail ontbreekt: '+subjectWords);
};
const invited=await fetch(base+'/auth/v1/invite',{method:'POST',headers:{
  apikey:admin,Authorization:'Bearer '+admin,'Content-Type':'application/json'
},body:JSON.stringify({email,data:{display_name:'Test Medewerker'}})});
assert.ok(invited.ok,'Fictief account uitgenodigd');
const invitation=await readMail('uitnodiging');
await api.verifyInvitation(email,invitation);
const state=await api.state();
assert.equal(state.people.find(p=>p.id===state.me)?.role,'employee');
await assert.rejects(api.verifyInvitation(email,invitation),'Een gebruikte uitnodiging werkt één keer');
await api.logout();
// Give the configured Auth throttle time to expire between two protection-sensitive e-mails.
const cooldown=()=>new Promise(resolve=>setTimeout(resolve,61000));
await cooldown();
await api.recover(email);
const resetCode=await readMail('herstel');
await api.verifyRecovery(email,resetCode);
const password=randomUUID()+randomUUID();
await api.setPassword(password);
await api.logout();
await assert.rejects(api.verifyRecovery(email,resetCode),'Een gebruikte herstelcode werkt één keer');
await api.loginPassword(email,password);
assert.equal((await api.state()).me,state.me);
await api.logout();
await cooldown();
await api.sendCode(email);
const signInCode=await readMail('inlogcode');
await api.verifyCode(email,signInCode);
assert.equal((await api.state()).me,state.me);
await api.logout();
console.log('Geslaagd: fictieve uitnodiging, mailontvangst, verificatie, herstel, hergebruik geweigerd, wachtwoordlogin, OTP en serverrol.');
