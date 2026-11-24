import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// ui.js laadt bij het starten de iconen met fetch; in Node lezen we het bestand zelf.
globalThis.fetch=async url=>({json:async()=>JSON.parse(fs.readFileSync(new URL(url),'utf8'))});
const {pilotRoster}=await import('../v2/pilot.js');
const {apply,leaveDays,vacationLeft}=await import('../v2/model.js');
const {dialogs}=await import('../v2/dialogs.js');
const {hoursPage}=await import('../v2/hours.js');

const at=(t,iso)=>t.mock.timers.enable({apis:['Date'],now:new Date(iso)});
const person=(db,id)=>db.people.find(p=>p.id===id);
// Elise werkt vast op maandag, donderdag en zaterdag. Ze heeft 16 vakantiedagen per jaar, startsaldo 16 in 2026.
const monday=t=>at(t,'2026-11-23T12:00:00+01:00');
// Een week vrij in december: ma 14 t/m zo 20 december.
const week={date:'2026-12-14',through:'2026-12-20',type:'verlof'};
const ask=(db,p=week)=>apply(db,'elise','leave',p);
const last=db=>db.requests.at(-1);

test('Een week vrij telt alleen de vaste werkdagen: ma, do en za zijn 3 vakantiedagen',t=>{
 monday(t);
 const db=ask(pilotRoster());
 assert.equal(leaveDays(db,last(db)),3);
 assert.equal(leaveDays(db,{...last(db),date:'2026-12-15',through:'2026-12-16'}),0,'di en wo werkt ze niet');
});

test('Goedgekeurd verlof gaat van het saldo af: 16 dagen, 3 opgenomen, 13 over',t=>{
 monday(t);
 let db=ask(pilotRoster());
 assert.equal(vacationLeft(db,'elise'),16,'een open aanvraag telt nog niet');
 db=apply(db,'eva','decide',{id:last(db).id,accept:true,choices:{}});
 assert.equal(vacationLeft(db,'elise'),13);
 assert.equal(vacationLeft(db,'isis'),null,'contract Uren: geen vakantiedagen in de app');
});

test('Betaald verlof kan tot het saldo op is; daarna alleen onbetaald vrij',t=>{
 monday(t);
 let db=pilotRoster();
 person(db,'elise').leaveStartBalance=4;
 db=ask(db);
 assert.throws(()=>ask(db,{date:'2026-12-21',through:'2026-12-27',type:'verlof'}),
  /Je hebt nog 1 vakantiedag over \(na je open aanvragen\)\. Je vraagt er 3\. Kies minder dagen, overuren inzetten of onbetaald vrij\./);
 assert.ok(ask(db,{date:'2026-12-21',through:'2026-12-27',type:'onbetaald'}));
});

test('Vakantiedagen gaan mee naar het volgende jaar en daar komen de nieuwe bij',t=>{
 monday(t);
 let db=ask(pilotRoster());
 db=apply(db,'eva','decide',{id:last(db).id,accept:true,choices:{}});
 t.mock.timers.setTime(Date.parse('2027-01-04T12:00:00+01:00'));
 assert.equal(vacationLeft(db,'elise'),13+16);
});

test('De bedrijfsleider past het saldo vakantiedagen aan met een reden; dat wordt vastgelegd',t=>{
 monday(t);
 let db=pilotRoster();
 assert.throws(()=>apply(db,'iris','leaveSet',{user:'elise',days:10,reason:'x'}),/Alleen de bedrijfsleider/);
 assert.throws(()=>apply(db,'eva','leaveSet',{user:'elise',days:10,reason:''}),/reden/);
 db=apply(db,'eva','leaveSet',{user:'elise',days:10,reason:'Gelijkgetrokken met de loonadministratie'});
 assert.equal(vacationLeft(db,'elise'),10);
 const c=db.leaveCorrections.at(-1);
 assert.deepEqual([c.user,c.days,c.by],['elise',-6,'eva']);
 const body=dialogs.person(db,person(db,'eva'),'elise').body;
 assert.match(body,/Vakantiedagen over: <b>10<\/b>/);
 assert.match(body,/data-op="leaveSet"/);
});

test('Eva vult bij een nieuwe medewerker vakantiedagen per jaar en een startsaldo in',t=>{
 monday(t);
 const p={name:'Noor',role:'employee',contract:'vast',contractHours:32,areas:['Vloer'],
  vacationDays:'21',leaveStartBalance:'12.5'};
 const db=apply(pilotRoster(),'eva','savePerson',p);
 const noor=db.people.find(x=>x.name==='Noor');
 assert.deepEqual([noor.vacationDays,noor.leaveStartBalance,noor.leaveYear],[21,12.5,'2026']);
 assert.throws(()=>apply(pilotRoster(),'eva','savePerson',{...p,vacationDays:'-1'}),/vakantiedagen/);
});

test('Elise ziet bij Mijn uren en bij Vrij vragen hoeveel vakantiedagen ze nog heeft',t=>{
 monday(t);
 const db=pilotRoster(),elise=person(db,'elise');
 assert.match(hoursPage(db,elise,{page:'hours',month:'2026-11'}),/Vakantiedagen over<\/span><b>16<\/b>/);
 assert.match(dialogs.leave(db,elise,'2026-12-14').body,/Je hebt nog 16 vakantiedagen\./);
});

test('Bij beoordelen ziet Eva hoeveel vakantiedagen de aanvraag kost en hoeveel er over zijn',t=>{
 monday(t);
 const db=ask(pilotRoster());
 assert.match(dialogs.decision(db,person(db,'eva'),last(db).id).body,
  /Telt 3 vakantiedagen\. Elise B heeft er nog 16\./);
});

test('Bijzonder verlof: kies een soort, bij Anders een reden; het gaat niet van de vakantiedagen af',t=>{
 monday(t);
 let db=pilotRoster();
 assert.throws(()=>ask(db,{...week,type:'bijzonder'}),/Kies welk bijzonder verlof/);
 assert.throws(()=>ask(db,{...week,type:'bijzonder',special:'anders'}),/reden/);
 db=ask(db,{...week,type:'bijzonder',special:'rouwverlof'});
 assert.equal(last(db).special,'rouwverlof');
 db=apply(db,'eva','decide',{id:last(db).id,accept:true,choices:{},paid:'ja'});
 assert.equal(vacationLeft(db,'elise'),16);
 assert.ok(apply(pilotRoster(),'isis','leave',{...week,type:'bijzonder',special:'kort verzuim'}),'ook bij contract Uren');
});

test('Vrij vragen toont de keuzelijst bijzonder verlof met: vermeld geen medische informatie',t=>{
 monday(t);
 const db=pilotRoster(),body=dialogs.leave(db,person(db,'elise'),'2026-12-14').body;
 assert.match(body,/<option value="bijzonder">Bijzonder verlof<\/option>/);
 assert.match(body,/<div id="special" hidden>/);
 for(const s of ['Zwangerschapsverlof','Ouderschapsverlof','Rouwverlof','Kort verzuim','Anders'])assert.match(body,new RegExp(s));
 assert.match(body,/Vermeld geen medische informatie\./);
});

test('Overuren inzetten: een vierde soort bij vast contract; Eva ziet het saldo plus- en minuren bij beoordelen',t=>{
 monday(t);
 const db=pilotRoster(),elise=person(db,'elise');
 assert.match(dialogs.leave(db,elise,'2026-12-14').body,/<option value="overuren">Overuren inzetten<\/option>/);
 assert.doesNotMatch(dialogs.leave(db,person(db,'isis'),'2026-12-14').body,/value="overuren"/);
 const next=ask(db,{...week,type:'overuren'});
 assert.match(dialogs.decision(next,person(db,'eva'),last(next).id).body,/Saldo plus- en minuren van Elise B: 0u 0m/);
 assert.equal(vacationLeft(next,'elise'),16,'gaat niet van de vakantiedagen af');
});
