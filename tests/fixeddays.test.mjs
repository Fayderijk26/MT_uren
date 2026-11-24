import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// ui.js laadt bij het starten de iconen met fetch; in Node lezen we het bestand zelf.
globalThis.fetch=async url=>({json:async()=>JSON.parse(fs.readFileSync(new URL(url),'utf8'))});
const {pilotRoster}=await import('../v2/pilot.js');
const {apply,ruleFor,needsInstead,extraToDecide}=await import('../v2/model.js');
const {dialogs}=await import('../v2/dialogs.js');
const {weekPage,availability}=await import('../v2/week.js');
const {dayContent}=await import('../v2/calendar.js');

const person=(db,id)=>db.people.find(p=>p.id===id);
// Maandag 23 november. Elise (vast) werkt ma/do/za. Isis (oproep) werkt op zaterdag.
const monday=t=>t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-23T12:00:00+01:00')});

test('Eva vult bij Medewerker de vaste werkdagen in; dat is de vaste beschikbaarheid',t=>{
 monday(t);
 const db=pilotRoster(),eva=person(db,'eva');
 const body=dialogs.person(db,eva,'elise').body;
 assert.match(body,/<input type="checkbox" name="fixed" value="1" checked> Maandag/);
 assert.match(body,/<input type="checkbox" name="fixed" value="2"> Dinsdag/);
 const p={...person(db,'elise'),contractHours:24,fixed:['2','4'],start2:'09:00',end2:'17:00',start4:'08:30',end4:'17:30'};
 const next=apply(db,'eva','savePerson',p);
 assert.deepEqual([ruleFor(next,{user:'elise',date:'2026-11-24'})].map(r=>r.start+'-'+r.end),['09:00-17:00']);
 assert.ok(ruleFor(next,{user:'elise',date:'2026-11-30'}).off,'maandag is geen vaste dag meer');
 assert.equal(ruleFor(next,{user:'elise',date:'2026-11-26'}).end,'17:30');
});

test('Elise (vast) kan geen vrij vragen op een dag die geen vaste werkdag is: ze geeft Niet beschikbaar op',t=>{
 monday(t);
 const db=pilotRoster();
 assert.throws(()=>apply(db,'elise','leave',{date:'2026-12-15',type:'verlof'}),
  /Op deze dag werk je niet vast\. Geef Niet beschikbaar op; daar is geen goedkeuring voor nodig\./);
 const next=apply(db,'elise','extra',{date:'2026-12-15',off:true});
 assert.deepEqual(next.extra.at(-1),{user:'elise',date:'2026-12-15',off:true});
 assert.deepEqual(extraToDecide(next),[],'geen goedkeuring');
 assert.equal(next.updates.length,db.updates.length,'geen melding');
 assert.throws(()=>apply(db,'elise','extra',{date:'2026-12-14',off:true}),
  /Dit is een vaste werkdag\. Vraag vrij aan\./);
});

test('Niet beschikbaar staat in het teamrooster en in Mijn rooster',t=>{
 monday(t);
 const db=apply(pilotRoster(),'elise','extra',{date:'2026-12-15',off:true});
 assert.equal(availability(db,'elise','2026-12-15'),'Niet beschikbaar');
 assert.match(weekPage(db,{day:'2026-12-15'},true),/Niet beschikbaar/,'ook voor de leidinggevende');
 assert.equal(dayContent(db,'elise','2026-12-15').at(-1).text,'Niet beschikbaar');
});

test('Later beginnen op een vaste dag is een aanvraag: tot de bedrijfsleider akkoord geeft, geldt de vaste dag',t=>{
 monday(t);
 let db=apply(pilotRoster(),'elise','extra',{date:'2026-12-14',start:'10:00',end:'17:30'});
 const r=db.requests.at(-1);
 assert.deepEqual([r.kind,r.status,r.start,r.end],['day','pending','10:00','17:30']);
 assert.ok(!db.extra.some(e=>e.user==='elise'),'nog geen beschikbaarheid');
 assert.equal(availability(db,'elise','2026-12-14'),'Hele dag beschikbaar · 10:00–17:30 gevraagd');
 const mine=dayContent(db,'elise','2026-12-14').find(i=>i.request);
 assert.deepEqual([mine.text,mine.kind],['Beschikbaarheid 10:00–17:30 · Wacht op akkoord','pending']);
 assert.match(dialogs.decision(db,person(db,'eva'),r.id).body,/ma 14 dec · Beschikbaar 10:00–17:30/);
 db=apply(db,'eva','decide',{id:r.id,accept:true});
 assert.equal(availability(db,'elise','2026-12-14'),'Beschikbaar vanaf 10:00');
 assert.match(dialogs.extra(db,person(db,'elise')).body,
  /Op een vaste werkdag is dit een aanvraag: de bedrijfsleider keurt hem goed\. Tot dan geldt je vaste beschikbaarheid\./);
});

test('Op een dag die geen vaste werkdag is, is extra beschikbaarheid geen aanvraag (zoals het was)',t=>{
 monday(t);
 const db=apply(pilotRoster(),'elise','extra',{date:'2026-12-15',start:'10:00',end:'17:30'});
 assert.equal(db.requests.length,pilotRoster().requests.length);
 assert.equal(availability(db,'elise','2026-12-15'),'Beschikbaar vanaf 10:00');
});

test('Eva wijzigt een vaste werkdag vanaf een datum; tot die datum geldt de oude',t=>{
 monday(t);
 const db=pilotRoster(),elise=person(db,'elise');
 assert.match(dialogs.person(db,person(db,'eva'),'elise').body,/name="fixedFrom" type="date" value="2026-11-23"/);
 const next=apply(db,'eva','savePerson',{...elise,contractHours:24,fixed:['1','4','6'],fixedFrom:'2026-12-07',
  start1:'10:00',end1:'17:30',start4:'08:30',end4:'18:00',start6:'10:00',end6:'18:00'});
 assert.equal(ruleFor(next,{user:'elise',date:'2026-11-30'}).start,'08:30','oude tot 7 december');
 assert.equal(ruleFor(next,{user:'elise',date:'2026-12-07'}).start,'10:00');
 assert.throws(()=>apply(db,'eva','savePerson',{...elise,contractHours:24,fixed:['1'],fixedFrom:'2026-11-01'}),
  /Kies vandaag of later voor Geldig vanaf\./);
});

test('Bij beschikbaarheid staat dat het een wens is, geen garantie',t=>{
 monday(t);
 const db=pilotRoster(),elise=person(db,'elise');
 for(const d of ['extra','weekly'])
  assert.match(dialogs[d](db,elise).body,/Let op: je wordt niet standaard van 08:30 tot 18:00 ingepland\. Dit is alleen je beschikbaarheid\./);
});

test('Isis (oproep) vraagt vrij op haar vaste zaterdag: de app vraagt eerst of ze een andere dag kan',t=>{
 monday(t);
 const db=pilotRoster(),leave={date:'2026-12-12',type:'onbetaald'};
 assert.ok(needsInstead(db,'isis','2026-12-12','2026-12-12'));
 assert.ok(!needsInstead(db,'elise','2026-12-12','2026-12-12'),'alleen bij oproepkrachten');
 assert.throws(()=>apply(db,'isis','leave',leave),/Kan je een andere dag toevallig wel werken\?/);
 const body=dialogs.leave(db,person(db,'isis'),'2026-12-12').body;
 assert.match(body,/<div id="instead" hidden>/);
 assert.match(body,/Kan je een andere dag van de week toevallig wel werken\?/);
 const no=apply(db,'isis','leave',{...leave,instead:'nee'});
 assert.deepEqual(no.requests.at(-1).instead,[]);
});

test('Isis kan zondag 13 en woensdag 16 december wel: dat wordt aangegeven beschikbaarheid en Eva ziet het',t=>{
 monday(t);
 const instead=[{date:'2026-12-13',start:'10:00',end:'18:00'},{date:'2026-12-16',start:'12:00',end:'17:30'}];
 const db=apply(pilotRoster(),'isis','leave',{date:'2026-12-12',type:'onbetaald',instead});
 const r=db.requests.at(-1);
 assert.deepEqual(r.instead,instead);
 assert.deepEqual(db.extra.filter(e=>e.user==='isis').map(e=>e.date+' '+e.start+'–'+e.end+' '+e.request),
  ['2026-12-13 10:00–18:00 '+r.id,'2026-12-16 12:00–17:30 '+r.id]);
 assert.equal(dayContent(db,'isis','2026-12-13').at(-1).text,'Aangegeven beschikbaarheid 10:00–18:00');
 const body=dialogs.decision(db,person(db,'eva'),r.id).body;
 assert.match(body,/Vraagt vrij voor za 12 dec en heeft een andere dag opgegeven\./);
 assert.match(body,/Heeft in plaats daarvan aangegeven wel zo 13 dec \(10:00–18:00\) en wo 16 dec \(12:00–17:30\) te kunnen werken\. Wil je deze vrije dag goedkeuren\?/);
 const none=apply(pilotRoster(),'isis','leave',{date:'2026-12-12',type:'onbetaald',instead:'nee'});
 assert.match(dialogs.decision(none,person(db,'eva'),none.requests.at(-1).id).body,
  /Vraagt vrij voor za 12 dec en heeft geen andere dag opgegeven\./);
 assert.throws(()=>apply(pilotRoster(),'isis','leave',{date:'2026-12-12',type:'onbetaald',
  instead:[{date:'2026-12-12',start:'10:00',end:'18:00'}]}),/Kies een andere dag dan de dag die je vrij vraagt\./);
});
