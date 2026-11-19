import {mayReview,mayRemind,missing,minutes,today} from './model.js';
import {button,card,line,link,clock,labels,name,dateLabel,field,sortDate,approvalText} from './view.js';
export function reviews(db,actor){return db.shifts.filter(s=>mayReview(db,actor,s)&&db.hours[s.id]?.status==='pending').sort(sortDate)}
export const teamMissing=(db,actor)=>missing(db,actor).filter(m=>m.shift.user!==actor.id);
function remindLink(db,s){
 const person=db.people.find(p=>p.id===s.user);
 const text='Hoi '+person.name.split(' ')[0]+', wil je je uren van '+dateLabel(s.date)+' nog invullen?';
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
 return line(name(db,s.user)+' · '+dateLabel(s.date),clock(e)+' · '+e.pause+' min pauze · '+Math.floor(net/60)+'u '+net%60+'m · '+(clock(s)===clock(e)?'Volgens rooster':'Gepland '+clock(s))+(e.approvedBy?' · '+approvalText(db,e):''),button('Goedkeuren','approve',s.id,true)+button('Bekijken','inspect',s.id));
}
export function hoursPage(db,actor,view){
 const tabs=actor.role==='employee'?'':'<div class="weeknav">'+button('Mijn uren','page','hours')+button('Uren goedkeuren','page','reviews')+'</div>';
 if(view.page==='reviews'){
  const absent=teamMissing(db,actor);
  return tabs+card('Uren goedkeuren',reviews(db,actor).map(s=>reviewRow(db,s)).join('')||'Alle uren zijn beoordeeld.')
   +card('Ontbreekt ('+absent.length+')',absent.map(m=>missingRow(db,actor,m)).join('')||'Er ontbreken geen uren.');
 }
 const rows=db.shifts.filter(s=>!s.deadline&&s.user===actor.id&&s.date.startsWith(view.month)&&s.date<=today()).sort(sortDate).reverse();
 const total=rows.reduce((sum,s)=>{const e=db.hours[s.id];return sum+(e?.status==='approved'?minutes(e.end)-minutes(e.start)-e.pause:0)},0);
 return tabs+card('Gewerkte uren',button('Ongeplande dienst invullen','unplanned')+field('Maand','month','month',view.month,'data-view="month"')+'<p>'+Math.floor(total/60)+'u '+total%60+'m goedgekeurd</p>'+rows.map(s=>line(dateLabel(s.date),clock(db.hours[s.id]||s)+' · '+(labels[db.hours[s.id]?.status]||'Nog invullen'),button('Bekijken','entry',s.id))).join(''));
}
