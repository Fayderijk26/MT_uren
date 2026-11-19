import {today,leads,ownTodo,toReview,offersFor} from './model.js';
import {card,line,name,clock,dateLabel,button,labels,sortDate,requestName,requestStatus,h} from './view.js';
import {reviewRow,teamMissing,missingRow} from './hours.js';
export function ownRow(db,s){const e=db.hours[s.id];return line(dateLabel(s.date)+' · '+s.area,clock(s)+(e?.reason?' · '+e.reason:''),button(e?.status==='returned'?'Aanpassen':labels[e?.status]||'Uren invullen','entry',s.id,!e||e.status==='returned'))}
export function requestRow(db,r){return line(name(db,r.user),requestName(r)+' · '+Math.round((Date.parse(r.date)-Date.parse(r.created))/86400000)+' dagen van tevoren aangevraagd'+(r.kind==='leave'&&Date.parse(r.date)-Date.parse(r.created)<21*86400000?' · Te laat aangevraagd':''),button('Beoordelen','decision',r.id))}
const shiftLine=s=>line(dateLabel(s.date),clock(s)+' · '+s.area);
function absentCard(db,actor){
 const absent=teamMissing(db,actor);
 if(!absent.length)return '';
 const rows=absent.slice(0,3).map(m=>missingRow(db,actor,m)).join('');
 return card('Uren ontbreken ('+absent.length+')',rows+button('Alle bekijken','page','reviews'));
}
// 1. Wanneer heb ik dienst: vandaag, of anders de eerstvolgende.
function myShift(db,mine,day){
 const current=mine.filter(s=>s.date===day),next=mine.find(s=>s.date>day);
 if(current.length)return card('Mijn dienst vandaag',current.map(s=>ownRow(db,s)).join(''));
 return next?card('Eerstvolgende dienst',shiftLine(next)):'';
}
// 2. Wat moet ik nog doen en welke aanvragen lopen er.
function todoCards(db,actor,mine,day){
 const admin=actor.role==='admin';
 const open=ownTodo(db,actor,day);
 let html=open.length?card('Nog in te vullen',open.map(s=>ownRow(db,s)).join('')):'';
 const offers=offersFor(db,actor);
 if(offers.length)html+=card('Roosterwijzigingen beoordelen',offers.map(o=>line(dateLabel(o.row.date)+' · '+name(db,o.row.user),
  (o.fallback?'Ingepland '+clock(o.fallback)+' · Gevraagd '+clock(o.row):clock(o.row)),button('Voorstel bekijken','proposal',o.id))).join(''));
 const standby=db.shifts.filter(s=>s.deadline&&(admin?s.date<=day:s.user===actor.id&&s.date>=day));
 if(standby.length)html+=card('Stand-by',standby.map(s=>line(admin?name(db,s.user)+' wacht op bericht':dateLabel(s.date),
  'Bericht vóór '+s.deadline+(admin?'':' · Dan hoor je of je werkt.'),admin?button('Stand-by afhandelen','standby',s.id):'')).join(''));
 if(actor.role!=='employee'){
  html+=absentCard(db,actor);
  const queue=toReview(db,actor);
  if(queue.length)html+=card('Uren goedkeuren ('+queue.length+')',queue.slice(0,3).map(s=>reviewRow(db,s)).join('')
   +button('Alle uren bekijken','page','reviews'));
 }
 const requests=admin?db.requests.filter(r=>r.status==='pending'):[];
 if(requests.length)html+=card('Aanvragen beoordelen',requests.slice(0,3).map(r=>requestRow(db,r)).join('')
  +button('Alle aanvragen bekijken','page','requests'));
 const pending=mine.filter(s=>db.hours[s.id]?.status==='pending');
 if(pending.length)html+=card('Wacht op beoordeling',pending.map(s=>line(dateLabel(s.date),clock(db.hours[s.id]))).join(''));
 const own=db.requests.filter(r=>r.user===actor.id&&r.kind==='leave'&&r.through>=day);
 if(own.length)html+=card('Mijn vrijaanvragen',own.map(r=>line(requestName(r),requestStatus(r)+(r.response?' · '+r.response:''))).join(''));
 return html;
}
// 3. De rest: wie werkt er vandaag, de dienst daarna en roosterwijzigingen.
function restCards(db,actor,mine,day){
 const onDuty=actor.role==='admin'||actor.role==='lead'&&leads(db,day).includes(actor.id);
 const team=db.shifts.filter(s=>!s.deadline&&s.date===day).sort(sortDate);
 let html=onDuty?card('Wie werkt er vandaag?',team.map(s=>line(name(db,s.user),clock(s)+' · '+s.area)).join('')
  ||'Er staan vandaag geen diensten gepland.'):'';
 const next=mine.find(s=>s.date>day);
 if(mine.some(s=>s.date===day)&&next)html+=card('Eerstvolgende dienst',shiftLine(next));
 const notes=db.updates.filter(n=>n.user===actor.id);
 if(notes.length)html+=card('Roosterwijzigingen',notes.map(n=>line(dateLabel(n.date),n.text,button('Gezien','seen',n.id))).join(''));
 return html;
}
export function todayPage(db,actor){
 const day=today(),mine=db.shifts.filter(s=>!s.deadline&&s.user===actor.id).sort(sortDate);
 const hero='<section class="hero"><div class="jungle"></div><div class="herocontent"><p>'+h(dateLabel(day))+'</p><h1>Hoi, '
  +h(actor.name.split(' ')[0])+'!</h1></div></section>';
 return hero+myShift(db,mine,day)+todoCards(db,actor,mine,day)+restCards(db,actor,mine,day);
}
