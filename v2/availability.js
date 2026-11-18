import {opening} from './settings.js';
import {today} from './model.js';
import {name,card,line,clock,button,requestName,requestStatus,weekNames,dateLabel,chip,empty,h} from './view.js';
import {requestRow} from './today.js';
export function availabilityPage(db,actor,v){
 if(v.page==='requests')return card('Aanvragen beoordelen',db.requests.filter(r=>r.status==='pending').map(r=>requestRow(db,r)).join('')||'Geen openstaande aanvragen.');
 const rules=db.rules.filter(r=>r.user===actor.id).sort((a,b)=>b.date.localeCompare(a.date));
 const requests=db.requests.filter(r=>r.user===actor.id).slice().reverse();
 const adminList=actor.role==='admin'?db.extra.filter(r=>r.date>=today()).map(r=>line(name(db,r.user)+' · '+dateLabel(r.date),r.start==='00:00'&&r.end==='23:59'?'Hele dag beschikbaar':clock(r),button('Inplannen','planExtra',r.date+'|'+r.user))).join(''):'';
 return (adminList?card('Extra beschikbaar voor het rooster',adminList):'')+card('Vrij & beschikbaarheid',button('Vrij vragen','leave','',true)+button('Ik kan ook extra werken','extra'))+
 card('Mijn vaste dagen','<div class="fixed-days">'+rules.filter((r,i)=>rules.findIndex(x=>x.weekday===r.weekday)===i).map(r=>'<span class="day-chip">'+h(weekNames[r.weekday-1]+' · '+(r.off?'Vrij':r.wholeDay?'Hele dag':clock(r))+(r.fortnightly?' · om de week':''))+'</span>').join('')+'</div>'+button('Wijzig','weekly'))+
 card('Mijn aanvragen',requests.map(r=>line(requestName(r),(r.reason?'Toelichting: '+r.reason+' · ':'')+(r.response?'Besluit: '+r.response:''),chip(r.status==='pending'?'waiting':r.status,requestStatus(r)))).join('')+db.extra.filter(r=>r.user===actor.id&&r.date>=today()).map(r=>line(dateLabel(r.date),'Ik kan ook extra werken · '+clock(r),chip('approved','Vastgelegd'))).join('')+(!requests.length&&!db.extra.some(r=>r.user===actor.id)?empty('Je hebt nog geen aanvragen.',button('Vrij vragen','leave')):''));
}
