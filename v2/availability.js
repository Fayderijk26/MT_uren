import {today} from './model.js';
import {name,card,line,clock,button,requestName,requestStatus,weekNames,dateLabel} from './view.js';
import {requestRow} from './today.js';
export function availabilityPage(db,actor,v){
 if(v.page==='requests')return card('Aanvragen beoordelen',db.requests.filter(r=>r.status==='pending').map(r=>requestRow(db,r)).join('')||'Geen openstaande aanvragen.');
 const rules=db.rules.filter(r=>r.user===actor.id).sort((a,b)=>b.date.localeCompare(a.date));
 const requests=db.requests.filter(r=>r.user===actor.id).slice().reverse();
 const adminList=actor.role==='admin'?db.extra.filter(r=>r.date>=today()).map(r=>line(name(db,r.user)+' · '+dateLabel(r.date),r.start==='00:00'&&r.end==='23:59'?'Hele dag beschikbaar':clock(r),button('Inplannen','planExtra',r.date+'|'+r.user))).join(''):'';
 return (adminList?card('Extra beschikbaar voor het rooster',adminList):'')+card('Vrij & beschikbaarheid',button('Vrij vragen','leave','',true)+button('Extra beschikbaar','extra'))+
 card('Mijn vaste beschikbaarheid',rules.filter((r,i)=>rules.findIndex(x=>x.weekday===r.weekday)===i).map(r=>line(weekNames[r.weekday-1],(r.off?'Vrij':clock(r))+(r.fortnightly?' · om de week vanaf ':' vanaf ')+dateLabel(r.date))).join('')+button('Vaste dagen wijzigen','weekly'))+
 (db.extra.some(r=>r.user===actor.id&&r.date>=today())?card('Extra beschikbaar',db.extra.filter(r=>r.user===actor.id&&r.date>=today()).map(r=>line(dateLabel(r.date),clock(r))).join('')):'')+
 (requests.length?card('Mijn aanvragen',requests.map(r=>line(requestName(r),requestStatus(r)+(r.response?' · '+r.response:''))).join('')):'');
}
