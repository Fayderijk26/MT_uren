import {mayReview,minutes,today} from './model.js';
import {button,card,line,clock,labels,name,dateLabel,field,sortDate} from './view.js';
export function reviews(db,actor){return db.shifts.filter(s=>mayReview(db,actor,s)&&db.hours[s.id]?.status==='pending').sort(sortDate)}
export function reviewRow(db,s){
 const e=db.hours[s.id],net=minutes(e.end)-minutes(e.start)-e.pause;
 return line(name(db,s.user)+' · '+dateLabel(s.date),clock(e)+' · '+e.pause+' min pauze · '+Math.floor(net/60)+'u '+net%60+'m · '+(clock(s)===clock(e)?'Volgens rooster':'Gepland '+clock(s)),button('Goedkeuren','approve',s.id,true)+button('Bekijken','inspect',s.id));
}
export function hoursPage(db,actor,view){
 if(view.page==='reviews')return card('Uren goedkeuren',reviews(db,actor).map(s=>reviewRow(db,s)).join('')||'Alle uren zijn beoordeeld.');
 const rows=db.shifts.filter(s=>s.user===actor.id&&s.date.startsWith(view.month)&&s.date<=today()).sort(sortDate).reverse();
 const total=rows.reduce((sum,s)=>{const e=db.hours[s.id];return sum+(e?.status==='approved'?minutes(e.end)-minutes(e.start)-e.pause:0)},0);
 return card('Gewerkte uren',button('Ongeplande dienst invullen','unplanned')+field('Maand','month','month',view.month,'data-view="month"')+'<p>'+Math.floor(total/60)+'u '+total%60+'m goedgekeurd</p>'+rows.map(s=>line(dateLabel(s.date),clock(db.hours[s.id]||s)+' · '+(labels[db.hours[s.id]?.status]||'Nog invullen'),button('Bekijken','entry',s.id))).join(''));
}
