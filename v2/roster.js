import {today,monday,add,freeWindows} from './model.js';
import {button,card,line,name,dateLabel,clock,field,sortDate} from './view.js';
export function rosterPage(db,actor,v){
 const personal=v.page==='mine',admin=!personal&&actor.role==='admin';
 const day=v.day,first=monday(day),last=add(first,6);
 const shifts=db.shifts.filter(s=>(!personal||s.user===actor.id)&&s.date>=first&&s.date<=last);
 const drafts=admin?db.drafts.filter(s=>s.date>=first&&s.date<=last):[];
 const rows=shifts.filter(s=>!drafts.some(d=>d.id===s.id)).concat(drafts).sort(sortDate);
 let result=field('Week van','day','date',day,'data-view="day"');
 for(let d=first;d<=last;d=add(d,1)){
  const list=rows.filter(s=>s.date===d);
  const leave=db.requests.filter(r=>r.kind==='leave'&&r.status!=='rejected'&&(personal?r.user===actor.id:admin)&&r.date<=d&&r.through>=d);
  const offers=db.offers.filter(o=>o.row.date===d&&(personal?o.row.user===actor.id:admin));
  if(!admin&&!list.length&&!leave.length&&!offers.length)continue;
  result+='<h3>'+dateLabel(d)+'</h3>'+list.map(s=>line(name(db,s.user),(s.deadline?'Stand-by · Bericht vóór '+s.deadline:clock(s))+' · '+s.area+(drafts.includes(s)?' · Concept':''),admin&&d>=today()&&!db.hours[s.id]?button('Wijzigen','draft',s.id):'')).join('');
  result+=leave.map(r=>line(name(db,r.user), (r.start||r.exceptions?.length?freeWindows(r,d).map(clock).join(' en ')+' · ':'')+(r.status==='pending'?'Vrij gevraagd':'Vrij goedgekeurd'))).join('');
  result+=offers.map(o=>line(name(db,o.row.user),'Voorstel '+clock(o.row),(o.turn==='admin'?admin:o.row.user===actor.id)?button('Bekijken','proposal',o.id):'Wacht op reactie')).join('');
  if(admin&&d>=today())result+=button('Dienst toevoegen','newDraft',d);
  if(drafts.some(s=>s.date===d))result+=button('Dag publiceren','pubDay',d);
 }
 if(drafts.length)result+=button('Week publiceren','pubWeek',first,true);
 return card(personal?'Mijn rooster':'Teamrooster',result+(!rows.length?'<p>Geen diensten deze week.</p>':''));
}
