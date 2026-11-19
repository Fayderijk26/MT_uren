import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// ui.js laadt bij het starten de iconen met fetch; in Node lezen we het bestand zelf.
globalThis.fetch=async url=>({json:async()=>JSON.parse(fs.readFileSync(new URL(url),'utf8'))});
const {pilotRoster}=await import('../v2/pilot.js');
const {hoursPage}=await import('../v2/hours.js');

test('Sylvia mist twee dagen: Eva ziet één regel voor Sylvia en stuurt één herinnering voor beide dagen',t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-19T12:00:00+01:00')});
 const db=pilotRoster(),eva=db.people.find(p=>p.id==='eva');
 const missing=hoursPage(db,eva,{page:'reviews',month:'2026-11'}).split('<h2>Ontbreekt')[1];
 assert.equal(missing.split('<b>Sylvia').length-1,1,'één regel voor Sylvia');
 assert.match(missing,/di 17 nov, wo 18 nov/);
 const text=decodeURIComponent(missing.match(/wa\.me\/\d*\?text=([^"]*)/)[1]);
 assert.equal(text,'Hoi Sylvia, wil je je uren van di 17 nov en wo 18 nov nog invullen?');
});

test('Bij Uren goedkeuren staat bovenaan de knop Alles goedkeuren met het aantal uren volgens rooster',t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-19T12:00:00+01:00')});
 const db=pilotRoster(),eva=db.people.find(p=>p.id==='eva');
 const html=hoursPage(db,eva,{page:'reviews',month:'2026-11'}).split('<h2>Uren goedkeuren')[1];
 assert.match(html,/^<\/h2>[\s\S]*?data-act="approveAll"[^>]*>Alles goedkeuren \(1\)</);
});

test('Bij Gewerkte uren staat de knop Bekijken naast de dienst, zoals Herinner',t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-19T12:00:00+01:00')});
 const db=pilotRoster(),iris=db.people.find(p=>p.id==='iris');
 const html=hoursPage(db,iris,{page:'hours',month:'2026-11'});
 assert.match(html,/<div class="compact"><article class="vrow"><div><b>ma 16 nov[\s\S]*?data-act="entry"/);
});
