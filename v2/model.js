// Vaste tijden. Bezoekers: open tot close. Werkdag medewerkers (ook "hele dag" en een nieuwe dienst): start tot end.
export const TIMES = {open:'09:00',close:'17:30',start:'08:30',end:'18:00'};
export const today = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Amsterdam'}).format(new Date());
export const now = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Amsterdam',hour:'2-digit',minute:'2-digit'})
 .format(new Date());
export function add(day,n){const d=new Date(day+'T12:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
export const weekday = day => new Date(day+'T12:00Z').getUTCDay()||7;
export const monday = day => add(day,1-weekday(day));
export const intersects = (a,b) => a.start<b.end && b.start<a.end;
export const minutes = time => Number(time.slice(0,2))*60+Number(time.slice(3));
export function check(ok,message){if(!ok)throw Error(message)}
export function interval(row){
  check(/^([01]\d|2[0-3]):[0-5]\d$/.test(row.start)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(row.end)&&row.start<row.end,'Controleer de begin- en eindtijd.');
}
export function ruleFor(db,s){
  const exact=db.extra.find(r=>r.user===s.user&&r.date===s.date);
  const weekly=db.rules.filter(r=>r.user===s.user&&r.weekday===weekday(s.date)&&r.date<=s.date).sort((a,b)=>b.date.localeCompare(a.date))[0];
  if(exact)return exact;
  if(weekly?.fortnightly){
   const weeks=(Date.parse(monday(s.date))-Date.parse(monday(weekly.date)))/604800000;
   if(weeks%2!==0)return undefined;
  }
  return weekly;
}
export function available(db,s){
  const r=ruleFor(db,s);
  return !r||(!r.off&&r.start<=s.start&&r.end>=s.end);
}
export function remaining(s,r){
  if(!r.start)return [];
  if(!intersects(s,r))return [s];
  return [...(s.start<r.start?[{...s,end:r.start}]:[]),...(s.end>r.end?[{...s,start:r.end}]:[])];
}
export function affected(db,r){return db.shifts.filter(s=>s.user===r.user&&s.date>=r.date&&s.date<=r.through&&freeWindows(r,s.date).some(w=>intersects(s,w)))}
export const leads = (db,day) => db.shifts.filter(s=>!s.deadline&&s.date===day&&db.people.some(p=>p.id===s.user&&p.role==='lead')).map(s=>s.user);
// Beoordelen: bedrijfsleider altijd; leiding op een dag dat zij dagleiding is, ook de eigen uren.
export const mayReview = (db,actor,s) => actor.role==='admin'||actor.role==='lead'&&leads(db,s.date).includes(actor.id);
// Heropenen van goedgekeurde uren: alleen de bedrijfsleider.
export const mayReopen = (db,actor,s) => actor.role==='admin'&&db.hours[s.id]?.status==='approved';
// Ontbrekende uren: een dienst vóór vandaag zonder ingevulde uren. Stand-by telt niet mee.
// Bedrijfsleider ziet iedereen, leiding de eigen uren en de dagen waarop zij dagleiding was, medewerker de eigen uren.
export function missing(db,actor,day=today()){
 const sees=s=>actor.role==='admin'||s.user===actor.id||actor.role==='lead'&&leads(db,s.date).includes(actor.id);
 const late=s=>Math.round((Date.parse(day)-Date.parse(s.date))/86400000);
 return db.shifts.filter(s=>!s.deadline&&s.date<day&&!db.hours[s.id]&&sees(s))
  .sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start)).map(s=>({shift:s,late:late(s)}));
}
// Herinneren mag de bedrijfsleider of de dagleiding van die dag, nooit aan zichzelf.
export const mayRemind = (db,actor,s) => actor.id!==s.user
 &&(actor.role==='admin'||actor.role==='lead'&&leads(db,s.date).includes(actor.id));
export function freeWindows(request,date){
 if(date<request.date||date>request.through)return [];
 let windows=[{start:request.start||'00:00',end:request.end||'23:59'}];
 for(const exception of (request.exceptions||[]).filter(e=>e.date===date)){
  windows=windows.flatMap(w=>remaining(w,exception));
 }
 return windows;
}
function freeRequests(db,s){
 return db.requests.filter(r=>r.kind==='leave'&&r.status!=='rejected'&&r.user===s.user&&freeWindows(r,s.date).some(w=>intersects(w,s)));
}
function validate(db){
 for(const [i,s] of db.shifts.entries()){
  interval(s);check(!db.shifts.slice(i+1).some(t=>t.user===s.user&&t.date===s.date&&intersects(t,s)),'Deze dienst overlapt een andere dienst.');
 }
}
function announce(db,s,text){db.updates.push({id:crypto.randomUUID(),user:s.user,date:s.date,text})}
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

// Uren van vandaag mogen niet later eindigen dan nu, met 15 minuten speling.
function notLaterThanNow(date,end){
 check(date<today()||minutes(end)<=minutes(now())+15,'De eindtijd kan niet later zijn dan nu.');
}
// Waarschuwingen voor de leiding; ze houden niets tegen.
export function warnings(db,s){
 const e=db.hours[s.id];
 if(!e)return [];
 const net=minutes(e.end)-minutes(e.start)-e.pause,list=[];
 if(!s.unplanned&&e.end<s.end)list.push('Eindigt vóór het rooster (gepland tot '+s.end+')');
 if(e.pause===0&&net>330)list.push('Geen pauze bij een lange dag');
 return list;
}
export const net = e => minutes(e.end)-minutes(e.start)-e.pause;
// Maandnorm: contracturen per week × 52 ÷ 12, tenzij de bedrijfsleider hem voor die maand heeft overschreven.
export function normMinutes(db,user,month){
 const override=db.normOverrides.find(n=>n.user===user&&n.month===month);
 if(override)return override.minutes;
 const person=db.people.find(p=>p.id===user);
 return Math.round((person?.contractHours||0)*60*52/12);
}
// Per persoon: goedgekeurde minuten, open diensten (wacht, aanpassen of ontbreekt), norm en verschil.
export function monthSummary(db,month,day=today()){
 return db.people.map(person=>{
  const shifts=db.shifts.filter(s=>s.user===person.id&&!s.deadline&&s.date.startsWith(month+'-'))
   .sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start));
  const status=s=>db.hours[s.id]?.status||(s.date<day?'missing':'future');
  const approved=shifts.filter(s=>status(s)==='approved').reduce((sum,s)=>sum+net(db.hours[s.id]),0);
  const open=shifts.filter(s=>['pending','returned','missing'].includes(status(s))).map(s=>({shift:s,status:status(s)}));
  const norm=normMinutes(db,person.id,month);
  return {user:person.id,approved,open,norm,diff:approved-norm};
 });
}
function setNorm({db,actor,p}){
 check(actor.role==='admin','Alleen de bedrijfsleider kan de norm aanpassen.');
 check(db.people.some(x=>x.id===p.user)&&/^\d{4}-(0[1-9]|1[0-2])$/.test(p.month),'Kies een medewerker en een maand.');
 check(Number.isInteger(p.minutes)&&p.minutes>=0,'Vul een geldige norm in.');
 check(p.reason?.trim(),'Geef een reden voor de aangepaste norm.');
 db.normOverrides=db.normOverrides.filter(n=>!(n.user===p.user&&n.month===p.month));
 db.normOverrides.push({user:p.user,month:p.month,minutes:p.minutes,reason:p.reason.trim(),by:actor.id});
}
function submitHours({db,actor,p,s}){
 check(!s?.deadline&&s?.user===actor.id&&s.date<=today(),'Kies een eigen gewerkte dienst.');
  check(!db.hours[s.id]||db.hours[s.id].status==='returned','Deze uren zijn al ingediend.');
  interval(p);notLaterThanNow(s.date,p.end);const pause=Number(p.pause);
  check(String(p.pause).trim()!==''&&Number.isInteger(pause)&&pause>=0&&pause<minutes(p.end)-minutes(p.start),'Vul de werkelijke pauze in.');
  check(!db.shifts.some(t=>t.id!==s.id&&t.user===s.user&&t.date===s.date&&intersects(p,db.hours[t.id]||t)),'Deze uren overlappen een andere dienst.');
  const {approvedBy,approvedAt,reopenedBy}=db.hours[s.id]||{};
  db.hours[s.id]={start:p.start,end:p.end,pause,status:'pending',approvedBy,approvedAt,reopenedBy};
}

function reviewHours({db,actor,op,p,s}){
 check(s&&mayReview(db,actor,s)&&db.hours[s.id]?.status==='pending','Deze uren kunnen hier niet worden beoordeeld.');
  if(op==='return')check(p.reason?.trim(),'Geef aan wat gecontroleerd moet worden.');
  Object.assign(db.hours[s.id],{status:op==='return'?'returned':'approved',reason:p.reason||''});
  if(op==='approve')Object.assign(db.hours[s.id],{approvedBy:actor.id,approvedAt:new Date().toISOString()});
}

function reopenHours({db,actor,p,s}){
 check(actor.role==='admin','Alleen de bedrijfsleider kan uren heropenen.');
 check(s&&mayReopen(db,actor,s),'Alleen goedgekeurde uren kunnen worden heropend.');
 check(p.reason?.trim(),'Geef een reden voor het heropenen.');
 Object.assign(db.hours[s.id],{status:'returned',reason:p.reason.trim(),reopenedBy:actor.id});
}

function recordAvailability({db,actor,op,p}){
 check(p.date>=today(),'Kies vandaag of later.');
  const start=p.start||'',end=p.end||'';
  if(start||end)interval(p);
  if(op==='weekly')check(Number.isInteger(+p.weekday)&&+p.weekday>=1&&+p.weekday<=7,'Kies een weekdag.');
  if(op==='extra'){
   db.extra=db.extra.filter(x=>x.user!==actor.id||x.date!==p.date);db.extra.push({user:actor.id,date:p.date,start:start||TIMES.start,end:end||TIMES.end});
  }else{
   const through=p.through||p.date;check(through>=p.date&&(!start||through===p.date||op==='weekly'),'Controleer de periode.');
   if(op==='leave')check(!db.requests.some(r=>r.user===actor.id&&r.kind==='leave'&&r.status!=='rejected'&&r.date<=through&&r.through>=p.date&&(!start||!r.start||intersects(r,p))),'Er is al een aanvraag voor deze periode.');
   db.requests.push({id:crypto.randomUUID(),kind:op,user:actor.id,date:p.date,through,start,end,weekday:Number(p.weekday),off:p.off===true,reason:p.reason||'',status:'pending',created:today()});
  };
}

export function weeklyConflicts(db,r){
 return db.shifts.filter(s=>s.user===r.user&&s.date>=r.date&&weekday(s.date)===r.weekday&&(r.off||s.start<(r.start||TIMES.start)||s.end>(r.end||TIMES.end)));
}
function decideRequest({db,admin,p,r}){
 check(admin&&r?.status==='pending','Alleen de bedrijfsleider kan een open aanvraag beoordelen.');
  if(!p.accept)check(p.reason?.trim(),'Geef een reden voor afwijzing.');
  if(p.accept&&r.kind==='weekly'){
   const conflicts=weeklyConflicts(db,r);
   check(!conflicts.length||p.keep==='yes','Bekijk de bestaande diensten en bevestig dat ze blijven staan.');
   r.retained=conflicts.map(s=>({date:s.date,start:s.start,end:s.end}));
   if(conflicts.length)announce(db,{user:r.user,date:r.date},'Nieuwe beschikbaarheid goedgekeurd. Deze diensten blijven staan: '+conflicts.map(s=>s.date+' '+s.start+'–'+s.end).join(', '));
   db.rules=db.rules.filter(x=>!(x.user===r.user&&x.weekday===r.weekday&&x.date===r.date));
   db.rules.push({...r,start:r.start||TIMES.start,end:r.end||TIMES.end});
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
  r.status=p.accept?'approved':'rejected';r.response=p.reason||'';
}

export function needsQuestion(db,row){
 return !ruleFor(db,row)||ruleFor(db,row).off||freeRequests(db,row).length>0;
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
function saveDraft({db,admin,p,s}){
 check(admin&&db.people.some(x=>x.id===p.user)&&p.date>=today(),'Controleer de medewerker en datum.');interval(p);
  const id=p.id||crypto.randomUUID(), prior=db.drafts.find(d=>d.id===id);
  check(!s||(!db.hours[id]&&s.date===p.date&&s.user===p.user),'Deze dienst kan niet worden gewijzigd.');
  const other=db.shifts.filter(t=>!db.drafts.some(d=>d.id===t.id)).concat(db.drafts);
  check(!other.some(t=>t.id!==id&&t.user===p.user&&t.date===p.date&&intersects(t,p)),'Deze dienst overlapt een andere dienst.');
  const row={id,user:p.user,date:p.date,start:p.start,end:p.end,area:p.area};
  if(p.deadline)row.deadline=p.deadline;
  const before=prior?prior.before:s?JSON.stringify(s):null;
  check(!db.offers.some(o=>o.row.user===row.user&&o.row.date===row.date&&intersects(o.row,row)),'Er staat al een vraag open voor deze tijden.');
  db.drafts=db.drafts.filter(x=>x.id!==id);
  if(!s&&needsQuestion(db,row)&&!(prior?.accepted&&prior.start===row.start&&prior.end===row.end&&prior.user===row.user&&prior.deadline===row.deadline)){
   db.offers.push({id:crypto.randomUUID(),row,before,turn:'employee',planning:true});
  }else db.drafts.push({...row,before,accepted:!!prior?.accepted});
}

export function fallbackShift(db,row){
 const rule=ruleFor(db,row);
 if(!rule||rule.off||row.deadline||freeRequests(db,row).length)return null;
 const start=row.start>rule.start?row.start:rule.start,end=row.end<rule.end?row.end:rule.end;
 return start<end?{...row,start,end}:null;
}
function publishDrafts({db,admin,p}){
 check(admin,'Alleen voor de bedrijfsleider.');
  const chosen=db.drafts.filter(d=>d.date>=p.date&&d.date<=p.through&&(!p.onlyId||d.id===p.onlyId));check(chosen.length||db.offers.some(o=>o.row.date>=p.date&&o.row.date<=p.through),'Geen diensten in deze periode.');
  db.published??=[];
  for(let d=p.date;d<=p.through;d=add(d,1))if(!db.published.includes(d))db.published.push(d);
  for(const {before,accepted,...row} of chosen){
   const old=db.shifts.find(s=>s.id===row.id);
   check((old?JSON.stringify(old):null)===before&&!db.hours[row.id],'De dienst is intussen gewijzigd. Controleer het concept.');
   const consent=!accepted&&(needsQuestion(db,row)||!available(db,row));
   check(consent||available(db,row)||p.confirm,'Bevestig het inplannen buiten de beschikbaarheid.');
   db.offers=db.offers.filter(o=>o.row.id!==row.id);
   if(consent){
    const fallback=old||fallbackShift(db,row);
    if(fallback&&!old){db.shifts.push(fallback);announce(db,fallback,'Ingepland: '+fallback.start+'–'+fallback.end);}
    db.offers.push({id:crypto.randomUUID(),row,before:fallback?JSON.stringify(fallback):null,turn:'employee',fallback:fallback?{...fallback}:null,requestedBy:db.people.find(x=>x.role==='admin').id,availability:ruleFor(db,row)});
   }
   else{db.shifts=db.shifts.filter(s=>s.id!==row.id);db.shifts.push(row);announce(db,row,'Ingepland: '+row.start+'–'+row.end);}
  }
  db.drafts=db.drafts.filter(d=>!chosen.some(c=>c.id===d.id));
}

function answerOffer({db,actor,admin,p}){
 const o=db.offers.find(x=>x.id===p.id);
  check(o&&(o.turn==='employee'?o.row.user===actor.id:admin),'Dit voorstel wacht op iemand anders.');
  check(['counter','yes','no'].includes(p.answer),'Kies een antwoord.');
  if(p.answer==='counter'){check(o.turn==='employee','Alleen de medewerker kan andere tijden voorstellen.');interval(p);Object.assign(o.row,{start:p.start,end:p.end});o.turn='admin';return;}
  if(p.answer==='yes'){
   const old=db.shifts.find(s=>s.id===o.row.id);
   check((old?JSON.stringify(old):null)===o.before&&!db.hours[o.row.id],'De oorspronkelijke dienst is gewijzigd.');
   for(const request of freeRequests(db,o.row)){
    (request.exceptions??=[]).push({date:o.row.date,start:o.row.start,end:o.row.end});
   }
   check(!db.drafts.some(d=>d.id!==o.row.id&&d.user===o.row.user&&d.date===o.row.date&&intersects(d,o.row)),'De tijden overlappen een conceptdienst.');
   check(!db.shifts.some(d=>d.id!==o.row.id&&d.user===o.row.user&&d.date===o.row.date&&intersects(d,o.row)),'De tijden overlappen een dienst.');
   if(o.planning&&!published(db,o.row.date))db.drafts.push({...o.row,before:null,accepted:true});
   else{db.shifts=db.shifts.filter(s=>s.id!==o.row.id);db.shifts.push(o.row);}
   announce(db,o.row,'Voorstel geaccepteerd: '+o.row.start+'–'+o.row.end);
  }
  announce(db,{date:o.row.date,user:o.turn==='admin'?o.row.user:o.requestedBy||db.people.find(x=>x.role==='admin').id},db.people.find(x=>x.id===o.row.user).name+' · '+(p.answer==='yes'?'Voorstel geaccepteerd · '+o.row.start+'–'+o.row.end:o.fallback?'Voorstel afgewezen; dienst blijft '+o.fallback.start+'–'+o.fallback.end:'Voorstel afgewezen · '+o.row.start+'–'+o.row.end));
  db.offers=db.offers.filter(x=>x.id!==o.id);
}

function markSeen({db,actor,p}){
 db.updates=db.updates.filter(x=>x.id!==p.id||x.user!==actor.id);
}

const actions={
  release:resolveStandby,call:resolveStandby,
  unplanned: submitUnplanned,
  rejectHours: rejectUnplanned,
  hours: submitHours,
  approve: reviewHours,
  return: reviewHours,
  reopen: reopenHours,
  setNorm,
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
 check(actor,'Onbekend profiel.');
 for(const field of ['start','end','deadline']){
  if(p[field])check(/^([01]\d|2[0-3]):(00|15|30|45)$/.test(p[field]),'Kies tijden per kwartier.');
 }
 check(Object.hasOwn(actions,op),'Onbekende actie.');
 actions[op]({db,actor,admin:actor.role==='admin',op,p,
  s:db.shifts.find(shift=>shift.id===p.id),
  r:db.requests.find(request=>request.id===p.id)
 });
 validate(db);
 return db;
}
