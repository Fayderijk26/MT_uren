import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// ui.js laadt bij het starten de iconen met fetch; in Node lezen we het bestand zelf.
globalThis.fetch=async url=>({json:async()=>JSON.parse(fs.readFileSync(new URL(url),'utf8'))});
const {pilotRoster}=await import('../v2/pilot.js');
const {apply,sickMinutes,missing,ownTodo,monthSummary,leads,mayReview}=await import('../v2/model.js');
const {todayPage}=await import('../v2/today.js');
const {weekPage}=await import('../v2/week.js');

// Donderdag 19 november, 12:00. Elise werkt vandaag 08:30–18:00 en zaterdag 10:00–18:00. Iris is vandaag dagleiding.
const thursday=t=>t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-19T12:00:00+01:00')});
const person=(db,id)=>db.people.find(p=>p.id===id);
const saturday='elise-2026-11-21';

test('Ziek telt de geplande tijd; langer dan 3 uur gaat er 30 minuten pauze af',()=>{
 assert.equal(sickMinutes({start:'08:30',end:'15:00'}),360);
 assert.equal(sickMinutes({start:'10:00',end:'18:00'}),450);
 assert.equal(sickMinutes({start:'14:00',end:'17:00'}),180);
 assert.equal(sickMinutes({start:'14:00',end:'17:15'}),165);
});

test('Elise meldt zich ziek voor zaterdag: niet bij Nog in te vullen of ontbrekend, wel 7u 30m ziek',t=>{
 thursday(t);
 let db=apply(pilotRoster(),'elise','sick',{id:saturday});
 assert.deepEqual(db.shifts.find(s=>s.id===saturday).sick.by,'elise');
 t.mock.timers.setTime(Date.parse('2026-11-23T12:00:00+01:00'));
 assert.ok(!ownTodo(db,person(db,'elise')).some(s=>s.id===saturday));
 assert.ok(!missing(db,person(db,'eva')).some(m=>m.shift.id===saturday));
 const row=monthSummary(db,'2026-11').find(r=>r.user==='elise');
 assert.equal(row.sick,450);
 assert.ok(!row.open.some(o=>o.shift.id===saturday));
});

test('Elise is al aan het werk: zelf ziek melden kan niet meer, Iris als dagleiding en Eva wel',t=>{
 thursday(t);
 const db=pilotRoster(),today='elise-2026-11-19';
 assert.throws(()=>apply(db,'elise','sick',{id:today}),/al begonnen/);
 assert.ok(apply(db,'iris','sick',{id:today}).shifts.find(s=>s.id===today).sick);
 assert.ok(apply(db,'eva','sick',{id:today}).shifts.find(s=>s.id===today).sick);
});

test('Sylvia is vandaag geen dagleiding en Isis is medewerker: zij kunnen Elise niet ziek melden',t=>{
 thursday(t);
 const db=pilotRoster();
 for(const id of ['sylvia','isis'])assert.throws(()=>apply(db,id,'sick',{id:'elise-2026-11-19'}),/niet ziek melden/);
});

test('Iris meldt Elise ziek: Elise ziet een melding op Vandaag en de dienst als Ziek gemeld',t=>{
 thursday(t);
 const db=apply(pilotRoster(),'iris','sick',{id:'elise-2026-11-19'});
 const html=todayPage(db,person(db,'elise'));
 assert.match(html,/Ziek gemeld door Iris Z/);
 const mine=html.split('<h2>Mijn dienst vandaag')[1].split('</section>')[0];
 assert.match(mine,/chip-off">Ziek gemeld/);
 assert.doesNotMatch(mine,/data-act="entry"/);
});

test('Eva en Iris zien op Vandaag wie zich ziek heeft gemeld, en het rooster toont Ziek gemeld',t=>{
 thursday(t);
 const db=apply(pilotRoster(),'elise','sick',{id:saturday});
 for(const id of ['eva','iris'])
  assert.match(todayPage(db,person(db,id)).split('<h2>Ziek gemeld')[1]||'',/Elise B · za 21 nov/,id);
 assert.doesNotMatch(todayPage(db,person(db,'isis')),/<h2>Ziek gemeld/);
 assert.match(weekPage(db,{day:'2026-11-21'}),/10:00–18:00<\/b>(?:(?!<\/button>).)*Ziek gemeld/s);
});

test('Voor een ziek gemelde dienst kun je geen uren indienen en het rooster niet wijzigen',t=>{
 thursday(t);
 const db=apply(pilotRoster(),'eva','sick',{id:'elise-2026-11-19'});
 assert.throws(()=>apply(db,'elise','hours',{id:'elise-2026-11-19',start:'08:30',end:'11:00',pause:0}),/ziek gemeld/);
 const s=db.shifts.find(x=>x.id===saturday);
 const sat=apply(db,'elise','sick',{id:saturday});
 assert.throws(()=>apply(sat,'eva','draft',{...s,id:saturday,end:'17:00'}),/ziek gemeld/);
});

test('Niet ziek melden bij stand-by, ingediende uren of als de dienst al ziek gemeld is',t=>{
 thursday(t);
 const db=pilotRoster();
 assert.throws(()=>apply(db,'eva','sick',{id:'elise-2026-11-16'}),/al uren/);
 const twice=apply(db,'elise','sick',{id:saturday});
 assert.throws(()=>apply(twice,'eva','sick',{id:saturday}),/al ziek gemeld/);
 db.shifts.find(s=>s.id===saturday).deadline='09:00';
 assert.throws(()=>apply(db,'eva','sick',{id:saturday}),/stand-by/);
});

test('Ziekmelding intrekken: door wie het meldde of de bedrijfsleider, daarna ontbreken de uren weer',t=>{
 thursday(t);
 let db=apply(pilotRoster(),'iris','sick',{id:'elise-2026-11-19'});
 assert.throws(()=>apply(db,'elise','sickUndo',{id:'elise-2026-11-19'}),/Alleen/);
 assert.ok(!apply(db,'iris','sickUndo',{id:'elise-2026-11-19'}).shifts.find(s=>s.id==='elise-2026-11-19').sick);
 db=apply(db,'eva','sickUndo',{id:'elise-2026-11-19'});
 t.mock.timers.setTime(Date.parse('2026-11-20T12:00:00+01:00'));
 assert.ok(missing(db,person(db,'eva')).some(m=>m.shift.id==='elise-2026-11-19'));
});

test('Iris is ziek gemeld: die dag is zij geen dagleiding en keurt ze geen uren goed',t=>{
 thursday(t);
 const db=apply(pilotRoster(),'eva','sick',{id:'iris-2026-11-19'});
 assert.ok(!leads(db,'2026-11-19').includes('iris'));
 assert.ok(!mayReview(db,person(db,'iris'),db.shifts.find(s=>s.id==='elise-2026-11-19')));
});

test('In een afgesloten maand kan niemand ziek melden of een ziekmelding intrekken',t=>{
 thursday(t);
 let db=apply(pilotRoster(),'eva','sick',{id:'elise-2026-11-19'});
 t.mock.timers.setTime(Date.parse('2026-12-02T12:00:00+01:00'));
 db=apply(db,'eva','closeMonth',{month:'2026-11',confirm:true});
 assert.throws(()=>apply(db,'eva','sick',{id:'iris-2026-11-19'}),/afgesloten/);
 assert.throws(()=>apply(db,'eva','sickUndo',{id:'elise-2026-11-19'}),/afgesloten/);
});
