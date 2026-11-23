import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// ui.js laadt bij het starten de iconen met fetch; in Node lezen we het bestand zelf.
globalThis.fetch=async url=>({json:async()=>JSON.parse(fs.readFileSync(new URL(url),'utf8'))});
const {pilotRoster}=await import('../v2/pilot.js');
const {apply,missing,ownTodo,monthSummary,leads,mayReview,badges,tracksHours}=await import('../v2/model.js');
const {todayPage}=await import('../v2/today.js');
const {hoursPage}=await import('../v2/hours.js');
const {peoplePage}=await import('../v2/people.js');
const {availabilityPage}=await import('../v2/availability.js');

// Mieke is leidinggevende zonder urenregistratie. Ze werkt woensdag 11:00–17:00 en zondag 11:00–16:00.
// Maandag 23 november, 12:00: haar diensten van woensdag 18 en zondag 22 november zijn voorbij.
const monday=t=>t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-23T12:00:00+01:00')});
const person=(db,id)=>db.people.find(p=>p.id===id);

test('Mieke staat in het rooster op woensdag 11:00–17:00 en zondag 11:00–16:00',()=>{
 const db=pilotRoster(),mieke=person(db,'mieke');
 assert.deepEqual([mieke.role,mieke.tracksHours],['lead',false]);
 assert.ok(!tracksHours(db,'mieke'));
 assert.ok(tracksHours(db,'elise'),'wie niets is ingesteld, houdt gewoon uren bij');
 const shifts=db.shifts.filter(s=>s.user==='mieke').map(s=>s.date+' '+s.start+'-'+s.end);
 assert.deepEqual(shifts,['2026-11-18 11:00-17:00','2026-11-22 11:00-16:00',
  '2026-11-25 11:00-17:00','2026-11-29 11:00-16:00']);
});

test('Miekes diensten zijn voorbij: niet bij Ontbreekt, niet bij Nog in te vullen en geen bolletje',t=>{
 monday(t);
 const db=pilotRoster(),mieke=person(db,'mieke');
 assert.ok(!missing(db,person(db,'eva')).some(m=>m.shift.user==='mieke'));
 assert.deepEqual(ownTodo(db,mieke),[]);
 assert.equal(badges(db,mieke).mine,0);
 assert.doesNotMatch(todayPage(db,mieke),/Uren invullen|Nog in te vullen/);
});

test('Mieke kan geen uren of ongeplande dienst indienen',t=>{
 monday(t);
 const db=pilotRoster();
 const hours={id:'mieke-2026-11-18',start:'11:00',end:'17:00',pause:30};
 assert.throws(()=>apply(db,'mieke','hours',hours),/geen uren bijgehouden/);
 const extra={date:'2026-11-20',start:'11:00',end:'15:00',pause:0,area:'Vloer'};
 assert.throws(()=>apply(db,'mieke','unplanned',extra),/geen uren bijgehouden/);
});

test('Mieke is woensdag dagleiding en keurt de uren van Sylvia goed',t=>{
 monday(t);
 let db=pilotRoster();
 assert.ok(leads(db,'2026-11-18').includes('mieke'));
 const s=db.shifts.find(x=>x.id==='sylvia-2026-11-18');
 assert.ok(mayReview(db,person(db,'mieke'),s));
 db=apply(db,'sylvia','hours',{id:s.id,start:'08:30',end:'18:00',pause:30});
 db=apply(db,'mieke','approve',{id:s.id});
 assert.equal(db.hours[s.id].status,'approved');
});

test('Mieke staat niet in het maandoverzicht en telt niet mee bij het afsluiten',t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-12-02T12:00:00+01:00')});
 const db=pilotRoster();
 assert.ok(!monthSummary(db,'2026-11').some(r=>r.user==='mieke'));
});

test('Bij Uren ziet Mieke alleen Uren goedkeuren, geen kaart Mijn uren',t=>{
 monday(t);
 const db=pilotRoster(),html=hoursPage(db,person(db,'mieke'),{page:'hours',month:'2026-11'});
 assert.doesNotMatch(html,/Mijn uren/);
 assert.match(html,/<h2>Uren goedkeuren/);
});

test('Mieke kan zich niet ziek melden of vrij vragen in de app',t=>{
 monday(t);
 const db=pilotRoster();
 assert.throws(()=>apply(db,'mieke','sick',{id:'mieke-2026-11-25'}),/geen uren bijgehouden/);
 assert.throws(()=>apply(db,'eva','sick',{id:'mieke-2026-11-25'}),/geen uren bijgehouden/);
 assert.throws(()=>apply(db,'mieke','leave',{date:'2026-12-24'}),/geen uren bijgehouden/);
 assert.doesNotMatch(availabilityPage(db,person(db,'mieke'),{page:'availability'}),/data-act="leave"/);
});

test('De bedrijfsleider zet Uren bijhouden op nee; in de lijst staat Geen uren',()=>{
 const base={name:'Noor V',role:'admin',contract:'vast',contractHours:'0',phone:'',areas:['Vloer']};
 let db=apply(pilotRoster(),'eva','savePerson',{...base,tracksHours:false});
 assert.equal(db.people.at(-1).tracksHours,false);
 assert.match(peoplePage(db,person(db,'eva')),/Noor V(?:(?!<\/article>).)*Geen uren/s);
 db=apply(pilotRoster(),'eva','savePerson',base);
 assert.equal(db.people.at(-1).tracksHours,true);
});
