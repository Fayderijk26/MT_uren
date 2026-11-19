import test from 'node:test';
import assert from 'node:assert/strict';
import {apply,add,today,weekday,remaining} from '../v2/model.js';

test('Mila beslist over een wijziging buiten haar beschikbaarheid',()=>{
 let db=seed();
 const old=db.shifts.find(s=>s.id==='s6');
 db.rules.push({user:'mila',date:old.date,weekday:weekday(old.date),start:'12:00',end:'18:00'});
 db=apply(db,'noor','draft',{...old,start:'10:00'});
 db=apply(db,'noor','publish',{date:old.date,through:old.date,confirm:true});
 assert.deepEqual(db.shifts.find(s=>s.id===old.id),old);
 const id=db.offers[0].id;
 assert.throws(()=>apply(db,'noor','offer',{id,answer:'yes'}));
 assert.deepEqual(apply(db,'mila','offer',{id,answer:'no'}).shifts,db.shifts);
 assert.equal(apply(db,'mila','offer',{id,answer:'yes'}).shifts.find(s=>s.id===old.id).start,'10:00');
});
test('Mila kan dezelfde uren opnieuw bevestigen en goedgekeurde uren zijn vergrendeld',()=>{
 let db=apply(seed(),'bram','return',{id:'s3',reason:'Controleer je eindtijd'});
 db=apply(db,'mila','hours',{...db.hours.s3,id:'s3'});
 db=apply(db,'bram','approve',{id:'s3'});
 assert.throws(()=>apply(db,'mila','hours',{...db.hours.s3,id:'s3'}));
});
test('Vrij midden in de dienst splitst pas bij akkoord en beschermt tegen een verouderde beslissing',()=>{
 let db=seed();const s=db.shifts.find(x=>x.id==='s6');
 db=apply(db,'mila','leave',{date:s.date,start:'14:00',end:'16:00'});
 const id=db.requests[0].id;
 assert.throws(()=>apply(db,'noor','decide',{id,accept:true}));
 const choices={[s.id]:{before:JSON.stringify(s),value:'all'}};
 assert.throws(()=>apply(db,'bram','decide',{id,accept:true,choices}));
 const result=apply(db,'noor','decide',{id,accept:true,choices});
 assert.deepEqual(result.shifts.filter(x=>x.date===s.date).map(x=>[x.start,x.end]),remaining(s,db.requests[0]).map(x=>[x.start,x.end]));
});
test('Aansluitende diensten mogen, overlappende diensten niet',()=>{
 const p={date:today(),start:'10:00',end:'11:00',pause:0,area:'Keuken'};
 assert.throws(()=>apply(seed(),'mila','unplanned',p),/overlap/);
 const db=apply(seed(),'mila','unplanned',{...p,start:'17:30',end:'18:00'});
 assert.equal(db.shifts.length,seed().shifts.length+1);
});

for(const publishFirst of [false,true]){
 test('Akkoord op een vraag '+(publishFirst?'na':'vóór')+' publicatie',()=>{
  let db=seed();
  const date=db.shifts.find(s=>s.id==='s6').date;
  const empty=new Date(date+'T12:00Z');empty.setUTCDate(empty.getUTCDate()+7);
  const day=empty.toISOString().slice(0,10);
  db=apply(db,'noor','draft',{user:'mila',date:day,start:'11:00',end:'18:00',area:'Keuken'});
  assert.equal(db.offers.length,1);
  if(publishFirst)db=apply(db,'noor','publish',{date:day,through:day});
  db=apply(db,'mila','offer',{id:db.offers[0].id,answer:'yes'});
  assert.equal(db.drafts.length,publishFirst?0:1);
  if(!publishFirst)db=apply(db,'noor','publish',{date:day,through:day});
  assert.equal(db.shifts.filter(s=>s.date===day).length,1);
  assert.equal(db.offers.length,0);
 });
}
test('Stand-by vereist een besluit en kan eenmalig worden afgehandeld',()=>{
 let db=seed();
 db=apply(db,'noor','extra',{date:today()});
 db=apply(db,'noor','draft',{user:'noor',date:today(),start:'11:00',end:'18:00',deadline:'11:00',area:'Keuken'});
 db=apply(db,'noor','publish',{date:today(),through:today()});
 const id=db.shifts.find(s=>s.deadline).id;
 assert.throws(()=>apply(db,'bram','release',{id}));
 assert.throws(()=>apply(db,'noor','hours',{id,start:'11:00',end:'18:00',pause:0}));
 assert.ok(!apply(db,'noor','release',{id}).shifts.some(s=>s.id===id));
 const called=apply(db,'noor','call',{id,start:'12:00',end:'18:00'});
 assert.equal(called.shifts.find(s=>s.id===id).start,'12:00');
 assert.throws(()=>apply(called,'noor','release',{id}));
});

function seed(day=today()){
  const people=[{id:'mila',name:'Mila Vos',role:'employee'},{id:'bram',name:'Bram Meijer',role:'lead'},{id:'noor',name:'Noor Post',role:'admin'}];
  const shift=(id,user,n,start,end,area)=>({id,user,date:add(day,n),start,end,area});
  return {people,shifts:[shift('s1','mila',0,'09:30','17:30','Speelvloer'),shift('s2','bram',0,'09:00','18:00','Dagleiding'),shift('s3','mila',-1,'10:00','18:00','Keuken'),shift('s4','bram',-1,'09:00','18:00','Dagleiding'),shift('s5','mila',-2,'12:00','16:00','Keuken'),shift('s6','mila',3,'12:00','18:00','Speelvloer')],hours:{s3:{start:'10:00',end:'18:00',pause:30,status:'pending'}},drafts:[],requests:[],offers:[],rules:[],extra:[],updates:[]};
}

import {pilotRoster} from '../v2/pilot.js';
import {ruleFor} from '../v2/model.js';
test('Proefrooster bevat twee volledige weken en wisselt de weekenddagen blijvend af',()=>{
 const db=pilotRoster();
 assert.equal(db.shifts.length,28);
 assert.equal(db.people.length,5);
 for(const [id,days] of Object.entries({eva:[2,4],iris:[1,4,5],sylvia:[2,3,5],isis:[6],elise:[1,4,6]})){
  for(let n=0;n<56;n++){
   const day=n%7+1,date=add('2026-11-16',n);
   const saturday=Math.floor(n/7)%2===0?'iris':'sylvia';
   const weekend=day>=6&&['iris','sylvia'].includes(id)&&(day===6)===(id===saturday);
   const works=days.includes(day)||weekend;
   assert.equal(Boolean(ruleFor(db,{user:id,date})),works);
   if(n<14)assert.equal(db.shifts.some(s=>s.user===id&&s.date===date),works);
  }
 }
});

test('Kwartieren gelden ook voor werkelijk gewerkte uren',()=>{
 assert.throws(()=>apply(seed(),'mila','hours',{id:'s1',start:'09:10',end:'17:30',pause:15}),/kwartier/);
});
test('Hele dag en expliciet behoud bestaande diensten',()=>{
 let db=apply(pilotRoster(),'elise','extra',{date:today()});
 assert.equal(db.extra[0].start,'08:30');
 assert.equal(db.extra[0].end,'18:00');
 const thursday=add(today(),(4-weekday(today())+7)%7||7);
 db=apply(db,'elise','weekly',{date:thursday,weekday:4,start:'10:00',end:'16:00'});
 const id=db.requests[0].id;
 assert.throws(()=>apply(db,'eva','decide',{id,accept:true}),/bevestig/);
 const result=apply(db,'eva','decide',{id,accept:true,keep:'yes'});
 assert.deepEqual(result.shifts,db.shifts);
 assert.equal(ruleFor(result,{user:'elise',date:thursday}).end,'16:00');
});

import {migratePilot} from '../v2/pilot.js';


test('Beschikbaar vanaf 10:00: basisdienst staat vast, eerder beginnen vraagt toestemming',()=>{
 let db=pilotRoster();const date='2026-12-04';
 db=apply(db,'eva','draft',{user:'sylvia',date,start:'08:30',end:'18:00',area:'Speelvloer'});
 db=apply(db,'eva','publish',{date,through:date,confirm:true});
 const s=db.shifts.find(s=>s.user==='sylvia'&&s.date===date),o=db.offers.at(-1);
 assert.equal(s.start,'10:00');assert.equal(o.row.start,'08:30');assert.equal(o.availability.start,'10:00');
 const no=apply(db,'sylvia','offer',{id:o.id,answer:'no'});
 assert.equal(no.shifts.find(x=>x.id===s.id).start,'10:00');assert.equal(no.offers.length,0);
 assert.match(no.updates.at(-1).text,/Sylvia.*blijft 10:00/);
 const yes=apply(db,'sylvia','offer',{id:o.id,answer:'yes'});
 assert.equal(yes.shifts.find(x=>x.id===s.id).start,'08:30');
 assert.equal(yes.shifts.filter(x=>x.user==='sylvia'&&x.date===date).length,1);
 assert.throws(()=>apply(db,'iris','offer',{id:o.id,answer:'yes'}));
});
test('Buiten beschikbaarheid zonder overlap, onbekend en vrij geeft geen basisdienst',()=>{
 for(const scenario of ['outside','unknown','free']){
  let db=pilotRoster();const date='2026-12-04';
  if(scenario==='unknown')db.rules=db.rules.filter(r=>r.user!=='sylvia');
  if(scenario==='free')db.requests.push({id:'vrij',kind:'leave',user:'sylvia',date,through:date,status:'approved'});
  db=apply(db,'eva','draft',{user:'sylvia',date,start:'08:30',end:scenario==='outside'?'09:30':'18:00',area:'Speelvloer'});
  db=apply(db,'eva','publish',{date,through:date,confirm:true});
  assert.equal(db.shifts.some(s=>s.date===date&&s.user==='sylvia'),false);
  assert.equal(db.offers.length,1);
 }
});
test('Dagleiding kan niet plannen of publiceren',()=>{
 let db=pilotRoster(),date='2026-12-04';
 db=apply(db,'eva','draft',{user:'sylvia',date,start:'10:00',end:'18:00',area:'Speelvloer'});

 assert.throws(()=>apply(db,'iris','draft',{user:'sylvia',date,start:'10:00',end:'18:00',area:'Speelvloer'}));
 assert.throws(()=>apply(db,'iris','publish',{date,through:date}));
});
test('Voorbeeldmigratie behoudt aangepaste diensten, uren en aanvragen',()=>{
 const db=pilotRoster();delete db.pilotTimesVersion;
 for(const r of db.rules)r.start='10:00';for(const s of db.shifts)s.start='10:00';
 db.shifts.find(s=>s.id==='eva-2026-11-19').start='09:15';
 const hours=JSON.stringify(db.hours);migratePilot(db);
 assert.equal(db.shifts.find(s=>s.id==='eva-2026-11-19').start,'09:15');
 assert.equal(db.shifts.find(s=>s.id==='eva-2026-11-24').start,'08:30');
 assert.equal(JSON.stringify(db.hours),hours);
 assert.equal(db.rules.filter(r=>r.start==='10:00').length,3);
 const snapshot=JSON.stringify(db);migratePilot(db);assert.equal(JSON.stringify(db),snapshot);

});
