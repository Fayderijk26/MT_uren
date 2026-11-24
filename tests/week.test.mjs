import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// ui.js laadt bij het starten de iconen met fetch; in Node lezen we het bestand zelf.
globalThis.fetch=async url=>({json:async()=>JSON.parse(fs.readFileSync(new URL(url),'utf8'))});
const {pilotRoster}=await import('../v2/pilot.js');
const {weekPage}=await import('../v2/week.js');
const {areaChoice}=await import('../v2/view.js');

test('Teamrooster: op een telefoon een dagweergave met vorige en volgende dag, op groot scherm het weekraster',()=>{
 const html=weekPage(pilotRoster(),{day:'2026-11-19'});
 const day=html.split('<div class="dayview">')[1];
 assert.ok(day,'er is een dagweergave');
 assert.match(day,/data-act="week" data-id="2026-11-18" aria-label="Vorige dag">‹</);
 assert.match(day,/data-act="week" data-id="2026-11-20" aria-label="Volgende dag">›</);
 assert.match(html,/data-act="week" data-id="2026-11-09" aria-label="Vorige week">‹</);
 assert.match(html,/<div class="calendar-navigation"[^>]*>[\s\S]*?>Vandaag</);
 assert.match(day,/do 19 nov/);
 assert.equal(day.split('<div class="dayrow">').length-1,6,'een regel per medewerker');
 assert.match(day,/Iris Z[\s\S]*10:00–18:00/);
 assert.match(html,/<div class="weekview">[\s\S]*<table class="weekgrid">/);
});

const {apply}=await import('../v2/model.js');
test('Een concept buiten de beschikbaarheid toont dat eronder; geen knop Vorige week kopiëren meer',t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-19T12:00:00+01:00')});
 const db=apply(pilotRoster(),'eva','draft',{user:'iris',date:'2026-12-03',start:'08:30',end:'18:00'});
 const html=weekPage(db,{day:'2026-12-03'}).split('<div class="weekview">')[1];
 assert.match(html,/Concept<\/small><small class="conflict">Let op: Beschikbaar 10:00–18:00<\/small>/);
 assert.doesNotMatch(html,/copyWeek|Vorige week kopiëren/);
});

test('Teamrooster heeft voor de bedrijfsleider de knop Concept uit vaste beschikbaarheid',t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-19T12:00:00+01:00')});
 const html=weekPage(pilotRoster(),{day:'2026-12-03'});
 assert.match(html,/data-act="planFromRules" data-id="2026-11-30">Concept uit vaste beschikbaarheid</);
 assert.doesNotMatch(weekPage(pilotRoster(),{day:'2026-12-03'},true),/planFromRules/);
});

test('Een keukendienst krijgt een K in het rooster, een vloerdienst niet',t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-19T12:00:00+01:00')});
 const html=weekPage(pilotRoster(),{day:'2026-11-19'});
 const cellOf=id=>html.split('data-id="'+id+'"')[1].split('</button>')[0];
 assert.match(cellOf('elise-2026-11-19'),/<b class="area-k" title="Keuken">K<\/b>/);
 assert.doesNotMatch(cellOf('iris-2026-11-19'),/area-k/);
});

test('Werkplek kiezen: geen keuze bij één werkplek, twee knoppen bij vloer en keuken',()=>{
 const db=pilotRoster();
 assert.equal(areaChoice(db,'isis'),'');
 const both=areaChoice(db,'iris','Keuken');
 assert.match(both,/value="Vloer"/);
 assert.match(both,/value="Keuken" checked/);
});

test('Concept uit vaste beschikbaarheid alleen bij een week die nog niet begonnen en niet gepubliceerd is',t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-19T12:00:00+01:00')});
 assert.doesNotMatch(weekPage(pilotRoster(),{day:'2026-11-19'}),/planFromRules/,'huidige week');
 assert.doesNotMatch(weekPage(pilotRoster(),{day:'2026-11-25'}),/planFromRules/,'volgende week, al gepubliceerd');
 const db=apply(pilotRoster(),'eva','draft',{user:'isis',date:'2026-12-05',start:'08:30',end:'18:00'});
 const published=apply(db,'eva','publish',{weekly:'Fijne week.',date:'2026-12-05',through:'2026-12-05',confirm:true});
 assert.doesNotMatch(weekPage(published,{day:'2026-12-03'}),/planFromRules/,'één dag gepubliceerd');
});

test('Ook op de telefoon alleen Week publiceren, geen Dag publiceren',t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-19T12:00:00+01:00')});
 const db=apply(pilotRoster(),'eva','draft',{user:'eva',date:'2026-12-03',start:'08:30',end:'18:00'});
 const html=weekPage(db,{day:'2026-12-02'});
 const day=html.split('<div class="dayview">')[1].split('<div class="weekview">')[0];
 assert.match(day,/data-act="pubWeek" data-id="2026-11-30">Week publiceren</);
 assert.doesNotMatch(html,/pubDay|Dag publiceren/);
 assert.doesNotMatch(weekPage(db,{day:'2026-12-02',single:true}),/pubDay/);
});
