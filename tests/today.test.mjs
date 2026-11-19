import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// ui.js laadt bij het starten de iconen met fetch; in Node lezen we het bestand zelf.
globalThis.fetch=async url=>({json:async()=>JSON.parse(fs.readFileSync(new URL(url),'utf8'))});
const {pilotRoster}=await import('../v2/pilot.js');
const {apply}=await import('../v2/model.js');
const {todayPage}=await import('../v2/today.js');

const reviewCard=html=>html.split('<h2>Uren goedkeuren</h2>')[1].split('</section>')[0];

test('Sylvia vult haar uren van dinsdag in: Eva ziet ze op Vandaag bij Uren goedkeuren',()=>{
 const db=apply(pilotRoster(),'sylvia','hours',{id:'sylvia-2026-11-17',start:'08:30',end:'18:00',pause:30});
 const eva=db.people.find(p=>p.id==='eva');
 const card=reviewCard(todayPage(db,eva));
 assert.match(card,/Sylvia · di 17 nov/);
 assert.match(card,/Elise B · ma 16 nov/);
 assert.doesNotMatch(card,/Geen uren te beoordelen/);
});
