import {saveDraft,publishDrafts,answerOffer,generateWeek} from './planning.js';
export {fallbackShift} from './planning.js';
import {opening} from './settings.js';
import {savePerson,saveSettings,closeMonth,reopenMonth,reopenHours} from './administration.js';
export const today = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Amsterdam'}).format(new Date());
export function add(day,n){const d=new Date(day+'T12:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
export const weekday = day => new Date(day+'T12:00Z').getUTCDay()||7;
export const monday = day => add(day,1-weekday(day));
export const intersects = (a,b) => a.start<b.end && b.start<a.end;
export const minutes = time => Number(time.slice(0,2))*60+Number(time.slice(3));
export function check(ok,message,field=''){if(!ok){const e=Error(message);e.field=field;throw e}}
export function interval(row){
  check(/^([01]\d|2[0-3]):[0-5]\d$/.test(row.start)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(row.end)&&row.start<row.end,'Controleer de begin- en eindtijd.','start');
}
export function ruleFor(db,s){
  const exact=db.extra.find(r=>r.user===s.user&&r.date===s.date);
  const weekly=db.rules.filter(r=>r.user===s.user&&r.weekday===weekday(s.date)&&r.date<=s.date).sort((a,b)=>b.date.localeCompare(a.date))[0];
  if(exact)return exact.wholeDay?{...exact,...opening(db,s.date)}:exact;
  if(weekly?.fortnightly){
   const weeks=(Date.parse(monday(s.date))-Date.parse(monday(weekly.date)))/604800000;
   if(weeks%2!==0)return undefined;
  }
  return weekly?.wholeDay?{...weekly,...opening(db,s.date)}:weekly;
}
export function available(db,s){
  const r=ruleFor(db,s);
  return !r||(!r.off&&!r.closed&&r.start<=s.start&&r.end>=s.end);
}
export function remaining(s,r){
  if(!r.start)return [];
  if(!intersects(s,r))return [s];
  return [...(s.start<r.start?[{...s,end:r.start}]:[]),...(s.end>r.end?[{...s,start:r.end}]:[])];
}
export function affected(db,r){return db.shifts.filter(s=>s.user===r.user&&s.date>=r.date&&s.date<=r.through&&freeWindows(r,s.date).some(w=>intersects(s,w)))}
export const leads = (db,day) => db.shifts.filter(s=>!s.deadline&&s.date===day&&db.people.some(p=>p.id===s.user&&p.role==='lead')).map(s=>s.user);
export const mayReview = (db,actor,s) => actor.role==='admin'||(actor.role==='lead'&&actor.id!==s.user&&leads(db,s.date).includes(actor.id));
export function freeWindows(request,date){
 if(date<request.date||date>request.through)return [];
 let windows=[{start:request.start||'00:00',end:request.end||'23:59'}];
 for(const exception of (request.exceptions||[]).filter(e=>e.date===date)){
  windows=windows.flatMap(w=>remaining(w,exception));
 }
 return windows;
}
export function freeRequests(db,s){
 return db.requests.filter(r=>r.kind==='leave'&&r.status!=='rejected'&&r.user===s.user&&freeWindows(r,s.date).some(w=>intersects(w,s)));
}
function validate(db){
 for(const [i,s] of db.shifts.entries()){
  interval(s);check(!db.shifts.slice(i+1).some(t=>t.user===s.user&&t.date===s.date&&intersects(t,s)),'Deze dienst overlapt een andere dienst.');
 }
}
export function announce(db,s,text){db.updates.push({id:crypto.randomUUID(),user:s.user,date:s.date,text})}
function submitUnplanned({db,actor,p}){
 interval(p);check(p.date<=today()&&/^\d{4}-\d{2}-\d{2}$/.test(p.date),'Kies een gewerkte dag.');
  const id=crypto.randomUUID();
  check(!db.shifts.some(t=>t.user===actor.id&&t.date===p.date&&intersects(t,p)),'Deze uren overlappen een andere dienst.');
  db.shifts.push({id,date:p.date,user:actor.id,start:p.start,end:p.end,area:p.area,unplanned:true});
  submitHours({db,actor,p:{...p,id},s:db.shifts.at(-1)});
}

function rejectUnplanned({db,actor,p,s}){
 check(s?.unplanned&&mayReview(db,actor,s)&&db.hours[s.id]?.status==='pending'&&p.reason?.trim(),'Controleer deze ongeplande dienst en geef een reden.');
  Object.assign(db.hours[s.id],{status:'rejected',reason:p.reason});
}

function submitHours({db,actor,p,s}){
 check(!s?.deadline&&s?.user===actor.id&&s.date<=today(),'Kies een eigen gewerkte dienst.');
  check(!db.hours[s.id]||db.hours[s.id].status==='returned','Deze uren zijn al ingediend.');
  interval(p);const pause=Number(p.pause);
  check(String(p.pause).trim()!==''&&Number.isInteger(pause)&&pause>=0&&pause<minutes(p.end)-minutes(p.start),'Vul de werkelijke pauze in.','pause');
  check(!db.shifts.some(t=>t.id!==s.id&&t.user===s.user&&t.date===s.date&&intersects(p,db.hours[t.id]||t)),'Deze uren overlappen een andere dienst.');
  db.hours[s.id]={...db.hours[s.id],start:p.start,end:p.end,pause,status:'pending',approvedBy:null,approvedAt:null,submittedAt:new Date().toISOString(),submittedBy:actor.id};
}

function reviewHours({db,actor,op,p,s}){
 check(s&&mayReview(db,actor,s)&&db.hours[s.id]?.status==='pending','Deze uren kunnen hier niet worden beoordeeld.');
  if(op==='return')check(p.reason?.trim(),'Geef aan wat gecontroleerd moet worden.');
  Object.assign(db.hours[s.id],{status:op==='return'?'returned':'approved',...(op==='return'?{reason:p.reason}:{approvedBy:actor.id,approvedAt:new Date().toISOString()})});
}

function recordAvailability({db,actor,op,p}){
 check(p.date>=today(),'Kies vandaag of later.');
  const window=opening(db,op==='weekly'?Number(p.weekday):p.date);
  const start=p.mode==='all'&&op!=='leave'?window.start:p.start||'',end=p.mode==='all'&&op!=='leave'?window.end:p.end||'';
  if(start||end)interval({start,end});
  if(op==='weekly')check(Number.isInteger(+p.weekday)&&+p.weekday>=1&&+p.weekday<=7,'Kies een weekdag.');
  if(op==='extra'){
   db.extra=db.extra.filter(x=>x.user!==actor.id||x.date!==p.date);db.extra.push({user:actor.id,date:p.date,start:start||window.start,end:end||window.end,wholeDay:!p.start&&!p.end});
  }else{
   const through=p.through||p.date;check(through>=p.date&&(!start||through===p.date||op==='weekly'),'Controleer de periode.');
   if(op==='leave')check(!db.requests.some(r=>r.user===actor.id&&r.kind==='leave'&&r.status!=='rejected'&&r.date<=through&&r.through>=p.date&&(!start||!r.start||intersects(r,p))),'Er is al een aanvraag voor deze periode.');
   db.requests.push({id:crypto.randomUUID(),kind:op,user:actor.id,date:p.date,through,start,end,weekday:Number(p.weekday),off:p.off===true,wholeDay:op==='weekly'&&(!p.start&&!p.end||p.mode==='all'),reason:p.reason||'',status:'pending',created:today()});
  };
}

export function weeklyConflicts(db,r){
 return db.shifts.filter(s=>s.user===r.user&&s.date>=r.date&&weekday(s.date)===r.weekday&&(r.off||s.start<(r.start||opening(db,r.weekday).start)||s.end>(r.end||opening(db,r.weekday).end)));
}
function decideRequest({db,admin,actor,p,r}){
 check(admin&&r?.status==='pending','Alleen de bedrijfsleider kan een open aanvraag beoordelen.');
  if(!p.accept)check(p.reason?.trim(),'Geef een reden voor afwijzing.');
  if(p.accept&&r.kind==='weekly'){
   const conflicts=weeklyConflicts(db,r);
   check(!conflicts.length||p.keep==='yes','Bekijk de bestaande diensten en bevestig dat ze blijven staan.');
   r.retained=conflicts.map(s=>({date:s.date,start:s.start,end:s.end}));
   if(conflicts.length)announce(db,{user:r.user,date:r.date},'Nieuwe beschikbaarheid goedgekeurd. Deze diensten blijven staan: '+conflicts.map(s=>s.date+' '+s.start+'–'+s.end).join(', '));
   db.rules=db.rules.filter(x=>!(x.user===r.user&&x.weekday===r.weekday&&x.date===r.date));
   db.rules.push({...r,start:r.start||opening(db,r.weekday).start,end:r.end||opening(db,r.weekday).end});
  }else if(p.accept){
   for(const old of affected(db,r)){
    check(!db.hours[old.id],'Bij deze dienst zijn al uren ingediend.');
    const choice=p.choices?.[old.id];check(choice&&choice.before===JSON.stringify(old),'Controleer de gevolgen voor elke dienst.');
    const parts=remaining(old,r);
    check(['none','all',...parts.map((_,i)=>String(i))].includes(choice.value),'Kies wat er met de dienst gebeurt.');
    const keep=choice.value==='all'?parts:parts.filter((_,i)=>String(i)===choice.value);
    db.shifts=db.shifts.filter(x=>x.id!==old.id);
    keep.forEach((part,i)=>db.shifts.push({...part,id:i?crypto.randomUUID():old.id}));
    announce(db,old,keep.length?'Nieuwe werktijden: '+keep.map(t=>t.start+'–'+t.end).join(' en '):'Je dienst vervalt.');
   }
  }
  r.status=p.accept?'approved':'rejected';r.response=p.reason||'';r.decidedBy=actor.id;r.decidedAt=new Date().toISOString();
}

export function needsQuestion(db,row){
 return !ruleFor(db,row)||ruleFor(db,row).off||ruleFor(db,row).closed||freeRequests(db,row).length>0;
}
export function published(db,date){
 return db.published?.includes(date)||db.shifts.some(s=>s.date===date&&!s.unplanned);
}
function resolveStandby({db,admin,s,p,op}){
 check(admin&&s?.deadline,'Deze stand-by is al afgehandeld.');
 if(op==='release'){
  db.shifts=db.shifts.filter(row=>row.id!==s.id);
  announce(db,s,'Je hoeft niet te werken.');
 }else{
  interval(p);
  check(p.start>=s.start&&p.end<=s.end,'Kies tijden binnen de afgesproken stand-bydienst.');
  delete s.deadline;
  Object.assign(s,{start:p.start,end:p.end});
  announce(db,s,'Je bent opgeroepen: '+s.start+'–'+s.end);
 }
}

function markSeen({db,actor,p}){
 db.updates=db.updates.filter(x=>x.id!==p.id||x.user!==actor.id);
}



const actions={
  person:savePerson,settings:saveSettings,closeMonth,reopenMonth,reopenHours,generate:generateWeek,
  release:resolveStandby,call:resolveStandby,
  unplanned: submitUnplanned,
  rejectHours: rejectUnplanned,
  hours: submitHours,
  approve: reviewHours,
  return: reviewHours,
  leave: recordAvailability,
  weekly: recordAvailability,
  extra: recordAvailability,
  decide: decideRequest,
  draft: saveDraft,
  publish: publishDrafts,
  offer: answerOffer,
  seen: markSeen
};
export function apply(previous,actorId,op,p){
 const db=structuredClone(previous);
 const actor=db.people.find(person=>person.id===actorId);
 check(actor&&actor.active!==false,'Dit profiel is niet actief.');
 for(const field of ['start','end','deadline']){
  if(p[field])check(/^([01]\d|2[0-3]):(00|15|30|45)$/.test(p[field]),'Kies tijden per kwartier.',field);
 }
 check(Object.hasOwn(actions,op),'Onbekende actie.');
 actions[op]({db,actor,admin:actor.role==='admin',op,p,
  s:db.shifts.find(shift=>shift.id===p.id),
  r:db.requests.find(request=>request.id===p.id)
 });
 validate(db);
 for(const [month,state] of Object.entries(previous.months||{}))if(state.closed&&op!=='reopenMonth'){
  const contents=d=>JSON.stringify(d.shifts.filter(s=>s.date.startsWith(month)).map(s=>({s,e:d.hours[s.id]})));
  check(contents(previous)===contents(db),'Deze maand is afgesloten. De bedrijfsleider moet eerst de maand heropenen.');
 }
 db.audit??=[];
 if(['hours','unplanned','approve','return','rejectHours','reopenHours'].includes(op))for(const [id,e] of Object.entries(db.hours)){
  if(JSON.stringify(previous.hours[id])!==JSON.stringify(e)){
   const before=previous.hours[id];
   e.history=[...(before?.history||[]),{action:op,by:actor.id,at:new Date().toISOString(),reason:p.reason||'',previous:before?Object.fromEntries(Object.entries(before).filter(([k])=>k!=='history')):null}];
  }
 }
 if(['person','settings','closeMonth','reopenMonth','generate'].includes(op))db.audit.push({action:op,by:actor.id,at:new Date().toISOString(),reason:p.reason||'',month:p.month||'',id:p.id||''});
 return db;
}
