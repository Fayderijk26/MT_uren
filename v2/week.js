import {today,add,monday,ruleFor,freeWindows,TIMES} from './model.js';
import {h,card,button,clock,dateLabel} from './view.js';

export function availability(db,user,date){
 const leave=db.requests.find(r=>r.kind==='leave'&&r.user===user&&r.status!=='rejected'&&freeWindows(r,date).length);
 if(leave)return (leave.status==='pending'?'Vrij gevraagd':'Vrij')+(leave.start?' '+clock(leave):'');
 const rule=ruleFor(db,{user,date});
 if(!rule)return 'Onbekend';
 if(rule.off)return 'Vrij';
 if(rule.start===TIMES.start)return rule.end===TIMES.end?'Hele dag beschikbaar':'Beschikbaar tot '+rule.end;
 return rule.end===TIMES.end?'Beschikbaar vanaf '+rule.start:'Beschikbaar '+clock(rule);
}
function cell(db,person,date,readonly){
 const matches=s=>s.user===person.id&&s.date===date;
 const drafts=readonly?[]:db.drafts.filter(matches);
 const shifts=db.shifts.filter(matches).filter(s=>!drafts.some(d=>d.id===s.id)).concat(drafts).sort((a,b)=>a.start.localeCompare(b.start));
 const offers=db.offers.filter(o=>matches(o.row));
 const blocks=shifts.map(s=>{
  const text=s.deadline?'<b class="sb">SB</b><small>Bericht vóór '+h(s.deadline)+'</small>':'<b>'+clock(s)+'</b>';
  return '<button class="slot" data-act="shiftDetails" data-id="'+h(s.id)+'">'+text+'<small>'+(drafts.includes(s)?'Concept':'Ingepland')+'</small></button>';
 });
 for(const o of offers)blocks.push('<button class="asked" '+(o.turn==='admin'&&!readonly?'data-act="proposal" data-id="'+h(o.id)+'"':'disabled')+'>'+(o.fallback?'Gevraagd: '+clock(o.row):clock(o.row))+'<small>'+h(availability(db,person.id,date))+'</small><small>Wacht op '+(o.turn==='admin'?'bedrijfsleider':h(person.name.split(' ')[0]))+'</small></button>');
 if(!blocks.length)blocks.push(button(availability(db,person.id,date),!readonly&&date>=today()?'planExtra':'past',date+'|'+person.id));
 return blocks.join('');
}
export function weekPage(db,v,readonly=false){
 const first=monday(v.day),days=v.single?[v.day]:Array.from({length:7},(_,i)=>add(first,i));
 let html='<div class="weeknav">'+button('Vorige week','week',add(first,-7))+button('Vandaag','week',today())+button('Volgende week','week',add(first,7))+(v.single?button('Hele week','week',first):'')+'</div>';
 html+='<div class="weekscroll"><table class="weekgrid"><thead><tr><th>Medewerker</th>'+days.map(d=>'<th class="'+(d===today()?'current':'')+'">'+button(dateLabel(d),'day',d)+'</th>').join('')+'</tr></thead><tbody>';
 html+=db.people.map(p=>'<tr><th scope="row">'+h(p.name)+'</th>'+days.map(d=>'<td class="'+(d===today()?'current':'')+'">'+cell(db,p,d,readonly)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
 const pending=d=>db.drafts.some(s=>s.date===d)||db.offers.some(o=>o.row.date===d);
 if(!readonly&&days.some(pending))html+=button(v.single?'Dag publiceren':'Week publiceren',v.single?'pubDay':'pubWeek',v.single?v.day:first,true);
 return card('Teamrooster',html);
}
