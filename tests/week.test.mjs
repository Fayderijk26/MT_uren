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
