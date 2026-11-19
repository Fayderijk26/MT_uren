import {monthSummary,normMinutes,net} from './model.js';
import {button,card,line,field,name,dateLabel,duration} from './view.js';
import {tabs} from './hours.js';

const openLabels={missing:'Ontbreekt',pending:'Wacht op beoordeling',returned:'Aanpassen gevraagd'};

function personRow(db,month,r){
 const changed=db.normOverrides.some(n=>n.user===r.user&&n.month===month);
 const parts=['Goedgekeurd '+duration(r.approved),'Norm '+duration(r.norm)+(changed?' (aangepast)':''),
  'Verschil '+duration(r.diff)];
 if(r.open.length)parts.push('Nog open '+r.open.length);
 return line(name(db,r.user),parts.join(' · '),button('Norm aanpassen','norm',r.user));
}

export function monthPage(db,actor,view){
 const month=view.month,rows=monthSummary(db,month);
 const open=rows.flatMap(r=>r.open);
 let html=tabs(actor)+card('Maandoverzicht',field('Maand','month','month',month,'data-view="month"')
  +rows.map(r=>personRow(db,month,r)).join(''));
 const openRows=open.map(o=>line(name(db,o.shift.user)+' · '+dateLabel(o.shift.date),openLabels[o.status]));
 html+=card('Nog open ('+open.length+')',openRows.join('')||'<p>Alle uren van deze maand zijn goedgekeurd.</p>');
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
 return {rows,summary};
}
