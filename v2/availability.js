import {today,offersFor,badges} from './model.js';
import {name,card,line,clock,button,requestName,requestChip,weekNames,dateLabel,subtabs} from './view.js';
import {requestRow,offerRow} from './today.js';
// Beoordelen (bedrijfsleider): aanvragen voor vrij of vaste dagen, en voorstellen voor het rooster.
function reviewCards(db,offers){
 const open=db.requests.filter(r=>r.status==='pending');
 return card('Aanvragen',open.map(r=>requestRow(db,r)).join('')||'Geen openstaande aanvragen.')
  +(offers.length?card('Roosterwijzigingen',offers.map(o=>offerRow(db,o)).join('')):'');
}
export function availabilityPage(db,actor,v){
 const admin=actor.role==='admin',offers=offersFor(db,actor);
 const items=[['Mijn aanvragen','availability',0],['Beoordelen','requests',badges(db,actor).requests]];
 const tabs=admin?subtabs(items,v.page):'';
 if(admin&&v.page==='requests')return tabs+reviewCards(db,offers);
 const answer=offers.length&&!admin?card('Voorstellen beantwoorden',offers.map(o=>offerRow(db,o)).join('')):'';
 const rules=db.rules.filter(r=>r.user===actor.id).sort((a,b)=>b.date.localeCompare(a.date));
 // Alleen aanvragen die nog open zijn of waarvan de datum nog komt; anders wordt de lijst te lang.
 const requests=db.requests.filter(r=>r.user===actor.id&&(r.status==='pending'||(r.through||r.date)>=today()))
  .slice().reverse();
 const adminList=actor.role==='admin'?db.extra.filter(r=>r.date>=today()).map(r=>line(name(db,r.user)+' · '+dateLabel(r.date),r.start==='00:00'&&r.end==='23:59'?'Hele dag beschikbaar':clock(r),button('Inplannen','planExtra',r.date+'|'+r.user))).join(''):'';
 return tabs+answer+(adminList?card('Extra beschikbaar voor het rooster',adminList):'')+card('Vrij & beschikbaarheid',button('Vrij vragen','leave','',true)+button('Extra beschikbaar','extra'))+
 card('Mijn vaste beschikbaarheid',rules.filter((r,i)=>rules.findIndex(x=>x.weekday===r.weekday)===i).map(r=>line(weekNames[r.weekday-1],(r.off?'Vrij':clock(r))+(r.fortnightly?' · om de week vanaf ':' vanaf ')+dateLabel(r.date))).join('')+button('Vaste dagen wijzigen','weekly'))+
 (db.extra.some(r=>r.user===actor.id&&r.date>=today())?card('Extra beschikbaar',db.extra.filter(r=>r.user===actor.id&&r.date>=today()).map(r=>line(dateLabel(r.date),clock(r))).join('')):'')+
 (requests.length?card('Mijn aanvragen',requests.map(r=>line(requestName(r),r.response||'','',requestChip(r))).join('')):'');
}
