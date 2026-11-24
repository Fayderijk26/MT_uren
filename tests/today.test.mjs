import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// ui.js laadt bij het starten de iconen met fetch; in Node lezen we het bestand zelf.
globalThis.fetch=async url=>({json:async()=>JSON.parse(fs.readFileSync(new URL(url),'utf8'))});
const {pilotRoster}=await import('../v2/pilot.js');
const {apply}=await import('../v2/model.js');
const {todayPage}=await import('../v2/today.js');

const reviewCard=html=>html.split('<h2>Uren goedkeuren')[1].split('</section>')[0];

// Sylvia en Iris zijn leidinggevenden: hun eigen uren zijn meteen goedgekeurd. Voor tests over beoordelen
// maken we ze medewerker.
const asEmployee=(db,...ids)=>{for(const id of ids)db.people.find(p=>p.id===id).role='employee';return db};
test('Sylvia vult haar uren van dinsdag in: Eva ziet ze op Vandaag bij Uren goedkeuren',()=>{
 const db=apply(asEmployee(pilotRoster(),'sylvia'),'sylvia','hours',{id:'sylvia-2026-11-17',start:'08:30',end:'18:00',pause:30});
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

test('Isis ziet op Vandaag dat haar vrije dag is afgewezen, met reden en een knop Gezien',t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-19T12:00:00+01:00')});
 let db=apply(pilotRoster(),'isis','leave',{date:'2026-12-24',reason:'Kerst'});
 const id=db.requests.at(-1).id,isis=db=>db.people.find(p=>p.id==='isis');
 assert.match(todayPage(db,isis(db)),/chip-wait">Wacht op akkoord/);
 db=apply(db,'eva','decide',{id,accept:false,reason:'Te druk met kerst'});
 const html=todayPage(db,isis(db));
 assert.match(html,/Je aanvraag is afgewezen · Reden: Te druk met kerst/);
 assert.match(html,/chip-off">Afgewezen/);
 assert.match(html,new RegExp('data-act="seen" data-id="'+id+'">Gezien<'));
 assert.doesNotMatch(todayPage(apply(db,'isis','seen',{id}),isis(db)),/Je aanvraag is/);
});

test('Op Vandaag staat de knop Uren invullen naast mijn dienst en naast nog in te vullen uren, zoals Herinner',t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-19T19:00:00+01:00')});
 const db=pilotRoster(),html=todayPage(db,db.people.find(p=>p.id==='eva'));
 for(const title of ['Mijn dienst vandaag','Nog in te vullen']){
  const part=html.split('<h2>'+title)[1].split('</section>')[0];
  assert.match(part,/<div class="compact"><article class="vrow">[\s\S]*data-act="entry"/,title);
 }
});
