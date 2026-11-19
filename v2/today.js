import {today,leads,ownTodo,toReview,offersFor,teamMissing,busy,ended,extraToDecide} from './model.js';
import {card,line,name,clock,dateLabel,button,sortDate,requestName,requestChip,requestLength,chip,h} from './view.js';
import {reviewRow,missingRow} from './hours.js';
// Eigen dienst: status als label; knop om in te vullen, aan te passen of te bekijken.
export function ownRow(db,s){
 const e=db.hours[s.id],todo=!e||e.status==='returned';
 const label=!e?'Uren invullen':e.status==='returned'?'Aanpassen':'Bekijken';
 const status=e?.status||(ended(s)?'missing':busy(s)?'busy':'');
 return line(dateLabel(s.date)+' · '+s.area,clock(s)+(e?.reason?' · '+e.reason:''),button(label,'entry',s.id,todo),
  status?chip(status):'');
}
// Aanvraag om te beoordelen: wie, wanneer, hoe lang en hoe ver van tevoren.
export function requestRow(db,r){
 const ahead=Math.round((Date.parse(r.date)-Date.parse(r.created))/86400000);
 const late=r.kind==='leave'&&ahead<21?' · Te laat aangevraagd':'';
 const what=requestName(r)+(requestLength(r)?' · '+requestLength(r):'');
 return line(name(db,r.user),what+' · '+ahead+' dagen van tevoren aangevraagd'+late,
  button('Beoordelen','decision',r.id));
}
// Extra beschikbaarheid op een gepubliceerde dag: de bedrijfsleider kiest inplannen of niet.
export const extraRow=(db,e)=>line(name(db,e.user)+' · '+dateLabel(e.date),clock(e),
 button('Wat wil je hiermee doen?','extraDecision',e.user+'|'+e.date,true));
// Voorstel voor het rooster dat iemand moet beantwoorden.
export const offerRow=(db,o)=>line(dateLabel(o.row.date)+' · '+name(db,o.row.user),
 o.fallback?'Ingepland '+clock(o.fallback)+' · Gevraagd '+clock(o.row):clock(o.row),
 button('Voorstel bekijken','proposal',o.id));
// Eigen aanvraag op Vandaag: wacht nog op akkoord, of het besluit tot je op Gezien tikt.
function ownRequestRow(r){
 if(r.status==='pending')return line(requestName(r),'','',requestChip(r));
 const text=(r.status==='approved'?'Je aanvraag is goedgekeurd':'Je aanvraag is afgewezen')
  +(r.response?' · Reden: '+r.response:'');
 return line(requestName(r),text,button('Gezien','seen',r.id),requestChip(r));
}
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
 const open=ownTodo(db,actor,day).filter(s=>s.date!==day); // vandaag staat al bovenaan
 let html=open.length?card('Nog in te vullen',open.map(s=>ownRow(db,s)).join('')):'';
 const offers=offersFor(db,actor);
 if(offers.length)html+=card('Roosterwijzigingen beoordelen',offers.map(o=>offerRow(db,o)).join(''));
 const standby=db.shifts.filter(s=>s.deadline&&(admin?s.date<=day:s.user===actor.id&&s.date>=day));
 const standbyRow=s=>line(admin?name(db,s.user)+' wacht op bericht':dateLabel(s.date),
  'Bericht vóór '+s.deadline+(admin?'':' · Dan hoor je of je werkt.'),
  admin?button('Stand-by afhandelen','standby',s.id):'');
 if(standby.length)html+=card('Stand-by',standby.map(standbyRow).join(''));
 if(actor.role!=='employee'){
  html+=absentCard(db,actor);
  const queue=toReview(db,actor);
  if(queue.length)html+=card('Uren goedkeuren ('+queue.length+')',queue.slice(0,3).map(s=>reviewRow(db,s)).join('')
   +button('Alle uren bekijken','page','reviews'));
 }
 const requests=admin?db.requests.filter(r=>r.status==='pending'):[];
 if(requests.length)html+=card('Aanvragen beoordelen',requests.slice(0,3).map(r=>requestRow(db,r)).join('')
  +button('Alle aanvragen bekijken','page','requests'));
 const extras=admin?extraToDecide(db):[];
 if(extras.length)html+=card('Extra beschikbaarheid doorgegeven',extras.map(e=>extraRow(db,e)).join(''));
 const pending=mine.filter(s=>db.hours[s.id]?.status==='pending');
 const pendingRow=s=>line(dateLabel(s.date),clock(db.hours[s.id]));
 if(pending.length)html+=card('Wacht op beoordeling',pending.map(pendingRow).join(''));
 const own=db.requests.filter(r=>r.user===actor.id&&(r.status==='pending'?(r.through||r.date)>=day:!r.seen));
 if(own.length)html+=card('Mijn aanvragen',own.map(ownRequestRow).join(''));
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
 const note=n=>line(dateLabel(n.date),n.text,button('Gezien','seen',n.id));
 if(notes.length)html+=card('Roosterwijzigingen',notes.map(note).join(''));
 return html;
}
export function todayPage(db,actor){
 const day=today(),mine=db.shifts.filter(s=>!s.deadline&&s.user===actor.id).sort(sortDate);
 const hero='<section class="hero"><div class="jungle"></div><div class="herocontent"><p>'+h(dateLabel(day))
  +'</p><h1>Hoi, '+h(actor.name.split(' ')[0])+'!</h1></div></section>';
 return hero+myShift(db,mine,day)+todoCards(db,actor,mine,day)+restCards(db,actor,mine,day);
}
