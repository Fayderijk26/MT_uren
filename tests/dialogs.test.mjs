import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// ui.js laadt bij het starten de iconen met fetch; in Node lezen we het bestand zelf.
globalThis.fetch=async url=>({json:async()=>JSON.parse(fs.readFileSync(new URL(url),'utf8'))});
const {pilotRoster}=await import('../v2/pilot.js');
const {apply}=await import('../v2/model.js');
const {dialogs}=await import('../v2/dialogs.js');

// Maandag 23 november, 12:00.
const monday=t=>t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-23T12:00:00+01:00')});
const person=(db,id)=>db.people.find(p=>p.id===id);
const show=(db,who,action,id)=>dialogs[action](db,person(db,who),id);

test('Mijn dienst: Elise ziet Gewerkte uren bij een voorbije dienst, Mieke (geen uren) niet',t=>{
 monday(t);
 const db=pilotRoster();
 const elise=show(db,'elise','ownShift','elise-2026-11-19');
 assert.equal(elise.title,'Mijn dienst');
 assert.match(elise.body,/data-act="entry" data-id="elise-2026-11-19">Gewerkte uren</);
 assert.doesNotMatch(show(db,'mieke','ownShift','mieke-2026-11-18').body,/Gewerkte uren/);
});

test('Medewerker wijzigen: rol, contract en Uren bijhouden staan meteen goed',()=>{
 const db=pilotRoster(),body=show(db,'eva','person','mieke').body;
 assert.match(body,/<option value="lead" selected>Leidinggevende/);
 assert.match(body,/<option value="vast" selected>Vast/);
 assert.match(body,/<option value="no" selected>Nee/);
 assert.match(show(db,'eva','person','').body,/<option value="yes" selected>Ja/,'nieuw: standaard ja');
});

test('Vrij goedkeuren: elke dienst gaat mee zoals hij was, zodat Eva met dat venster kan goedkeuren',t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-19T12:00:00+01:00')});
 let db=apply(pilotRoster(),'elise','leave',{date:'2026-11-21',type:'verlof'});
 const r=db.requests.at(-1),{title,body}=show(db,'eva','decision',r.id);
 assert.equal(title,'Aanvraag beoordelen');
 const before=body.match(/name="before-elise-2026-11-21" value="([^"]*)"/)[1].replaceAll('&quot;','"');
 assert.equal(before,JSON.stringify(db.shifts.find(s=>s.id==='elise-2026-11-21')));
 const choices={'elise-2026-11-21':{before,value:'none'}};
 db=apply(db,'eva','decide',{id:r.id,accept:true,choices});
 assert.equal(db.requests.at(-1).status,'approved');
});

test('Uren bekijken: Eva ziet de keuzes Goedkeuren en Aanpassen vragen bij uren die wachten',t=>{
 monday(t);
 const db=pilotRoster(),{title,body}=show(db,'eva','inspect','elise-2026-11-16');
 assert.equal(title,'Gewerkte uren');
 assert.match(body,/data-act="approve"[^>]*>Goedkeuren</);
 assert.match(body,/<div id="askChange" hidden>/);
});

test('Een dienst die niet bestaat in het teamrooster: geen venster',()=>{
 assert.equal(show(pilotRoster(),'eva','shiftDetails','bestaat-niet'),null);
});

test('Elke knop met een venster heeft een titel en inhoud',t=>{
 monday(t);
 const db=pilotRoster();
 const cases=[['calendarDay','2026-11-25'],['shiftDetails','iris-2026-11-27'],['unplanned',''],
  ['sickAsk','elise-2026-11-26'],['leave',''],['weekly',''],['extra',''],['planFromRules','2026-11-30'],
  ['approveAll',''],['newDraft','2026-11-30'],['draft','iris-2026-11-27'],['pubWeek','2026-11-30'],
  ['norm','elise'],['closeMonth','2026-10']];
 for(const [action,id] of cases){
  const d=show(db,'eva',action,id);
  assert.ok(d.title&&d.body.length>20,action);
 }
});
