import {mayReview,minutes,today,monday} from './model.js';
import {monthRows,netMinutes} from './administration.js';
import {button,card,line,clock,name,dateLabel,field,sortDate,chip,duration,empty,h} from './view.js';
import {contactButtons} from './contacts.js';
export function reviews(db,actor){return db.shifts.filter(s=>mayReview(db,actor,s)&&db.hours[s.id]?.status==='pending').sort(sortDate)}
export function missingHours(db,actor){return db.shifts.filter(s=>!s.deadline&&s.date<today()&&(!db.hours[s.id]||db.hours[s.id].status==='returned')&&(s.user===actor.id||actor.role!=='employee')).sort(sortDate)}
export function missingRow(db,actor,s){
 const person=name(db,s.user),e=db.hours[s.id];
 return line(person+' · '+dateLabel(s.date),clock(s)+(e?.reason?' · '+e.reason:''),chip(e?.status)+(s.user===actor.id?button('Uren invullen','entry',s.id,true):contactButtons(db,actor,s.user,'Hoi '+person+', wil je je uren van '+dateLabel(s.date)+' nog invullen?')));
}
export function reviewRow(db,s){
 const e=db.hours[s.id],same=clock(s)===clock(e);
 return '<article class="vrow"><div><b>'+h(name(db,s.user)+' · '+dateLabel(s.date))+'</b><small>'+h(clock(e)+' · '+e.pause+' min pauze · '+duration(netMinutes(e)))+'</small>'+chip(same?'approved':'pending',same?'Volgens rooster':'Gepland '+clock(s))+(e.reason?'<p>'+h(e.reason)+'</p>':'')+'</div><div class="vactions">'+button('Goedkeuren','approve',s.id,true)+button('Bekijken','inspect',s.id)+'</div></article>';
}
export function hoursPage(db,actor,view){
 const staff=actor.role!=='employee',mode=view.hoursTab||(staff?'pending':'own');
 let tabs=staff?'<div class="weeknav" role="group" aria-label="Urenoverzicht">'+[['pending','Te beoordelen'],['missing','Ontbreekt'],['approved','Goedgekeurd'],...(actor.role==='admin'?[['month','Maand']]:[]),['own','Mijn uren']].map(([k,v])=>button(v,'hoursTab',k,mode===k)).join('')+'</div>':'';
 if(staff&&mode==='month')return tabs+monthPage(db,actor,view);
 if(staff&&mode!=='own'){
  const rows=mode==='missing'?missingHours(db,actor):db.shifts.filter(s=>!s.deadline&&mayReview(db,actor,s)&&db.hours[s.id]?.status===mode&&(mode!=='approved'||s.date.startsWith(view.month))).sort(sortDate);
  let body=mode==='approved'?field('Maand','month','month',view.month,'data-view="month"'):'';
  for(const person of db.people){const own=rows.filter(s=>s.user===person.id);if(!own.length)continue;
   body+='<h3>'+h(person.name)+'</h3>'+own.map(s=>mode==='pending'?reviewRow(db,s):mode==='missing'?missingRow(db,actor,s):line(dateLabel(s.date),clock(db.hours[s.id])+' · '+duration(netMinutes(db.hours[s.id])),chip('approved')+button('Bekijken','inspect',s.id))).join('');
  }
  return tabs+card({pending:'Te beoordelen',missing:'Uren ontbreken',approved:'Goedgekeurde uren'}[mode],body+(rows.length?'':empty(mode==='missing'?'Iedereen heeft de verstreken diensten ingevuld.':'Er staan hier geen uren.',button('Mijn uren bekijken','hoursTab','own'))));
 }
 const rows=db.shifts.filter(s=>!s.deadline&&s.user===actor.id&&s.date.startsWith(view.month)&&s.date<=today()).sort(sortDate).reverse();
 const total=status=>rows.reduce((sum,s)=>sum+(db.hours[s.id]?.status===status?netMinutes(db.hours[s.id]):0),0);
 let body=field('Maand','month','month',view.month,'data-view="month"')+'<div class="totals"><p><b>'+duration(total('approved'))+'</b> goedgekeurd</p><p><b>'+duration(total('pending'))+'</b> wacht op beoordeling</p></div>'+button('Ongeplande dienst invullen','unplanned');
 const weeks=[...new Set(rows.map(s=>monday(s.date)))];
 for(const week of weeks)body+='<h3>Week van '+h(dateLabel(week))+'</h3>'+rows.filter(s=>monday(s.date)===week).map(s=>line(dateLabel(s.date),clock(db.hours[s.id]||s)+(db.hours[s.id]?.reason?' · '+db.hours[s.id].reason:''),chip(db.hours[s.id]?.status)+button('Bekijken','entry',s.id))).join('');
 return tabs+card('Gewerkte uren',body+(rows.length?'':empty('Je hebt deze maand nog geen gewerkte diensten.',button('Mijn rooster bekijken','page',actor.role==='employee'?'mine':'team'))));
}
export function monthPage(db,actor,view){
 const month=view.month,closed=db.months?.[month]?.closed,rows=closed?db.months[month].rows:monthRows(db,month);
 return card('Maandoverzicht',field('Maand','month','month',month,'data-view="month"')+chip(closed?'approved':'pending',closed?'Maand afgesloten':'Voorlopig')+'<p>Contractnorm = contracturen per week ÷ 7 × kalenderdagen. Wijzigingen tellen vanaf hun ingangsdatum.</p><div class="table-scroll"><table class="month-table"><thead><tr><th>Medewerker</th><th>Goedgekeurd</th><th>Te beoordelen</th><th>Ontbreekt</th><th>Contractnorm</th><th>Verschil</th></tr></thead><tbody>'+rows.map(r=>'<tr><th>'+h(r.name)+'</th><td>'+duration(r.approved)+'</td><td>'+duration(r.pending)+'</td><td>'+r.missing+'</td><td>'+duration(r.norm)+'</td><td>'+duration(r.difference)+'</td></tr>').join('')+'</tbody></table></div><div class="vactions">'+button('Export totalen (CSV)','exportSummary',month)+button('Export uurregels (CSV)','exportDetail',month)+button(closed?'Maand heropenen':'Maand afsluiten',closed?'reopenMonth':'closeMonth',month,true)+'</div>'+(closed?'<p>Afgesloten door '+h(name(db,db.months[month].by))+' op '+h(new Date(db.months[month].at).toLocaleString('nl-NL'))+'</p>':''));
}
