import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// ui.js laadt bij het starten de iconen met fetch; in Node lezen we het bestand zelf.
globalThis.fetch=async url=>({json:async()=>JSON.parse(fs.readFileSync(new URL(url),'utf8'))});
const {pilotRoster}=await import('../v2/pilot.js');
const {apply}=await import('../v2/model.js');
const {peoplePage,rosterTabs}=await import('../v2/people.js');
const {weekPage}=await import('../v2/week.js');

const person=(db,id)=>db.people.find(p=>p.id===id);

test('Onder Medewerkers ziet de bedrijfsleider iedereen met rol, contracturen en telefoonnummer',()=>{
 const db=apply(pilotRoster(),'eva','savePerson',{name:'Noor V',role:'employee',contractHours:'24',phone:'0600000000'});
 const html=peoplePage(db,person(db,'eva'));
 assert.match(html,/data-act="person" data-id="">Medewerker toevoegen</);
 assert.equal(html.split('data-act="person" data-id="').length-2,db.people.length,'een knop Wijzigen per persoon');
 assert.match(html,/Noor V[\s\S]*Medewerker · 24 uur per week · 0600000000/);
 assert.match(html,/Sylvia[\s\S]*Leidinggevende/);
});

test('Alleen de bedrijfsleider heeft de subkopjes Teamrooster en Medewerkers',()=>{
 const db=pilotRoster();
 assert.match(rosterTabs(person(db,'eva'),'team'),/Teamrooster[\s\S]*data-id="people"/);
 assert.equal(rosterTabs(person(db,'sylvia'),'team'),'');
});

test('Inactieve medewerkers staan onder Inactief met Weer actief maken, en niet in het teamrooster van nu',t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-19T12:00:00+01:00')});
 let db=pilotRoster();
 db.shifts=db.shifts.filter(s=>!(s.user==='isis'&&s.date>='2026-11-19'));
 db=apply(db,'eva','setActive',{id:'isis',active:false});
 const html=peoplePage(db,person(db,'eva'));
 assert.match(html.split('<h2>Inactief')[1],/Isis N[\s\S]*data-act="reactivate" data-id="isis">Weer actief maken</);
 assert.doesNotMatch(html.split('<h2>Inactief')[0],/Isis N/);
 assert.doesNotMatch(weekPage(db,{day:'2026-11-26'}),/Isis N/,'niet in een week zonder diensten van Isis');
});
