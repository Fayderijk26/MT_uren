import {add,ruleFor} from './model.js';

const firstMonday='2026-11-16';
const team=[
 {id:'eva',name:'Eva G.',role:'admin',hours:36,days:[2,4]},
 {id:'iris',name:'Iris Z',role:'lead',hours:32,days:[1,4,5],weekend:[6,7]},
 {id:'sylvia',name:'Sylvia',role:'lead',hours:32,days:[2,3,5],weekend:[7,6]},
 {id:'elise',name:'Elise B',role:'employee',hours:24,days:[1,4,6]},
 {id:'isis',name:'Isis N',role:'employee',hours:8,days:[6]}
];

export function pilotRoster(){
 const db={people:[],rules:[],shifts:[],hours:{},drafts:[],requests:[],offers:[],extra:[],updates:[],published:[],normOverrides:[],closedMonths:[],monthReopens:[]};
 for(const {id,name,role,hours,days,weekend=[]} of team){
  db.people.push({id,name,role,contractHours:hours});
  const rule={user:id,date:firstMonday,start:'08:30',end:'18:00'};
  for(const weekday of days)db.rules.push({...rule,weekday});
  weekend.forEach((weekday,week)=>db.rules.push({...rule,weekday,date:add(firstMonday,week*7),fortnightly:true}));
 }
 for(const r of db.rules)if((r.user==='sylvia'&&r.weekday===5)||(r.user==='iris'&&r.weekday===4)||(r.user==='elise'&&r.weekday===6))r.start='10:00';
 for(let offset=0;offset<14;offset++){
  const date=add(firstMonday,offset);
  db.published.push(date);
  for(const person of db.people){
   const rule=ruleFor(db,{user:person.id,date});
   if(!rule)continue;
   const area={admin:'Bedrijfsleiding',lead:'Dagleiding',employee:'Speelvloer'}[person.role];
   db.shifts.push({id:person.id+'-'+date,user:person.id,date,start:rule.start,end:rule.end,area});
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
  const target=fresh.rules.find(r=>r.user===rule.user&&r.date===rule.date&&r.weekday===rule.weekday&&!!r.fortnightly===!!rule.fortnightly);
  if(target&&rule.start==='10:00'&&rule.end==='18:00'&&!rule.off&&!rule.id)rule.start=target.start;
 }
 for(const s of db.shifts){
  const target=fresh.shifts.find(x=>x.id===s.id);
  if(target&&s.start==='10:00'&&s.end==='18:00'&&!db.hours[s.id]&&!db.drafts.some(d=>d.id===s.id)&&!db.offers.some(o=>o.row.id===s.id))s.start=target.start;
 }
 db.pilotTimesVersion=2;
}
