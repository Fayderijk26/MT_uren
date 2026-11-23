import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// ui.js laadt bij het starten de iconen met fetch; in Node lezen we het bestand zelf.
globalThis.fetch=async url=>({json:async()=>JSON.parse(fs.readFileSync(new URL(url),'utf8'))});
const {pilotRoster}=await import('../v2/pilot.js');
const {apply,monthSummary,mayPaidLeave,absentMinutes}=await import('../v2/model.js');
const {requestName}=await import('../v2/view.js');

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

test('Elise krijgt verlof voor zaterdag: de vervallen dienst blijft bewaard en telt 7u 30m verlof',t=>{
 thursday(t);
 let db=apply(pilotRoster(),'elise','leave',{date:'2026-11-21',type:'verlof',reason:'Bruiloft'});
 db=approve(db);
 assert.ok(!db.shifts.some(s=>s.id===saturday),'dienst staat niet meer in het rooster');
 assert.deepEqual(db.requests.at(-1).dropped,[{date:'2026-11-21',start:'10:00',end:'18:00'}]);
 assert.equal(monthSummary(db,'2026-11').find(r=>r.user==='elise').leave,450);
});

test('Onbetaald vrij bewaart ook de vervallen dienst, maar telt niet als verlof',t=>{
 thursday(t);
 let db=apply(pilotRoster(),'elise','leave',{date:'2026-11-21',type:'onbetaald'});
 db=approve(db);
 assert.equal(db.requests.at(-1).dropped.length,1);
 assert.equal(monthSummary(db,'2026-11').find(r=>r.user==='elise').leave,0);
});

test('Deels verlof: Elise werkt zaterdag tot 15:00, alleen 15:00–18:00 telt als verlof',t=>{
 thursday(t);
 let db=apply(pilotRoster(),'elise','leave',{date:'2026-11-21',start:'15:00',end:'18:00',type:'verlof'});
 db=approve(db,'0');
 assert.deepEqual(db.shifts.filter(s=>s.user==='elise'&&s.date==='2026-11-21').map(s=>s.start+'-'+s.end),['10:00-15:00']);
 assert.deepEqual(db.requests.at(-1).dropped,[{date:'2026-11-21',start:'15:00',end:'18:00'}]);
 assert.equal(monthSummary(db,'2026-11').find(r=>r.user==='elise').leave,absentMinutes({start:'15:00',end:'18:00'}));
});

test('Verlof op een dag zonder geplande dienst telt 0 uur',t=>{
 thursday(t);
 let db=apply(pilotRoster(),'elise','leave',{date:'2026-12-24',type:'verlof'});
 db=approve(db);
 assert.deepEqual(db.requests.at(-1).dropped,[]);
 assert.equal(monthSummary(db,'2026-12').find(r=>r.user==='elise').leave,0);
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
