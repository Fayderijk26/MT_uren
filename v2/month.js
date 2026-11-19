import {monthSummary,normMinutes,net,closed,mayCloseMonth} from './model.js';
import {button,card,line,field,name,dateLabel,duration,moment,h} from './view.js';
import {tabs} from './hours.js';

const openLabels={missing:'Ontbreekt',pending:'Wacht op beoordeling',returned:'Aanpassen gevraagd'};

function personRow(db,month,r){
 const changed=db.normOverrides.some(n=>n.user===r.user&&n.month===month);
 const parts=['Goedgekeurd '+duration(r.approved),'Norm '+duration(r.norm)+(changed?' (aangepast)':''),
  'Verschil '+duration(r.diff)];
 if(r.open.length)parts.push('Nog open '+r.open.length);
 const action=closed(db,month+'-01')?'':button('Norm aanpassen','norm',r.user);
 return line(name(db,r.user),parts.join(' · '),action);
}

const next=month=>new Intl.DateTimeFormat('nl-NL',{day:'numeric',month:'long',timeZone:'UTC'})
 .format(new Date(Date.UTC(+month.slice(0,4),+month.slice(5,7),1)));
function statusCard(db,actor,month){
 const done=db.closedMonths.find(c=>c.month===month);
 if(done)return card('Afgesloten','<p>Afgesloten door '+h(name(db,done.by))+' · '+h(moment(done.at))+'.</p>'
  +'<p>Uren van deze maand kunnen niet meer worden ingevuld, aangepast of goedgekeurd.</p>'
  +button('Noodknop: maand heropenen','reopenMonth',month));
 const intro='<p>Na afsluiten liggen de uren van deze maand vast.</p>';
 const action=button('Maand afsluiten','closeMonth',month,true);
 if(mayCloseMonth(db,actor,month))return card('Maand afsluiten',intro+action);
 return card('Maand afsluiten','<p>Deze maand kan vanaf '+next(month)+' worden afgesloten.</p>');
}
// Inhoud van het venster bij afsluiten: eerst de open uren laten zien, dan bevestigen.
export function closeMonthBody(db,month){
 const open=monthSummary(db,month).flatMap(r=>r.open);
 if(!open.length)return '<p>Alle uren zijn goedgekeurd.</p>';
 const rows=open.map(o=>line(name(db,o.shift.user)+' · '+dateLabel(o.shift.date),openLabels[o.status])).join('');
 const text=open.length===1?'er staat nog 1 dienst open. Die komt'
  :'er staan nog '+open.length+' diensten open. Die komen';
 return '<p class="notice">Let op: '+text+' niet in de export.</p>'+rows
  +'<label class="field"><span><input type="checkbox" name="confirm" required> Toch afsluiten</span></label>';
}
export function monthPage(db,actor,view){
 const month=view.month,rows=monthSummary(db,month);
 const open=rows.flatMap(r=>r.open);
 let html=tabs(actor)+card('Maandoverzicht',field('Maand','month','month',month,'data-view="month"')
  +rows.map(r=>personRow(db,month,r)).join(''));
 const openRows=open.map(o=>line(name(db,o.shift.user)+' · '+dateLabel(o.shift.date),openLabels[o.status]));
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
