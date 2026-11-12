import test, {beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {demoAct,demoState,selectDemo,resetDemo,demoAccounts} from '../demo.js';

function memory() {
  const store=new Map();
  return {setItem:(k,v)=>store.set(k,String(v)),getItem:k=>store.get(k)??null,removeItem:k=>store.delete(k)};
}
globalThis.localStorage=memory();
globalThis.sessionStorage=memory();
beforeEach(()=>{resetDemo();});
const act=demoAct;
const me=()=>demoState();
const row=id=>me().shifts.find(s=>s.id===id);
const ownOpen=()=>me().shifts.filter(s=>!s.entry && s.kind==='shift').sort((a,b)=>a.date.localeCompare(b.date))[0];
const attempt=(id,start,end,pause,version=0)=>({id,start,end,pause,version});
async function newRow(id,date,start,end,user='mila') {
  await act('extra',{id,date,start,end,user});
}
test('seed, actor views, role selection and storage isolation',()=>{
  assert.equal(me().me,'mila');
  assert.ok(me().shifts.every(s=>s.user==='mila'));
  assert.equal(demoAccounts().length,5);
  const old=structuredClone(me());
  const boss=selectDemo('noor');
  assert.ok(boss.shifts.length>old.shifts.length);
  assert.ok(boss.people.length===5);
  assert.throws(()=>selectDemo('missing'));
  sessionStorage.setItem('other','untouched');
  localStorage.setItem('live-session','untouched');
  resetDemo();
  assert.equal(localStorage.getItem('live-session'),'untouched');
  assert.equal(sessionStorage.getItem('other'),'untouched');
});
test('T03/04 and T14: submission, approval, correction, return, audit and stale version',async()=>{
  const s=ownOpen(),p=attempt(s.id,'09:00','18:00',30);
  await act('submit',p);
  assert.equal(row(s.id).entry.net,510);
  selectDemo('noor');await act('plan',{shifts:[{id:'working-lead',date:s.date,user:'bram',start:'09:00',end:'12:00'}]});
  selectDemo('bram');
  await act('approve',{id:s.id,version:1});
  selectDemo('mila');
  assert.equal(row(s.id).entry.status,'approved');
  await assert.rejects(act('submit',attempt(s.id,'09:15','17:45',30,2)),/goedgekeurd/);
  selectDemo('bram');
  await assert.rejects(act('return',{id:s.id,version:2,reason:'Controle'}));
  selectDemo('noor');
  await act('return',{id:s.id,version:2,reason:'Controleer je pauze'});
  selectDemo('mila');
  assert.equal(row(s.id).entry.reason,'Controleer je pauze');
  await act('submit',attempt(s.id,'09:00','17:45',15,3));
  assert.equal(row(s.id).entry.net,510);
  const events=await act('history',{id:s.id});
  assert.deepEqual(events.map(e=>e.action),['submit','approve','return','submit']);
});
test('T05/06/18: pause, invalid times, DST and future',async()=>{
  const {id}=ownOpen();
  for(const invalid of [30,31,-1,2.5,'',null]) {
    await assert.rejects(act('submit',attempt(id,'12:00','12:30',invalid)));
    assert.equal(row(id).entry,null);
  }
  await act('submit',attempt(id,'12:00','12:30',0));
  assert.equal(row(id).entry.net,30);
  await act('submit',attempt(id,'12:00','12:30',29,1));
  assert.equal(row(id).entry.net,1);
  for(const [a,b] of [['12:00','12:00'],['12:00','10:30'],['23:00','00:30']])
    await assert.rejects(act('submit',attempt(id,a,b,0,2)));
  await newRow('later','2098-05-18','09:00','12:00');
  await assert.rejects(act('submit',attempt('later','09:00','12:00',0)),/toekomst/);
  for(const date of ['2025-03-30','2025-10-26'])
    await assert.rejects(newRow('dst'+date,date,'02:10','04:00'),/klokverzet/);
  await newRow('clock','2025-03-30','01:30','03:30');
  await act('submit',attempt('clock','01:30','03:30',0));
  assert.equal(row('clock').entry.net,60);
});
test('T07/08: two adjacent entries, overlap and replay',async()=>{
  const date='2024-03-01';
  for(const [id,start,end] of [['a','08:00','10:00'],['b','10:00','12:00']])
    await newRow(id,date,start,end);
  const p={...attempt('a','08:00','10:00',0),requestId:'sample'};
  await Promise.all([act('submit',p),act('submit',p)]);
  assert.equal((await act('history',{id:'a'})).filter(e=>e.action==='submit').length,1);
  await act('submit',attempt('b','10:00','12:00',0));
  await assert.rejects(newRow('c',date,'09:00','11:00'),/overlappende/);
  await assert.rejects(act('submit',{...p,pause:4}),/verzoeknummer/);
});
test('T02/11/12/13/19: tamper, role assignment and atomic import',async()=>{
  const s=ownOpen(), original=me();
  await assert.rejects(act('submit',{...attempt(s.id,'09:00','17:00',0),net:1000}));
  await assert.rejects(act('approve',{id:s.id,version:0}));
  await assert.rejects(act('profile',{user:'mila',role:'admin'}));
  await assert.rejects(act('history',{id:s.id.replace('mila','sam')}));
  assert.deepEqual(me(),original);
  selectDemo('noor');
  const planned={id:'row',date:'2024-01-02',user:'mila',kind:'shift',start:'10:00'};
  await assert.rejects(act('plan',{shifts:[planned,{...planned,id:'bad',user:'nobody'}]}));
  assert.equal(row('row'),undefined);
  await act('plan',{shifts:[planned]});
  await act('plan',{shifts:[planned]});
  assert.equal(row('row').end,'18:00');
  assert.equal((await act('history',{id:'row'})).length,1);
  await assert.rejects(act('lead',{date:s.date,user:'noor'}));
  selectDemo('bram');
  assert.equal(row(s.id),undefined);
  await assert.rejects(act('approve',{id:s.id,version:0}));
  selectDemo('noor');
  await assert.rejects(act('profile',{user:'noor',role:'employee'}));
  await act('profile',{user:'mila',active:false});
  assert.throws(()=>selectDemo('mila'));
});
test('T16/17: monthly norm, history and month locking',async()=>{
  selectDemo('noor');
  await act('norm',{month:'2024-03',user:'bram',norm:9600,paid:480,reason:'Contract gecontroleerd'});
  assert.deepEqual(me().norms['2024-03:bram'],{norm:9600,paid:480,reason:'Contract gecontroleerd'});
  await newRow('open','2024-03-01','08:00','10:00','bram');
  await assert.rejects(act('close',{month:'2024-03'}));
  await act('close',{month:'2024-03',reason:'Geregistreerde uitzondering'});
  assert.ok(me().closed.includes('2024-03'));
  await assert.rejects(act('norm',{month:'2024-03',user:'bram',norm:0,paid:0}));
  await assert.rejects(act('reopen',{month:'2024-03'}));
  await act('reopen',{month:'2024-03',reason:'Correctie nodig'});
  await act('cancel',{id:'open',reason:'Vervallen'});
  await act('close',{month:'2024-03'});
  assert.equal(me().periodVersions['2024-03'],2);
});
test('T09/24/25: standby, office, change of worker and protection of submitted hours',async()=>{
  selectDemo('noor');
  const s=me().shifts.find(s=>s.user==='inez'&&s.kind==='standby');
  assert.equal(s.deadline,'11:00');
  await act('call',{id:s.id,start:'13:00',end:'17:00'});
  assert.equal(row(s.id).start,'13:00');
  assert.equal(row(s.id).kind,'shift');
  await assert.rejects(act('swap',{id:s.id,user:'sam'}),/overlap/);
  await act('invite',{name:'Invaller',role:'employee',contract:'zero'});
  const replacement=me().people.find(p=>p.name==='Invaller');
  await act('swap',{id:s.id,user:replacement.id});
  assert.equal(row(s.id).user,replacement.id);
  const office=me().shifts.find(s=>s.area==='Kantoor');
  assert.equal(office.kind,'shift');
  const existing=me().shifts.find(s=>s.entry);
  await act('swap',{id:existing.id,user:'bram'});
  assert.equal(row(existing.id).user,existing.user);
  assert.deepEqual(row(existing.id).entry,existing.entry);
  assert.ok(me().shifts.some(s=>s.user==='bram'&&s.date===existing.date&&!s.entry));
  await assert.rejects(act('cancel',{id:existing.id}));
  await act('invite',{name:'Test Persoon',contract:'zero',role:'employee'});
  assert.ok(demoAccounts().some(p=>p.name==='Test Persoon'));
});
test('T15: twee goedgekeurde diensten tellen 14u15, open dienst telt niet mee',async()=>{
 const times=[['eerste','2025-11-04','18:00',30],['tweede','2025-11-05','15:00',15],['open','2025-11-06','17:00',0]];
 for(const [id,date,end,pause] of times){await newRow(id,date,'09:00',end);await act('submit',attempt(id,'09:00',end,pause));}
 selectDemo('noor');
 for(const id of ['eerste','tweede'])await act('approve',{id,version:1});
 const entries=me().shifts.filter(s=>times.some(([id])=>id===s.id));
 assert.equal(entries.filter(s=>s.entry.status==='approved').reduce((n,s)=>n+s.entry.net,0),855);
 assert.equal(entries.filter(s=>s.entry.status==='pending').length,1);
});

test('Extra dienst atomair indienen, terugsturen, berichten en herstel',async()=>{
 await newRow('old','2025-02-01','09:00','13:00');
 await assert.rejects(act('extra',{id:'overlap',date:'2025-02-01',start:'10:00',end:'12:00',pause:0}),/overlappende/);
 await act('extra',{id:'extra-feedback',date:'2025-02-01',start:'15:00',end:'18:00',pause:15});
 assert.equal(row('extra-feedback').entry.status,'pending');
 assert.equal(row('extra-feedback').entry.net,165);
 selectDemo('noor');
 await act('return',{id:'extra-feedback',version:1,reason:'Controleer pauze'});
 selectDemo('mila');
 assert.ok(me().notifications.some(n=>n.action==='return'&&n.text==='Controleer pauze'));
 await act('message',{id:'extra-feedback',message:'Ik had 15 minuten pauze.'});
 selectDemo('noor');
 assert.ok(me().notifications.some(n=>n.action==='message'));
 await act('restore',{id:'old',reason:'herstel'}).then(()=>assert.fail(),()=>{});
 await act('cancel',{id:'old',reason:'Vervallen wegens ruil'});
 selectDemo('mila');
 assert.ok(me().notifications.some(n=>n.action==='cancel'));
 await act('message',{id:'old',message:'Ik heb wel gewerkt.'});
 selectDemo('noor');
 await act('restore',{id:'old',reason:'Dienst teruggezet'});
 assert.equal(row('old').kind,'shift');
});

test('Vrijmelding, voorstel en gesplitste diensten',async()=>{
  selectDemo('noor');
  const base={date:'2025-04-08',user:'mila'};
  const plan=(id,start,end,kind='shift')=>act('plan',{shifts:[{...base,id,start,end,kind}]});
  await plan('vrij','','','off');
  await assert.rejects(plan('nieuw','09:00','12:00'),/vrij gevraagd/);
  await act('offer',{id:'vrij',start:'10:00',end:'12:00',message:'Kun je invallen?'});
  selectDemo('mila');
  const proposal=(await act('history',{id:'vrij'})).at(-1).after.offer;
  await act('acceptOffer',{id:'vrij',token:proposal.token});
  assert.equal(row(proposal.token).start,'10:00');
  await assert.rejects(act('acceptOffer',{id:'vrij',token:proposal.token}));
  selectDemo('noor');
  await assert.rejects(plan('middag','14:00','18:00'),/vrij gevraagd/);
  base.date='2025-04-09';
  await plan('ochtend','09:00','11:00');
  await assert.rejects(plan('overlap','10:00','14:00'),/overlap/);
  await plan('middag','13:00','17:00');
  await plan('middag','11:00','15:00');
  selectDemo('mila');
  assert.ok(me().notifications.some(e=>e.id==='middag'&&e.action==='plan'));
});

test('Tegenvoorstel plant alleen het toegestane tijdvak na akkoord',async()=>{
  selectDemo('noor');
  const off=me().shifts.find(s=>s.kind==='off'&&s.user==='mila');
  const id=off.id;
  for(const decision of ['rejectCounter','approveCounter']){
    await act('offer',{id,start:'09:00',end:'11:00'});
    selectDemo('mila');
    const original=me().offers[id].offer.token;
    await act('counterOffer',{id,token:original,start:'16:00',end:'18:00'});
    await assert.rejects(act('acceptOffer',{id,token:original}));
    const token=me().offers[id].offer.token;
    assert.ok(!row(token));
    await assert.rejects(act('approveCounter',{id,token}));
    selectDemo('noor');
    await act(decision,{id,token,reason:'Alleen in de ochtend hulp nodig'});
    assert.equal(Boolean(row(token)),decision==='approveCounter');
    if(row(token))assert.deepEqual([row(token).start,row(token).end],['16:00','18:00']);
    await assert.rejects(act(decision,{id,token,reason:'Opnieuw'}));
  }
});

test('Import vervalt eenmaal met vaste reden',async()=>{
 selectDemo('noor');
 await act('plan',{shifts:[{id:'excel:test',user:'mila',date:'2025-03-01',start:'10:00',end:'12:00'}]});
 await act('plan',{shifts:[],cancelIds:['excel:test']});
 const events=(await act('history',{id:'excel:test'})).filter(e=>e.action==='cancel');
 assert.equal(events.length,1);
 assert.equal(events[0].after.reason,'Verdwenen uit rooster-import');
});
test('Stand-by is geblokkeerd op een vrije dag',async()=>{
 selectDemo('noor');
 const off=me().shifts.find(s=>s.kind==='off');
 await assert.rejects(act('plan',{shifts:[{id:'standby-conflict',user:off.user,date:off.date,kind:'standby'}]}),/vrij gevraagd/);
});

test('Bedrijfsleider keurt eigen uren afzonderlijk goed',async()=>{
  selectDemo('noor');
  await act('extra',{id:'eigen',user:'noor',date:'2025-05-02',start:'12:00',end:'14:00',pause:0});
  await assert.rejects(act('approveExact',{id:'eigen',version:1}));
  await act('approve',{id:'eigen',version:1});
  assert.equal((await act('history',{id:'eigen'})).at(-1).action,'selfApprove');
});
test('Groepsgoedkeuring controleert diensttijden en versie bij opslaan',async()=>{
  selectDemo('mila');
  await act('extra',{id:'apart',date:'2025-05-03',start:'09:00',end:'13:00',pause:0});
  await act('submit',attempt('apart','09:15','13:00',0,1));
  selectDemo('noor');
  await assert.rejects(act('approveExact',{id:'apart',version:2}));
  selectDemo('mila');
  await act('submit',attempt('apart','09:00','13:00',0,2));
  selectDemo('noor');
  await assert.rejects(act('approveExact',{id:'apart',version:2}));
  await act('approveExact',{id:'apart',version:3});
  assert.equal(row('apart').entry.status,'approved');
});

test('Vrij aanvragen vanaf 21 dagen en bewust bestaande dienst afhandelen',async()=>{
 const day=new Date();day.setUTCDate(day.getUTCDate()+24);const date=day.toISOString().slice(0,10);
 await assert.rejects(act('leaveRequest',{date:'2020-01-01'}),/21 dagen/);
 await act('leaveRequest',{date});const id=me().leave[0].id;
 selectDemo('noor');
 await act('plan',{shifts:[{id:'future',date,user:'mila',start:'09:00',end:'12:00'}]});
 await assert.rejects(act('leaveApprove',{id}),/dienst/);
 await act('cancel',{id:'future',reason:'Vrijaanvraag besproken'});
 await act('leaveApprove',{id});
 selectDemo('mila');
 assert.equal(me().leave[0].status,'approved');
 assert.equal(row(id).kind,'off');
});
