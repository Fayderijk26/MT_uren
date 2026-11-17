export const today = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Amsterdam'}).format(new Date());
export function add(day,n){const d=new Date(day+'T12:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
export const weekday = day => new Date(day+'T12:00Z').getUTCDay()||7;
export const monday = day => add(day,1-weekday(day));
export const intersects = (a,b) => a.start<b.end && b.start<a.end;
export const minutes = time => Number(time.slice(0,2))*60+Number(time.slice(3));
export function check(ok,message){if(!ok)throw Error(message)}
export function interval(row){
  check(/^([01]\d|2[0-3]):[0-5]\d$/.test(row.start)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(row.end)&&row.start<row.end,'Controleer de begin- en eindtijd.');
}
export function available(db,s){
  const exact=db.extra.find(r=>r.user===s.user&&r.date===s.date);
  const weekly=db.rules.filter(r=>r.user===s.user&&r.weekday===weekday(s.date)&&r.date<=s.date).sort((a,b)=>b.date.localeCompare(a.date))[0];
  const r=exact||weekly;
  return !r||(!r.off&&r.start<=s.start&&r.end>=s.end);
}
export function remaining(s,r){
  if(!r.start)return [];
  if(!intersects(s,r))return [s];
  return [...(s.start<r.start?[{...s,end:r.start}]:[]),...(s.end>r.end?[{...s,start:r.end}]:[])];
}
export function affected(db,r){return db.shifts.filter(s=>s.user===r.user&&s.date>=r.date&&s.date<=r.through&&freeWindows(r,s.date).some(w=>intersects(s,w)))}
export const leads = (db,day) => db.shifts.filter(s=>s.date===day&&db.people.some(p=>p.id===s.user&&p.role==='lead')).map(s=>s.user);
export const mayReview = (db,actor,s) => actor.role==='admin'||(actor.role==='lead'&&actor.id!==s.user&&leads(db,s.date).includes(actor.id));
export function seed(day=today()){
  const people=[{id:'mila',name:'Mila Vos',role:'employee'},{id:'bram',name:'Bram Meijer',role:'lead'},{id:'noor',name:'Noor Post',role:'admin'}];
  const shift=(id,user,n,start,end,area)=>({id,user,date:add(day,n),start,end,area});
  return {people,shifts:[shift('s1','mila',0,'09:30','17:30','Speelvloer'),shift('s2','bram',0,'09:00','18:00','Dagleiding'),shift('s3','mila',-1,'10:00','18:00','Keuken'),shift('s4','bram',-1,'09:00','18:00','Dagleiding'),shift('s5','mila',-2,'12:00','16:00','Keuken'),shift('s6','mila',3,'12:00','18:00','Speelvloer')],hours:{s3:{start:'10:00',end:'18:00',pause:30,status:'pending'}},drafts:[],requests:[],offers:[],rules:[],extra:[],updates:[]};
}
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

function submitHours({db,actor,p,s}){
 check(s?.user===actor.id&&s.date<=today(),'Kies een eigen gewerkte dienst.');
  check(!db.hours[s.id]||db.hours[s.id].status==='returned','Deze uren zijn al ingediend.');
  interval(p);const pause=Number(p.pause);
  check(String(p.pause).trim()!==''&&Number.isInteger(pause)&&pause>=0&&pause<minutes(p.end)-minutes(p.start),'Vul de werkelijke pauze in.');
  check(!db.shifts.some(t=>t.id!==s.id&&t.user===s.user&&t.date===s.date&&intersects(p,db.hours[t.id]||t)),'Deze uren overlappen een andere dienst.');
  db.hours[s.id]={start:p.start,end:p.end,pause,status:'pending'};
}

function reviewHours({db,actor,op,p,s}){
 check(s&&mayReview(db,actor,s)&&db.hours[s.id]?.status==='pending','Deze uren kunnen hier niet worden beoordeeld.');
  if(op==='return')check(p.reason?.trim(),'Geef aan wat gecontroleerd moet worden.');
  Object.assign(db.hours[s.id],{status:op==='return'?'returned':'approved',reason:p.reason||''});
}

function recordAvailability({db,actor,op,p}){
 check(p.date>=today(),'Kies vandaag of later.');
  const start=p.start||'',end=p.end||'';
  if(start||end)interval(p);
  if(op==='weekly')check(Number.isInteger(+p.weekday)&&+p.weekday>=1&&+p.weekday<=7,'Kies een weekdag.');
  if(op==='extra'){
   db.extra=db.extra.filter(x=>x.user!==actor.id||x.date!==p.date);db.extra.push({user:actor.id,date:p.date,start:start||'00:00',end:end||'23:59'});
  }else{
   const through=p.through||p.date;check(through>=p.date&&(!start||through===p.date||op==='weekly'),'Controleer de periode.');
   if(op==='leave')check(!db.requests.some(r=>r.user===actor.id&&r.kind==='leave'&&r.status!=='rejected'&&r.date<=through&&r.through>=p.date&&(!start||!r.start||intersects(r,p))),'Er is al een aanvraag voor deze periode.');
   db.requests.push({id:crypto.randomUUID(),kind:op,user:actor.id,date:p.date,through,start,end,weekday:Number(p.weekday),off:p.off===true,reason:p.reason||'',status:'pending',created:today()});
  };
}

function decideRequest({db,admin,p,r}){
 check(admin&&r?.status==='pending','Alleen de bedrijfsleider kan een open aanvraag beoordelen.');
  if(!p.accept)check(p.reason?.trim(),'Geef een reden voor afwijzing.');
  if(p.accept&&r.kind==='weekly'){
   db.rules=db.rules.filter(x=>!(x.user===r.user&&x.weekday===r.weekday&&x.date===r.date));
   db.rules.push({...r,start:r.start||'00:00',end:r.end||'23:59'});
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

function saveDraft({db,admin,p,s}){
 check(admin&&db.people.some(x=>x.id===p.user)&&p.date>=today(),'Controleer de medewerker en datum.');interval(p);
  const id=p.id||crypto.randomUUID(), prior=db.drafts.find(d=>d.id===id);
  check(!s||(!db.hours[id]&&s.date===p.date&&s.user===p.user),'Deze dienst kan niet worden gewijzigd.');
  const other=db.shifts.filter(t=>!db.drafts.some(d=>d.id===t.id)).concat(db.drafts);
  check(!other.some(t=>t.id!==id&&t.user===p.user&&t.date===p.date&&intersects(t,p)),'Deze dienst overlapt een andere dienst.');
  db.drafts=db.drafts.filter(x=>x.id!==id);db.drafts.push({id,user:p.user,date:p.date,start:p.start,end:p.end,area:p.area,before:prior?prior.before:s?JSON.stringify(s):null});
}

function publishDrafts({db,admin,p}){
 check(admin,'Alleen voor de bedrijfsleider.');
  const chosen=db.drafts.filter(d=>d.date>=p.date&&d.date<=p.through);check(chosen.length,'Geen conceptdiensten in deze periode.');
  for(const {before,...row} of chosen){
   const old=db.shifts.find(s=>s.id===row.id);
   check((old?JSON.stringify(old):null)===before&&!db.hours[row.id],'De dienst is intussen gewijzigd. Controleer het concept.');
   const consent=freeRequests(db,row).length>0||old&&!available(db,row);
   check(consent||available(db,row)||p.confirm,'Bevestig het inplannen buiten de beschikbaarheid.');
   db.offers=db.offers.filter(o=>o.row.id!==row.id);
   if(consent)db.offers.push({id:crypto.randomUUID(),row,before,turn:'employee'});
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
   db.shifts=db.shifts.filter(s=>s.id!==o.row.id);db.shifts.push(o.row);announce(db,o.row,'Voorstel geaccepteerd: '+o.row.start+'–'+o.row.end);
  }
  announce(db,{date:o.row.date,user:o.turn==='admin'?o.row.user:db.people.find(x=>x.role==='admin').id},(p.answer==='yes'?'Voorstel geaccepteerd':'Voorstel afgewezen')+' · '+o.row.start+'–'+o.row.end);
  db.offers=db.offers.filter(x=>x.id!==o.id);
}

function markSeen({db,actor,p}){
 db.updates=db.updates.filter(x=>x.id!==p.id||x.user!==actor.id);
}

const actions={
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
 check(actor,'Onbekend profiel.');
 check(Object.hasOwn(actions,op),'Onbekende actie.');
 actions[op]({db,actor,admin:actor.role==='admin',op,p,
  s:db.shifts.find(shift=>shift.id===p.id),
  r:db.requests.find(request=>request.id===p.id)
 });
 validate(db);
 return db;
}
