import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// ui.js laadt bij het starten de iconen met fetch; in Node lezen we het bestand zelf.
globalThis.fetch=async url=>({json:async()=>JSON.parse(fs.readFileSync(new URL(url),'utf8'))});
const {pilotRoster}=await import('../v2/pilot.js');
const {apply,ownTodo,missing,mayRemind,monthSummary}=await import('../v2/model.js');
const {hoursPage}=await import('../v2/hours.js');
const {dialogs}=await import('../v2/dialogs.js');

const at=(t,iso)=>t.mock.timers.enable({apis:['Date'],now:new Date(iso)});
const person=(db,id)=>db.people.find(p=>p.id===id);
const hours={id:'sylvia-2026-11-17',start:'08:30',end:'18:00',pause:30};
// De uren van Elise op 16 november wachten nog op beoordeling; Eva keurt ze goed.
const reviewed=()=>apply(pilotRoster(),'eva','approve',{id:'elise-2026-11-16'});
// Een dienst op maandag 30 november, de laatste dag van de maand.
function lastDayShift(db){
 db.shifts.push({id:'elise-2026-11-30',date:'2026-11-30',user:'elise',start:'08:30',end:'17:30',area:'Keuken'});
 return db;
}

test('Sylvia vult haar uren in tot en met 30 november 23:59; op 1 december is de maand voor haar dicht',t=>{
 at(t,'2026-11-30T23:50:00+01:00');
 assert.ok(apply(pilotRoster(),'sylvia','hours',hours));
 t.mock.timers.setTime(Date.parse('2026-12-01T00:05:00+01:00'));
 const late=/De maand is voorbij\. Vraag de bedrijfsleider om je uren in te vullen\./;
 assert.throws(()=>apply(pilotRoster(),'sylvia','hours',hours),late);
 assert.throws(()=>apply(pilotRoster(),'isis','unplanned',
  {date:'2026-11-28',start:'09:00',end:'12:00',pause:0,area:'Keuken'}),late);
});

test('Na de maand staat 17 november niet meer bij Nog in te vullen, maar als Niet ingevuld bij Diensten',t=>{
 at(t,'2026-12-01T09:00:00+01:00');
 const db=pilotRoster(),sylvia=person(db,'sylvia');
 assert.ok(!ownTodo(db,sylvia).some(s=>s.id==='sylvia-2026-11-17'));
 const page=hoursPage(db,sylvia,{page:'hours',month:'2026-11'});
 assert.match(page,/di 17 nov<\/b><small>08:30–18:00 · telt niet mee<\/small><div class="chips"><span class="chip chip-bad">Niet ingevuld/);
 assert.match(page,/diensten niet ingevuld · tellen niet mee/);
 assert.doesNotMatch(page,/vul ze in bij Diensten/);
});

test('Na de maand vult alleen de bedrijfsleider nog uren in; die zijn meteen goedgekeurd',t=>{
 at(t,'2026-11-25T12:00:00+01:00');
 assert.throws(()=>apply(pilotRoster(),'eva','hours',hours),/na de laatste dag van de maand/);
 t.mock.timers.setTime(Date.parse('2026-12-01T09:00:00+01:00'));
 assert.throws(()=>apply(pilotRoster(),'iris','hours',hours),/Alleen de bedrijfsleider/);
 const db=apply(pilotRoster(),'eva','hours',hours);
 assert.equal(db.hours['sylvia-2026-11-17'].status,'approved');
 assert.equal(db.hours['sylvia-2026-11-17'].approvedBy,'eva');
 assert.equal(monthSummary(db,'2026-11').find(r=>r.user==='sylvia').approved,540);
});

test('Ontbreekt na de maand: geen Herinner meer, de dagleiding ziet het niet, Eva krijgt Uren invullen',t=>{
 at(t,'2026-12-01T09:00:00+01:00');
 const db=pilotRoster(),s=db.shifts.find(x=>x.id==='sylvia-2026-11-17');
 assert.ok(!mayRemind(db,person(db,'eva'),s));
 assert.ok(!missing(db,person(db,'iris')).some(m=>m.shift.date<'2026-12-01'));
 const eva=hoursPage(db,person(db,'eva'),{page:'reviews',month:'2026-11'}).split('<h2>Ontbreekt')[1];
 assert.match(eva,/data-act="fillPick" data-id="sylvia">Uren invullen</,'meer dagen: één knop');
 assert.match(dialogs.fillPick(db,person(db,'eva'),'sylvia').body,
  /di 17 nov<\/b><small>08:30–18:00[\s\S]*?data-act="entry" data-id="sylvia-2026-11-17">Uren invullen</);
 assert.doesNotMatch(eva,/wa\.me/);
 assert.match(dialogs.entry(db,person(db,'eva'),'sylvia-2026-11-17').title,/Uren invullen/);
});

test('Afsluiten kan niet zolang er uren wachten op beoordeling',t=>{
 at(t,'2026-12-01T09:00:00+01:00');
 const wait=/Er wachten nog uren op beoordeling bij: Elise B\. Keur ze eerst goed of laat ze goedkeuren\./;
 assert.throws(()=>apply(pilotRoster(),'eva','closeMonth',{month:'2026-11',confirm:true}),wait);
 assert.ok(apply(reviewed(),'eva','closeMonth',{month:'2026-11',confirm:true}));
});

test('Afsluiten kan vanaf de laatste dag; dan vult Eva eerst de uren van die dag in',t=>{
 at(t,'2026-11-29T12:00:00+01:00');
 assert.throws(()=>apply(reviewed(),'eva','closeMonth',{month:'2026-11',confirm:true}),/laatste dag van de maand/);
 t.mock.timers.setTime(Date.parse('2026-11-30T12:00:00+01:00'));
 let db=lastDayShift(reviewed());
 assert.throws(()=>apply(db,'eva','closeMonth',{month:'2026-11',confirm:true}),
  /Vandaag staan nog mensen ingepland zonder uren: Elise B\. Vul hun uren eerst in\./);
 db=apply(db,'eva','hours',{id:'elise-2026-11-30',start:'08:30',end:'17:30',pause:30});
 assert.equal(db.hours['elise-2026-11-30'].status,'approved','de tijd ligt nog in de toekomst, maar Eva mag dat');
 assert.ok(apply(db,'eva','closeMonth',{month:'2026-11',confirm:true}));
});

test('Lege diensten mogen open blijven bij het afsluiten: eerst bevestigen, ze tellen niet mee',t=>{
 at(t,'2026-12-01T09:00:00+01:00');
 assert.throws(()=>apply(reviewed(),'eva','closeMonth',{month:'2026-11'}),
  /Niet ingevuld bij: .*Sylvia.*Deze diensten tellen niet mee\. Bevestig om af te sluiten\./);
});
