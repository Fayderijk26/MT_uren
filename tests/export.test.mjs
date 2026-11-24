import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// ui.js laadt bij het starten de iconen met fetch; in Node lezen we het bestand zelf.
globalThis.fetch=async url=>({json:async()=>JSON.parse(fs.readFileSync(new URL(url),'utf8'))});
const {pilotRoster}=await import('../v2/pilot.js');
const {apply,displayName}=await import('../v2/model.js');
const {weekPage}=await import('../v2/week.js');
const {exportData,monthPage}=await import('../v2/month.js');
const {dialogs}=await import('../v2/dialogs.js');

const at=(t,iso)=>t.mock.timers.enable({apis:['Date'],now:new Date(iso)});
const person=(db,id)=>db.people.find(p=>p.id===id);
// Elise: 16 november 9u goedgekeurd, 19 november ziek (doorbetaald), 21 november ook 4 uur gewerkt.
function november(t){
 at(t,'2026-11-26T12:00:00+01:00');
 let db=apply(pilotRoster(),'eva','approve',{id:'elise-2026-11-16'});
 db=apply(db,'eva','sick',{id:'elise-2026-11-19'});
 db=apply(db,'eva','sickDecide',{id:'elise-2026-11-19',paid:true});
 db=apply(db,'elise','hours',{id:'elise-2026-11-21',start:'10:00',end:'14:00',pause:0});
 return apply(db,'eva','approve',{id:'elise-2026-11-21'});
}
const rowOf=(sheet,first)=>sheet.rows.find(r=>r[0]===first);

test('Export loonadministratie: één regel per persoon, uren als decimaal, ziek en verlof in eigen kolommen',t=>{
 const {pay}=exportData(november(t),'2026-11');
 assert.deepEqual(pay.sheets[0].head,['Personeelsnummer','Achternaam en voorletters','Voornaam','Vast of oproep',
  'Percentage','Uren gewerkt','Dagen gewerkt','Ziek (uren)','Verlof (uren)']);
 const elise=rowOf(pay.sheets[0],'1004');
 assert.deepEqual(elise,['1004','Bakker, E.','Elise','Vast','',{hours:13*60},2,{hours:9*60},{hours:0}]);
 assert.equal(rowOf(pay.sheets[0],'1005')[3],'Oproep');
 assert.equal(pay.file,'MonkeyTown-loonadministratie-2026-11');
});

test('Uitgebreide export voor de bedrijfsleiders: gewerkt, ziek, verlof, onbetaald vrij, totaal, norm, verschil, saldo',t=>{
 const {full}=exportData(november(t),'2026-11');
 assert.deepEqual(full.sheets[0].head,['Personeelsnummer','Naam','Contract','Gewerkt','Ziek','Verlof',
  'Bijzonder verlof','Onbetaald vrij','Overuren ingezet','Totaal','Norm','Verschil','Saldo']);
 const elise=rowOf(full.sheets[0],'1004');
 assert.deepEqual(elise.slice(1,10),['Elise B','Vast',{hours:780},{hours:540},{hours:0},{hours:0},{hours:0},{hours:0},
  {hours:1320}]);
 assert.deepEqual(elise[10],{hours:104*60});
 assert.deepEqual(elise[11],{hours:1320-104*60});
 assert.deepEqual(elise[12],{hours:0},'november is nog niet afgesloten');
 assert.deepEqual(rowOf(full.sheets[0],'1005').slice(10),['','',''],'contract Uren: geen norm, verschil of saldo');
 assert.equal(full.sheets[1].name,'Diensten');
 assert.equal(full.file,'MonkeyTown-uitgebreid-2026-11');
});

test('Maandoverzicht: twee knoppen, één voor de loonadministratie en één uitgebreid',t=>{
 const db=november(t),html=monthPage(db,person(db,'eva'),{month:'2026-11'});
 assert.match(html,/data-act="export" data-id="pay">Export loonadministratie</);
 assert.match(html,/data-act="export" data-id="full">Uitgebreide export</);
});

test('Eva vult bij een medewerker personeelsnummer, voornaam, achternaam en voorletters in',t=>{
 at(t,'2026-11-26T12:00:00+01:00');
 const db=pilotRoster(),eva=person(db,'eva');
 assert.match(dialogs.person(db,eva,'elise').body,/name="staffNumber" type="text" value="1004"/);
 const p={id:'elise',name:'Elise B',role:'employee',contract:'vast',contractHours:24,areas:['Keuken'],
  staffNumber:' 2001 ',firstName:'Elise',lastName:'de Boer',initials:'E.M.'};
 const next=person(apply(db,'eva','savePerson',p),'elise');
 assert.deepEqual([next.staffNumber,next.lastName,next.initials],['2001','de Boer','E.M.']);
 assert.equal(exportData(apply(db,'eva','savePerson',p),'2026-11').pay.sheets[0].rows
  .find(r=>r[2]==='Elise')[1],'de Boer, E.M.');
});

test('Twee keer de naam Elise: de app toont overal naam en achternaam, ook in het rooster',t=>{
 at(t,'2026-11-26T12:00:00+01:00');
 let db=pilotRoster();
 const nieuw={name:'Elise',role:'employee',contract:'uren',contractHours:8,areas:['Vloer'],firstName:'Elise'};
 db=apply(db,'eva','savePerson',{id:'elise',name:'Elise',role:'employee',contract:'vast',contractHours:24,
  areas:['Keuken'],staffNumber:'1004',firstName:'Elise',lastName:'Bakker',initials:'E.'});
 assert.throws(()=>apply(db,'eva','savePerson',nieuw),/Vul bij allebei een achternaam in/);
 db=apply(db,'eva','savePerson',{...nieuw,lastName:'Visser'});
 assert.equal(displayName(db,'elise'),'Elise Bakker');
 assert.equal(displayName(db,'isis'),'Isis N','unieke naam blijft zoals hij is');
 assert.match(weekPage(db,{day:'2026-11-26'}),/Elise Bakker/);
 assert.doesNotMatch(weekPage(db,{day:'2026-11-26'}),/>Elise</);
});
