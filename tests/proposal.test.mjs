import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// ui.js laadt bij het starten de iconen met fetch; in Node lezen we het bestand zelf.
globalThis.fetch=async url=>({json:async()=>JSON.parse(fs.readFileSync(new URL(url),'utf8'))});
const {pilotRoster}=await import('../v2/pilot.js');
const {apply}=await import('../v2/model.js');
const {dialogs}=await import('../v2/dialogs.js');
const {todayPage}=await import('../v2/today.js');

const person=(db,id)=>db.people.find(p=>p.id===id);
// Maandag 23 november. Mieke heeft geen vaste beschikbaarheid: Eva vraagt of ze do 3 december kan werken.
function asked(t){
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-23T12:00:00+01:00')});
 return apply(pilotRoster(),'eva','draft',{user:'mieke',date:'2026-12-03',start:'08:30',end:'18:00',area:'Vloer'});
}

test('Dienstvoorstel: Mieke ziet Accepteren, Wijzigen en Ik kan niet; de tijden staan eerst verborgen',t=>{
 const db=asked(t),o=db.offers.at(-1);
 const body=dialogs.proposal(db,person(db,'mieke'),o.id).body;
 assert.match(body,/<p class="proposalday">do 3 dec<\/p>/);
 assert.match(body,/08:30–18:00 · Vloer/);
 assert.match(body,/Eva G\. vraagt of je deze dienst kunt werken\./);
 assert.match(body,/<div class="proposalactions"><form data-op="yes".*Accepteren.*Wijzigen.*Ik kan niet.*<\/div><div id="counter"/s);
 const today=todayPage(db,person(db,'mieke'));
 assert.match(today,/<h2>Vraag om te werken<\/h2>/);
 assert.match(today,/<b>Extra dienst · do 3 dec<\/b><small>08:30–18:00 · Vloer<\/small><small>Eva G\. vraagt of je deze dienst kunt werken\.<\/small>/);
 assert.match(body,/>Accepteren<\/button>/);
 assert.match(body,/data-act="reveal" data-id="counter">Wijzigen<\/button>/);
 assert.match(body,/<div id="counter" hidden>.*>Deze tijden voorstellen<\/button>/s);
 assert.match(body,/>Ik kan niet<\/button>/);
});

test('Mieke stelt 10:00–18:00 voor: Eva ziet het voorstel en kiest accepteren of afwijzen',t=>{
 let db=asked(t);const id=db.offers.at(-1).id;
 db=apply(db,'mieke','offer',{id,answer:'counter',start:'10:00',end:'18:00'});
 const {title,body}=dialogs.proposal(db,person(db,'eva'),id);
 assert.equal(title,'Reactie op extra dienst');
 assert.match(body,/Extra dienst: donderdag is geen vaste werkdag van Mieke\./);
 assert.match(body,/Je vroeg 08:30–18:00\./);
 assert.match(body,/Mieke stelt andere tijden voor: 10:00–18:00\./);
 assert.match(body,/>Voorstel accepteren<\/button>/);
 assert.match(body,/>Afwijzen<\/button>/);
 assert.doesNotMatch(body,/Wijziging voorstellen/);
});

test('Reactie op een dienst buiten de beschikbaarheid: Eva ziet waarom het een vraag was',t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-23T12:00:00+01:00')});
 // Isis werkt vast op zaterdag; op 12 december is ze goedgekeurd beschikbaar vanaf 11:00.
 let db=apply(pilotRoster(),'isis','extra',{date:'2026-12-12',start:'11:00',end:'18:00'});
 db=apply(db,'eva','decide',{id:db.requests.at(-1).id,accept:true});
 db.offers.push({id:'o1',row:{id:'s1',user:'isis',date:'2026-12-12',start:'08:30',end:'18:00',area:'Vloer'},
  turn:'employee',before:null});
 assert.match(dialogs.proposal(db,person(db,'isis'),'o1').body,
  /Dit is buiten je aangegeven beschikbaarheid\. De bedrijfsleider vraagt of je wilt werken\./);
 db=apply(db,'isis','offer',{id:'o1',answer:'counter',start:'10:00',end:'18:00'});
 const {title,body}=dialogs.proposal(db,person(db,'eva'),'o1');
 assert.equal(title,'Reactie op dienstvoorstel');
 assert.match(body,/Buiten de beschikbaarheid van Isis N: beschikbaar vanaf 11:00\./);
 assert.match(todayPage(db,person(db,'eva')),/<h2>Reactie op voorstel<\/h2>/);
 db.offers[0].row.user='elise';db.offers[0].row.date='2026-12-15';
 assert.match(dialogs.proposal(db,person(db,'eva'),'o1').body,/Extra dienst: dinsdag is geen vaste werkdag van Elise B\./);
});

test('Andere tijden gevraagd: titel, daaronder ingepland en gevraagd, daaronder de reden; Ja en Nee naast elkaar',t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-23T12:00:00+01:00')});
 const db=pilotRoster();
 const fallback={id:'s9',user:'isis',date:'2026-12-12',start:'11:00',end:'17:00',area:'Vloer'};
 db.shifts.push(fallback);
 db.offers.push({id:'o2',row:{...fallback,start:'10:00'},fallback,before:JSON.stringify(fallback),turn:'employee',
  requestedBy:'eva',availability:{start:'11:00',end:'17:00'}});
 db.extra.push({user:'isis',date:'2026-12-12',start:'11:00',end:'17:00'});
 assert.match(todayPage(db,person(db,'isis')),new RegExp('<b>Andere tijden gevraagd · za 12 dec</b><small>Ingepland '
  +'11:00–17:00 · Gevraagd 10:00–17:00</small><small>Dit is buiten je aangegeven beschikbaarheid\\. Eva G\\. vraagt'
  +' of je wilt werken\\.</small>'));
 const body=dialogs.proposal(db,person(db,'isis'),'o2').body;
 assert.match(body,/<div class="proposalactions"><form data-op="yes".*Ja, 10:00–17:00.*Nee, behoud 11:00–17:00.*<\/div>/s);
});

test('De knop Lees eerst de weekly opent de weekly, niet het venster Vaste dagen wijzigen',t=>{
 const db=asked(t);
 db.weeklies=[{week:'2026-11-30',text:'Fijne week.',image:'',version:1,reads:{}}];
 assert.match(dialogs.weeklyView(db,person(db,'mieke'),'2026-11-30').body,/Fijne week\./);
 assert.match(dialogs.weekly(db,person(db,'mieke')).title,/Vaste/);
});
