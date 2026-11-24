import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// ui.js laadt bij het starten de iconen met fetch; in Node lezen we het bestand zelf.
globalThis.fetch=async url=>({json:async()=>JSON.parse(fs.readFileSync(new URL(url),'utf8'))});
const {pilotRoster}=await import('../v2/pilot.js');
const {apply}=await import('../v2/model.js');
const {dialogs}=await import('../v2/dialogs.js');

const person=(db,id)=>db.people.find(p=>p.id===id);
// Maandag 23 november. Week 50: maandag 7 t/m zondag 13 december. Isis werkt vast op zaterdag (12 december).
const week='2026-12-07',sat='2026-12-12';
function start(t){
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-23T12:00:00+01:00')});
 let db=apply(pilotRoster(),'eva','draft',{user:'elise',date:week,start:'08:30',end:'17:30',area:'Keuken'});
 return db;
}
const plan=(db,s='08:30')=>apply(db,'eva','draft',{user:'isis',date:sat,start:s,end:'18:00',area:'Vloer'});
const body=db=>dialogs.pubWeek(db,person(db,'eva'),week).body;

test('Publiceren: de diensten zonder botsing staan in een lijst die je kunt openklappen',t=>{
 const db=plan(start(t),'10:00');
 const html=body(db);
 assert.match(html,/<details class="publist"><summary>Wordt ingepland \(2\)<\/summary>/);
 assert.match(html,/Elise B · ma 7 dec · 08:30–17:30/);
 assert.doesNotMatch(html,/Voorstel aan medewerker|Eerst beslissen/);
});

test('Isis vraagt vanaf 11:00 en Eva heeft nog niet beslist: eerst beslissen, dan pas publiceren',t=>{
 // Eva had Isis al in het concept gezet; daarna vraagt Isis vanaf 11:00.
 let db=apply(plan(start(t)),'isis','extra',{date:sat,start:'11:00',end:'18:00'});
 const r=db.requests.at(-1);
 const html=body(db);
 assert.match(html,/Eerst beslissen \(1\)/);
 assert.match(html,/Isis N · za 12 dec · Beschikbaar 11:00–18:00/);
 assert.match(html,new RegExp('data-act="decision" data-id="'+r.id+'">Beoordelen'));
 assert.throws(()=>apply(db,'eva','publish',{date:week,weekly:'Fijne week.',confirm:true}),
  /Beslis eerst over de open aanvragen: Isis N \(za 12 dec\)\./);
 db=apply(db,'eva','decide',{id:r.id,accept:false,reason:'Zaterdag is druk.'});
 assert.ok(apply(db,'eva','publish',{date:week,weekly:'Fijne week.',confirm:true}));
});

test('Ook een open vrij-aanvraag op een dag waarop iemand wordt ingepland: eerst beslissen',t=>{
 const base=start(t);
 const asked=apply(base,'isis','leave',{date:sat,type:'onbetaald',instead:'nee'});
 assert.throws(()=>plan(asked),/Er staat een open aanvraag voor deze dag\. Beslis daar eerst over\./);
 // Vraagt Isis vrij nadat Eva haar al in het concept had gezet: dan wacht het publiceren.
 let db=apply(plan(base),'isis','leave',{date:sat,type:'onbetaald',instead:'nee'});
 assert.match(body(db),/Eerst beslissen \(1\)/);
 assert.throws(()=>apply(db,'eva','publish',{date:week,weekly:'Fijne week.',confirm:true}),/Beslis eerst/);
});

test('Al goedgekeurd vanaf 11:00 en Eva plant 08:30: Isis krijgt een voorstel, met uitleg waarom',t=>{
 let db=apply(start(t),'isis','extra',{date:sat,start:'11:00',end:'18:00'});
 db=apply(db,'eva','decide',{id:db.requests.at(-1).id,accept:true});
 db=plan(db);
 const html=body(db);
 assert.match(html,/Voorstel aan medewerker \(1\)/);
 assert.match(html,/Geeft aan: beschikbaar vanaf 11:00 \(al goedgekeurd, daarom vragen we het Isis N\)/);
 assert.match(html,/Isis N krijgt de vraag: kun je werken van 08:30 tot 18:00\?/);
 assert.match(html,/Wordt ingepland \(1\)/);
});
