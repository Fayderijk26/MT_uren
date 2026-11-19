import {today,add,monday,weekday,ruleFor,TIMES} from './model.js';
import {h,button,card,clock,dateLabel,requestStatus,weekNames} from './view.js';

export function dayContent(db,user,date){
 const shifts=db.shifts.filter(s=>s.user===user&&s.date===date);
 const requests=db.requests.filter(r=>r.user===user&&(r.kind==='weekly'?r.date<=date&&r.weekday===weekday(date):r.date<=date&&r.through>=date));
 const rule=ruleFor(db,{user,date});
 const items=shifts.map(s=>({text:s.deadline?'SB · Bericht vóór '+s.deadline:clock(s)+' · Ingepland',kind:'planned',shift:s}));
 if(rule)items.push({text:rule.off?'Vrij':rule.start===TIMES.start&&rule.end===TIMES.end?'Hele dag beschikbaar': 'Beschikbaar '+clock(rule),kind:'available'});
 for(const r of requests)items.push({text:(r.kind==='weekly'?'Vaste beschikbaarheid: '+(r.off?'niet beschikbaar':clock(r)):r.start?'Vrij '+clock(r):'Vrij gevraagd')+' · '+requestStatus(r)+(r.response?' · '+r.response:''),kind:r.status,request:r});
 for(const offer of db.offers.filter(o=>o.row.user===user&&o.row.date===date))items.push({text:clock(offer.row)+' · '+(offer.turn==='employee'?'Vraag om te werken':'Wacht op bedrijfsleider'),kind:'pending',offer});
 return items.length?items:[{text:'Onbekend',kind:'unknown'}];
}
export function calendarPage(db,actor,view){
 const date=view.calendarDate||today(),week=view.calendarMode==='week';
 const month=date.slice(0,7)+'-01';
 const nextMonth=new Date(month+'T12:00Z');nextMonth.setUTCMonth(nextMonth.getUTCMonth()+1);
 const endMonth=nextMonth.toISOString().slice(0,10);
 const start=week?monday(date):monday(month);
 const end=week?add(start,7):add(monday(add(endMonth,-1)),7);
 let grid='<div class="calendar-scroll"><div class="personal-calendar">';
 for(const day of weekNames)grid+='<div class="weekday">'+day.slice(0,2)+'</div>';
 for(let d=start;d<end;d=add(d,1)){
  grid+='<button class="calendar-day '+(d===today()?'current':'')+(d.slice(0,7)!==date.slice(0,7)?' adjacent':'')+'" data-act="calendarDay" data-id="'+d+'"><b>'+Number(d.slice(8))+'</b>'+dayContent(db,actor.id,d).map(i=>'<span class="cal-'+i.kind+'">'+h(i.text)+'</span>').join('')+'</button>';
 }
 grid+='</div></div>';
 const title=week?dateLabel(start)+' – '+dateLabel(add(start,6)):new Intl.DateTimeFormat('nl-NL',{month:'long',year:'numeric'}).format(new Date(month+'T12:00Z'));
 const mode=(label,id,active)=>'<button data-act="calendarMode" data-id="'+id+'" aria-pressed="'+active+'" class="'+(active?'primary':'secondary')+'">'+label+'</button>';
 return card('Mijn rooster','<div class="calendar-toolbar"><div class="calendar-modes" role="group" aria-label="Weergave">'+mode('Week','week',week)+mode('Maand','month',!week)+'</div><div class="calendar-navigation" role="group" aria-label="Periode kiezen"><button class="secondary" data-act="calendarMove" data-id="-1" aria-label="Vorige '+(week?'week':'maand')+'">‹</button>'+button('Vandaag','calendarMove','0')+'<button class="secondary" data-act="calendarMove" data-id="1" aria-label="Volgende '+(week?'week':'maand')+'">›</button></div></div><h3 class="calendar-period">'+h(title)+'</h3>'+grid);
}
