import {check,add,today,minutes} from './model.js';
export const netMinutes=e=>e?minutes(e.end)-minutes(e.start)-Number(e.pause||0):0;
export const monthEnd=m=>add(m+'-01',new Date(Number(m.slice(0,4)),Number(m.slice(5,7)),0).getDate()-1);
export function contractNorm(person,month){
 let hours=0;
 for(let d=month+'-01';d<=monthEnd(month);d=add(d,1)){
  const c=(person.contracts||[]).filter(c=>c.from<=d).sort((a,b)=>b.from.localeCompare(a.from))[0];
  hours+=(c?.weeklyHours||0)/7;
 }
 return Math.round(hours*60);
}
export function monthRows(db,month){
 return db.people.filter(p=>p.active!==false||db.shifts.some(s=>s.user===p.id&&s.date.startsWith(month))).map(p=>{
  const shifts=db.shifts.filter(s=>s.user===p.id&&!s.deadline&&s.date.startsWith(month));
  const approved=shifts.reduce((n,s)=>n+(db.hours[s.id]?.status==='approved'?netMinutes(db.hours[s.id]):0),0);
  const pending=shifts.reduce((n,s)=>n+(db.hours[s.id]?.status==='pending'?netMinutes(db.hours[s.id]):0),0);
  const missing=shifts.filter(s=>s.date<today()&&(!db.hours[s.id]||db.hours[s.id].status==='returned')).length;
  const norm=contractNorm(p,month);return {id:p.id,name:p.name,approved,pending,missing,norm,difference:approved-norm};
 });
}
function requireAdmin(actor){check(actor.role==='admin','Alleen de bedrijfsleider mag dit aanpassen.');}
export function savePerson({db,actor,p}){
 requireAdmin(actor);check(p.name?.trim(),'Vul een naam in.');
 check(['employee','lead','admin'].includes(p.role),'Kies een geldige rol.');
 check(!p.email||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email),'Controleer het e-mailadres.');
 const phone=(p.phone||'').replace(/[\s()-]/g,'');check(!phone||/^\+?[0-9]{8,15}$/.test(phone),'Controleer het telefoonnummer, liefst met landcode.');
 const old=db.people.find(x=>x.id===p.id),active=p.active!=='no';
 check(!old||old.id!==actor.id||(active&&p.role==='admin'),'Je kunt je eigen beheerrechten niet verwijderen.');
 if(old?.role==='admin'&&(!active||p.role!=='admin'))check(db.people.some(x=>x.id!==old.id&&x.role==='admin'&&x.active!==false),'Er moet een actieve bedrijfsleider blijven.');
 const weeklyHours=Number(p.weeklyHours||0);check(Number.isFinite(weeklyHours)&&weeklyHours>=0&&weeklyHours<=80,'Contracturen moeten tussen 0 en 80 liggen.');
 check(/^\d{4}-\d{2}-\d{2}$/.test(p.from||''),'Kies de ingangsdatum van de contracturen.');
 check(!db.months?.[p.from.slice(0,7)]?.closed,'Heropen eerst de afgesloten maand om de contractnorm te wijzigen.');
 const person=old||{id:crypto.randomUUID(),contracts:[]};
 const contracts=person.contracts||[];
 const prev=contracts.filter(c=>c.from<=p.from).sort((a,b)=>b.from.localeCompare(a.from))[0];
 if(!prev||prev.weeklyHours!==weeklyHours){
  check(!Object.entries(db.months||{}).some(([m,v])=>v.closed&&monthEnd(m)>=p.from),'Deze contractwijziging raakt een afgesloten maand. Kies een latere ingangsdatum.');
  person.contracts=contracts.filter(c=>c.from!==p.from).concat({from:p.from,weeklyHours});
 }
 Object.assign(person,{name:p.name.trim(),role:p.role,active,phone,email:(p.email||'').trim()});
 if(!old)db.people.push(person);
}
export function saveSettings({db,actor,p}){
 requireAdmin(actor);const days={};
 for(let day=1;day<=7;day++){
  const start=p['start'+day],end=p['end'+day],closed=!!p['closed'+day];
  check(closed||(/^([01]\d|2[0-3]):(00|15|30|45)$/.test(start)&&/^([01]\d|2[0-3]):(00|15|30|45)$/.test(end)&&start<end),'Controleer de openingstijden van dag '+day+'.');
  days[day]={start,end,closed};
 }
 db.settings={...db.settings,opening:days};
}
export function closeMonth({db,actor,p}){
 requireAdmin(actor);check(/^\d{4}-\d{2}$/.test(p.month||''),'Kies een maand.');
 check(monthEnd(p.month)<today(),'Je kunt een maand pas na de laatste dag afsluiten.');
 check(!db.months?.[p.month]?.closed,'Deze maand is al afgesloten.');
 const rows=monthRows(db,p.month);
 check(!rows.some(r=>r.pending||r.missing),'Er ontbreken uren of er wachten nog uren op beoordeling.');
 check(!db.drafts.some(s=>s.date.startsWith(p.month))&&!db.offers.some(o=>o.row.date.startsWith(p.month)),'Handel eerst de conceptdiensten en voorstellen in deze maand af.');
 db.months??={};db.months[p.month]={closed:true,by:actor.id,at:new Date().toISOString(),rows};
}
export function reopenMonth({db,actor,p}){
 requireAdmin(actor);check(db.months?.[p.month]?.closed&&p.reason?.trim(),'Geef een reden om deze maand te heropenen.');
 db.months[p.month]={...db.months[p.month],closed:false,reopenedBy:actor.id,reopenedAt:new Date().toISOString(),reason:p.reason};
}
export function reopenHours({db,actor,p,s}){
 requireAdmin(actor);check(s&&db.hours[s.id]?.status==='approved','Alleen goedgekeurde uren kunnen worden heropend.');check(p.reason?.trim(),'Geef een reden voor het heropenen.');
 Object.assign(db.hours[s.id],{status:'returned',reason:p.reason});
 db.updates.push({id:crypto.randomUUID(),user:s.user,date:s.date,text:actor.name+' vraagt je uren aan te passen: '+p.reason});
}
const csvCell=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';
export function exportMonth(db,actor,month){
 requireAdmin(actor);
 const rows=db.months?.[month]?.closed?db.months[month].rows:monthRows(db,month);
 const decimal=n=>(n/60).toFixed(2).replace('.',',');
 const summary=[['Maand','Medewerker','Goedgekeurde uren','Nog te beoordelen','Ontbrekende registraties','Contractnorm','Verschil','Status'],...rows.map(r=>[month,r.name,decimal(r.approved),decimal(r.pending),r.missing,decimal(r.norm),decimal(r.difference),db.months?.[month]?.closed?'Afgesloten':'Voorlopig'])];
 const detail=[['Datum','Medewerker','Start','Einde','Pauze minuten','Netto uren','Status','Goedgekeurd door','Goedgekeurd op','Reden'],...db.shifts.filter(s=>s.date.startsWith(month)&&!s.deadline).map(s=>{
  const e=db.hours[s.id];return [s.date,db.people.find(p=>p.id===s.user)?.name,e?.start,e?.end,e?.pause,e?decimal(netMinutes(e)):'',e?.status||'Ontbreekt',db.people.find(p=>p.id===e?.approvedBy)?.name||'',e?.approvedAt||'',e?.reason||''];
 })];
 const format=rows=>'\uFEFF'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n');return {summary:format(summary),detail:format(detail)};
}
