import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// ui.js laadt bij het starten de iconen met fetch; in Node lezen we het bestand zelf.
globalThis.fetch=async url=>({json:async()=>JSON.parse(fs.readFileSync(new URL(url),'utf8'))});
const {pilotRoster}=await import('../v2/pilot.js');
const {apply,dayTimes,monthSummary,vacationLeft,closedPeople}=await import('../v2/model.js');
const {dialogs}=await import('../v2/dialogs.js');
const {weekPage}=await import('../v2/week.js');
const {hoursPage}=await import('../v2/hours.js');
const calendar=await import('../v2/calendar.js');

const at=(t,iso)=>t.mock.timers.enable({apis:['Date'],now:new Date(iso)});
const person=(db,id)=>db.people.find(p=>p.id===id);
// Maandag 23 november. Donderdag 10 december: vaste werkdag van Elise (ma/do/za) en Iris (ma/do/vr), vast contract.
const monday=t=>at(t,'2026-11-23T12:00:00+01:00');
const day='2026-12-10';
const row=(db,user)=>monthSummary(db,'2026-12').find(r=>r.user===user);

test('Standaard werkdag: doordeweeks 08:30–17:30, in het weekend 08:30–18:00',()=>{
 assert.deepEqual(dayTimes('2026-12-10'),{start:'08:30',end:'17:30'});
 assert.deepEqual(dayTimes('2026-12-12'),{start:'08:30',end:'18:00'});
 assert.deepEqual(dayTimes('2026-12-13'),{start:'08:30',end:'18:00'});
});

test('Een nieuwe dienst staat vooraf op de standaard werkdag van die dag',t=>{
 monday(t);
 const db=pilotRoster(),eva=person(db,'eva');
 assert.match(dialogs.draft(db,eva,'2026-12-10').body,/<option selected value="17:30">17:30/);
 assert.match(dialogs.draft(db,eva,'2026-12-12').body,/<option selected value="18:00">18:00/);
});

test('Eva zet donderdag 10 december dicht: ze ziet wie daar normaal werkt en kiest doorbetalen of min-uren',t=>{
 monday(t);
 const db=pilotRoster(),eva=person(db,'eva');
 assert.deepEqual(closedPeople(db,day),['eva','iris','elise']);
 const body=dialogs.dayEdit(db,eva,day).body;
 assert.match(body,/Je zet nu deze dag dicht\. Dit is een normale werkdag voor Eva G\., Iris Z en Elise B\./);
 assert.match(body,/Wil je hun uren gewoon doorbetalen of zijn dit min-uren\?/);
 assert.throws(()=>apply(db,'eva','setDay',{date:day,status:'closed'}),/Kies of de uren worden doorbetaald/);
 assert.throws(()=>apply(db,'iris','setDay',{date:day,status:'closed',paid:'ja'}),/Alleen de bedrijfsleider/);
});

test('Dicht en doorbetaald: Elise krijgt 8 uur, er gaat geen vakantiedag af',t=>{
 monday(t);
 let db=apply(pilotRoster(),'elise','leave',{date:day,type:'verlof'});
 db=apply(db,'eva','decide',{id:db.requests.at(-1).id,accept:true,choices:{}});
 db=apply(db,'eva','setDay',{date:day,status:'closed',paid:'ja'});
 assert.equal(row(db,'elise').closedPaid,480);
 assert.equal(row(db,'elise').leave,0,'verlof op een dichte dag telt niet dubbel');
 assert.equal(vacationLeft(db,'elise'),16,'en kost geen vakantiedag');
 assert.match(hoursPage(db,person(db,'elise'),{page:'hours',month:'2026-12'}),/1 dag dicht, doorbetaald \(8u 0m\)/);
});

test('Dicht en niet doorbetaald: het telt 0 uur, dus min-uren',t=>{
 monday(t);
 const db=apply(pilotRoster(),'eva','setDay',{date:day,status:'closed',paid:'nee'});
 assert.equal(row(db,'elise').closedPaid,0);
 assert.match(hoursPage(db,person(db,'elise'),{page:'hours',month:'2026-12'}),/1 dag dicht, telt niet mee/);
});

test('Een dichte dag is in het rooster lichtrood met Dicht, en er kan niemand worden ingepland',t=>{
 monday(t);
 const db=apply(pilotRoster(),'eva','setDay',{date:day,status:'closed',paid:'ja'});
 assert.match(weekPage(db,{day}),/class="dayclosed"[^>]*>Dicht</);
 assert.match(weekPage(db,{day,single:true}),/class="[^"]*closed[^"]*"/);
 assert.throws(()=>apply(db,'eva','draft',{user:'isis',date:day,start:'10:00',end:'16:00',area:'Vloer'}),
  /Het park is dicht op deze dag\./);
});

test('Een dag met diensten kan niet dicht; eerst de diensten weghalen',t=>{
 at(t,'2026-11-19T12:00:00+01:00');
 assert.throws(()=>apply(pilotRoster(),'eva','setDay',{date:'2026-11-21',status:'closed',paid:'ja'}),
  /Op deze dag staan nog diensten\. Haal die eerst weg\./);
});

test('Aangepaste openingstijden: Eva zet 24 december op 10:00–15:00; dat staat in het rooster',t=>{
 monday(t);
 assert.throws(()=>apply(pilotRoster(),'eva','setDay',{date:'2026-12-24',status:'hours',open:'15:00',close:'10:00'}),
  /begin- en eindtijd/);
 let db=apply(pilotRoster(),'eva','setDay',{date:'2026-12-24',status:'hours',open:'10:00',close:'15:00'});
 assert.match(weekPage(db,{day:'2026-12-24'}),/Open 10:00–15:00/);
 db=apply(db,'eva','setDay',{date:'2026-12-24',status:'normal'});
 assert.deepEqual(db.days,[],'weer normaal: niets meer opgeslagen');
});

test('Medewerkers zien de dichte dag ook in Mijn rooster, en Hele dag beschikbaar volgt de standaard werkdag',t=>{
 monday(t);
 const db=apply(pilotRoster(),'eva','setDay',{date:day,status:'closed',paid:'ja'});
 const {dayContent,calendarPage}=calendar;
 assert.equal(dayContent(db,'elise',day)[0].text,'Dicht');
 assert.match(calendarPage(db,person(db,'elise'),{calendarDate:day}),/class="calendar-day closed[^"]*" data-act="calendarDay" data-id="2026-12-10"/);
 db.extra.push({user:'isis',date:'2026-12-11',start:'08:30',end:'17:30'});
 assert.equal(dayContent(db,'isis','2026-12-11').at(-1).text,'Hele dag beschikbaar');
});
