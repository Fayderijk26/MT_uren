// Vaste tijden. Bezoekers: open tot close. Werkdag medewerkers (ook "hele dag" en een nieuwe dienst): start tot end.
export const TIMES = {open:'09:00',close:'17:30',start:'08:30',end:'18:00'};
export const dayOf = when => new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Amsterdam'}).format(new Date(when));
export const today = () => dayOf(Date.now());
export const now = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Amsterdam',hour:'2-digit',minute:'2-digit'})
 .format(new Date());
export function add(day,n){
 const d=new Date(day+'T12:00Z');d.setUTCDate(d.getUTCDate()+n);
 return d.toISOString().slice(0,10);
}
export const weekday = day => new Date(day+'T12:00Z').getUTCDay()||7;
export const monday = day => add(day,1-weekday(day));
export const intersects = (a,b) => a.start<b.end && b.start<a.end;
export const minutes = time => Number(time.slice(0,2))*60+Number(time.slice(3));
export function check(ok,message){if(!ok)throw Error(message)}
export function interval(row){
  const time=/^([01]\d|2[0-3]):[0-5]\d$/;
  check(time.test(row.start)&&time.test(row.end)&&row.start<row.end,'Controleer de begin- en eindtijd.');
}
export function ruleFor(db,s){
  const exact=db.extra.find(r=>r.user===s.user&&r.date===s.date);
  const weekly=db.rules.filter(r=>r.user===s.user&&r.weekday===weekday(s.date)&&r.date<=s.date)
   .sort((a,b)=>b.date.localeCompare(a.date))[0];
  if(exact)return exact;
  if(weekly?.fortnightly){
   const weeks=(Date.parse(monday(s.date))-Date.parse(monday(weekly.date)))/604800000;
   if(weeks%2!==0)return undefined;
  }
  return weekly;
}
export function available(db,s){
  const r=ruleFor(db,s);
  return !r||(!r.off&&r.start<=s.start&&r.end>=s.end);
}
export function remaining(s,r){
  if(!r.start)return [];
  if(!intersects(s,r))return [s];
  return [...(s.start<r.start?[{...s,end:r.start}]:[]),...(s.end>r.end?[{...s,start:r.end}]:[])];
}
export function affected(db,r){
 return db.shifts.filter(s=>s.user===r.user&&s.date>=r.date&&s.date<=r.through
  &&freeWindows(r,s.date).some(w=>intersects(s,w)));
}
const isLead=(db,user)=>db.people.some(p=>p.id===user&&p.role==='lead');
export const leads = (db,day) => db.shifts.filter(s=>!s.deadline&&!s.sick&&s.date===day&&isLead(db,s.user))
 .map(s=>s.user);
// Beoordelen: bedrijfsleider altijd; leiding op een dag dat zij dagleiding is, ook de eigen uren.
// Afgesloten maand: daarin kan niemand nog iets met uren.
export const closed = (db,date) => db.closedMonths.some(c=>c.month===date.slice(0,7));
const notClosed = (db,date) => check(!closed(db,date),'Deze maand is afgesloten.');
// De laatste dag van een maand ('2026-11' → '2026-11-30').
export const lastDay=month=>month+'-'+String(new Date(Date.UTC(+month.slice(0,4),+month.slice(5,7),0)).getUTCDate());
// Na de laatste dag van de maand (23:59) kunnen medewerkers niets meer aan die maand doen (SPEC 9e).
export const monthOver=(date,day=today())=>day>lastDay(date.slice(0,7));
const OVER='De maand is voorbij. Vraag de bedrijfsleider om je uren in te vullen.';
// Afsluiten: alleen de bedrijfsleider, vanaf de laatste dag van de maand.
export const mayCloseMonth = (db,actor,month,day=today()) =>
 actor.role==='admin'&&day>=lastDay(month)&&!db.closedMonths.some(c=>c.month===month);
export const mayReview = (db,actor,s) => !closed(db,s.date)
 &&(actor.role==='admin'||actor.role==='lead'&&leads(db,s.date).includes(actor.id));
// Heropenen van goedgekeurde uren: alleen de bedrijfsleider.
export const mayReopen = (db,actor,s) => actor.role==='admin'&&!closed(db,s.date)&&db.hours[s.id]?.status==='approved';
// Ontbrekende uren: een dienst vóór vandaag zonder ingevulde uren. Stand-by telt niet mee.
// Bedrijfsleider ziet iedereen, leiding de eigen uren en de dagen waarop zij dagleiding was, medewerker de eigen uren.
// Een dienst is voorbij na de eindtijd uit het rooster; daarvoor is hij (vanaf de begintijd) bezig.
export const ended=(s,day=today())=>s.date<day||s.date===day&&day===today()&&s.end<=now();
export const busy=s=>s.date===today()&&s.start<=now()&&!ended(s);
// Wie inactief is, staat niet meer in het rooster en krijgt geen herinneringen; oude uren blijven bewaard.
export const activePeople=db=>db.people.filter(p=>p.active!==false);
// Werkplekken: vloer en/of keuken per medewerker. Zonder keuze de eerste (vloer als iemand beide doet).
export const AREAS=['Vloer','Keuken'];
export const areasOf=(db,user)=>db.people.find(p=>p.id===user)?.areas||[];
function areaFor(db,user,area){
 const own=areasOf(db,user),pick=area||own[0];
 check(own.includes(pick),'Kies een werkplek waar deze medewerker kan werken.');
 return pick;
}
const isActive=(db,user)=>db.people.find(p=>p.id===user)?.active!==false;
// Uren bijhouden (SPEC ronde 10): standaard ja. Bij nee wel in het rooster en alle rechten van de rol,
// maar geen uren, geen herinneringen, geen ziek melden of vrij vragen en niet in het maandoverzicht.
export const tracksHours=(db,user)=>db.people.find(p=>p.id===user)?.tracksHours!==false;
const NO_HOURS='Voor jou worden geen uren bijgehouden.';
// Diensten, concepten en open vragen van iemand vanaf vandaag.
export const futureShifts=(db,user)=>db.shifts.concat(db.drafts,db.offers.map(o=>o.row))
 .filter(s=>s.user===user&&s.date>=today()).sort((a,b)=>a.date.localeCompare(b.date));
export function missing(db,actor,day=today()){
 const sees=s=>isActive(db,s.user)&&(actor.role==='admin'||!monthOver(s.date,day)
  &&(s.user===actor.id||actor.role==='lead'&&leads(db,s.date).includes(actor.id)));
 const late=s=>Math.round((Date.parse(day)-Date.parse(s.date))/86400000);
 return db.shifts.filter(s=>!s.deadline&&!s.sick&&ended(s,day)&&!db.hours[s.id]&&!closed(db,s.date)&&sees(s)
  &&tracksHours(db,s.user))
  .sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start)).map(s=>({shift:s,late:late(s)}));
}
const byDate=(a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start);
// Eigen uren die nog moeten: dienst voorbij, maand open, nog niet ingevuld of aanpassen gevraagd.
export const ownTodo = (db,actor,day=today()) => !tracksHours(db,actor.id)?[]:db.shifts
 .filter(s=>!s.deadline&&!s.sick&&s.user===actor.id&&ended(s,day)&&!closed(db,s.date)
 &&(actor.role==='admin'||!monthOver(s.date,day))&&(!db.hours[s.id]||db.hours[s.id].status==='returned')).sort(byDate);
// Uren die deze persoon nu kan beoordelen.
export const toReview = (db,actor) => db.shifts
 .filter(s=>mayReview(db,actor,s)&&db.hours[s.id]?.status==='pending').sort(byDate);
// Voorstellen waarop deze persoon moet reageren.
export const offersFor = (db,actor) =>
 db.offers.filter(o=>o.turn==='employee'?o.row.user===actor.id:actor.role==='admin');
// Bolletjes in de tabbalk: hoeveel er bij Uren en Aanvragen nog te doen is.
// Ontbrekende uren van anderen die deze leidinggevende ziet.
export const teamMissing=(db,actor,day=today())=>missing(db,actor,day).filter(m=>m.shift.user!==actor.id);
export function badges(db,actor,day=today()){
 const mine=ownTodo(db,actor,day).length;
 const review=actor.role==='employee'?0:toReview(db,actor).length+teamMissing(db,actor,day).length;
 const requests=actor.role==='admin'?db.requests.filter(r=>r.status==='pending').length+extraToDecide(db).length:0;
 return {mine,review,hours:mine+review,requests:offersFor(db,actor).length+requests};
}
// Herinneren mag de bedrijfsleider of de dagleiding van die dag, nooit aan zichzelf.
// Na de maand heeft herinneren geen zin meer: de medewerker kan niets meer invullen.
export const mayRemind = (db,actor,s) => actor.id!==s.user&&!monthOver(s.date)
 &&(actor.role==='admin'||actor.role==='lead'&&leads(db,s.date).includes(actor.id));
// Uren invullen voor iemand anders: alleen de bedrijfsleider, na de maand of op de laatste dag zelf (SPEC 9e).
export function fillProblem(db,actor,s){
 if(actor.role!=='admin')return 'Alleen de bedrijfsleider kan uren voor iemand anders invullen.';
 if(!monthOver(s.date)&&today()!==lastDay(s.date.slice(0,7)))
  return 'Uren voor iemand anders invullen kan pas vanaf de laatste dag van de maand.';
 return '';
}
// Mag deze persoon de uren van deze dienst nu invullen? Voor de vensters; de controle zit in submitHours.
export const mayEnter=(db,actor,s)=>!!s&&!s.deadline&&!s.sick&&!closed(db,s.date)&&tracksHours(db,s.user)
 &&(!db.hours[s.id]||db.hours[s.id].status==='returned')
 &&(s.user===actor.id?s.date<=today()&&(actor.role==='admin'||!monthOver(s.date)):!fillProblem(db,actor,s));
export function freeWindows(request,date){
 if(date<request.date||date>request.through)return [];
 let windows=[{start:request.start||'00:00',end:request.end||'23:59'}];
 for(const exception of (request.exceptions||[]).filter(e=>e.date===date)){
  windows=windows.flatMap(w=>remaining(w,exception));
 }
 return windows;
}
function freeRequests(db,s){
 return db.requests.filter(r=>r.kind==='leave'&&r.status!=='rejected'&&r.user===s.user
  &&freeWindows(r,s.date).some(w=>intersects(w,s)));
}
function validate(db){
 for(const [i,s] of db.shifts.entries()){
  interval(s);
  check(!db.shifts.slice(i+1).some(t=>t.user===s.user&&t.date===s.date&&intersects(t,s)),
   'Deze dienst overlapt een andere dienst.');
 }
}
function announce(db,s,text){db.updates.push({id:crypto.randomUUID(),user:s.user,date:s.date,text})}
function submitUnplanned({db,actor,p}){
 check(tracksHours(db,actor.id),NO_HOURS);
 interval(p);check(p.date<=today()&&/^\d{4}-\d{2}-\d{2}$/.test(p.date),'Kies een gewerkte dag.');notClosed(db,p.date);
 check(actor.role==='admin'||!monthOver(p.date),OVER);
  const id=crypto.randomUUID();
  check(!db.shifts.some(t=>t.user===actor.id&&t.date===p.date&&intersects(t,p)),
   'Deze uren overlappen een andere dienst.');
  const area=areaFor(db,actor.id,p.area);
  db.shifts.push({id,date:p.date,user:actor.id,start:p.start,end:p.end,area,unplanned:true});
  submitHours({db,actor,p:{...p,id},s:db.shifts.at(-1)});
}

function rejectUnplanned({db,actor,p,s}){
 if(s)notClosed(db,s.date);
 check(s?.unplanned&&mayReview(db,actor,s)&&db.hours[s.id]?.status==='pending'&&p.reason?.trim(),
  'Controleer deze ongeplande dienst en geef een reden.');
  Object.assign(db.hours[s.id],{status:'rejected',reason:p.reason});
}

// Uren van vandaag mogen niet later eindigen dan nu, met 15 minuten speling.
function notLaterThanNow(date,end){
 check(date<today()||minutes(end)<=minutes(now())+15,'De eindtijd kan niet later zijn dan nu.');
}
// Waarschuwingen voor de leiding; ze houden niets tegen.
export function warnings(db,s){
 const e=db.hours[s.id];
 if(!e)return [];
 const net=minutes(e.end)-minutes(e.start)-e.pause,list=[];
 if(!s.unplanned&&e.end<s.end)list.push('Eindigt vóór het rooster (gepland tot '+s.end+')');
 if(e.pause===0&&net>330)list.push('Geen pauze bij een lange dag');
 return list;
}
export const net = e => minutes(e.end)-minutes(e.start)-e.pause;
// Maandnorm: contracturen per week × 52 ÷ 12, tenzij de bedrijfsleider hem voor die maand heeft overschreven.
export function normMinutes(db,user,month){
 const override=db.normOverrides.find(n=>n.user===user&&n.month===month);
 if(override)return override.minutes;
 const person=db.people.find(p=>p.id===user);
 return Math.round((person?.contractHours||0)*60*52/12);
}
// Norm tot nu toe: in de lopende maand de maandnorm naar rato van de kalenderdagen tot en met vandaag.
// Een voorbije maand: de hele norm; een maand die nog moet komen: 0.
export function normSoFar(db,user,month,day=today()){
 const full=normMinutes(db,user,month),end=lastDay(month);
 if(day>=end)return full;
 if(day<month+'-01')return 0;
 return Math.round(full*Number(day.slice(8))/Number(end.slice(8)));
}
// Pauzeregel (SPEC 9c), van begin tot eind: tot en met 3 uur geen pauze, daarboven 15 minuten, vanaf 6 uur 30.
export const pauseFor=gross=>gross>=360?30:gross>180?15:0;
// Minder dan 30 minuten pauze bij 6 uur of meer: een vraag, geen blokkade.
export function pauseQuestion(start,end,pause){
 if(!start||!end||pauseFor(minutes(end)-minutes(start))<30||Number(pause)>=30)return '';
 const had=Number(pause)?'maar '+Number(pause)+' min pauze':'geen pauze';
 return 'Let op: officieel heb je recht op 30 min pauze. Klopt het dat je '+had+' hebt gehad?';
}
// Ziek of verlof: de geplande tijd min de pauzeregel.
export function absentMinutes(s){
 const planned=minutes(s.end)-minutes(s.start);
 return planned-pauseFor(planned);
}
// Verlof (betaald) alleen bij een vast contract; onbetaald vrij en bijzonder verlof kan iedereen vragen.
// Overuren inzetten (SPEC 9g, nog te overleggen): vrij dat van het saldo plus- en minuren afgaat; alleen bij vast.
export const LEAVE_TYPES=['verlof','overuren','onbetaald','bijzonder'];
const PICK_TYPE='Kies verlof, overuren inzetten, onbetaald vrij of bijzonder verlof.';
const VAST_ONLY='Overuren inzetten kan alleen bij een vast contract. Kies onbetaald vrij.';
const WHOLE='Betaald verlof gaat in hele dagen. Kies voor een deel van de dag overuren inzetten of onbetaald vrij.';
// Een verlofdag telt altijd 8 uur in de uren van de maand (besluit eigenaar 24 november).
export const LEAVE_DAY_MINUTES=480;
// Bijzonder verlof (SPEC 9g): de soort uit een keuzelijst; bij Anders een reden. Gaat niet van de vakantiedagen af.
export const SPECIAL_TYPES=['zwangerschapsverlof','ouderschapsverlof','rouwverlof','kort verzuim','anders'];
function checkSpecial(p){
 check(SPECIAL_TYPES.includes(p.special),'Kies welk bijzonder verlof.');
 check(p.special!=='anders'||p.reason?.trim(),'Geef bij Anders een reden.');
}
// Vakantiedagen (SPEC 9g): een verlofdag is 1 dag. Een dag telt als die persoon er een vaste werkdag heeft
// (vaste beschikbaarheid, niet Niet beschikbaar), ook bij een deel van de dag.
const fixedDay=(db,user,date)=>{const r=ruleFor({...db,extra:[]},{user,date});return !!r&&!r.off};
const fixedDates=(db,r,from='',to='9999')=>{
 const out=[];
 for(let d=r.date>from?r.date:from;d<=r.through&&d<=to;d=add(d,1))if(fixedDay(db,r.user,d))out.push(d);
 return out;
};
export const leaveDays=(db,r,from)=>fixedDates(db,r,from).length;
// Vakantiedagen over: startsaldo + per nieuw kalenderjaar de dagen per jaar, min goedgekeurd verlof, plus correcties
// van de bedrijfsleider. Wat over is gaat mee naar het volgende jaar. null: niet ingesteld (bijvoorbeeld contract Uren).
export function vacationLeft(db,user,state='approved'){
 const p=db.people.find(x=>x.id===user);
 if(!p?.leaveYear||!mayPaidLeave(db,user))return null;
 const years=Number(today().slice(0,4))-Number(p.leaveYear);
 const taken=db.requests.filter(r=>r.kind==='leave'&&r.type==='verlof'&&r.user===user
  &&[].concat(state).includes(r.status)).reduce((sum,r)=>sum+leaveDays(db,r,p.leaveYear+'-01-01'),0);
 const fixes=db.leaveCorrections.filter(c=>c.user===user).reduce((sum,c)=>sum+c.days,0);
 return p.leaveStartBalance+p.vacationDays*years-taken+fixes;
}
const dayWord=n=>n===1?'1 vakantiedag':n+' vakantiedagen';
// Saldo vakantiedagen aanpassen (de bedrijfsleider, met reden): p.days is het nieuwe saldo. Wordt vastgelegd.
function setVacation({db,actor,admin,p}){
 check(admin,'Alleen de bedrijfsleider kan vakantiedagen aanpassen.');
 const now=vacationLeft(db,p.user),days=Number(p.days);
 check(now!==null,'Voor deze medewerker zijn geen vakantiedagen ingesteld.');
 check(String(p.days).trim()!==''&&Number.isFinite(days)&&days*2===Math.round(days*2),'Vul een aantal dagen in.');
 check(p.reason?.trim(),'Geef een reden.');
 db.leaveCorrections.push({user:p.user,days:days-now,reason:p.reason.trim(),by:actor.id,at:new Date().toISOString()});
}
const PAID_ONLY='Betaald verlof kan alleen bij een vast contract. Kies onbetaald vrij.';
export const mayPaidLeave=(db,user)=>db.people.find(p=>p.id===user)?.contract==='vast';
// Vrij in een maand, per soort, met minutes: hoeveel het telt. Verlof en betaald bijzonder verlof: elke vaste
// werkdag 8 uur. Niet betaald bijzonder verlof: niets. Andere soorten: de vervallen (delen van) diensten.
export function leaveItems(db,user,month,type='verlof'){
 const asked=db.requests.filter(r=>r.kind==='leave'&&(r.type||'onbetaald')===type&&r.status==='approved'&&r.user===user);
 if(type==='bijzonder')return asked.filter(r=>r.paid).flatMap(r=>fixedDates(db,r,month+'-01',lastDay(month)))
  .map(date=>({date,minutes:LEAVE_DAY_MINUTES,day:true}));
 if(type==='verlof')return asked.flatMap(r=>fixedDates(db,r,month+'-01',lastDay(month)))
  .map(date=>({date,minutes:LEAVE_DAY_MINUTES,day:true}));
 return asked.flatMap(r=>r.dropped||[]).filter(d=>d.date.startsWith(month+'-'))
  .map(d=>({...d,minutes:absentMinutes(d)}));
}
// Per persoon: goedgekeurde minuten, ziek, verlof, wacht op beoordeling, open diensten
// (wacht, aanpassen of ontbreekt), norm en verschil.
export function monthSummary(db,month,day=today()){
 const worked=p=>db.shifts.some(s=>s.user===p.id&&s.date.startsWith(month+'-'));
 return db.people.filter(p=>(p.active!==false||worked(p))&&tracksHours(db,p.id)).map(person=>{
  const shifts=db.shifts.filter(s=>s.user===person.id&&!s.deadline&&s.date.startsWith(month+'-'))
   .sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start));
  const status=s=>db.hours[s.id]?.status||(ended(s,day)?'missing':'future');
  const approved=shifts.filter(s=>status(s)==='approved').reduce((sum,s)=>sum+net(db.hours[s.id]),0);
  const sick=shifts.filter(sickPaid).reduce((sum,s)=>sum+absentMinutes(s),0);
  const sickWaiting=shifts.filter(sickOpen).reduce((sum,s)=>sum+absentMinutes(s),0);
  const sickUnpaid=shifts.filter(s=>s.sick?.paid===false).reduce((sum,s)=>sum+absentMinutes(s),0);
  const count=type=>leaveItems(db,person.id,month,type).reduce((sum,d)=>sum+d.minutes,0);
  const leave=count('verlof'),unpaid=count('onbetaald'),overtime=count('overuren'),special=count('bijzonder');
  // Dagen gewerkt (SPEC 9h): losse dagen met goedgekeurde uren, ook als het maar een paar uur was.
  const days=new Set(shifts.filter(s=>status(s)==='approved'&&net(db.hours[s.id])>0).map(s=>s.date)).size;
  const pending=shifts.filter(s=>status(s)==='pending').reduce((sum,s)=>sum+net(db.hours[s.id]),0);
  const open=shifts.filter(s=>!s.sick&&['pending','returned','missing'].includes(status(s)))
   .map(s=>({shift:s,status:status(s)}));
  const norm=normMinutes(db,person.id,month);
  // Verschil (SPEC 9f): alleen bij een vast contract. Gewerkt + ziek (doorbetaald) + verlof, min de norm.
  const diff=person.contract==='vast'?approved+sick+leave+special-norm:null;
  return {user:person.id,approved,sick,sickWaiting,sickUnpaid,leave,special,unpaid,overtime,days,pending,open,norm,diff};
 });
}
// Lopend saldo plus- en minuren (SPEC 9f): de verschillen van de afgesloten maanden plus de correcties van de
// bedrijfsleider. Een maand telt mee zodra hij is afgesloten. Alleen bij een vast contract.
export function saldo(db,user){
 if(db.people.find(p=>p.id===user)?.contract!=='vast'||!tracksHours(db,user))return null;
 const months=db.closedMonths.map(c=>monthSummary(db,c.month).find(r=>r.user===user)?.diff||0);
 const fixes=db.saldoCorrections.filter(c=>c.user===user).map(c=>c.minutes);
 return months.concat(fixes).reduce((a,b)=>a+b,0);
}
// Saldo op 0 zetten als het is uitbetaald of verrekend: alleen de bedrijfsleider, met reden. Wordt vastgelegd.
function resetSaldo({db,actor,admin,p}){
 check(admin,'Alleen de bedrijfsleider kan het saldo aanpassen.');
 const now=saldo(db,p.user);
 check(now!==null,'Deze medewerker heeft geen saldo.');
 check(now!==0,'Het saldo is al 0.');
 check(p.reason?.trim(),'Geef een reden, bijvoorbeeld uitbetaald of verrekend.');
 db.saldoCorrections.push({user:p.user,minutes:-now,reason:p.reason.trim(),by:actor.id,at:new Date().toISOString()});
}
// Afsluiten (SPEC 9e): niet zolang er uren wachten op beoordeling. Op de laatste dag zelf moeten eerst de uren
// van iedereen die die dag ingepland staat zijn ingevuld. Lege diensten van eerder tellen niet mee (bevestigen).
function closeMonth({db,actor,p}){
 check(actor.role==='admin','Alleen de bedrijfsleider kan een maand afsluiten.');
 check(!db.closedMonths.some(c=>c.month===p.month),'Deze maand is al afgesloten.');
 check(mayCloseMonth(db,actor,p.month),'Een maand kan pas vanaf de laatste dag van de maand worden afgesloten.');
 const personName=id=>displayName(db,id);
 const rows=monthSummary(db,p.month),who=list=>[...new Set(list.map(o=>personName(o.shift.user)))].join(', ');
 const open=rows.flatMap(r=>r.open),waiting=open.filter(o=>o.status==='pending');
 check(!waiting.length,'Er wachten nog uren op beoordeling bij: '+who(waiting)
  +'. Keur ze eerst goed of laat ze goedkeuren.');
 const returned=open.filter(o=>o.status==='returned');
 check(!returned.length,'Bij deze uren is om aanpassing gevraagd: '+who(returned)+'. Vul ze eerst zelf in.');
 const sick=db.shifts.filter(s=>s.date.startsWith(p.month+'-')&&sickOpen(s)).map(shift=>({shift}));
 check(!sick.length,'Er zijn nog ziekmeldingen zonder besluit bij: '+who(sick)+'. Kies eerst Doorbetalen of Wachtdag.');
 const lastDayEmpty=today()===lastDay(p.month)?db.shifts.filter(s=>s.date===today()&&!s.deadline&&!s.sick
  &&!db.hours[s.id]&&tracksHours(db,s.user)).map(shift=>({shift})):[];
 check(!lastDayEmpty.length,'Vandaag staan nog mensen ingepland zonder uren: '+who(lastDayEmpty)
  +'. Vul hun uren eerst in.');
 check(!open.length||p.confirm===true,'Niet ingevuld bij: '+who(open)
  +'. Deze diensten tellen niet mee. Bevestig om af te sluiten.');
 db.closedMonths.push({month:p.month,by:actor.id,at:new Date().toISOString()});
}
// Noodknop: een afgesloten maand weer openen, met reden. Wordt vastgelegd in monthReopens.
function reopenMonth({db,actor,p}){
 check(actor.role==='admin','Alleen de bedrijfsleider kan een maand heropenen.');
 check(db.closedMonths.some(c=>c.month===p.month),'Deze maand is niet afgesloten.');
 check(p.reason?.trim(),'Geef een reden voor het heropenen van de maand.');
 db.closedMonths=db.closedMonths.filter(c=>c.month!==p.month);
 db.monthReopens.push({month:p.month,by:actor.id,at:new Date().toISOString(),reason:p.reason.trim()});
}
function setNorm({db,actor,p}){
 check(actor.role==='admin','Alleen de bedrijfsleider kan de norm aanpassen.');
 check(db.people.some(x=>x.id===p.user)&&/^\d{4}-(0[1-9]|1[0-2])$/.test(p.month),'Kies een medewerker en een maand.');
 notClosed(db,p.month);
 check(Number.isInteger(p.minutes)&&p.minutes>=0,'Vul een geldige norm in.');
 check(p.reason?.trim(),'Geef een reden voor de aangepaste norm.');
 db.normOverrides=db.normOverrides.filter(n=>!(n.user===p.user&&n.month===p.month));
 db.normOverrides.push({user:p.user,month:p.month,minutes:p.minutes,reason:p.reason.trim(),by:actor.id});
}
// Eigen uren: tot en met de laatste dag van de maand (bedrijfsleider tot het afsluiten). Voor iemand anders: alleen
// de bedrijfsleider, na de maand of op de laatste dag; die uren zijn meteen goedgekeurd (SPEC 9e).
function submitHours({db,actor,p,s}){
 const forOther=s&&s.user!==actor.id;
 check(tracksHours(db,forOther?s.user:actor.id),forOther?'Voor deze persoon worden geen uren bijgehouden.':NO_HOURS);
 check(s&&!s.deadline&&(forOther||s.date<=today()),'Kies een eigen gewerkte dienst.');
 notClosed(db,s.date);
 if(forOther){const problem=fillProblem(db,actor,s);check(!problem,problem)}
 else check(actor.role==='admin'||!monthOver(s.date),OVER);
 check(!s.sick,'Deze dienst is ziek gemeld. Trek de ziekmelding eerst in.');
  check(!db.hours[s.id]||db.hours[s.id].status==='returned','Deze uren zijn al ingediend.');
  interval(p);if(!forOther)notLaterThanNow(s.date,p.end);const pause=Number(p.pause);
  check(String(p.pause).trim()!==''&&Number.isInteger(pause)&&pause>=0&&pause<minutes(p.end)-minutes(p.start),
   'Vul de werkelijke pauze in.');
  check(!db.shifts.some(t=>t.id!==s.id&&t.user===s.user&&t.date===s.date&&intersects(p,db.hours[t.id]||t)),
   'Deze uren overlappen een andere dienst.');
  const {approvedBy,approvedAt,reopenedBy}=db.hours[s.id]||{};
  db.hours[s.id]={start:p.start,end:p.end,pause,status:'pending',approvedBy,approvedAt,reopenedBy};
  // Ingevuld door de bedrijfsleider voor iemand anders, of eigen uren van leiding of bedrijfsleider: meteen goedgekeurd.
  if(forOther||actor.role!=='employee')
   Object.assign(db.hours[s.id],{status:'approved',approvedBy:actor.id,approvedAt:new Date().toISOString()});
}

function reviewHours({db,actor,op,p,s}){
 if(s)notClosed(db,s.date);
 check(s&&mayReview(db,actor,s)&&db.hours[s.id]?.status==='pending','Deze uren kunnen hier niet worden beoordeeld.');
  if(op==='return')check(p.reason?.trim(),'Geef aan wat gecontroleerd moet worden.');
  Object.assign(db.hours[s.id],{status:op==='return'?'returned':'approved',reason:p.reason||''});
  if(op==='approve')Object.assign(db.hours[s.id],{approvedBy:actor.id,approvedAt:new Date().toISOString()});
}

// Precies volgens rooster: zelfde begin- en eindtijd en geen waarschuwing. De pauze telt niet mee.
export const asPlanned=(db,actor)=>toReview(db,actor).filter(s=>{
 const e=db.hours[s.id];
 return !s.unplanned&&e.start===s.start&&e.end===s.end&&!warnings(db,s).length;
});
// Alles goedkeuren: alleen uren die precies volgens rooster zijn; per dienst gelden dezelfde regels.
function approveAll({db,actor,p}){
 const ok=asPlanned(db,actor).map(s=>s.id);
 check(Array.isArray(p.ids)&&p.ids.length&&p.ids.every(id=>ok.includes(id)),
  'Deze uren zijn niet volgens rooster of al beoordeeld. Bekijk ze een voor een.');
 for(const id of p.ids)reviewHours({db,actor,op:'approve',p:{id},s:db.shifts.find(s=>s.id===id)});
}

function reopenHours({db,actor,p,s}){
 check(actor.role==='admin','Alleen de bedrijfsleider kan uren heropenen.');
 if(s)notClosed(db,s.date);
 check(s&&mayReopen(db,actor,s),'Alleen goedgekeurde uren kunnen worden heropend.');
 check(p.reason?.trim(),'Geef een reden voor het heropenen.');
 Object.assign(db.hours[s.id],{status:'returned',reason:p.reason.trim(),reopenedBy:actor.id});
}

function recordAvailability({db,actor,op,p}){
 check(p.date>=today(),'Kies vandaag of later.');
  const start=p.start||'',end=p.end||'';
  if(start||end)interval(p);
  if(op==='leave')check(tracksHours(db,actor.id),NO_HOURS+' Overleg vrije dagen met de bedrijfsleider.');
  if(op==='weekly')check(Number.isInteger(+p.weekday)&&+p.weekday>=1&&+p.weekday<=7,'Kies een weekdag.');
  if(op==='extra'){
   check(!db.shifts.some(s=>s.user===actor.id&&s.date===p.date),'Je bent op deze dag al ingepland.');
   db.extra=db.extra.filter(x=>x.user!==actor.id||x.date!==p.date);
   db.extra.push({user:actor.id,date:p.date,start:start||TIMES.start,end:end||TIMES.end});
  }else{
   const through=p.through||p.date;
   check(through>=p.date&&(!start||through===p.date||op==='weekly'),'Controleer de periode.');
   const type=op==='leave'?p.type||'onbetaald':undefined;
   if(op==='leave'){
    check(LEAVE_TYPES.includes(type),PICK_TYPE);
    check(type!=='verlof'||mayPaidLeave(db,actor.id),PAID_ONLY);
    check(type!=='overuren'||mayPaidLeave(db,actor.id),VAST_ONLY);
    check(type!=='verlof'||!start,WHOLE);
    if(type==='bijzonder')checkSpecial(p);
    const left=type==='verlof'?vacationLeft(db,actor.id,['approved','pending']):null;
    const want=leaveDays(db,{user:actor.id,date:p.date,through});
    check(left===null||want<=left,'Je hebt nog '+dayWord(left)+' over (na je open aanvragen). Je vraagt er '+want
     +'. Kies minder dagen, overuren inzetten of onbetaald vrij.');
   }
   const overlaps=r=>r.user===actor.id&&r.kind==='leave'&&r.status!=='rejected'&&r.date<=through&&r.through>=p.date
    &&(!start||!r.start||intersects(r,p));
   if(op==='leave')check(!db.requests.some(overlaps),'Er is al een aanvraag voor deze periode.');
   db.requests.push({id:crypto.randomUUID(),kind:op,user:actor.id,date:p.date,through,start,end,
    weekday:Number(p.weekday),off:p.off===true,reason:p.reason||'',status:'pending',created:today()});
   if(type)db.requests.at(-1).type=type;
   if(type==='bijzonder')db.requests.at(-1).special=p.special;
  };
}

export function weeklyConflicts(db,r){
 const outside=s=>r.off||s.start<(r.start||TIMES.start)||s.end>(r.end||TIMES.end);
 return db.shifts.filter(s=>s.user===r.user&&s.date>=r.date&&weekday(s.date)===r.weekday&&outside(s));
}
function decideRequest({db,admin,p,r}){
 check(admin&&r?.status==='pending','Alleen de bedrijfsleider kan een open aanvraag beoordelen.');
  if(!p.accept)check(p.reason?.trim(),'Geef een reden voor afwijzing.');
  if(p.accept&&r.kind==='weekly'){
   const conflicts=weeklyConflicts(db,r);
   check(!conflicts.length||p.keep==='yes','Bekijk de bestaande diensten en bevestig dat ze blijven staan.');
   r.retained=conflicts.map(s=>({date:s.date,start:s.start,end:s.end}));
   const kept=conflicts.map(s=>s.date+' '+s.start+'–'+s.end).join(', ');
   if(conflicts.length)announce(db,{user:r.user,date:r.date},
    'Nieuwe beschikbaarheid goedgekeurd. Deze diensten blijven staan: '+kept);
   db.rules=db.rules.filter(x=>!(x.user===r.user&&x.weekday===r.weekday&&x.date===r.date));
   db.rules.push({...r,start:r.start||TIMES.start,end:r.end||TIMES.end});
  }else if(p.accept){
   // De bedrijfsleider kan de soort aanpassen (voorlopig, zie SPEC ronde 9b). De gevraagde soort blijft in askedType.
   if(r.kind==='leave'&&p.type&&p.type!==r.type){
    check(LEAVE_TYPES.includes(p.type),PICK_TYPE);
    if(p.type==='bijzonder')checkSpecial(p);
    r.askedType=r.type||'onbetaald';r.type=p.type;
    if(p.type==='bijzonder')r.special=p.special;
   }
   check(r.type!=='verlof'||mayPaidLeave(db,r.user),PAID_ONLY);
   check(r.type!=='overuren'||mayPaidLeave(db,r.user),VAST_ONLY);
   check(r.type!=='verlof'||!r.start,WHOLE);
   // Bijzonder verlof: de bedrijfsleider kiest of het betaald wordt (SPEC 9g, voorlopig).
   if(r.type==='bijzonder'){
    check(['ja','nee'].includes(p.paid),'Kies of dit bijzonder verlof betaald wordt.');
    r.paid=p.paid==='ja';
   }
   const left=r.type==='verlof'?vacationLeft(db,r.user):null,cost=r.kind==='leave'?leaveDays(db,r):0;
   check(left===null||cost<=left,displayName(db,r.user)+' heeft nog '+dayWord(left)+'; deze aanvraag is '+cost
    +'. Kies onbetaald vrij of pas het saldo vakantiedagen aan.');
   check(!closed(db,r.date)&&!closed(db,r.through),'Deze maand is afgesloten.');
   r.dropped=[];
   for(const old of affected(db,r)){
    check(!db.hours[old.id],'Bij deze dienst zijn al uren ingediend.');
    const choice=p.choices?.[old.id];
    check(choice&&choice.before===JSON.stringify(old),'Controleer de gevolgen voor elke dienst.');
    const parts=remaining(old,r);
    check(['none','all',...parts.map((_,i)=>String(i))].includes(choice.value),'Kies wat er met de dienst gebeurt.');
    const keep=choice.value==='all'?parts:parts.filter((_,i)=>String(i)===choice.value);
    // Wat er van de dienst binnen de vrije tijd viel: dat telt bij verlof (zie monthSummary).
    for(const w of freeWindows(r,old.date)){
     const start=old.start>w.start?old.start:w.start,end=old.end<w.end?old.end:w.end;
     if(start<end)r.dropped.push({date:old.date,start,end});
    }
    db.shifts=db.shifts.filter(x=>x.id!==old.id);
    keep.forEach((part,i)=>db.shifts.push({...part,id:i?crypto.randomUUID():old.id}));
    announce(db,old,keep.length?'Nieuwe werktijden: '+keep.map(t=>t.start+'–'+t.end).join(' en ')
     :'Je dienst vervalt.');
   }
  }
  r.status=p.accept?'approved':'rejected';r.response=p.reason||'';
}

export function needsQuestion(db,row){
 return !ruleFor(db,row)||ruleFor(db,row).off||freeRequests(db,row).length>0;
}
export function published(db,date){
 return db.published?.includes(date)||db.shifts.some(s=>s.date===date&&!s.unplanned);
}
function resolveStandby({db,admin,s,p,op}){
 check(admin&&s?.deadline,'Deze stand-by is al afgehandeld.');
 if(op==='release'){
  db.shifts=db.shifts.filter(row=>row.id!==s.id);
  announce(db,s,'Je hoeft niet te werken.');
 }else{
  interval(p);
  check(p.start>=s.start&&p.end<=s.end,'Kies tijden binnen de afgesproken stand-bydienst.');
  delete s.deadline;
  Object.assign(s,{start:p.start,end:p.end});
  announce(db,s,'Je bent opgeroepen: '+s.start+'–'+s.end);
 }
}
function saveDraft({db,actor,admin,p,s}){
 check(admin&&db.people.some(x=>x.id===p.user)&&p.date>=today(),'Controleer de medewerker en datum.');interval(p);
  check(isActive(db,p.user),'Deze medewerker is inactief.');
  check(!s?.sick,'Deze dienst is ziek gemeld. Trek de ziekmelding eerst in.');
  const id=p.id||crypto.randomUUID(), prior=db.drafts.find(d=>d.id===id);
  check(!s||(!db.hours[id]&&s.date===p.date&&s.user===p.user),'Deze dienst kan niet worden gewijzigd.');
  const other=db.shifts.filter(t=>!db.drafts.some(d=>d.id===t.id)).concat(db.drafts);
  check(!other.some(t=>t.id!==id&&t.user===p.user&&t.date===p.date&&intersects(t,p)),
   'Deze dienst overlapt een andere dienst.');
  const row={id,user:p.user,date:p.date,start:p.start,end:p.end,area:areaFor(db,p.user,p.area)};
  if(p.deadline)row.deadline=p.deadline;
  const before=prior?prior.before:s?JSON.stringify(s):null;
  check(!db.offers.some(o=>o.row.user===row.user&&o.row.date===row.date&&intersects(o.row,row)),
   'Er staat al een vraag open voor deze tijden.');
  db.drafts=db.drafts.filter(x=>x.id!==id);
  // Al eerder geaccepteerd met precies deze tijden: niet opnieuw vragen.
  const agreed=prior?.accepted&&prior.start===row.start&&prior.end===row.end&&prior.user===row.user
   &&prior.deadline===row.deadline;
  if(!s&&needsQuestion(db,row)&&!agreed){
   db.offers.push({id:crypto.randomUUID(),row,before,turn:'employee',planning:true,requestedBy:actor.id});
  }else db.drafts.push({...row,before,accepted:!!prior?.accepted});
}

// Botst een (concept)dienst met de opgegeven beschikbaarheid? Lege tekst als alles klopt.
export function availabilityConflict(db,row){
 const free=freeRequests(db,row);
 if(free.some(r=>r.status==='approved'))return 'Vrij (goedgekeurd)';
 if(free.length)return 'Vrij gevraagd, nog beoordelen';
 const rule=ruleFor(db,row);
 if(!rule)return 'Beschikbaarheid onbekend';
 if(rule.off)return 'Niet beschikbaar';
 return available(db,row)?'':'Beschikbaar '+rule.start+'–'+rule.end;
}
// Nieuwe concepten toevoegen, behalve in het verleden of als die medewerker dan al een dienst,
// concept of open vraag heeft.
function addDrafts(db,admin,rows,empty){
 check(admin,'Alleen de bedrijfsleider maakt het rooster.');
 const taken=row=>db.shifts.concat(db.drafts,db.offers.map(o=>o.row))
  .some(t=>t.user===row.user&&t.date===row.date&&intersects(t,row));
 const fresh=rows.filter(row=>row.date>=today()&&!taken(row));
 check(fresh.length,empty);
 for(const row of fresh)db.drafts.push({...row,id:crypto.randomUUID(),before:null,accepted:false});
}
// Concept uit vaste beschikbaarheid: iedereen op zijn beschikbare dagen en tijden. Goedgekeurd vrij gaat eraf
// (deels vrij: de rest van de dag blijft). Vrij dat nog wacht blijft staan; het concept toont dan een waarschuwing.
// Concept uit vaste beschikbaarheid alleen voor een week die nog moet beginnen en waarvan nog niets gepubliceerd is.
// Daarna zijn het losse aanpassingen.
export function mayPlanWeek(db,day){
 const week=monday(day);
 return week>today()&&!db.published.some(d=>d>=week&&d<=add(week,6));
}
function planFromRules({db,admin,p}){
 check(mayPlanWeek(db,p.week),'Deze week is al begonnen of gepubliceerd. Pas diensten los aan.');
 const week=monday(p.week),rows=[];
 for(const person of activePeople(db))for(let i=0;i<7;i++){
  const date=add(week,i),rule=ruleFor(db,{user:person.id,date});
  if(!rule||rule.off)continue;
  const row={user:person.id,date,start:rule.start,end:rule.end,area:areaFor(db,person.id)};
  const free=freeRequests(db,row).filter(r=>r.status==='approved').flatMap(r=>freeWindows(r,date));
  rows.push(...free.reduce((parts,w)=>parts.flatMap(part=>remaining(part,w)),[row]));
 }
 addDrafts(db,admin,rows,'Er is niets om in te plannen: iedereen staat al ingepland, is vrij of de dagen zijn voorbij.'
 );
}

export function fallbackShift(db,row){
 const rule=ruleFor(db,row);
 if(!rule||rule.off||row.deadline||freeRequests(db,row).length)return null;
 const start=row.start>rule.start?row.start:rule.start,end=row.end<rule.end?row.end:rule.end;
 return start<end?{...row,start,end}:null;
}
// Publiceren gaat per week (ma–zo). Alleen een losse aanpassing (onlyId) in een gepubliceerde week gaat per dienst.
function publishDrafts({db,actor,admin,p:input}){
 check(admin,'Alleen voor de bedrijfsleider.');
 const from=input.onlyId?input.date:monday(input.date);
 const p={...input,date:from,through:input.onlyId?input.through:add(from,6)};
  const chosen=db.drafts.filter(d=>d.date>=p.date&&d.date<=p.through&&(!p.onlyId||d.id===p.onlyId));
  check(chosen.length||db.offers.some(o=>o.row.date>=p.date&&o.row.date<=p.through),'Geen diensten in deze periode.');
  db.published??=[];
  for(let d=p.date;d<=p.through;d=add(d,1))if(!db.published.includes(d))db.published.push(d);
  for(const {before,accepted,...row} of chosen){
   const old=db.shifts.find(s=>s.id===row.id);
   check((old?JSON.stringify(old):null)===before&&!db.hours[row.id],
    'De dienst is intussen gewijzigd. Controleer het concept.');
   const consent=!accepted&&(needsQuestion(db,row)||!available(db,row));
   check(consent||available(db,row)||p.confirm,'Bevestig het inplannen buiten de beschikbaarheid.');
   db.offers=db.offers.filter(o=>o.row.id!==row.id);
   if(consent){
    const fallback=old||fallbackShift(db,row);
    if(fallback&&!old){db.shifts.push(fallback);announce(db,fallback,'Ingepland: '+fallback.start+'–'+fallback.end);}
    db.offers.push({id:crypto.randomUUID(),row,before:fallback?JSON.stringify(fallback):null,turn:'employee',
     fallback:fallback?{...fallback}:null,requestedBy:actor.id,availability:ruleFor(db,row)});
   }
   else{
    db.shifts=db.shifts.filter(s=>s.id!==row.id);db.shifts.push(row);
    const extra=!old&&db.extra.some(e=>e.user===row.user&&e.date===row.date);
    announce(db,row,(extra?'Extra ingepland: ':'Ingepland: ')+row.start+'–'+row.end
     +(extra?', naar aanleiding van je opgegeven beschikbaarheid.':''));
   }
  }
  db.drafts=db.drafts.filter(d=>!chosen.some(c=>c.id===d.id));
}

// Extra beschikbaarheid op een dag waarvan het rooster al gepubliceerd is: de bedrijfsleider beslist.
// planned = er staat een dienst in die tijd; declined = niet ingepland; waiting = wacht op de bedrijfsleider.
export function extraState(db,e){
 if(db.shifts.some(s=>s.user===e.user&&s.date===e.date&&!s.deadline&&intersects(s,e)))return 'planned';
 if(e.declined)return 'declined';
 return e.date>=today()&&published(db,e.date)?'waiting':'';
}
export const extraToDecide=db=>db.extra.filter(e=>extraState(db,e)==='waiting');
function waitingExtra(db,admin,p){
 const e=db.extra.find(x=>x.user===p.user&&x.date===p.date);
 check(admin&&e,'Alleen de bedrijfsleider beslist over extra beschikbaarheid.');
 check(published(db,e.date),'Het rooster van deze dag is nog niet gepubliceerd. Plan de dienst in het rooster.');
 check(extraState(db,e)==='waiting','Deze extra beschikbaarheid is al afgehandeld.');
 return e;
}
// Inplannen: de hele opgegeven tijd of andere tijden daarbinnen; de dienst staat meteen in het rooster.
function planExtra({db,actor,admin,p}){
 const e=waitingExtra(db,admin,p),whole=p.whole==='whole';
 const start=whole?e.start:p.start,end=whole?e.end:p.end;
 check(start>=e.start&&end<=e.end,'Kies tijden binnen de opgegeven tijd ('+e.start+'–'+e.end+').');
 const id=crypto.randomUUID();
 saveDraft({db,actor,admin,p:{id,user:e.user,date:e.date,start,end,area:p.area}});
 publishDrafts({db,actor,admin,p:{date:e.date,through:e.date,onlyId:id}});
}
function declineExtra({db,admin,p}){
 const e=waitingExtra(db,admin,p);
 e.declined=true;
 announce(db,e,'Je bent niet extra ingepland. Bedankt voor het doorgeven.');
}

// Medewerker toevoegen of wijzigen (alleen de bedrijfsleider). Er blijft altijd minstens één bedrijfsleider.
// Naam in de app: bij twee mensen met dezelfde naam altijd naam en achternaam (besluit eigenaar 24 november).
export function displayName(db,id){
 const p=db.people.find(x=>x.id===id);
 if(!p)return '';
 const same=db.people.some(x=>x!==p&&x.name.toLowerCase()===p.name.toLowerCase());
 return same&&p.lastName?p.name+' '+p.lastName:p.name;
}
function savePerson({db,admin,p}){
 check(admin,'Alleen de bedrijfsleider beheert medewerkers.');
 const name=String(p.name||'').trim(),hours=Number(p.contractHours),phone=String(p.phone||'').trim();
 // Voor de export naar de loonadministratie (SPEC 9h). Niet verplicht.
 const pay=Object.fromEntries(['staffNumber','firstName','lastName','initials'].map(k=>[k,String(p[k]||'').trim()]));
 const old=p.id?db.people.find(x=>x.id===p.id):null;
 check(!p.id||old,'Deze medewerker bestaat niet.');
 check(name,'Vul een naam in.');
 // Dezelfde naam mag, als allebei een (verschillende) achternaam hebben; die toont de app dan erbij.
 const twin=db.people.find(x=>x!==old&&x.name.toLowerCase()===name.toLowerCase());
 const last=String(p.lastName||'').trim();
 check(!twin||last&&twin.lastName&&twin.lastName.toLowerCase()!==last.toLowerCase(),
  'Er bestaat al iemand met deze naam. Vul bij allebei een achternaam in; de app toont dan naam en achternaam.');
 check(['employee','lead','admin'].includes(p.role),'Kies een rol.');
 check(['vast','uren'].includes(p.contract),'Kies het soort contract: vast of uren.');
 check(String(p.contractHours).trim()!==''&&hours>=0&&hours<=40,'Vul contracturen in tussen 0 en 40.');
 check(/^[+0-9 ()-]{0,20}$/.test(phone),'Vul een geldig telefoonnummer in (alleen cijfers).');
 const areas=AREAS.filter(a=>[].concat(p.areas||[]).includes(a));
 check(areas.length,'Kies minstens één werkplek.');
 const admins=db.people.filter(x=>x.role==='admin'&&x.active!==false&&x!==old);
 check(p.role==='admin'||admins.length,'Er moet minstens één bedrijfsleider blijven.');
 // Vakantiedagen per jaar en startsaldo (SPEC 9g), alleen bij een vast contract. Het startsaldo geldt voor het jaar
 // waarin het voor het eerst is ingevuld.
 const vacation={};
 if(p.contract==='vast'&&String(p.vacationDays??'').trim()!==''){
  vacation.vacationDays=Number(p.vacationDays);
  vacation.leaveStartBalance=Number(String(p.leaveStartBalance??'').trim()||p.vacationDays);
  check([vacation.vacationDays,vacation.leaveStartBalance].every(n=>Number.isFinite(n)&&n>=0&&n<=100),
   'Vul de vakantiedagen in als een aantal dagen (0 of meer).');
  vacation.leaveYear=old?.leaveYear||today().slice(0,4);
 }
 const fields={name,role:p.role,contract:p.contract,contractHours:hours,phone,areas,tracksHours:p.tracksHours!==false,
  ...pay,...vacation};
 if(old)Object.assign(old,fields);else db.people.push({id:crypto.randomUUID(),...fields,active:true});
}

// Ziek melden per dienst (SPEC 9a en 9d): alleen de dagleiding van die dag en de bedrijfsleider, ook achteraf.
// Medewerkers melden zich niet zelf ziek; een leidinggevende kan zichzelf ziek melden voor een eigen dienst.
const mayReportFor=(db,actor,s)=>actor.role==='admin'||actor.role==='lead'&&leads(db,s.date).includes(actor.id);
export function sickProblem(db,actor,s){
 if(!s)return 'Deze dienst bestaat niet.';
 if(closed(db,s.date))return 'Deze maand is afgesloten.';
 if(!tracksHours(db,s.user))return 'Voor '+(s.user===actor.id?'jou':'deze persoon')+' worden geen uren bijgehouden.';
 if(s.sick)return 'Deze dienst is al ziek gemeld.';
 if(s.deadline)return 'Een stand-bydienst kun je niet ziek melden.';
 if(s.unplanned)return 'Een ongeplande dienst kun je niet ziek melden.';
 if(db.hours[s.id])return 'Voor deze dienst zijn al uren ingediend.';
 if(mayReportFor(db,actor,s))return '';
 return s.user===actor.id?'Ziek melden doet de leiding. Bel de leidinggevende van de dag.'
  :'Je kunt deze dienst niet ziek melden.';
}
export const maySick=(db,actor,s)=>!sickProblem(db,actor,s);
export const mayUndoSick=(db,actor,s)=>!!s?.sick&&!closed(db,s.date)&&(actor.role==='admin'||s.sick.by===actor.id);
function reportSick({db,actor,s}){
 const problem=sickProblem(db,actor,s);
 check(!problem,problem);
 s.sick={by:actor.id,at:new Date().toISOString()};
 if(s.user!==actor.id)announce(db,s,'Ziek gemeld door '+displayName(db,actor.id)+' · '+s.start+'–'+s.end);
}
// Meerdere dagen tegelijk ziek melden (bij Ontbreekt). Alles of niets: mag één dag niet, dan wordt niets gemeld.
function reportSickMany({db,actor,p}){
 const ids=[].concat(p.ids||[]);
 check(ids.length,'Kies minstens één dag.');
 for(const id of ids)reportSick({db,actor,s:db.shifts.find(s=>s.id===id)});
}
// Ontbrekende diensten van één persoon die deze leidinggevende ziek mag melden.
export const sickable=(db,actor,user)=>missing(db,actor).map(m=>m.shift)
 .filter(s=>s.user===user&&maySick(db,actor,s));
function undoSick({db,actor,s}){
 if(s)notClosed(db,s.date);
 check(s?.sick,'Deze dienst is niet ziek gemeld.');
 check(mayUndoSick(db,actor,s),'Alleen wie de ziekmelding deed of een bedrijfsleider kan hem intrekken.');
 delete s.sick;
 if(s.user!==actor.id)announce(db,s,'Ziekmelding ingetrokken door '+displayName(db,actor.id)+' · '+s.start+'–'+s.end);
}
// Per ziek gemelde dienst beslist de bedrijfsleider: doorbetalen of wachtdag (SPEC 9d). Tot dan telt hij niet mee.
export const sickPaid=s=>s.sick?.paid===true;
export const sickOpen=s=>!!s.sick&&s.sick.paid===undefined;
function decideSick({db,actor,admin,s,p}){
 check(admin,'Alleen de bedrijfsleider beslist over doorbetalen bij ziekte.');
 check(s?.sick,'Deze dienst is niet ziek gemeld.');
 notClosed(db,s.date);
 Object.assign(s.sick,{paid:p.paid===true||p.paid==='true',decidedBy:actor.id,decidedAt:new Date().toISOString()});
}
// Ziekmeldingen zonder besluit in een open maand: voor de bedrijfsleider.
export const sickToDecide=db=>db.shifts.filter(s=>sickOpen(s)&&!closed(db,s.date)).sort(byDate);
// Ziek gemelde diensten vanaf vandaag die deze persoon overziet: bedrijfsleider alles, dagleiding haar dagen.
export const sickList=(db,actor,day=today())=>db.shifts.filter(s=>s.sick&&s.date>=day&&s.user!==actor.id
 &&(actor.role==='admin'||actor.role==='lead'&&leads(db,s.date).includes(actor.id))).sort(byDate);

// Op inactief zetten kan pas als iemand geen diensten meer in de toekomst heeft; weer actief kan altijd.
function setActive({db,actor,admin,p}){
 check(admin,'Alleen de bedrijfsleider beheert medewerkers.');
 const person=db.people.find(x=>x.id===p.id);
 check(person,'Deze medewerker bestaat niet.');
 if(!p.active){
  check(person!==actor,'Je kunt jezelf niet op inactief zetten.');
  check(!futureShifts(db,person.id).length,
   'Deze medewerker heeft nog diensten in de toekomst. Haal die eerst weg of geef ze aan iemand anders.');
 }
 person.active=Boolean(p.active);
}

function answerOffer({db,actor,admin,p}){
 const o=db.offers.find(x=>x.id===p.id);
  check(o&&(o.turn==='employee'?o.row.user===actor.id:admin),'Dit voorstel wacht op iemand anders.');
  check(['counter','yes','no'].includes(p.answer),'Kies een antwoord.');
  if(p.answer==='counter'){
   check(o.turn==='employee','Alleen de medewerker kan andere tijden voorstellen.');
   interval(p);Object.assign(o.row,{start:p.start,end:p.end});o.turn='admin';return;
  }
  if(p.answer==='yes'){
   const old=db.shifts.find(s=>s.id===o.row.id);
   check((old?JSON.stringify(old):null)===o.before&&!db.hours[o.row.id],'De oorspronkelijke dienst is gewijzigd.');
   for(const request of freeRequests(db,o.row)){
    (request.exceptions??=[]).push({date:o.row.date,start:o.row.start,end:o.row.end});
   }
   const clash=d=>d.id!==o.row.id&&d.user===o.row.user&&d.date===o.row.date&&intersects(d,o.row);
   check(!db.drafts.some(clash),'De tijden overlappen een conceptdienst.');
   check(!db.shifts.some(clash),'De tijden overlappen een dienst.');
   if(o.planning&&!published(db,o.row.date))db.drafts.push({...o.row,before:null,accepted:true});
   else{db.shifts=db.shifts.filter(s=>s.id!==o.row.id);db.shifts.push(o.row);}
   announce(db,o.row,'Voorstel geaccepteerd: '+o.row.start+'–'+o.row.end);
  }
  // Antwoord van de bedrijfsleider gaat naar de medewerker; antwoord van de medewerker naar iedere bedrijfsleider.
  const to=o.turn==='admin'?[o.row.user]:activePeople(db).filter(x=>x.role==='admin').map(x=>x.id);
  const answer=displayName(db,o.row.user)+' · '
   +(p.answer==='yes'?'Voorstel geaccepteerd · '+o.row.start+'–'+o.row.end
   :o.fallback?'Voorstel afgewezen; dienst blijft '+o.fallback.start+'–'+o.fallback.end
   :'Voorstel afgewezen · '+o.row.start+'–'+o.row.end);
  for(const user of to)announce(db,{date:o.row.date,user},answer);
  db.offers=db.offers.filter(x=>x.id!==o.id);
}

// Gezien: een melding over het rooster, of het besluit over je eigen aanvraag.
function markSeen({db,actor,p}){
 const r=db.requests.find(x=>x.id===p.id);
 if(r){
  check(r.user===actor.id,'Je kunt alleen je eigen aanvraag als gezien markeren.');
  check(r.status!=='pending','Deze aanvraag heeft nog geen besluit.');
  r.seen=true;return;
 }
 db.updates=db.updates.filter(x=>x.id!==p.id||x.user!==actor.id);
}

const actions={
  release:resolveStandby,call:resolveStandby,
  unplanned: submitUnplanned,
  rejectHours: rejectUnplanned,
  hours: submitHours,
  approve: reviewHours,
  approveAll,
  planFromRules,
  savePerson,
  sick: reportSick,
  sickMany: reportSickMany,
  sickUndo: undoSick,
  sickDecide: decideSick,
  saldoReset: resetSaldo,
  leaveSet: setVacation,
  setActive,
  return: reviewHours,
  reopen: reopenHours,
  setNorm,
  closeMonth,
  reopenMonth,
  leave: recordAvailability,
  weekly: recordAvailability,
  extra: recordAvailability,
  decide: decideRequest,
  draft: saveDraft,
  publish: publishDrafts,
  offer: answerOffer,
  seen: markSeen,
  planExtra,
  declineExtra
};
export function apply(previous,actorId,op,p){
 const db=structuredClone(previous);
 const actor=db.people.find(person=>person.id===actorId);
 check(actor,'Onbekend profiel.');
 for(const field of ['start','end','deadline']){
  if(p[field])check(/^([01]\d|2[0-3]):(00|15|30|45)$/.test(p[field]),'Kies tijden per kwartier.');
 }
 check(Object.hasOwn(actions,op),'Onbekende actie.');
 actions[op]({db,actor,admin:actor.role==='admin',op,p,
  s:db.shifts.find(shift=>shift.id===p.id),
  r:db.requests.find(request=>request.id===p.id)
 });
 validate(db);
 return db;
}
