import {mayRemind,minutes,today,warnings,toReview,teamMissing,badges,busy,ended,asPlanned} from './model.js';
import {button,card,line,link,clock,name,dateLabel,field,sortDate,approvalText,chip,subtabs,sickButton}
 from './view.js';
// "di 17 nov", "di 17 nov en wo 18 nov", "ma 16 nov, di 17 nov en wo 18 nov".
const dayList=shifts=>shifts.map(s=>dateLabel(s.date)).join(', ').replace(/, ([^,]*)$/,' en $1');
// WhatsApp-herinnering voor één of meer diensten van dezelfde medewerker.
export function remindLink(db,shifts,status='missing'){
 const person=db.people.find(p=>p.id===shifts[0].user),todo=status==='returned'?'nog aanpassen':'nog invullen';
 const text='Hoi '+person.name.split(' ')[0]+', wil je je uren van '+dayList(shifts)+' '+todo+'?';
 const phone=(person.phone||'').replace(/\D/g,'');
 return link('Herinner','https://wa.me/'+phone+'?text='+encodeURIComponent(text));
}
// Ontbrekende uren per medewerker bij elkaar: één regel en één herinnering voor alle dagen.
export function missingByPerson(list){
 const groups=new Map();
 for(const m of list)groups.set(m.shift.user,[...(groups.get(m.shift.user)||[]),m]);
 return [...groups.values()];
}
export function missingRow(db,actor,group){
 const {shift,late}=group[0],when=late===0?'vandaag':late===1?'1 dag te laat':late+' dagen te laat';
 const remind=group.map(m=>m.shift).filter(s=>mayRemind(db,actor,s));
 const text=group.length===1?dateLabel(shift.date)+' · '+clock(shift)+' · '+when
  :group.map(m=>dateLabel(m.shift.date)).join(', ');
 // Vergeten ziek te melden in de app: per dag een knop, als deze persoon dat mag (regel in model.js).
 const sick=group.map(m=>sickButton(db,actor,m.shift,'Ziek melden '+dateLabel(m.shift.date))).join('');
 const row=line(name(db,shift.user),text,(remind.length?remindLink(db,remind):'')+sick);
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
export function tabs(db,actor,page){
 if(actor.role==='employee')return '';
 const count=badges(db,actor);
 const items=[['Mijn uren','hours',count.mine],['Uren goedkeuren','reviews',count.review]];
 if(actor.role==='admin')items.push(['Maandoverzicht','month',0]);
 return subtabs(items,page);
}
function ownHoursRow(db,s){
 const status=s.sick?'sick':db.hours[s.id]?.status||(ended(s)?'missing':busy(s)?'busy':'');
 const row=line(dateLabel(s.date),clock(db.hours[s.id]||s),button('Bekijken','entry',s.id),status?chip(status):'');
 return '<div class="compact">'+row+'</div>';
}
export function hoursPage(db,actor,view){
 if(view.page==='reviews'){
  const absent=teamMissing(db,actor);
  const same=asPlanned(db,actor).length;
  const all=same?button('Alles goedkeuren ('+same+')','approveAll','',true):'';
  return tabs(db,actor,'reviews')+card('Uren goedkeuren',all+(toReview(db,actor).map(s=>reviewRow(db,s)).join('')
   ||'Alle uren zijn beoordeeld.'))
   +card('Ontbreekt ('+absent.length+')',missingByPerson(absent).map(g=>missingRow(db,actor,g)).join('')||'Er ontbreken geen uren.');
 }
 const rows=db.shifts.filter(s=>!s.deadline&&s.user===actor.id&&s.date.startsWith(view.month)&&s.date<=today()).sort(sortDate).reverse();
 const total=rows.reduce((sum,s)=>{const e=db.hours[s.id];return sum+(e?.status==='approved'?minutes(e.end)-minutes(e.start)-e.pause:0)},0);
 return tabs(db,actor,'hours')+card('Gewerkte uren',button('Ongeplande dienst invullen','unplanned')+field('Maand','month','month',view.month,'data-view="month"')+'<p>'+Math.floor(total/60)+'u '+total%60+'m goedgekeurd</p>'+rows.map(s=>ownHoursRow(db,s)).join(''));
}
