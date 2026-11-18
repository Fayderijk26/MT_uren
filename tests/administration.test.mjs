import test from 'node:test';
import assert from 'node:assert/strict';
import {apply,today,add,monday,ruleFor} from '../v2/model.js';
import {pilotRoster} from '../v2/pilot.js';
import {contractNorm,monthRows,exportMonth} from '../v2/administration.js';
import {opening} from '../v2/settings.js';
const example=()=>{
 const db=pilotRoster();db.shifts=[{id:'past',user:'elise',date:'2026-10-05',start:'08:30',end:'18:00',area:'Speelvloer'}];db.hours={};db.months={};return db;
};
test('Goedkeuring heeft auteur en tijd; heropenen bewaart versies en reden',()=>{
 let db=example();db=apply(db,'elise','hours',{id:'past',start:'08:30',end:'18:00',pause:0});
 db=apply(db,'eva','approve',{id:'past'});assert.equal(db.hours.past.approvedBy,'eva');assert.ok(db.hours.past.approvedAt);
 assert.throws(()=>apply(db,'iris','reopenHours',{id:'past',reason:'Controle'}));
 assert.throws(()=>apply(db,'eva','reopenHours',{id:'past',reason:''}));
 db=apply(db,'eva','reopenHours',{id:'past',reason:'Eindtijd controleren'});
 assert.equal(db.hours.past.reason,'Eindtijd controleren');assert.equal(db.hours.past.history.at(-1).previous.status,'approved');
 db=apply(db,'elise','hours',{id:'past',start:'08:30',end:'17:30',pause:30});
 assert.equal(db.hours.past.reason,'Eindtijd controleren');assert.equal(db.hours.past.approvedAt,null);
 db=apply(db,'eva','approve',{id:'past'});assert.equal(db.hours.past.history.length,5);
 assert.equal(db.hours.past.history[2].previous.end,'18:00');
});
test('Maand afsluiten vereist complete uren; afsluiting beschermt alle uurmutaties',()=>{
 let db=example();assert.throws(()=>apply(db,'eva','closeMonth',{month:'2026-10'}));
 db=apply(db,'elise','hours',{id:'past',start:'08:30',end:'18:00',pause:30});
 assert.throws(()=>apply(db,'eva','closeMonth',{month:'2026-10'}));
 db=apply(db,'eva','approve',{id:'past'});db=apply(db,'eva','closeMonth',{month:'2026-10'});
 assert.equal(db.months['2026-10'].closed,true);
 assert.throws(()=>apply(db,'eva','reopenHours',{id:'past',reason:'Controle'}),/afgesloten/);
 assert.throws(()=>apply(db,'isis','unplanned',{date:'2026-10-06',start:'09:00',end:'12:00',pause:0,area:'Speelvloer'}),/afgesloten/);
 assert.throws(()=>apply(db,'iris','reopenMonth',{month:'2026-10',reason:'Controle'}));
 db=apply(db,'eva','reopenMonth',{month:'2026-10',reason:'Correctie loonstaat'});
 db=apply(db,'eva','reopenHours',{id:'past',reason:'Controle'});assert.equal(db.hours.past.status,'returned');
});
test('Contractnorm rekent ingangsdata en CSV export bevat controle-informatie',()=>{
 let db=example();db.people.find(p=>p.id==='elise').contracts=[{from:'2026-10-01',weeklyHours:14},{from:'2026-10-16',weeklyHours:28}];
 assert.equal(contractNorm(db.people.find(p=>p.id==='elise'),'2026-10'),(15*2+16*4)*60);
 db=apply(db,'elise','hours',{id:'past',start:'08:30',end:'18:00',pause:30});db=apply(db,'eva','approve',{id:'past'});
 const data=exportMonth(db,db.people.find(p=>p.id==='eva'),'2026-10');assert.match(data.detail,/Eva G/);assert.match(data.summary,/9,00/);assert.match(data.summary,/94,00/);
 assert.throws(()=>exportMonth(db,db.people.find(p=>p.id==='elise'),'2026-10'));
 db.people.find(p=>p.id==='elise').name='=HYPERLINK("evil")';assert.match(exportMonth(db,db.people[0],'2026-10').summary,/'=HYPERLINK/);
});
test('Nieuwe medewerker, rolwijziging en inactief zijn beschermd',()=>{
 let db=example(),p={name:'Test collega',role:'employee',email:'test@example.com',phone:'+31612345678',weeklyHours:16,from:today(),active:'yes'};
 assert.throws(()=>apply(db,'iris','person',p));db=apply(db,'eva','person',p);const person=db.people.at(-1);assert.equal(person.contracts[0].weeklyHours,16);
 db=apply(db,'eva','person',{...p,id:person.id,active:'no'});assert.equal(db.people.at(-1).active,false);
 assert.throws(()=>apply(db,person.id,'extra',{date:today()}));
 assert.throws(()=>apply(db,'eva','person',{...p,id:'eva',active:'no',role:'admin'}));
});
test('Openingstijden sturen hele dag zonder bestaande uren te veranderen',()=>{
 let db=pilotRoster();const shift=structuredClone(db.shifts[0]);const p={};for(let n=1;n<=7;n++){p['start'+n]='09:00';p['end'+n]='20:00';}
 assert.throws(()=>apply(db,'elise','settings',p));db=apply(db,'eva','settings',p);
 assert.deepEqual(opening(db,'2026-12-01'),{start:'09:00',end:'20:00',closed:false});
 assert.deepEqual(db.shifts[0],shift);assert.equal(ruleFor(db,{user:'eva',date:'2026-12-01'}).end,'20:00');
 db=apply(db,'elise','extra',{date:add(today(),1),mode:'all'});assert.equal(db.extra.at(-1).end,'20:00');
});
test('Reactie gaat naar tweede bedrijfsleider die het voorstel maakte',()=>{
 let db=pilotRoster();db.people.push({id:'admin2',name:'Tweede leiding',role:'admin'});const date='2026-12-04';
 db=apply(db,'admin2','draft',{user:'sylvia',date,start:'08:30',end:'18:00',area:'Speelvloer'});db=apply(db,'admin2','publish',{date,through:date,confirm:true});
 assert.equal(db.offers[0].requestedBy,'admin2');db=apply(db,'sylvia','offer',{id:db.offers[0].id,answer:'no'});
 assert.equal(db.updates.at(-1).user,'admin2');
});
test('Concept uit vaste beschikbaarheid slaat vrij en overlap over, herhaling dupliceert niet',()=>{
 let db=pilotRoster();const date=add(monday(today()),21);
 db.requests.push({id:'leave',kind:'leave',user:'elise',date,through:date,status:'pending'});
 db=apply(db,'eva','generate',{date,source:'availability'});
 assert.ok(db.drafts.length>0);assert.ok(!db.drafts.some(s=>s.user==='elise'&&s.date===date));
 const count=db.drafts.length;db=apply(db,'eva','generate',{date,source:'availability'});assert.equal(db.drafts.length,count);assert.equal(db.generation.created,0);
 assert.equal(db.offers.length,0);
});
test('Vorige week kopiëren maakt alleen concept en respecteert nieuwe vrije dag',()=>{
 let db=pilotRoster();const date=add(monday(today()),14),prev=add(date,-7);
 db.shifts.push({id:'copy',user:'eva',date:add(prev,1),start:'09:00',end:'17:00',area:'Kantoor'});
 // Remove the seed week to isolate the copied service.
 db.shifts=db.shifts.filter(s=>s.id==='copy');
 db=apply(db,'eva','generate',{date,source:'previous'});assert.equal(db.drafts.length,1);assert.equal(db.drafts[0].start,'09:00');assert.equal(db.shifts.length,1);
});
