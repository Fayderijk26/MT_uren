import {add,ruleFor} from './model.js';

const firstMonday='2026-11-16';
const team=[
 {id:'eva',name:'Eva G.',role:'admin',days:[2,4]},
 {id:'iris',name:'Iris Z',role:'lead',days:[1,4,5],weekend:[6,7]},
 {id:'sylvia',name:'Sylvia',role:'lead',days:[2,3,5],weekend:[7,6]},
 {id:'elise',name:'Elise B',role:'employee',days:[1,4,6]},
 {id:'isis',name:'Isis N',role:'employee',days:[6]}
];

export function pilotRoster(){
 const db={people:[],rules:[],shifts:[],hours:{},drafts:[],requests:[],offers:[],extra:[],updates:[],published:[]};
 for(const {id,name,role,days,weekend=[]} of team){
  db.people.push({id,name,role});
  const rule={user:id,date:firstMonday,start:'10:00',end:'18:00'};
  for(const weekday of days)db.rules.push({...rule,weekday});
  weekend.forEach((weekday,week)=>db.rules.push({...rule,weekday,date:add(firstMonday,week*7),fortnightly:true}));
 }
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
 db.hours['iris-'+firstMonday]={start:'10:00',end:'18:00',pause:30,status:'approved'};
 db.hours['elise-'+firstMonday]={start:'10:00',end:'18:00',pause:30,status:'pending'};
 return db;
}
