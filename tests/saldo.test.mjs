import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// ui.js laadt bij het starten de iconen met fetch; in Node lezen we het bestand zelf.
globalThis.fetch=async url=>({json:async()=>JSON.parse(fs.readFileSync(new URL(url),'utf8'))});
const {pilotRoster}=await import('../v2/pilot.js');
const {apply,monthSummary,saldo}=await import('../v2/model.js');
const {hoursPage}=await import('../v2/hours.js');
const {monthPage}=await import('../v2/month.js');
const {dialogs}=await import('../v2/dialogs.js');

const at=(t,iso)=>t.mock.timers.enable({apis:['Date'],now:new Date(iso)});
const person=(db,id)=>db.people.find(p=>p.id===id);
const row=(db,user,month='2026-11')=>monthSummary(db,month).find(r=>r.user===user);
// Elise heeft een vast contract van 24 uur: norm november 104u. Uren van 16 november (9u) wachten op Eva.
function november(t){
 at(t,'2026-11-26T12:00:00+01:00');
 let db=apply(pilotRoster(),'eva','approve',{id:'elise-2026-11-16'});
 db=apply(db,'eva','sick',{id:'elise-2026-11-19'});
 db=apply(db,'eva','sickDecide',{id:'elise-2026-11-19',paid:true});
 for(const s of db.shifts.filter(s=>s.date.startsWith('2026-11')&&s.sick&&s.sick.paid===undefined))
  db=apply(db,'eva','sickDecide',{id:s.id,paid:false});
 return db;
}
const close=(t,db)=>{t.mock.timers.setTime(Date.parse('2026-12-01T09:00:00+01:00'));
 return apply(db,'eva','closeMonth',{month:'2026-11',confirm:true})};

test('Verschil van de maand: goedgekeurd plus ziek (doorbetaald) plus verlof, min de norm',t=>{
 const db=november(t),r=row(db,'elise');
 assert.equal(r.approved,540);
 assert.equal(r.sick,540);
 assert.equal(r.norm,104*60);
 assert.equal(r.diff,540+540+r.leave-104*60);
});

test('Contract Uren heeft geen verschil en geen saldo',t=>{
 const db=november(t);
 assert.equal(row(db,'isis').diff,null);
 assert.equal(saldo(db,'isis'),null);
});

test('Het saldo telt de afgesloten maanden: na afsluiten gaat het verschil van november mee',t=>{
 let db=november(t);
 assert.equal(saldo(db,'elise'),0,'november is nog niet afgesloten');
 const diff=row(db,'elise').diff;
 db=close(t,db);
 assert.equal(saldo(db,'elise'),diff);
});

test('Elise ziet bij Mijn uren de norm, het verschil van de maand en haar saldo',t=>{
 let db=november(t);
 const diff=row(db,'elise').diff;
 db=close(t,db);
 const html=hoursPage(db,person(db,'elise'),{page:'hours',month:'2026-11'});
 assert.match(html,/Norm<\/span><b>104u 0m<\/b>/);
 assert.match(html,new RegExp('Verschil<\\/span><b>−'+Math.floor(-diff/60)+'u '+(-diff%60)+'m<\\/b>'));
 assert.match(html,/Saldo plus- en minuren<\/span><b>−/);
 assert.doesNotMatch(hoursPage(db,person(db,'isis'),{page:'hours',month:'2026-11'}),/Saldo/,'contract Uren');
});

test('Eva zet het saldo van Elise op 0 met een reden; dat wordt vastgelegd',t=>{
 let db=close(t,november(t));
 assert.throws(()=>apply(db,'iris','saldoReset',{user:'elise',reason:'uitbetaald'}),/Alleen de bedrijfsleider/);
 assert.throws(()=>apply(db,'eva','saldoReset',{user:'elise',reason:''}),/reden/);
 const before=saldo(db,'elise');
 db=apply(db,'eva','saldoReset',{user:'elise',reason:'Verrekend in december'});
 assert.equal(saldo(db,'elise'),0);
 const c=db.saldoCorrections.at(-1);
 assert.deepEqual([c.user,c.minutes,c.reason,c.by],['elise',-before,'Verrekend in december','eva']);
 assert.throws(()=>apply(db,'eva','saldoReset',{user:'elise',reason:'nog eens'}),/al 0/);
});

test('Maandoverzicht: kolom Saldo; Eva opent het saldo en ziet Saldo op 0 zetten',t=>{
 const db=close(t,november(t)),eva=person(db,'eva');
 const html=monthPage(db,eva,{month:'2026-11'});
 assert.match(html,/<th>Saldo<\/th>/);
 assert.match(html,/data-act="saldo" data-id="elise">−/);
 const d=dialogs.saldo(db,eva,'elise');
 assert.match(d.title,/Saldo Elise B/);
 assert.match(d.body,/data-op="saldoReset"/);
});
