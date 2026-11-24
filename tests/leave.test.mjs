import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// ui.js laadt bij het starten de iconen met fetch; in Node lezen we het bestand zelf.
globalThis.fetch=async url=>({json:async()=>JSON.parse(fs.readFileSync(new URL(url),'utf8'))});
const {pilotRoster}=await import('../v2/pilot.js');
const {apply,monthSummary,mayPaidLeave,absentMinutes}=await import('../v2/model.js');
const {requestName}=await import('../v2/view.js');
const {todayPage}=await import('../v2/today.js');

// Donderdag 19 november, 12:00. Elise (vast) werkt zaterdag 21 november 10:00–18:00. Isis heeft contract Uren.
const thursday=t=>t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-19T12:00:00+01:00')});
const saturday='elise-2026-11-21';
const person=(db,id)=>db.people.find(p=>p.id===id);
// Goedkeuren met een keuze per dienst die vervalt of deels blijft.
function approve(db,value='none'){
 const r=db.requests.at(-1),shift=db.shifts.find(s=>s.user===r.user&&s.date===r.date);
 const choices=shift?{[shift.id]:{before:JSON.stringify(shift),value}}:{};
 return apply(db,'eva','decide',{id:r.id,accept:true,choices});
}

test('Isis heeft contract Uren: zij kan geen betaald verlof kiezen, alleen onbetaald vrij',t=>{
 thursday(t);
 const db=pilotRoster();
 assert.equal(person(db,'isis').contract,'uren');
 assert.ok(!mayPaidLeave(db,'isis'));
 assert.ok(mayPaidLeave(db,'elise'));
 assert.throws(()=>apply(db,'isis','leave',{date:'2026-12-24',type:'verlof'}),/vast contract/);
 assert.equal(apply(db,'isis','leave',{date:'2026-12-24',type:'onbetaald'}).requests.at(-1).type,'onbetaald');
});

test('Elise krijgt verlof voor zaterdag: de vervallen dienst blijft bewaard en een verlofdag telt altijd 8 uur',t=>{
 thursday(t);
 let db=apply(pilotRoster(),'elise','leave',{date:'2026-11-21',type:'verlof',reason:'Bruiloft'});
 db=approve(db);
 assert.ok(!db.shifts.some(s=>s.id===saturday),'dienst staat niet meer in het rooster');
 assert.deepEqual(db.requests.at(-1).dropped,[{date:'2026-11-21',start:'10:00',end:'18:00'}]);
 assert.equal(monthSummary(db,'2026-11').find(r=>r.user==='elise').leave,480);
});

test('Onbetaald vrij bewaart ook de vervallen dienst, maar telt niet als verlof',t=>{
 thursday(t);
 let db=apply(pilotRoster(),'elise','leave',{date:'2026-11-21',type:'onbetaald'});
 db=approve(db);
 assert.equal(db.requests.at(-1).dropped.length,1);
 assert.equal(monthSummary(db,'2026-11').find(r=>r.user==='elise').leave,0);
});

test('Een deel van de dag kan geen betaald verlof zijn: Elise zet overuren in voor zaterdag 15:00–18:00',t=>{
 thursday(t);
 const part={date:'2026-11-21',start:'15:00',end:'18:00'};
 assert.throws(()=>apply(pilotRoster(),'elise','leave',{...part,type:'verlof'}),
  /Betaald verlof gaat in hele dagen\. Kies voor een deel van de dag overuren inzetten of onbetaald vrij\./);
 assert.throws(()=>apply(pilotRoster(),'isis','leave',{...part,date:'2026-11-28',type:'overuren'}),/vast contract/);
 let db=apply(pilotRoster(),'elise','leave',{...part,type:'overuren'});
 db=approve(db,'0');
 assert.deepEqual(db.shifts.filter(s=>s.user==='elise'&&s.date==='2026-11-21').map(s=>s.start+'-'+s.end),['10:00-15:00']);
 assert.deepEqual(db.requests.at(-1).dropped,[{date:'2026-11-21',start:'15:00',end:'18:00'}]);
 const row=monthSummary(db,'2026-11').find(r=>r.user==='elise');
 assert.equal(row.leave,0,'telt niet als verlof: het gaat van de plusuren af');
 assert.equal(row.overtime,absentMinutes({start:'15:00',end:'18:00'}));
});

test('Verlof op een vaste werkdag zonder geplande dienst telt ook 8 uur',t=>{
 thursday(t);
 let db=apply(pilotRoster(),'elise','leave',{date:'2026-12-24',type:'verlof'});
 db=approve(db);
 assert.deepEqual(db.requests.at(-1).dropped,[]);
 assert.equal(monthSummary(db,'2026-12').find(r=>r.user==='elise').leave,480);
});

test('Elise gaat naar contract Uren voordat haar verlof is goedgekeurd: goedkeuren als verlof lukt dan niet',t=>{
 thursday(t);
 let db=apply(pilotRoster(),'elise','leave',{date:'2026-12-24',type:'verlof'});
 const elise=person(db,'elise');
 db=apply(db,'eva','savePerson',{...elise,contract:'uren',contractHours:String(elise.contractHours)});
 assert.throws(()=>approve(db),/vast contract/);
});

test('Een aanvraag zonder soort is onbetaald vrij, zoals vrij vragen altijd werkte',t=>{
 thursday(t);
 const db=apply(pilotRoster(),'isis','leave',{date:'2026-12-24'});
 assert.equal(db.requests.at(-1).type,'onbetaald');
 assert.match(requestName({...db.requests.at(-1),type:undefined}),/Onbetaald vrij/);
});

test('De bedrijfsleider kiest bij een medewerker Vast of Uren',()=>{
 const base={name:'Noor V',role:'employee',contractHours:'0',phone:'',areas:['Vloer']};
 assert.throws(()=>apply(pilotRoster(),'eva','savePerson',base),/Kies het soort contract/);
 const db=apply(pilotRoster(),'eva','savePerson',{...base,contract:'uren'});
 assert.equal(db.people.at(-1).contract,'uren');
});

test('Bij een aanvraag staat de soort: Verlof (betaald) of Onbetaald vrij',t=>{
 thursday(t);
 const db=apply(pilotRoster(),'elise','leave',{date:'2026-12-24',type:'verlof'});
 assert.equal(requestName(db.requests.at(-1)),'do 24 dec · Hele dag · Verlof (betaald)');
});

const {leaveTypeField}=await import('../v2/view.js');

test('Vrij vragen: bij een vast contract staat Verlof (betaald) vooraf gekozen, bij Uren alleen Onbetaald vrij',()=>{
 const db=pilotRoster();
 assert.match(leaveTypeField(db,'elise'),/<option value="verlof" selected>Verlof \(betaald\)<\/option><option value="overuren">/);
 assert.doesNotMatch(leaveTypeField(db,'isis'),/value="verlof"/);
 assert.match(leaveTypeField(db,'isis'),/alleen bij een vast contract/);
});

test('Elise vraagt verlof, Eva keurt goed als onbetaald vrij: telt geen verlof en Elise ziet dat de soort is aangepast',t=>{
 thursday(t);
 let db=apply(pilotRoster(),'elise','leave',{date:'2026-11-21',type:'verlof'});
 const r=db.requests.at(-1),shift=db.shifts.find(s=>s.id===saturday);
 assert.match(leaveTypeField(db,'elise','verlof'),/value="verlof" selected/,'bij beoordelen staat de gevraagde soort');
 db=apply(db,'eva','decide',{id:r.id,accept:true,type:'onbetaald',choices:{[saturday]:{before:JSON.stringify(shift),value:'none'}}});
 const done=db.requests.at(-1);
 assert.deepEqual([done.type,done.askedType],['onbetaald','verlof']);
 assert.equal(monthSummary(db,'2026-11').find(x=>x.user==='elise').leave,0);
 assert.match(requestName(done),/Onbetaald vrij/);
 assert.match(todayPage(db,person(db,'elise')),/Soort aangepast: je vroeg Verlof \(betaald\)/);
});

test('Eva kan een aanvraag van Isis (contract Uren) niet als betaald verlof goedkeuren',t=>{
 thursday(t);
 const db=apply(pilotRoster(),'isis','leave',{date:'2026-12-24',type:'onbetaald'});
 const id=db.requests.at(-1).id;
 assert.throws(()=>apply(db,'eva','decide',{id,accept:true,type:'verlof'}),/vast contract/);
 assert.throws(()=>apply(db,'eva','decide',{id,accept:true,type:'vakantie'}),/Kies verlof, overuren inzetten, onbetaald vrij of bijzonder verlof/);
 assert.equal(apply(db,'eva','decide',{id,accept:true,type:'onbetaald'}).requests.at(-1).askedType,undefined);
});
