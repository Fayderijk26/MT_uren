import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// ui.js laadt bij het starten de iconen met fetch; in Node lezen we het bestand zelf.
globalThis.fetch=async url=>({json:async()=>JSON.parse(fs.readFileSync(new URL(url),'utf8'))});
const {pilotRoster}=await import('../v2/pilot.js');
const {apply}=await import('../v2/model.js');
const {dialogs}=await import('../v2/dialogs.js');

const person=(db,id)=>db.people.find(p=>p.id===id);
// Maandag 23 november. Mieke heeft geen vaste beschikbaarheid: Eva vraagt of ze do 3 december kan werken.
function asked(t){
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-23T12:00:00+01:00')});
 return apply(pilotRoster(),'eva','draft',{user:'mieke',date:'2026-12-03',start:'08:30',end:'18:00',area:'Vloer'});
}

test('Dienstvoorstel: Mieke ziet Dienst accepteren en Wijziging voorstellen; de tijden staan eerst verborgen',t=>{
 const db=asked(t),o=db.offers.at(-1);
 const body=dialogs.proposal(db,person(db,'mieke'),o.id).body;
 assert.match(body,/<p class="proposalday">do 3 dec<\/p>/);
 assert.match(body,/08:30–18:00 · Vloer/);
 assert.match(body,/Eva G\. vraagt of je deze dienst kunt werken\./);
 assert.match(body,/>Dienst accepteren<\/button>/);
 assert.match(body,/data-act="reveal" data-id="counter">Wijziging voorstellen<\/button>/);
 assert.match(body,/<div id="counter" hidden>.*>Deze tijden voorstellen<\/button>/s);
 assert.match(body,/>Ik kan niet<\/button>/);
});

test('Mieke stelt 10:00–18:00 voor: Eva ziet het voorstel en kiest accepteren of afwijzen',t=>{
 let db=asked(t);const id=db.offers.at(-1).id;
 db=apply(db,'mieke','offer',{id,answer:'counter',start:'10:00',end:'18:00'});
 const body=dialogs.proposal(db,person(db,'eva'),id).body;
 assert.match(body,/Mieke stelt andere tijden voor: 10:00–18:00\./);
 assert.match(body,/>Voorstel accepteren<\/button>/);
 assert.match(body,/>Afwijzen<\/button>/);
 assert.doesNotMatch(body,/Wijziging voorstellen/);
});

test('De knop Lees eerst de weekly opent de weekly, niet het venster Vaste dagen wijzigen',t=>{
 const db=asked(t);
 db.weeklies=[{week:'2026-11-30',text:'Fijne week.',image:'',version:1,reads:{}}];
 assert.match(dialogs.weeklyView(db,person(db,'mieke'),'2026-11-30').body,/Fijne week\./);
 assert.match(dialogs.weekly(db,person(db,'mieke')).title,/Vaste/);
});
