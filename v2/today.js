import {today,leads,ownTodo,toReview,offersFor,teamMissing,busy,ended,extraToDecide,sickList,sickToDecide,
 tracksHours,mustRead,monday} from './model.js';
import {card,line,name,clock,dateLabel,button,sortDate,requestName,requestChip,requestLength,chip,h,sickButton,
 leaveNames,sickStatus,sickDecision} from './view.js';
import {askText,reasonText,offerTitle} from './offers.js';
import {reviewRow,missingRow,missingByPerson} from './hours.js';
// Eigen dienst: status als label; knop om in te vullen, aan te passen of te bekijken, en Ziek melden.
export function ownRow(db,actor,s){
 if(!tracksHours(db,actor.id))return '<div class="compact">'+shiftLine(db,actor,s)+'</div>';
 if(s.sick)return '<div class="compact">'+line(dateLabel(s.date)+' · '+s.area,clock(s),sickButton(db,actor,s),
  chip('sick'))+'</div>';
 const e=db.hours[s.id],todo=!e||e.status==='returned';
 const label=!e?'Uren invullen':e.status==='returned'?'Aanpassen':'Bekijken';
 const status=e?.status||(ended(s)?'missing':busy(s)?'busy':'');
 return '<div class="compact">'+line(dateLabel(s.date)+' · '+s.area,clock(s)+(e?.reason?' · '+e.reason:''),
  button(label,'entry',s.id,todo)+sickButton(db,actor,s),status?chip(status):'')+'</div>';
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
// Een dienstvoorstel: bij de medewerker met de vraag erbij, bij de bedrijfsleider met de reden (ronde 15).
export function offerRow(db,o,admin=o.turn==='admin'){
 const times=o.fallback?'Ingepland '+clock(o.fallback)+' · Gevraagd '+clock(o.row):clock(o.row)+' · '+o.row.area;
 return line(offerTitle(db,o,admin),times+' · '+(admin?reasonText(db,o):askText(db,o)),
  button('Voorstel bekijken','proposal',o.id));
}
// Eigen aanvraag op Vandaag: wacht nog op akkoord, of het besluit tot je op Gezien tikt.
function ownRequestRow(r){
 if(r.status==='pending')return line(requestName(r),'','',requestChip(r));
 const text=(r.status==='approved'?'Je aanvraag is goedgekeurd':'Je aanvraag is afgewezen')
  +(r.askedType?' · Soort aangepast: je vroeg '+leaveNames[r.askedType]:'')+(r.response?' · Reden: '+r.response:'');
 return line(requestName(r),text,button('Gezien','seen',r.id),requestChip(r));
}
const shiftLine=(db,actor,s)=>line(dateLabel(s.date),clock(s)+' · '+s.area,sickButton(db,actor,s),
 s.sick?chip('sick'):'');
function absentCard(db,actor){
 const absent=teamMissing(db,actor);
 if(!absent.length)return '';
 const rows=missingByPerson(absent).slice(0,3).map(g=>missingRow(db,actor,g)).join('');
 return card('Uren ontbreken ('+absent.length+')',rows+button('Alle bekijken','page','reviews'));
}
// Ziek gemeld, vandaag en later: voor de bedrijfsleider en de dagleiding van die dag.
function sickCard(db,actor,day){
 const list=sickList(db,actor,day);
 const row=s=>line(name(db,s.user)+' · '+dateLabel(s.date),clock(s)+' · '+sickStatus(s)
  +' · gemeld door '+name(db,s.sick.by),sickButton(db,actor,s));
 return list.length?card('Ziek gemeld ('+list.length+')',list.map(row).join('')):'';
}
// Ziek: besluit nodig. Alleen de bedrijfsleider kiest per dienst Doorbetalen of Wachtdag (SPEC 9d).
function sickDecideCard(db,actor){
 const list=actor.role==='admin'?sickToDecide(db):[];
 const row=s=>'<div class="compact">'+line(name(db,s.user)+' · '+dateLabel(s.date),
  clock(s)+' · gemeld door '+name(db,s.sick.by),sickDecision(db,actor,s))+'</div>';
 return list.length?card('Ziek: besluit nodig ('+list.length+')',list.map(row).join('')):'';
}
// 1. Wanneer heb ik dienst: vandaag, of anders de eerstvolgende.
// Weekly van die week nog niet gelezen (ronde 14): de dienst wazig, met een knop naar de weekly.
function nextLine(db,actor,s){
 if(!mustRead(db,actor.id,s.date))return shiftLine(db,actor,s);
 return '<div class="blurbox"><div class="blurred" aria-hidden="true">'+shiftLine(db,actor,s)+'</div>'
  +button('Lees eerst de weekly','weeklyView',monday(s.date),true)+'</div>';
}
function myShift(db,actor,mine,day){
 const current=mine.filter(s=>s.date===day),next=mine.find(s=>s.date>day);
 if(current.length)return card('Mijn dienst vandaag',current.map(s=>ownRow(db,actor,s)).join(''));
 return next?card('Eerstvolgende dienst',nextLine(db,actor,next)):'';
}
// 2. Wat moet ik nog doen en welke aanvragen lopen er.
function todoCards(db,actor,mine,day){
 const admin=actor.role==='admin';
 const open=ownTodo(db,actor,day).filter(s=>s.date!==day); // vandaag staat al bovenaan
 let html=open.length?card('Nog in te vullen',open.map(s=>ownRow(db,actor,s)).join('')):'';
 const offers=offersFor(db,actor);
 if(offers.length)html+=card(admin?'Reactie op voorstel':'Vraag om te werken',offers.map(o=>offerRow(db,o)).join(''));
 const standby=db.shifts.filter(s=>s.deadline&&(admin?s.date<=day:s.user===actor.id&&s.date>=day));
 const standbyRow=s=>line(admin?name(db,s.user)+' wacht op bericht':dateLabel(s.date),
  'Bericht vóór '+s.deadline+(admin?'':' · Dan hoor je of je werkt.'),
  admin?button('Stand-by afhandelen','standby',s.id):'');
 if(standby.length)html+=card('Stand-by',standby.map(standbyRow).join(''));
 if(actor.role!=='employee'){
  html+=absentCard(db,actor)+sickDecideCard(db,actor)+sickCard(db,actor,day);
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
 const who=s=>line(name(db,s.user),clock(s)+' · '+s.area+(s.sick?' · Ziek gemeld':''));
 let html=onDuty?card('Wie werkt er vandaag?',team.map(who).join('')
  ||'Er staan vandaag geen diensten gepland.'):'';
 const next=mine.find(s=>s.date>day);
 if(mine.some(s=>s.date===day)&&next)html+=card('Eerstvolgende dienst',nextLine(db,actor,next));
 const notes=db.updates.filter(n=>n.user===actor.id);
 const note=n=>line(dateLabel(n.date),n.text,button('Gezien','seen',n.id));
 if(notes.length)html+=card('Roosterwijzigingen',notes.map(note).join(''));
 return html;
}
export function todayPage(db,actor){
 const day=today(),mine=db.shifts.filter(s=>!s.deadline&&s.user===actor.id).sort(sortDate);
 const hero='<section class="hero"><div class="jungle"></div><div class="herocontent"><p>'+h(dateLabel(day))
  +'</p><h1>Hoi, '+h(actor.name.split(' ')[0])+'!</h1></div></section>';
 return hero+myShift(db,actor,mine,day)+todoCards(db,actor,mine,day)+restCards(db,actor,mine,day);
}
