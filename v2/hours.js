import {mayRemind,missing,minutes,today,warnings,toReview} from './model.js';
import {button,card,line,link,clock,labels,name,dateLabel,field,sortDate,approvalText} from './view.js';
export const teamMissing=(db,actor)=>missing(db,actor).filter(m=>m.shift.user!==actor.id);
export function remindLink(db,s,status='missing'){
 const person=db.people.find(p=>p.id===s.user),todo=status==='returned'?'nog aanpassen':'nog invullen';
 const text='Hoi '+person.name.split(' ')[0]+', wil je je uren van '+dateLabel(s.date)+' '+todo+'?';
 const phone=(person.phone||'').replace(/\D/g,'');
 return link('Herinner','https://wa.me/'+phone+'?text='+encodeURIComponent(text));
}
export function missingRow(db,actor,{shift,late}){
 const when=late===1?'1 dag te laat':late+' dagen te laat';
 const action=mayRemind(db,actor,shift)?remindLink(db,shift):'';
 const row=line(name(db,shift.user)+' · '+dateLabel(shift.date),clock(shift)+' · '+when,action);
 return '<div class="compact">'+row+'</div>';
}
export function reviewRow(db,s){
 const e=db.hours[s.id],net=minutes(e.end)-minutes(e.start)-e.pause;
 const parts=[clock(e),e.pause+' min pauze',Math.floor(net/60)+'u '+net%60+'m',
  clock(s)===clock(e)?'Volgens rooster':'Gepland '+clock(s)];
 if(e.approvedBy)parts.push(approvalText(db,e));
 for(const w of warnings(db,s))parts.push('Let op: '+w);
 const actions=button('Goedkeuren','approve',s.id,true)+button('Bekijken','inspect',s.id);
 return line(name(db,s.user)+' · '+dateLabel(s.date),parts.join(' · '),actions);
}
export function tabs(actor){
 if(actor.role==='employee')return '';
 const month=actor.role==='admin'?button('Maandoverzicht','page','month'):'';
 const own=button('Mijn uren','page','hours'),review=button('Uren goedkeuren','page','reviews');
 return '<div class="weeknav">'+own+review+month+'</div>';
}
export function hoursPage(db,actor,view){
 if(view.page==='reviews'){
  const absent=teamMissing(db,actor);
  return tabs(actor)+card('Uren goedkeuren',toReview(db,actor).map(s=>reviewRow(db,s)).join('')||'Alle uren zijn beoordeeld.')
   +card('Ontbreekt ('+absent.length+')',absent.map(m=>missingRow(db,actor,m)).join('')||'Er ontbreken geen uren.');
 }
 const rows=db.shifts.filter(s=>!s.deadline&&s.user===actor.id&&s.date.startsWith(view.month)&&s.date<=today()).sort(sortDate).reverse();
 const total=rows.reduce((sum,s)=>{const e=db.hours[s.id];return sum+(e?.status==='approved'?minutes(e.end)-minutes(e.start)-e.pause:0)},0);
 return tabs(actor)+card('Gewerkte uren',button('Ongeplande dienst invullen','unplanned')+field('Maand','month','month',view.month,'data-view="month"')+'<p>'+Math.floor(total/60)+'u '+total%60+'m goedgekeurd</p>'+rows.map(s=>line(dateLabel(s.date),clock(db.hours[s.id]||s)+' · '+(labels[db.hours[s.id]?.status]||'Nog invullen'),button('Bekijken','entry',s.id))).join(''));
}
