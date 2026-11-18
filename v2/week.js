import {today,add,monday,ruleFor,freeWindows} from './model.js';
import {wholeDay,opening} from './settings.js';
import {h,card,button,clock,dateLabel,line,chip} from './view.js';
import {contactButtons} from './contacts.js';
export function availability(db,user,date){
 const leave=db.requests.find(r=>r.kind==='leave'&&r.user===user&&r.status!=='rejected'&&freeWindows(r,date).length);
 if(leave)return (leave.status==='pending'?'Vrij gevraagd':'Vrij')+(leave.start?' '+clock(leave):'');
 const rule=ruleFor(db,{user,date});if(!rule)return 'Onbekend';if(rule.off||rule.closed)return 'Vrij';
 const o=opening(db,date);
 if(wholeDay(db,{...rule,date}))return 'Hele dag beschikbaar';
 if(rule.start===o.start)return 'Beschikbaar tot '+rule.end;
 return rule.end===o.end?'Beschikbaar vanaf '+rule.start:'Beschikbaar '+clock(rule);
}
function cell(db,person,date,readonly,compact=false){
 const matches=s=>s.user===person.id&&s.date===date,drafts=readonly?[]:db.drafts.filter(matches);
 const shifts=db.shifts.filter(matches).filter(s=>!drafts.some(d=>d.id===s.id)).concat(drafts).sort((a,b)=>a.start.localeCompare(b.start));
 const offers=db.offers.filter(o=>matches(o.row)),blocks=shifts.map(s=>{
  const text=s.deadline?'<b class="sb">SB</b><small>Bericht vóór '+h(s.deadline)+'</small>':'<b>'+clock(s)+'</b>';
  return '<button class="slot" data-act="shiftDetails" data-id="'+h(s.id)+'">'+text+'<small>'+(drafts.includes(s)?'Concept':'Ingepland')+'</small></button>';
 });
 for(const o of offers)blocks.push('<div class="asked">'+h((o.fallback?'Gevraagd: ':'')+clock(o.row))+'<small>'+h(availability(db,person.id,date))+'</small>'+chip('waiting','Wacht op '+(o.turn==='admin'?'bedrijfsleider':person.name.split(' ')[0]))+(o.turn==='admin'&&!readonly?button('Bekijken','proposal',o.id):'')+'</div>');
 if(!blocks.length){
  const text=availability(db,person.id,date),kind=text==='Onbekend'?'unknown':text.startsWith('Vrij')?'free':'available';
  blocks.push('<button class="availability-cell" aria-label="'+h(person.name+' · '+dateLabel(date)+' · '+text)+'" title="'+h(text)+'" data-act="availabilityDetail" data-id="'+date+'|'+person.id+'"><span aria-hidden="true" class="availability-dot '+kind+'"></span>'+(compact?'<span>'+h(text)+'</span>':'<span class="sr-only">'+h(text)+'</span>')+'</button>');
 }
 return blocks.join('');
}
export function weekPage(db,v,readonly=false,actor){
 const first=monday(v.day),single=v.compact||v.single,days=single?[v.day]:Array.from({length:7},(_,i)=>add(first,i));
 let html='<div class="calendar-toolbar"><h3>'+h(single?dateLabel(v.day):dateLabel(first)+' – '+dateLabel(add(first,6)))+'</h3><div class="vactions">'+button('‹',single?'day':'week',add(single?v.day:first,single?-1:-7))+button('Vandaag',single?'day':'week',today())+button('›',single?'day':'week',add(single?v.day:first,single?1:7))+(!v.compact&&v.single?button('Hele week','week',first):'')+'</div></div>';
 if(!readonly)html+='<div class="vactions">'+button('Kopieer vorige week','generatePrevious')+button('Concept uit beschikbaarheid','generateAvailability')+'</div>';
 const people=db.people.filter(p=>p.active!==false||db.shifts.some(s=>s.user===p.id&&days.includes(s.date)));
 if(v.compact)html+='<div class="mobile-roster">'+people.map(p=>'<article class="vrow"><b>'+h(p.name)+'</b><div>'+cell(db,p,v.day,readonly,true)+'</div><div class="vactions">'+(actor?contactButtons(db,actor,p.id):'')+'</div></article>').join('')+'</div>';
 else{
  html+='<div class="weekscroll"><table class="weekgrid"><thead><tr><th>Medewerker</th>'+days.map(d=>'<th class="'+(d===today()?'current':'')+'">'+button(dateLabel(d),'day',d)+'</th>').join('')+'</tr></thead><tbody>';
  html+=people.map(p=>'<tr><th scope="row">'+h(p.name)+'</th>'+days.map(d=>'<td class="'+(d===today()?'current':'')+'">'+cell(db,p,d,readonly)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div><p class="legend"><span class="availability-dot available"></span> Beschikbaar · <span class="availability-dot unknown"></span> Onbekend · <span class="availability-dot free"></span> Vrij — open een vakje voor details.</p>';
 }
 const count=db.drafts.filter(s=>days.includes(s.date)).length;
 if(!readonly&&count)html+='<aside class="publish-bar"><strong>'+count+' conceptdienst'+(count===1?'':'en')+'</strong>'+button('Publiceren',single?'pubDay':'pubWeek',single?v.day:first,true)+'</aside>';
 return card('Teamrooster',html);
}
