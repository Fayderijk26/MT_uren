import {monthSummary,normMinutes,net,closed,mayCloseMonth,mayRemind,mayReview,mayEnter,lastDay,saldo} from './model.js';
import {button,card,line,field,name,dateLabel,moment,h,chip,clock} from './view.js';
import {tabs,remindLink} from './hours.js';


// Korte duur voor in de tabel: 104u, 138u40, −95u.
const short=m=>(m<0?'−':'')+Math.floor(Math.abs(m)/60)+'u'+(Math.abs(m)%60?String(Math.abs(m)%60).padStart(2,'0'):'');
// Eén rij per medewerker. De norm is een knop waarmee de bedrijfsleider hem aanpast (niet in een afgesloten maand).
function personRow(db,month,r){
 const changed=db.normOverrides.some(n=>n.user===r.user&&n.month===month);
 const norm=closed(db,month+'-01')?h(short(r.norm)):button(short(r.norm),'norm',r.user);
 // Saldo (SPEC 9f): een knop waarmee de bedrijfsleider het bekijkt of op 0 zet. Geen saldo bij contract Uren.
 const own=saldo(db,r.user),balance=own===null?'–':button(short(own),'saldo',r.user);
 const cells=[h(name(db,r.user)),short(r.approved),norm+(changed?'<small>aangepast</small>':''),
  r.diff===null?'–':short(r.diff),balance,r.open.length||'–'];
 return '<tr class="person">'+cells.map(c=>'<td>'+c+'</td>').join('')+'</tr>';
}
function personTable(db,month,rows){
 const head=['Medewerker','Goedgekeurd','Norm','Verschil','Saldo','Open'].map(x=>'<th>'+x+'</th>').join('');
 return '<div class="monthscroll"><table class="monthgrid"><thead><tr>'+head+'</tr></thead><tbody>'
  +rows.map(r=>personRow(db,month,r)).join('')+'</tbody></table></div>';
}
// De juiste knop bij een open dienst: zelf invullen of aanpassen, beoordelen, of de medewerker herinneren.
function openAction(db,actor,{shift,status}){
 const own=shift.user===actor.id;
 if(status==='pending')return mayReview(db,actor,shift)?button('Beoordelen','inspect',shift.id,true):'';
 if(own)return button(status==='returned'?'Aanpassen':'Uren invullen','entry',shift.id,true);
 if(mayEnter(db,actor,shift))return button('Uren invullen','entry',shift.id,true);
 return mayRemind(db,actor,shift)?remindLink(db,[shift],status):'';
}
const openTitle=(db,o)=>name(db,o.shift.user)+' · '+dateLabel(o.shift.date);
function openRow(db,actor,o){
 const row=line(openTitle(db,o),clock(o.shift),openAction(db,actor,o),chip(o.status));
 return '<div class="compact">'+row+'</div>';
}

const longDate=day=>new Intl.DateTimeFormat('nl-NL',{day:'numeric',month:'long',timeZone:'UTC'})
 .format(new Date(day+'T12:00:00Z'));
function statusCard(db,actor,month){
 const done=db.closedMonths.find(c=>c.month===month);
 if(done)return card('Afgesloten','<p>Afgesloten door '+h(name(db,done.by))+' · '+h(moment(done.at))+'.</p>'
  +'<p>Uren van deze maand kunnen niet meer worden ingevuld, aangepast of goedgekeurd.</p>'
  +button('Noodknop: maand heropenen','reopenMonth',month));
 const intro='<p>Na afsluiten liggen de uren van deze maand vast.</p>';
 const action=button('Maand afsluiten','closeMonth',month,true);
 if(mayCloseMonth(db,actor,month))return card('Maand afsluiten',intro+action);
 return card('Maand afsluiten','<p>Deze maand kan vanaf '+longDate(lastDay(month))+' worden afgesloten.</p>');
}
// Inhoud van het venster bij afsluiten: eerst de open uren laten zien, dan bevestigen (SPEC 9e).
// Uren die wachten op beoordeling houden het afsluiten tegen; lege diensten tellen niet mee.
export function closeMonthBody(db,month){
 const open=monthSummary(db,month).flatMap(r=>r.open);
 if(!open.length)return '<p>Alle uren zijn goedgekeurd.</p>';
 const rows=open.map(o=>line(openTitle(db,o),clock(o.shift),'',chip(o.status))).join('');
 const waiting=open.some(o=>o.status==='pending')
  ?'<p class="notice">Er wachten nog uren op beoordeling. Keur die eerst goed; daarna kan de maand dicht.</p>':'';
 const text=open.length===1?'er staat nog 1 dienst open. Die telt niet mee en komt'
  :'er staan nog '+open.length+' diensten open. Die tellen niet mee en komen';
 return waiting+'<p class="notice">Let op: '+text+' niet in de export.</p>'+rows
  +'<label class="field"><span><input type="checkbox" name="confirm" required> Toch afsluiten</span></label>';
}
export function monthPage(db,actor,view){
 const month=view.month,rows=monthSummary(db,month);
 const open=rows.flatMap(r=>r.open);
 let html=tabs(db,actor,'month')+card('Maandoverzicht',field('Maand','month','month',month,'data-view="month"')
  +personTable(db,month,rows));
 const openRows=open.map(o=>openRow(db,actor,o));
 html+=card('Nog open ('+open.length+')',openRows.join('')||'<p>Alle uren van deze maand zijn goedgekeurd.</p>');
 html+=statusCard(db,actor,month);
 html+=card('Loonadministratie','<p>De export bevat alleen goedgekeurde uren.</p>'
  +button('Exporteren naar Excel','export',month,true));
 return html;
}

// Gegevens voor de Excel-export: alleen goedgekeurde uren.
export function exportData(db,month){
 const rows=db.shifts.filter(s=>s.date.startsWith(month+'-')&&db.hours[s.id]?.status==='approved')
  .sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start))
  .map(s=>{const e=db.hours[s.id];return {employeeId:s.user,name:name(db,s.user),date:s.date,start:e.start,end:e.end,
   breakMinutes:e.pause,netMinutes:net(e)}});
 const summary=monthSummary(db,month).map(r=>({employeeId:r.user,name:name(db,r.user),workedMinutes:r.approved,
  normMinutes:normMinutes(db,r.user,month),absenceMinutes:0,balanceMinutes:r.diff}));
 const metadata={revision:db.monthReopens.filter(r=>r.month===month).length,closed:closed(db,month+'-01')};
 return {rows,summary,metadata};
}
