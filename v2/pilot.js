import {add,ruleFor} from './model.js';

const firstMonday='2026-11-16';
const team=[
 {id:'eva',name:'Eva G.',pay:['1001','Eva','Groen','E.'],role:'admin',contract:'vast',hours:36,days:[2,4],areas:['Vloer']},
 {id:'iris',name:'Iris Z',pay:['1002','Iris','Zwart','I.'],role:'lead',contract:'vast',hours:32,days:[1,4,5],weekend:[6,7],areas:['Vloer','Keuken']},
 {id:'sylvia',name:'Sylvia',pay:['1003','Sylvia','Smit','S.'],role:'lead',contract:'vast',hours:32,days:[2,3,5],weekend:[7,6],areas:['Vloer','Keuken']},
 {id:'elise',name:'Elise B',pay:['1004','Elise','Bakker','E.'],role:'employee',contract:'vast',hours:24,days:[1,4,6],areas:['Keuken']},
 {id:'isis',name:'Isis N',pay:['1005','Isis','Nieuw','I.'],role:'employee',contract:'uren',hours:8,days:[6],areas:['Vloer']},
 // Leidinggevende zonder urenregistratie (niet per uur betaald): wel in het rooster, geen uren.
 {id:'mieke',name:'Mieke',pay:['1006','Mieke','Molen','M.'],role:'lead',contract:'vast',hours:0,days:[3,7],areas:['Vloer'],tracksHours:false,
  times:{3:['11:00','17:00'],7:['11:00','16:00']}}
];

export function pilotRoster(){
 const db={people:[],rules:[],shifts:[],hours:{},drafts:[],requests:[],offers:[],extra:[],updates:[],published:[],
  normOverrides:[],closedMonths:[],monthReopens:[],saldoCorrections:[]};
 for(const {id,name,role,contract,hours,days,weekend=[],areas,tracksHours,times={},pay} of team){
  const [staffNumber,firstName,lastName,initials]=pay;
  db.people.push({id,name,role,contract,contractHours:hours,areas,staffNumber,firstName,lastName,initials,...(tracksHours===false?{tracksHours}:{})});
  const rule={user:id,date:firstMonday,start:'08:30',end:'18:00'};
  for(const weekday of days){
   const [start,end]=times[weekday]||[rule.start,rule.end];
   db.rules.push({...rule,weekday,start,end});
  }
  weekend.forEach((weekday,week)=>db.rules.push({...rule,weekday,date:add(firstMonday,week*7),fortnightly:true}));
 }
 // Een paar vaste dagen beginnen om 10:00.
 const late={sylvia:5,iris:4,elise:6};
 for(const r of db.rules)if(late[r.user]===r.weekday)r.start='10:00';
 for(let offset=0;offset<14;offset++){
  const date=add(firstMonday,offset);
  db.published.push(date);
  for(const person of db.people){
   const rule=ruleFor(db,{user:person.id,date});
   if(!rule)continue;
   db.shifts.push({id:person.id+'-'+date,user:person.id,date,start:rule.start,end:rule.end,area:person.areas[0]});
  }
 }
 db.hours['iris-'+firstMonday]={start:'08:30',end:'18:00',pause:30,status:'approved'};
 db.hours['elise-'+firstMonday]={start:'08:30',end:'18:00',pause:30,status:'pending'};
 db.pilotTimesVersion=2;
 return db;
}

export function migratePilot(db){
 if(db.pilotTimesVersion===2)return;
 const fresh=pilotRoster();
 for(const rule of db.rules){
  const target=fresh.rules.find(r=>r.user===rule.user&&r.date===rule.date&&r.weekday===rule.weekday
   &&!!r.fortnightly===!!rule.fortnightly);
  if(target&&rule.start==='10:00'&&rule.end==='18:00'&&!rule.off&&!rule.id)rule.start=target.start;
 }
 for(const s of db.shifts){
  const target=fresh.shifts.find(x=>x.id===s.id);
  const untouched=!db.hours[s.id]&&!db.drafts.some(d=>d.id===s.id)&&!db.offers.some(o=>o.row.id===s.id);
  if(target&&s.start==='10:00'&&s.end==='18:00'&&untouched)s.start=target.start;
 }
 db.pilotTimesVersion=2;
}
