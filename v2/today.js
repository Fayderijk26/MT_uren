import {today,leads,closed} from './model.js';
import {card,line,name,clock,dateLabel,button,labels,sortDate,requestName,requestStatus,h} from './view.js';
import {reviews,reviewRow,teamMissing,missingRow} from './hours.js';
export function ownRow(db,s){const e=db.hours[s.id];return line(dateLabel(s.date)+' · '+s.area,clock(s)+(e?.reason?' · '+e.reason:''),button(e?.status==='returned'?'Aanpassen':labels[e?.status]||'Uren invullen','entry',s.id,!e||e.status==='returned'))}
export function requestRow(db,r){return line(name(db,r.user),requestName(r)+' · '+Math.round((Date.parse(r.date)-Date.parse(r.created))/86400000)+' dagen van tevoren aangevraagd'+(r.kind==='leave'&&Date.parse(r.date)-Date.parse(r.created)<21*86400000?' · Te laat aangevraagd':''),button('Beoordelen','decision',r.id))}
function todo(db,mine,day){
 const open=mine.filter(s=>s.date<day&&!closed(db,s.date)&&(!db.hours[s.id]||db.hours[s.id].status==='returned'));
 return open.length?card('Nog in te vullen',open.map(s=>ownRow(db,s)).join('')):'';
}
function absentCard(db,actor){
 const absent=teamMissing(db,actor);
 if(!absent.length)return '';
 const rows=absent.slice(0,3).map(m=>missingRow(db,actor,m)).join('');
 return card('Uren ontbreken ('+absent.length+')',rows+button('Alle bekijken','page','reviews'));
}
export function todayPage(db,actor){
 const day=today(),mine=db.shifts.filter(s=>!s.deadline&&s.user===actor.id).sort(sortDate),team=db.shifts.filter(s=>!s.deadline&&s.date===day).sort(sortDate);
 const onDuty=actor.role==='admin'||actor.role==='lead'&&leads(db,day).includes(actor.id);
 let html='<section class="hero"><div class="jungle"></div><div class="herocontent"><p>'+h(dateLabel(day))+'</p><h1>Hoi, '+h(actor.name.split(' ')[0])+'!</h1></div></section>';
 if(onDuty)html+=card('Wie werkt er vandaag?',team.map(s=>line(name(db,s.user),clock(s)+' · '+s.area,s.user===actor.id?button(db.hours[s.id]?'Mijn uren bekijken':'Mijn uren invullen','entry',s.id):'')).join('')||'Er staan vandaag geen diensten gepland.');
 if(onDuty)html+=todo(db,mine,day);
 else{
  const current=mine.filter(s=>s.date===day),next=mine.find(s=>s.date>day);
  if(current.length)html+=card('Mijn dienst vandaag',current.map(s=>ownRow(db,s)).join(''));
  if(!current.length&&next)html+=card('Eerstvolgende dienst',line(dateLabel(next.date),clock(next)+' · '+next.area));
  html+=todo(db,mine,day);
  const pending=mine.filter(s=>db.hours[s.id]?.status==='pending');
  if(pending.length)html+=card('Wacht op beoordeling',pending.map(s=>line(dateLabel(s.date),clock(db.hours[s.id]))).join(''));
  if(current.length&&next)html+=card('Eerstvolgende dienst',line(dateLabel(next.date),clock(next)+' · '+next.area));
 }
 const standby=db.shifts.filter(s=>s.deadline&&(actor.role==='admin'?s.date<=day:s.user===actor.id&&s.date>=day));
 if(standby.length)html+=card('Stand-by',standby.map(s=>line(actor.role==='admin'?name(db,s.user)+' wacht op bericht':dateLabel(s.date),'Bericht vóór '+s.deadline+(actor.role==='admin'?'':' · Dan hoor je of je werkt.'),actor.role==='admin'?button('Stand-by afhandelen','standby',s.id):'')).join(''));
 if(actor.role!=='employee')html+=absentCard(db,actor);
 if(actor.role!=='employee'){
  const queue=reviews(db,actor);
  html+=card('Uren goedkeuren',queue.slice(0,3).map(s=>reviewRow(db,s)).join('')+(queue.length?'':'<p>Geen uren te beoordelen op dit overzicht.</p>')+button('Alle uren bekijken','page','reviews'));
 }
 if(actor.role==='admin'){
  const requests=db.requests.filter(r=>r.status==='pending');if(requests.length)html+=card('Aanvragen beoordelen',requests.slice(0,3).map(r=>requestRow(db,r)).join('')+button('Alle aanvragen bekijken','page','requests'));
 }
 const own=db.requests.filter(r=>r.user===actor.id&&r.kind==='leave'&&r.through>=day);
 if(own.length)html+=card('Mijn vrijaanvragen',own.map(r=>line(requestName(r),requestStatus(r)+(r.response?' · '+r.response:''))).join(''));
 const offers=db.offers.filter(o=>o.turn==='employee'?o.row.user===actor.id:actor.role==='admin');
 if(offers.length)html+=card('Roosterwijzigingen beoordelen',offers.map(o=>line(dateLabel(o.row.date)+' · '+name(db,o.row.user),(o.fallback?'Ingepland '+clock(o.fallback)+' · Gevraagd '+clock(o.row):clock(o.row)),button('Voorstel bekijken','proposal',o.id))).join(''));
 const notes=db.updates.filter(n=>n.user===actor.id);
 if(notes.length)html+=card('Roosterwijzigingen',notes.map(n=>line(dateLabel(n.date),n.text,button('Gezien','seen',n.id))).join(''));
 return html;
}
