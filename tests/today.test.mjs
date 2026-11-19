import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// ui.js laadt bij het starten de iconen met fetch; in Node lezen we het bestand zelf.
globalThis.fetch=async url=>({json:async()=>JSON.parse(fs.readFileSync(new URL(url),'utf8'))});
const {pilotRoster}=await import('../v2/pilot.js');
const {apply}=await import('../v2/model.js');
const {todayPage}=await import('../v2/today.js');

const reviewCard=html=>html.split('<h2>Uren goedkeuren')[1].split('</section>')[0];

test('Sylvia vult haar uren van dinsdag in: Eva ziet ze op Vandaag bij Uren goedkeuren',()=>{
 const db=apply(pilotRoster(),'sylvia','hours',{id:'sylvia-2026-11-17',start:'08:30',end:'18:00',pause:30});
 const eva=db.people.find(p=>p.id==='eva');
 const card=reviewCard(todayPage(db,eva));
 assert.match(card,/Sylvia · di 17 nov/);
 assert.match(card,/Elise B · ma 16 nov/);
 assert.doesNotMatch(card,/Geen uren te beoordelen/);
});

test('Vandaag is voor iedere rol gelijk opgebouwd: eerst mijn dienst, dan wat ik moet doen, dan de rest',t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-19T12:00:00+01:00')});
 const db=pilotRoster();
 for(const id of ['eva','iris','elise']){
  const html=todayPage(db,db.people.find(p=>p.id===id));
  const at=title=>html.indexOf('<h2>'+title);
  assert.ok(at('Mijn dienst vandaag')>0,id+' ziet eerst de eigen dienst');
  for(const later of ['Nog in te vullen','Uren goedkeuren','Uren ontbreken','Wie werkt er vandaag?'])
   if(at(later)>0)assert.ok(at('Mijn dienst vandaag')<at(later),id+': '+later+' staat onder de eigen dienst');
  if(at('Wie werkt er vandaag?')>0)for(const before of ['Nog in te vullen','Uren goedkeuren','Uren ontbreken'])
   if(at(before)>0)assert.ok(at(before)<at('Wie werkt er vandaag?'),id+': '+before+' staat boven Wie werkt er vandaag?');
 }
});
