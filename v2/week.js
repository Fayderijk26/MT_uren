import {today,add,monday,ruleFor,freeWindows,TIMES,availabilityConflict,mayPlanWeek} from './model.js';
import {h,card,button,clock,dateLabel,areaMark,leaveShort} from './view.js';

export function availability(db,user,date){
 const leave=db.requests.find(r=>r.kind==='leave'&&r.user===user&&r.status!=='rejected'&&freeWindows(r,date).length);
 if(leave)return leaveShort(leave)+(leave.status==='pending'?' gevraagd':'')+(leave.start?' '+clock(leave):'');
 const rule=ruleFor(db,{user,date});
 if(!rule)return 'Onbekend';
 if(rule.off)return 'Vrij';
 if(rule.start===TIMES.start)return rule.end===TIMES.end?'Hele dag beschikbaar':'Beschikbaar tot '+rule.end;
 return rule.end===TIMES.end?'Beschikbaar vanaf '+rule.start:'Beschikbaar '+clock(rule);
}
function cell(db,person,date,readonly){
 const matches=s=>s.user===person.id&&s.date===date;
 const drafts=readonly?[]:db.drafts.filter(matches);
 const shifts=db.shifts.filter(matches).filter(s=>!drafts.some(d=>d.id===s.id)).concat(drafts)
  .sort((a,b)=>a.start.localeCompare(b.start));
 const offers=db.offers.filter(o=>matches(o.row));
 const blocks=shifts.map(s=>{
  const text=(s.deadline?'<b class="sb">SB</b><small>Bericht vóór '+h(s.deadline)+'</small>':'<b>'+clock(s)+'</b>')
   +areaMark(s);
  const conflict=drafts.includes(s)?availabilityConflict(db,s):'';
  const warn=conflict?'<small class="conflict">Let op: '+h(conflict)+'</small>':'';
  return '<button class="slot" data-act="shiftDetails" data-id="'+h(s.id)+'">'+text+'<small>'
   +(drafts.includes(s)?'Concept':s.sick?'Ziek gemeld':'Ingepland')+'</small>'+warn+'</button>';
 });
 // Een open voorstel: de bedrijfsleider kan het openen als het op haar wacht.
 for(const o of offers){
  const act=o.turn==='admin'&&!readonly?'data-act="proposal" data-id="'+h(o.id)+'"':'disabled';
  const who=o.turn==='admin'?'bedrijfsleider':h(person.name.split(' ')[0]);
  blocks.push('<button class="asked" '+act+'>'+(o.fallback?'Gevraagd: '+clock(o.row):clock(o.row))
   +'<small>'+h(availability(db,person.id,date))+'</small><small>Wacht op '+who+'</small></button>');
 }
 // Lege dag: de beschikbaarheid, en vanaf vandaag een knop om iemand in te plannen.
 const act=!readonly&&date>=today()?'planExtra':'past';
 if(!blocks.length)blocks.push(button(availability(db,person.id,date),act,date+'|'+person.id));
 return blocks.join('');
}
// Concept maken uit vaste beschikbaarheid, voor een week die nog niet voorbij is.
const plan=(db,v,readonly)=>readonly||!mayPlanWeek(db,v.day)?''
 :button('Concept uit vaste beschikbaarheid','planFromRules',monday(v.day));
// Bovenbalk zoals bij Mijn rooster: links de knoppen, rechts ‹ Vandaag ›.
const arrow=(day,text,sign)=>'<button class="secondary" data-act="week" data-id="'+day+'" aria-label="'+text+'">'
 +sign+'</button>';
const toolbar=(left,prev,next,unit)=>'<div class="calendar-toolbar"><div class="weektools">'+left+'</div>'
 +'<div class="calendar-navigation" role="group" aria-label="Periode kiezen">'+arrow(prev,'Vorige '+unit,'‹')
 +button('Vandaag','week',today())+arrow(next,'Volgende '+unit,'›')+'</div></div>';
// Wie staat in het rooster: iedereen die actief is, en wie inactief is maar in deze dagen nog iets heeft.
const shown=(db,days)=>db.people.filter(p=>p.active!==false
 ||db.shifts.concat(db.drafts).some(s=>s.user===p.id&&days.includes(s.date)));
// Dagweergave voor een telefoon: per medewerker één regel met de diensten van die dag.
function dayView(db,v,readonly,pending){
 const day=v.day;
 const nav=toolbar(plan(db,v,readonly),add(day,-1),add(day,1),'dag');
 const rows=shown(db,[day]).map(p=>'<div class="dayrow"><b>'+h(p.name)+'</b><div class="dayslots">'
  +cell(db,p,day,readonly)+'</div></div>').join('');
 const week=Array.from({length:7},(_,i)=>add(monday(day),i));
 const publish=!readonly&&week.some(pending)?button('Week publiceren','pubWeek',monday(day),true):'';
 return '<div class="dayview">'+nav+'<h3 class="daytitle">'+h(dateLabel(day))+'</h3>'+rows+publish+'</div>';
}
// Weekraster voor een groot scherm.
function weekView(db,v,readonly,pending){
 const first=monday(v.day),days=v.single?[v.day]:Array.from({length:7},(_,i)=>add(first,i));
 const current=d=>d===today()?'current':'';
 const left=(v.single?button('Hele week','week',first):'')+plan(db,v,readonly);
 let html=toolbar(left,add(first,-7),add(first,7),'week');
 html+='<div class="weekscroll"><table class="weekgrid"><thead><tr><th>Medewerker</th>'
  +days.map(d=>'<th class="'+current(d)+'">'+button(dateLabel(d),'day',d)+'</th>').join('')+'</tr></thead><tbody>';
 html+=shown(db,days).map(p=>'<tr><th scope="row">'+h(p.name)+'</th>'
  +days.map(d=>'<td class="'+current(d)+'">'+cell(db,p,d,readonly)+'</td>').join('')+'</tr>').join('')
  +'</tbody></table></div>';
 const week=Array.from({length:7},(_,i)=>add(first,i));
 if(!readonly&&week.some(pending))html+=button('Week publiceren','pubWeek',first,true);
 return '<div class="weekview">'+html+'</div>';
}
export function weekPage(db,v,readonly=false){
 const pending=d=>db.drafts.some(s=>s.date===d)||db.offers.some(o=>o.row.date===d);
 return card('Teamrooster',dayView(db,v,readonly,pending)+weekView(db,v,readonly,pending));
}
