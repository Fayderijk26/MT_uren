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
test('Aansluitende diensten mogen, overlappende diensten niet',t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-19T20:00:00+01:00')});
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
  return {people,shifts:[shift('s1','mila',0,'09:30','17:30','Speelvloer'),shift('s2','bram',0,'09:00','18:00','Dagleiding'),shift('s3','mila',-1,'10:00','18:00','Keuken'),shift('s4','bram',-1,'09:00','18:00','Dagleiding'),shift('s5','mila',-2,'12:00','16:00','Keuken'),shift('s6','mila',3,'12:00','18:00','Speelvloer')],hours:{s3:{start:'10:00',end:'18:00',pause:30,status:'pending'}},drafts:[],requests:[],offers:[],rules:[],extra:[],updates:[],normOverrides:[],closedMonths:[],monthReopens:[]};
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
 // Een dag (vanaf vandaag) waarop Elise nog niet is ingepland.
 const free=[0,1,2,3,4,5,6,7].map(n=>add(today(),n)).find(d=>!pilotRoster().shifts.some(s=>s.user==='elise'&&s.date===d));
 let db=apply(pilotRoster(),'elise','extra',{date:free});
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

import {missing,mayRemind} from '../v2/model.js';
function forgottenTuesday(){
 const db=pilotRoster(),tuesday='2026-11-17';
 db.shifts.push({id:'elise-dinsdag',user:'elise',date:tuesday,start:'08:30',end:'18:00',area:'Speelvloer'});
 return db;
}
const missingOf=(db,actor,user)=>{
 const person=db.people.find(p=>p.id===actor);
 return missing(db,person,'2026-11-18').filter(m=>m.shift.user===user);
};

test('Elise vergeet haar uren van dinsdag: Eva en Sylvia zien het, na invullen verdwijnt het',()=>{
 let db=forgottenTuesday();
 for(const actor of ['elise','eva','sylvia']){
  const rows=missingOf(db,actor,'elise');
  assert.deepEqual(rows.map(m=>[m.shift.id,m.late]),[['elise-dinsdag',1]]);
 }
 assert.equal(missingOf(db,'iris','elise').length,0);
 db=apply(db,'elise','hours',{id:'elise-dinsdag',start:'08:30',end:'17:30',pause:30});
 for(const actor of ['elise','eva','sylvia'])assert.equal(missingOf(db,actor,'elise').length,0);
});

test('Leiding en bedrijfsleider zien ook hun eigen ontbrekende uren',()=>{
 const db=forgottenTuesday();
 assert.ok(missingOf(db,'sylvia','sylvia').some(m=>m.shift.date==='2026-11-17'));
 assert.ok(missingOf(db,'eva','eva').some(m=>m.shift.date==='2026-11-17'));
 assert.equal(missingOf(db,'elise','sylvia').length,0);
});

test('Alleen de bedrijfsleider en de dagleiding van die dag mogen herinneren',()=>{
 const db=forgottenTuesday(),shift=db.shifts.find(s=>s.id==='elise-dinsdag');
 const person=id=>db.people.find(p=>p.id===id);
 assert.ok(mayRemind(db,person('eva'),shift));
 assert.ok(mayRemind(db,person('sylvia'),shift));
 assert.ok(!mayRemind(db,person('iris'),shift));
 assert.ok(!mayRemind(db,person('isis'),shift));
 assert.ok(!mayRemind(db,person('elise'),shift));
});

// Maandag 16 november: Iris (leiding) en Elise werken; Sylvia krijgt in deze tests ook een dienst.
function twoLeadsMonday(){
 const db=pilotRoster(),monday='2026-11-16';
 db.shifts.push({id:'sylvia-maandag',user:'sylvia',date:monday,start:'08:30',end:'18:00',area:'Dagleiding'});
 db.hours['iris-'+monday]={start:'08:30',end:'18:00',pause:30,status:'pending'};
 return db;
}

test('Iris en Sylvia hebben allebei dienst: zij keuren elkaars en hun eigen uren goed',()=>{
 const base=twoLeadsMonday();
 let db=apply(base,'iris','approve',{id:'elise-2026-11-16'});
 assert.equal(db.hours['elise-2026-11-16'].approvedBy,'iris');
 assert.ok(db.hours['elise-2026-11-16'].approvedAt);
 db=apply(base,'sylvia','approve',{id:'iris-2026-11-16'});
 assert.equal(db.hours['iris-2026-11-16'].approvedBy,'sylvia');
 db=apply(base,'iris','approve',{id:'iris-2026-11-16'});
 assert.equal(db.hours['iris-2026-11-16'].status,'approved');
 assert.equal(db.hours['iris-2026-11-16'].approvedBy,'iris');
 assert.throws(()=>apply(base,'elise','approve',{id:'elise-2026-11-16'}));
});

test('Eva heropent goedgekeurde uren van Elise: Elise past aan, leiding ziet wie eerder goedkeurde',()=>{
 let db=apply(twoLeadsMonday(),'iris','approve',{id:'elise-2026-11-16'});
 const id='elise-2026-11-16';
 assert.throws(()=>apply(db,'iris','reopen',{id,reason:'pauze klopte niet'}),/bedrijfsleider/);
 assert.throws(()=>apply(db,'eva','reopen',{id,reason:''}),/reden/);
 db=apply(db,'eva','reopen',{id,reason:'pauze klopte niet'});
 assert.equal(db.hours[id].status,'returned');
 assert.equal(db.hours[id].reason,'pauze klopte niet');
 assert.equal(db.hours[id].reopenedBy,'eva');
 db=apply(db,'elise','hours',{id,start:'08:30',end:'18:00',pause:45});
 assert.equal(db.hours[id].status,'pending');
 assert.equal(db.hours[id].pause,45);
 assert.equal(db.hours[id].approvedBy,'iris');
 assert.throws(()=>apply(db,'eva','reopen',{id,reason:'nog eens'}),/goedgekeurde/);
});

import {warnings} from '../v2/model.js';
// Zet de klok vast op donderdag 19 november 2026, Nederlandse tijd (UTC+1).
const clockAt=(t,time)=>t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-19T'+time+':00+01:00')});

test('Het is 13:00 en Elise werkt tot 18:00: 08:30–13:00 lukt, 08:30–16:00 niet',t=>{
 clockAt(t,'13:00');
 const id='elise-2026-11-19';
 assert.equal(apply(pilotRoster(),'elise','hours',{id,start:'08:30',end:'13:00',pause:30}).hours[id].end,'13:00');
 assert.throws(()=>apply(pilotRoster(),'elise','hours',{id,start:'08:30',end:'16:00',pause:30}),/niet later .* dan nu/);
});

test('Om 12:50 mag 13:00 al (15 minuten speling), 13:15 nog niet',t=>{
 clockAt(t,'12:50');
 const id='elise-2026-11-19';
 assert.ok(apply(pilotRoster(),'elise','hours',{id,start:'08:30',end:'13:00',pause:30}));
 assert.throws(()=>apply(pilotRoster(),'elise','hours',{id,start:'08:30',end:'13:15',pause:30}),/dan nu/);
});

test('Ongeplande dienst van vandaag mag niet in de toekomst eindigen; een eerdere dag wel tot elke tijd',t=>{
 clockAt(t,'13:00');
 const shift={area:'Speelvloer',pause:0};
 assert.throws(()=>apply(pilotRoster(),'isis','unplanned',{...shift,date:'2026-11-19',start:'09:00',end:'16:00'}),/dan nu/);
 assert.ok(apply(pilotRoster(),'isis','unplanned',{...shift,date:'2026-11-19',start:'09:00',end:'13:00'}));
 assert.ok(apply(pilotRoster(),'isis','unplanned',{...shift,date:'2026-11-18',start:'09:00',end:'22:00'}));
});

test('Leiding krijgt een waarschuwing bij uren die eerder eindigen dan het rooster of zonder pauze op een lange dag',()=>{
 const db=pilotRoster(),s=db.shifts.find(x=>x.id==='elise-2026-11-16');
 const check=(start,end,pause)=>warnings({...db,hours:{[s.id]:{start,end,pause,status:'pending'}}},s);
 assert.deepEqual(check('08:30','18:00',30),[]);
 assert.deepEqual(check('08:30','13:00',30),['Eindigt vóór het rooster (gepland tot 18:00)']);
 assert.deepEqual(check('08:30','18:00',0),['Geen pauze bij een lange dag']);
 assert.deepEqual(check('12:30','18:00',0),[]);
 assert.deepEqual(check('12:15','18:00',0),['Geen pauze bij een lange dag']);
 assert.deepEqual(check('08:30','14:15',0),['Eindigt vóór het rooster (gepland tot 18:00)','Geen pauze bij een lange dag']);
});

import {normMinutes,monthSummary} from '../v2/model.js';
test('Elise werkt 24 uur per week: haar maandnorm is 104 uur (× 52 ÷ 12)',()=>{
 const db=pilotRoster();
 assert.equal(db.people.find(p=>p.id==='elise').contractHours,24);
 assert.equal(normMinutes(db,'elise','2026-11'),104*60);
 assert.equal(normMinutes(db,'elise','2026-12'),104*60);
});

test('Eva overschrijft de norm van Elise voor november met reden; Iris mag dat niet',()=>{
 const base=pilotRoster(),p={user:'elise',month:'2026-11',minutes:90*60,reason:'Start halverwege de maand'};
 assert.throws(()=>apply(base,'iris','setNorm',p),/bedrijfsleider/);
 assert.throws(()=>apply(base,'eva','setNorm',{...p,reason:''}),/reden/);
 assert.throws(()=>apply(base,'eva','setNorm',{...p,minutes:-5}),/norm/);
 let db=apply(base,'eva','setNorm',p);
 assert.equal(normMinutes(db,'elise','2026-11'),90*60);
 assert.equal(normMinutes(db,'elise','2026-12'),104*60);
 db=apply(db,'eva','setNorm',{...p,minutes:80*60});
 assert.equal(db.normOverrides.length,1);
 assert.equal(normMinutes(db,'elise','2026-11'),80*60);
});

test('Maandoverzicht november: goedgekeurd, nog open, norm en verschil per persoon',()=>{
 let db=pilotRoster();
 db=apply(db,'iris','approve',{id:'elise-2026-11-16'});
 const rows=monthSummary(db,'2026-11','2026-11-19');
 const elise=rows.find(r=>r.user==='elise'),iris=rows.find(r=>r.user==='iris');
 assert.equal(elise.approved,9*60);
 assert.equal(elise.norm,104*60);
 assert.equal(elise.diff,9*60-104*60);
 assert.deepEqual(elise.open.map(o=>o.shift.id),[]);
 assert.equal(iris.approved,9*60);
 const sylvia=rows.find(r=>r.user==='sylvia');
 assert.deepEqual(sylvia.open.map(o=>[o.shift.date,o.status]),[['2026-11-17','missing'],['2026-11-18','missing']]);
 db=apply(db,'sylvia','hours',{id:'sylvia-2026-11-17',start:'08:30',end:'18:00',pause:30});
 assert.equal(monthSummary(db,'2026-11','2026-11-19').find(r=>r.user==='sylvia').open[0].status,'pending');
});

import {closed} from '../v2/model.js';
const at=(t,iso)=>t.mock.timers.enable({apis:['Date'],now:new Date(iso)});

test('November kan pas vanaf 1 december dicht, en alleen door de bedrijfsleider',t=>{
 at(t,'2026-11-30T20:00:00+01:00');
 assert.throws(()=>apply(pilotRoster(),'eva','closeMonth',{month:'2026-11',confirm:true}),/1e van de volgende maand/);
 t.mock.timers.setTime(Date.parse('2026-12-01T09:00:00+01:00'));
 assert.throws(()=>apply(pilotRoster(),'iris','closeMonth',{month:'2026-11',confirm:true}),/bedrijfsleider/);
});

test('Eva sluit november af terwijl er nog uren open staan: de app waarschuwt en toont wie',t=>{
 at(t,'2026-12-01T09:00:00+01:00');
 const db=pilotRoster();
 assert.throws(()=>apply(db,'eva','closeMonth',{month:'2026-11'}),/Elise B.*Bevestig|Bevestig/);
 assert.throws(()=>apply(db,'eva','closeMonth',{month:'2026-11'}),/Sylvia/);
 const after=apply(db,'eva','closeMonth',{month:'2026-11',confirm:true});
 assert.equal(after.closedMonths[0].month,'2026-11');
 assert.equal(after.closedMonths[0].by,'eva');
 assert.ok(closed(after,'2026-11-17'));
 assert.ok(!closed(after,'2026-12-01'));
 assert.throws(()=>apply(after,'eva','closeMonth',{month:'2026-11',confirm:true}),/al afgesloten/);
});

test('Na afsluiten kan niemand meer iets met uren van november',t=>{
 at(t,'2026-12-01T09:00:00+01:00');
 let db=pilotRoster(); // uren van Iris op 16 nov zijn al goedgekeurd, die van Elise wachten
 db=apply(db,'eva','closeMonth',{month:'2026-11',confirm:true});
 const no=/afgesloten/;
 assert.throws(()=>apply(db,'sylvia','hours',{id:'sylvia-2026-11-17',start:'08:30',end:'18:00',pause:30}),no);
 assert.throws(()=>apply(db,'eva','approve',{id:'elise-2026-11-16'}),no);
 assert.throws(()=>apply(db,'eva','return',{id:'elise-2026-11-16',reason:'x'}),no);
 assert.throws(()=>apply(db,'eva','reopen',{id:'iris-2026-11-16',reason:'x'}),no);
 assert.throws(()=>apply(db,'isis','unplanned',{date:'2026-11-28',start:'09:00',end:'12:00',pause:0,area:'Keuken'}),no);
 assert.throws(()=>apply(db,'eva','setNorm',{user:'elise',month:'2026-11',minutes:60,reason:'x'}),no);
 const eva=db.people.find(p=>p.id==='eva');
 assert.equal(missing(db,eva,'2026-12-01').length,0);
});

test('Noodknop: alleen de bedrijfsleider heropent een afgesloten maand, met reden, en dat wordt vastgelegd',t=>{
 at(t,'2026-12-01T09:00:00+01:00');
 let db=apply(pilotRoster(),'eva','closeMonth',{month:'2026-11',confirm:true});
 assert.throws(()=>apply(db,'iris','reopenMonth',{month:'2026-11',reason:'fout'}),/bedrijfsleider/);
 assert.throws(()=>apply(db,'eva','reopenMonth',{month:'2026-11',reason:''}),/reden/);
 assert.throws(()=>apply(db,'eva','reopenMonth',{month:'2026-10',reason:'fout'}),/niet afgesloten/);
 db=apply(db,'eva','reopenMonth',{month:'2026-11',reason:'Uren Sylvia vergeten'});
 assert.ok(!closed(db,'2026-11-17'));
 assert.deepEqual(db.monthReopens.map(r=>[r.month,r.by,r.reason]),[['2026-11','eva','Uren Sylvia vergeten']]);
 assert.ok(apply(db,'sylvia','hours',{id:'sylvia-2026-11-17',start:'08:30',end:'18:00',pause:30}));
});

import {badges,busy,ownTodo,teamMissing,extraToDecide,extraState} from '../v2/model.js';
test('Bolletjes: wat iemand nog moet doen bij Mijn uren, Uren goedkeuren en Aanvragen',t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-19T12:00:00+01:00')});
 let db=pilotRoster();
 const count=id=>badges(db,db.people.find(p=>p.id===id));
 // Eva mist 17 nov zelf; ze moet Elise (16 nov) beoordelen en Sylvia mist 17 en 18 nov.
 assert.deepEqual(count('eva'),{mine:1,review:3,hours:4,requests:0});
 assert.deepEqual(count('elise'),{mine:0,review:0,hours:0,requests:0});
 db=apply(db,'eva','return',{id:'elise-2026-11-16',reason:'pauze klopt niet'});
 assert.deepEqual(count('elise'),{mine:1,review:0,hours:1,requests:0});
 assert.deepEqual(count('eva'),{mine:1,review:2,hours:3,requests:0});
 db=apply(db,'elise','leave',{date:'2026-12-24',reason:'Kerst'});
 assert.deepEqual(count('eva'),{mine:1,review:2,hours:3,requests:1});
 assert.equal(count('elise').requests,0);
});

test('Dienst van vandaag: tot de eindtijd bezig, daarna ontbreken de uren, ook voor de leiding',t=>{
 const at=time=>t.mock.timers.setTime(Date.parse('2026-11-19T'+time+':00+01:00'));
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-19T08:00:00+01:00')});
 const db=pilotRoster(),eva=db.people.find(p=>p.id==='eva');
 const shift=db.shifts.find(s=>s.id==='eva-2026-11-19');
 assert.equal(busy(shift),false,'nog niet begonnen');
 at('12:00');
 assert.equal(busy(shift),true);
 assert.ok(!ownTodo(db,eva).includes(shift));
 at('18:00');
 assert.equal(busy(shift),false);
 assert.ok(ownTodo(db,eva).includes(shift));
 assert.ok(teamMissing(db,eva).some(m=>m.shift.id==='iris-2026-11-19'),'Iris werkte tot 18:00');
});

test('Isis vraagt vrij en Eva wijst af: Isis ziet het besluit tot ze op Gezien tikt',()=>{
 let db=apply(pilotRoster(),'isis','leave',{date:'2026-12-24',reason:'Kerst'});
 const id=db.requests.at(-1).id,request=db=>db.requests.find(r=>r.id===id);
 assert.throws(()=>apply(db,'isis','seen',{id}),/nog geen besluit/);
 db=apply(db,'eva','decide',{id,accept:false,reason:'Te druk met kerst'});
 assert.equal(request(db).seen,undefined);
 assert.throws(()=>apply(db,'eva','seen',{id}),/eigen aanvraag/);
 db=apply(db,'isis','seen',{id});
 assert.equal(request(db).seen,true);
 assert.equal(request(db).status,'rejected');
});

test('Isis is extra beschikbaar op een gepubliceerde dag: Eva ziet het en plant haar de hele opgegeven tijd in',t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-19T12:00:00+01:00')});
 let db=apply(pilotRoster(),'isis','extra',{date:'2026-11-20',start:'12:00',end:'18:00'});
 const eva=db.people.find(p=>p.id==='eva'),extra=db=>db.extra.find(e=>e.user==='isis'&&e.date==='2026-11-20');
 assert.deepEqual(extraToDecide(db).map(e=>e.user),['isis']);
 assert.equal(extraState(db,extra(db)),'waiting');
 assert.equal(badges(db,eva).requests,1);
 assert.throws(()=>apply(db,'isis','planExtra',{user:'isis',date:'2026-11-20',whole:'whole',area:'Speelvloer'}));
 assert.throws(()=>apply(db,'eva','planExtra',{user:'isis',date:'2026-11-20',start:'10:00',end:'18:00',area:'Speelvloer'}),
  /binnen de opgegeven tijd/);
 db=apply(db,'eva','planExtra',{user:'isis',date:'2026-11-20',whole:'whole',area:'Speelvloer'});
 const shift=db.shifts.find(s=>s.user==='isis'&&s.date==='2026-11-20');
 assert.deepEqual([shift.start,shift.end,shift.area],['12:00','18:00','Speelvloer']);
 assert.equal(db.drafts.length,0,'meteen in het rooster, geen concept');
 assert.match(db.updates.find(n=>n.user==='isis'&&n.date==='2026-11-20').text,
  /Extra ingepland: 12:00–18:00, naar aanleiding van je opgegeven beschikbaarheid/);
 assert.deepEqual(extraToDecide(db),[]);
 assert.equal(extraState(db,extra(db)),'planned');
});

test('Eva plant Isis niet extra in: Isis krijgt bericht en de melding verdwijnt bij Eva',t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-19T12:00:00+01:00')});
 let db=apply(pilotRoster(),'isis','extra',{date:'2026-11-20'});
 db=apply(db,'eva','planExtra',{user:'isis',date:'2026-11-20',whole:'other',start:'13:00',end:'17:00',area:'Bar'});
 assert.deepEqual(db.shifts.filter(s=>s.user==='isis'&&s.date==='2026-11-20').map(s=>s.start+'-'+s.end),['13:00-17:00']);
 db=apply(pilotRoster(),'isis','extra',{date:'2026-11-20'});
 db=apply(db,'eva','declineExtra',{user:'isis',date:'2026-11-20'});
 assert.deepEqual(extraToDecide(db),[]);
 assert.equal(extraState(db,db.extra.at(-1)),'declined');
 assert.match(db.updates.at(-1).text,/Je bent niet extra ingepland/);
});

test('Extra beschikbaar op een dag zonder gepubliceerd rooster: geen melding, wel de tekst bij publiceren',t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-19T12:00:00+01:00')});
 let db=apply(pilotRoster(),'isis','extra',{date:'2026-12-10'});
 assert.deepEqual(extraToDecide(db),[]);
 assert.equal(extraState(db,db.extra.at(-1)),'');
 assert.throws(()=>apply(db,'eva','planExtra',{user:'isis',date:'2026-12-10',whole:'whole',area:'Bar'}),/nog niet gepubliceerd/);
 db=apply(db,'eva','draft',{user:'isis',date:'2026-12-10',start:'08:30',end:'18:00',area:'Bar'});
 db=apply(db,'eva','publish',{date:'2026-12-10',through:'2026-12-10'});
 assert.match(db.updates.at(-1).text,/Extra ingepland: 08:30–18:00/);
});

test('Isis geeft extra beschikbaarheid op voor een dag waarop ze al werkt: ze hoort dat ze al ingepland is',t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-19T12:00:00+01:00')});
 const db=pilotRoster();
 assert.ok(db.shifts.some(s=>s.user==='isis'&&s.date==='2026-11-21'));
 assert.throws(()=>apply(db,'isis','extra',{date:'2026-11-21',start:'12:00',end:'18:00'}),/Je bent op deze dag al ingepland/);
 assert.equal(apply(db,'isis','extra',{date:'2026-11-20'}).extra.at(-1).date,'2026-11-20');
});
