import {describe,it} from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from './auth.js';

function fixture() {
  const values=new Map(), calls=[];
  const storage={
    getItem: k=>values.get(k) || null, setItem: (k,v)=>values.set(k,v), removeItem:k=>values.delete(k)
  };
  let fail=null, clock=3600;
  const fetch=async (url,req)=>{
    const path=new URL(url).pathname+new URL(url).search;
    calls.push({path,body:JSON.parse(req.body),...req, parsed:JSON.parse(req.body)});
    if(fail) return Response.json({message:'Geweigerd'},{status:fail});
    if(path.includes('verify')||path.includes('/token?')) return Response.json({
      access_token:'access',refresh_token:'refresh',expires_in:clock
    });
    return Response.json({ok:true});
  };
  return {api:createClient({SUPABASE_URL:'https://demo.invalid',SUPABASE_KEY:'public'},{storage,fetch}),
    values,calls, fail:status=>fail=status, expiry:n=>clock=n};
}
describe('Supabase verzoeken (lokaal nagebootst)',()=>{
  it('vraagt een code aan zonder accountregistratie',async()=>{
    const f=fixture(); await f.api.sendCode('  user@example.test ');
    assert.deepEqual(f.calls[0].parsed,{email:'user@example.test',create_user:false});
    assert.equal(f.calls[0].headers.Authorization,undefined); assert.equal(f.api.loggedIn(),false);
  });
  it('negeert een ongeldige code en bewaart geen sessie',async()=>{
    const f=fixture(); f.fail(403);
    await assert.rejects(f.api.verifyCode('user@example.test','123456')); assert.equal(f.api.loggedIn(),false);
  });
  it('gebruikt de Auth-sessie voor opslaan en lezen',async()=>{
    const f=fixture(); await f.api.verifyCode('user@example.test','123456');
    await f.api.state(); await f.api.act('submit',{id:'s1',pause:30});
    assert.equal(f.calls[1].headers.Authorization,'Bearer access');
    assert.deepEqual(f.calls[2].parsed,{action:'submit',payload:{id:'s1',pause:30}});
  });
  it('ververst bij twee gelijktijdige verzoeken eenmaal',async()=>{
    const f=fixture(); f.expiry(1); await f.api.loginPassword('user@example.test','fake-password'); f.expiry(3600);
    await Promise.all([f.api.state(),f.api.state()]);
    assert.equal(f.calls.filter(c=>c.path.includes('grant_type=refresh_token')).length,1);
  });
  it('wist ongeldige refresh-token maar behoudt sessie bij tijdelijke storing',async()=>{
    const f=fixture(); f.expiry(1); await f.api.verifyCode('a@b.test','000000');
    f.fail(503); await assert.rejects(f.api.state()); assert.equal(f.api.loggedIn(),true);
    f.fail(400); await assert.rejects(f.api.state()); assert.equal(f.api.loggedIn(),false);
  });
  it('wist apparaat ook als afmelden op de server tijdelijk mislukt',async()=>{
    const f=fixture(); await f.api.verifyCode('a@b.test','000000'); f.fail(503);
    await assert.rejects(f.api.logout()); assert.equal(f.api.loggedIn(),false);
    await assert.rejects(f.api.state(),/Log opnieuw in/);
  });
  it('gebruikt onderscheiden verificatietypes voor uitnodiging en wachtwoordherstel',async()=>{
    const f=fixture(); await f.api.verifyInvitation('a@b.test','000000'); await f.api.verifyRecovery('a@b.test','000000');
    await f.api.setPassword('fake-new-password');
    assert.equal(f.calls[0].parsed.type,'invite'); assert.equal(f.calls[1].parsed.type,'recovery');
    assert.equal(f.calls[2].method,'PUT'); assert.equal(f.calls[2].headers.Authorization,'Bearer access');
  });
});
