import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// ui.js laadt bij het starten de iconen met fetch; in Node lezen we het bestand zelf.
globalThis.fetch=async url=>({json:async()=>JSON.parse(fs.readFileSync(new URL(url),'utf8'))});
const {pilotRoster}=await import('../v2/pilot.js');
const {apply,monthSummary}=await import('../v2/model.js');
const {todayPage}=await import('../v2/today.js');
const {dialogs}=await import('../v2/dialogs.js');

// Donderdag 19 november, 12:00. Elise werkt vandaag 08:30–18:00 en zaterdag 10:00–18:00. Iris is vandaag dagleiding.
const thursday=t=>t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-19T12:00:00+01:00')});
const person=(db,id)=>db.people.find(p=>p.id===id);
const saturday='elise-2026-11-21';
const elise=db=>monthSummary(db,'2026-11').find(r=>r.user==='elise');

test('Elise kan zich niet zelf ziek melden, ook niet vooruit: ze belt de leiding',t=>{
 thursday(t);
 const db=pilotRoster();
 assert.throws(()=>apply(db,'elise','sick',{id:saturday}),/Ziek melden doet de leiding\. Bel de leidinggevende van de dag\./);
 assert.doesNotMatch(dialogs.ownShift(db,person(db,'elise'),saturday).body,/data-act="sickAsk"/);
 assert.doesNotMatch(todayPage(db,person(db,'elise')),/data-act="sickAsk"/);
});

test('Iris is leidinggevende en meldt zichzelf ziek voor haar dienst van vandaag',t=>{
 thursday(t);
 const db=apply(pilotRoster(),'iris','sick',{id:'iris-2026-11-19'});
 assert.equal(db.shifts.find(s=>s.id==='iris-2026-11-19').sick.by,'iris');
});

test('Iris meldt Elise ziek: het telt nog niet mee en Elise ziet Wacht op besluit',t=>{
 thursday(t);
 const db=apply(pilotRoster(),'iris','sick',{id:saturday});
 assert.equal(elise(db).sick,0);
 assert.equal(elise(db).sickWaiting,450);
 const body=dialogs.ownShift(db,person(db,'elise'),saturday).body;
 assert.match(body,/Ziek gemeld<\/span> door Iris Z op do 19 nov · wacht op besluit/);
});

test('Eva kiest Doorbetalen: de ziekte-uren tellen mee en Elise ziet dat',t=>{
 thursday(t);
 let db=apply(pilotRoster(),'iris','sick',{id:saturday});
 db=apply(db,'eva','sickDecide',{id:saturday,paid:true});
 assert.equal(elise(db).sick,450);
 assert.equal(elise(db).sickWaiting,0);
 assert.match(dialogs.ownShift(db,person(db,'elise'),saturday).body,/door Iris Z op do 19 nov · telt 7u 30m/);
});

test('Eva kiest Wachtdag: de dienst telt niet mee en Elise ziet dat',t=>{
 thursday(t);
 let db=apply(pilotRoster(),'iris','sick',{id:saturday});
 db=apply(db,'eva','sickDecide',{id:saturday,paid:false});
 assert.equal(elise(db).sick,0);
 assert.equal(elise(db).sickWaiting,0);
 assert.match(dialogs.ownShift(db,person(db,'elise'),saturday).body,/· telt niet mee \(wachtdag\)/);
});

test('Alleen de bedrijfsleider beslist, en niet in een afgesloten maand',t=>{
 thursday(t);
 let db=apply(pilotRoster(),'iris','sick',{id:'elise-2026-11-19'});
 db=apply(db,'eva','approve',{id:'elise-2026-11-16'});
 assert.throws(()=>apply(db,'iris','sickDecide',{id:'elise-2026-11-19',paid:true}),/Alleen de bedrijfsleider/);
 assert.throws(()=>apply(db,'eva','sickDecide',{id:'eva-2026-11-19',paid:true}),/niet ziek gemeld/);
 t.mock.timers.setTime(Date.parse('2026-12-02T12:00:00+01:00'));
 db=apply(db,'eva','closeMonth',{month:'2026-11',confirm:true});
 assert.throws(()=>apply(db,'eva','sickDecide',{id:'elise-2026-11-19',paid:true}),/afgesloten/);
});

test('Eva ziet op Vandaag welke ziekmeldingen een besluit nodig hebben, met Doorbetalen en Wachtdag',t=>{
 thursday(t);
 let db=apply(pilotRoster(),'iris','sick',{id:saturday});
 const card=todayPage(db,person(db,'eva')).split('<h2>Ziek: besluit nodig (1)')[1]?.split('</section>')[0]||'';
 assert.match(card,/Elise B · za 21 nov/);
 assert.match(card,/data-act="sickPaid" data-id="elise-2026-11-21">Doorbetalen</);
 assert.match(card,/data-act="sickUnpaid" data-id="elise-2026-11-21">Wachtdag</);
 assert.doesNotMatch(todayPage(db,person(db,'iris')),/besluit nodig/,'de dagleiding beslist niet');
 db=apply(db,'eva','sickDecide',{id:saturday,paid:true});
 assert.doesNotMatch(todayPage(db,person(db,'eva')),/besluit nodig/);
});
