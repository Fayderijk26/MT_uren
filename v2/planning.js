import {today,add,monday,weekday,minutes,check,interval,intersects,freeRequests,announce,needsQuestion,available,ruleFor,published} from './model.js';
import {opening} from './settings.js';
export function requiresConsent(db,row,accepted=false){return !accepted&&(needsQuestion(db,row)||!available(db,row));}
export function saveDraft({db,admin,actor,p,s}){
 check(admin&&db.people.some(x=>x.id===p.user&&x.active!==false)&&p.date>=today(),'Controleer de medewerker en datum.');interval(p);
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
   db.offers.push({id:crypto.randomUUID(),row,before,turn:'employee',planning:true,requestedBy:actor.id});
  }else db.drafts.push({...row,before,accepted:!!prior?.accepted&&prior.start===row.start&&prior.end===row.end&&prior.user===row.user&&prior.deadline===row.deadline});
}

export function fallbackShift(db,row){
 const rule=ruleFor(db,row);
 if(!rule||rule.off||rule.closed||row.deadline||freeRequests(db,row).length)return null;
 const start=row.start>rule.start?row.start:rule.start,end=row.end<rule.end?row.end:rule.end;
 return start<end?{...row,start,end}:null;
}
export function publishDrafts({db,admin,actor,p}){
 check(admin,'Alleen voor de bedrijfsleider.');
  const chosen=db.drafts.filter(d=>d.date>=p.date&&d.date<=p.through&&(!p.onlyId||d.id===p.onlyId));check(chosen.length||db.offers.some(o=>o.row.date>=p.date&&o.row.date<=p.through),'Geen diensten in deze periode.');
  db.published??=[];
  for(let d=p.date;d<=p.through;d=add(d,1))if(!db.published.includes(d))db.published.push(d);
  for(const {before,accepted,...row} of chosen){
   const old=db.shifts.find(s=>s.id===row.id);
   check((old?JSON.stringify(old):null)===before&&!db.hours[row.id],'De dienst is intussen gewijzigd. Controleer het concept.');
   const consent=requiresConsent(db,row,accepted);
   check(consent||available(db,row)||p.confirm,'Bevestig het inplannen buiten de beschikbaarheid.');
   db.offers=db.offers.filter(o=>o.row.id!==row.id);
   if(consent){
    const fallback=old||fallbackShift(db,row);
    if(fallback&&!old){db.shifts.push(fallback);announce(db,fallback,'Ingepland: '+fallback.start+'–'+fallback.end);}
    db.offers.push({id:crypto.randomUUID(),row,before:fallback?JSON.stringify(fallback):null,turn:'employee',fallback:fallback?{...fallback}:null,requestedBy:actor.id,availability:ruleFor(db,row)});
   }
   else{db.shifts=db.shifts.filter(s=>s.id!==row.id);db.shifts.push(row);announce(db,row,'Ingepland: '+row.start+'–'+row.end);}
  }
  db.drafts=db.drafts.filter(d=>!chosen.some(c=>c.id===d.id));
}

export function answerOffer({db,actor,admin,p}){
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
  for(const recipient of o.turn==='admin'?[o.row.user]:o.requestedBy?[o.requestedBy]:db.people.filter(p=>p.role==='admin'&&p.active!==false).map(p=>p.id))announce(db,{date:o.row.date,user:recipient},db.people.find(x=>x.id===o.row.user).name+' · '+(p.answer==='yes'?'Voorstel geaccepteerd · '+o.row.start+'–'+o.row.end:o.fallback?'Voorstel afgewezen; dienst blijft '+o.fallback.start+'–'+o.fallback.end:'Voorstel afgewezen · '+o.row.start+'–'+o.row.end));
  db.offers=db.offers.filter(x=>x.id!==o.id);
}

export function generateWeek({db,admin,actor,p}){
 check(admin,'Alleen de bedrijfsleider kan een conceptrooster maken.');
 check(['previous','availability'].includes(p.source),'Kies de bron van het rooster.');
 const first=monday(p.date);check(first>=monday(today()),'Kies deze week of later.');
 const skipped=[];let created=0;
 for(let n=0;n<7;n++){
  const date=add(first,n);if(date<today())continue;
  const candidates=p.source==='previous'?db.shifts.filter(s=>s.date===add(date,-7)&&!s.unplanned).map(s=>({...s,id:undefined,date})):
   db.people.filter(x=>x.active!==false).flatMap(person=>{
    const rule=ruleFor(db,{user:person.id,date}),window=opening(db,date);
    if(!rule||rule.off||rule.closed||window.closed||!db.rules.some(r=>r.user===person.id&&r.weekday===weekday(date)))return [];
    const start=rule.start>window.start?rule.start:window.start,end=rule.end<window.end?rule.end:window.end;
    return minutes(end)-minutes(start)>=360?[{user:person.id,date,start,end,area:person.role==='lead'?'Dagleiding':person.role==='admin'?'Bedrijfsleiding':'Speelvloer'}]:[];
   });
  for(const row of candidates){
   const person=db.people.find(x=>x.id===row.user);
   const occupied=db.shifts.concat(db.drafts).some(s=>s.user===row.user&&s.date===date&&intersects(s,row))||db.offers.some(o=>o.row.user===row.user&&o.row.date===date&&intersects(o.row,row));
   if(person?.active===false||occupied||needsQuestion(db,row)||!available(db,row)){skipped.push(person?.name+' · '+date);continue;}
   saveDraft({db,admin,actor,p:row});created++;
  }
 }
 db.generation={created,skipped,by:actor.id,date:first};
}
