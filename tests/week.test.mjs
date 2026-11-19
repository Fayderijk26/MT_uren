import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// ui.js laadt bij het starten de iconen met fetch; in Node lezen we het bestand zelf.
globalThis.fetch=async url=>({json:async()=>JSON.parse(fs.readFileSync(new URL(url),'utf8'))});
const {pilotRoster}=await import('../v2/pilot.js');
const {weekPage}=await import('../v2/week.js');

test('Teamrooster: op een telefoon een dagweergave met vorige en volgende dag, op groot scherm het weekraster',()=>{
 const html=weekPage(pilotRoster(),{day:'2026-11-19'});
 const day=html.split('<div class="dayview">')[1];
 assert.ok(day,'er is een dagweergave');
 assert.match(day,/data-act="week" data-id="2026-11-18">Vorige dag</);
 assert.match(day,/data-act="week" data-id="2026-11-20">Volgende dag</);
 assert.match(day,/do 19 nov/);
 assert.equal(day.split('<div class="dayrow">').length-1,5,'een regel per medewerker');
 assert.match(day,/Iris Z[\s\S]*10:00–18:00/);
 assert.match(html,/<div class="weekview">[\s\S]*<table class="weekgrid">/);
});

const {apply}=await import('../v2/model.js');
test('Gekopieerd concept dat botst met een vrije dag toont dat eronder; knop Vorige week kopiëren staat erbij',t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-19T12:00:00+01:00')});
 let db=apply(pilotRoster(),'elise','leave',{date:'2026-12-03',reason:'Bruiloft'});
 db=apply(db,'eva','decide',{id:db.requests.at(-1).id,accept:true});
 const empty=weekPage(db,{day:'2026-12-03'});
 assert.match(empty,/data-act="copyWeek" data-id="2026-11-30">Vorige week kopiëren</);
 db=apply(db,'eva','copyWeek',{week:'2026-11-30'});
 const html=weekPage(db,{day:'2026-12-03'}).split('<div class="weekview">')[1];
 assert.match(html,/Concept<\/small><small class="conflict">Let op: Vrij gevraagd<\/small>/);
 assert.doesNotMatch(weekPage(db,{day:'2026-12-03'},true),/copyWeek/,'niet in het alleen-lezen rooster');
});

test('Teamrooster heeft voor de bedrijfsleider de knop Concept uit vaste beschikbaarheid',t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-19T12:00:00+01:00')});
 const html=weekPage(pilotRoster(),{day:'2026-12-03'});
 assert.match(html,/data-act="planFromRules" data-id="2026-11-30">Concept uit vaste beschikbaarheid</);
 assert.doesNotMatch(weekPage(pilotRoster(),{day:'2026-12-03'},true),/planFromRules/);
});
