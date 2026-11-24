import {today,add,monday,weekday,ruleFor,dayTimes,closedDay} from './model.js';
import {h,button,card,clock,dateLabel,requestStatus,weekNames,leaveShort} from './view.js';

// Wat er op een dag voor iemand staat: diensten, beschikbaarheid, aanvragen en voorstellen.
export function dayContent(db,user,date){
 const shifts=db.shifts.filter(s=>s.user===user&&s.date===date);
 const onDay=r=>r.kind==='weekly'?r.date<=date&&r.weekday===weekday(date):r.date<=date&&r.through>=date;
 const requests=db.requests.filter(r=>r.user===user&&onDay(r));
 const rule=ruleFor(db,{user,date});
 const state=s=>s.sick?' · Ziek gemeld':' · Ingepland';
 const shiftText=s=>s.deadline?'SB · Bericht vóór '+s.deadline:clock(s)+state(s);
 const items=shifts.map(s=>({text:shiftText(s),kind:'planned',shift:s}));
 // Dicht (ronde 12): bovenaan, voor iedereen.
 if(closedDay(db,date))items.unshift({text:'Dicht',kind:'closed'});
 const std=dayTimes(date),wholeDay=rule&&rule.start<=std.start&&rule.end>=std.end;
 // Niet beschikbaar voor één dag, en aangegeven beschikbaarheid bij een vrij-aanvraag van een oproepkracht (ronde 13).
 const free=rule?.off&&(rule.weekday?'Vrij':'Niet beschikbaar');
 const told=rule?.request&&'Aangegeven beschikbaarheid '+clock(rule);
 if(rule)items.push({text:free||told||(wholeDay?'Hele dag beschikbaar':'Beschikbaar '+clock(rule)),kind:'available'});
 const what=r=>r.kind==='day'?'Beschikbaarheid '+clock(r):r.kind==='weekly'?'Vaste beschikbaarheid: '+(r.off?'niet beschikbaar':clock(r))
  :leaveShort(r)+(r.start?' '+clock(r):'');
 for(const r of requests)items.push({text:what(r)+' · '+requestStatus(r)+(r.response?' · '+r.response:''),
  kind:r.status,request:r});
 for(const offer of db.offers.filter(o=>o.row.user===user&&o.row.date===date)){
  const wait=offer.turn==='employee'?'Vraag om te werken':'Wacht op bedrijfsleider';
  items.push({text:clock(offer.row)+' · '+wait,kind:'pending',offer});
 }
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
  const kind=(closedDay(db,d)?'closed ':'')+(d===today()?'current':'')+(d.slice(0,7)!==date.slice(0,7)?' adjacent':'');
  const items=dayContent(db,actor.id,d).map(i=>'<span class="cal-'+i.kind+'">'+h(i.text)+'</span>').join('');
  grid+='<button class="calendar-day '+kind+'" data-act="calendarDay" data-id="'+d+'"><b>'+Number(d.slice(8))+'</b>'
   +items+'</button>';
 }
 grid+='</div></div>';
 const monthName=new Intl.DateTimeFormat('nl-NL',{month:'long',year:'numeric'}).format(new Date(month+'T12:00Z'));
 const title=week?dateLabel(start)+' – '+dateLabel(add(start,6)):monthName;
 const mode=(label,id,active)=>'<button data-act="calendarMode" data-id="'+id+'" aria-pressed="'+active+'" class="'
  +(active?'primary':'secondary')+'">'+label+'</button>';
 const unit=week?'week':'maand';
 const arrow=(step,text,sign)=>'<button class="secondary" data-act="calendarMove" data-id="'+step+'" aria-label="'
  +text+' '+unit+'">'+sign+'</button>';
 const modes='<div class="calendar-modes" role="group" aria-label="Weergave">'+mode('Week','week',week)
  +mode('Maand','month',!week)+'</div>';
 const nav='<div class="calendar-navigation" role="group" aria-label="Periode kiezen">'+arrow('-1','Vorige','‹')
  +button('Vandaag','calendarMove','0')+arrow('1','Volgende','›')+'</div>';
 return card('Mijn rooster','<div class="calendar-toolbar">'+modes+nav+'</div><h3 class="calendar-period">'+h(title)
  +'</h3>'+grid);
}
