import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// ui.js laadt bij het starten de iconen met fetch; in Node lezen we het bestand zelf.
globalThis.fetch=async url=>({json:async()=>JSON.parse(fs.readFileSync(new URL(url),'utf8'))});
const {pilotRoster}=await import('../v2/pilot.js');
const {pauseFor,pauseQuestion,absentMinutes}=await import('../v2/model.js');
const {dialogs}=await import('../v2/dialogs.js');

const chosen=html=>[...html.matchAll(/class="primary" data-act="pause" data-id="([^"]*)"/g)].map(m=>m[1]);

test('Pauzeregel: tot en met 3 uur geen pauze, daarboven 15 minuten, vanaf 6 uur 30 minuten',()=>{
 assert.equal(pauseFor(180),0,'3:00');
 assert.equal(pauseFor(195),15,'3:15');
 assert.equal(pauseFor(345),15,'5:45');
 assert.equal(pauseFor(360),30,'6:00');
 assert.equal(pauseFor(570),30,'9:30');
});

test('Ziek of verlof volgt dezelfde pauzeregel: 08:30–14:30 telt 5u 30m, 4 uur telt 3u 45m',()=>{
 assert.equal(absentMinutes({start:'08:30',end:'14:30'}),330);
 assert.equal(absentMinutes({start:'11:00',end:'15:00'}),225);
 assert.equal(absentMinutes({start:'14:00',end:'17:00'}),180);
});

test('Minder dan 30 minuten pauze bij 6 uur of meer: de app vraagt of het klopt',()=>{
 assert.equal(pauseQuestion('08:30','14:30',15),
  'Let op: officieel heb je recht op 30 min pauze. Klopt het dat je maar 15 min pauze hebt gehad?');
 assert.equal(pauseQuestion('08:30','18:00',0),
  'Let op: officieel heb je recht op 30 min pauze. Klopt het dat je geen pauze hebt gehad?');
 assert.equal(pauseQuestion('08:30','14:30',30),'');
 assert.equal(pauseQuestion('08:30','14:15',15),'','korter dan 6 uur: geen vraag');
});

test('Uren invullen: de pauze staat vooraf volgens de regel en volgt de tijden zolang je hem niet zelf kiest',t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-23T12:00:00+01:00')});
 const db=pilotRoster(),elise=db.people.find(p=>p.id==='elise');
 const body=dialogs.entry(db,elise,'elise-2026-11-19').body;
 assert.deepEqual(chosen(body),['30'],'08:30–18:00');
 assert.match(body,/name="pause" value="30" data-auto="1"/);
 const mieke={...db.shifts.find(s=>s.id==='mieke-2026-11-18'),id:'kort',user:'elise',start:'11:00',end:'15:00'};
 db.shifts.push(mieke);
 assert.deepEqual(chosen(dialogs.entry(db,elise,'kort').body),['15'],'11:00–15:00');
 const unplanned=dialogs.unplanned(db,elise).body;
 assert.match(unplanned,/name="pause" value="0" data-auto="1"/,'nog geen tijden: volgt zodra je ze kiest');
 assert.match(unplanned,/id="pausecheck" hidden/);
});
