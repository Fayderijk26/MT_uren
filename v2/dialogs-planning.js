import {today,add,available,affected,remaining,weeklyConflicts,ruleFor,fallbackShift} from './model.js';
import {opening} from './settings.js';
import {button,form,field,times,select,clock,h,name,dateLabel,weekNames,requestName} from './view.js';
const reason=(required=false)=>field(required?'Reden':'Toelichting (optioneel)','reason','text','',required?'required':'');
export function planningDialog({db,actor,action,id,open,modal,show,suggestWindow}){
 const shift=db.shifts.find(s=>s.id===id),draft=db.drafts.find(s=>s.id===id);
 if(action==='planExtra'){const [date,user]=id.split('|');show('newDraft',date);modal.querySelector('[name=user]').value=user;suggestWindow(true);return}
 if(action==='draft'||action==='newDraft'){
  const s=draft||shift,d=s?.date||id;
  open('Conceptdienst',form('draft',select('Medewerker','user',db.people.filter(p=>p.active!==false).map(p=>[p.id,p.name]))+field('Datum','date','date',d,'readonly')+'<p id="window"></p>'+times(s||opening(db,d))+field('Werkplek','area','text',s?.area||'Speelvloer','required')+field('Stand-by? Bericht vóór (optioneel)','deadline','time',s?.deadline||''),'Concept bewaren',s?.id||''));
  if(s)modal.querySelector('[name=user]').value=s.user;
  if(shift)modal.querySelector('[name=user]').disabled=true;
  suggestWindow(!s);return true;
 }
 if(action==='pubDay'||action==='pubWeek'){
  const end=action==='pubDay'?id:add(id,6), rows=db.drafts.filter(s=>s.date>=id&&s.date<=end);
  const waiting=db.offers.filter(o=>o.row.date>=id&&o.row.date<=end);
  const summary=rows.length+' conceptdienst(en) voor publicatie.'+waiting.map(o=>' '+clock(o.row)+' · Wacht op '+(o.turn==='admin'?'bedrijfsleider':name(db,o.row.user))+'.').join('');
  const outside=rows.some(s=>!available(db,s));
  open('Rooster publiceren',form('publish','<p>'+h(summary)+'</p>'+rows.map(s=>{
   const question=needsQuestion(db,s)||!available(db,s),base=db.shifts.find(x=>x.id===s.id)||fallbackShift(db,s);
   return '<section class="publish-row"><strong>'+h(name(db,s.user)+' · '+dateLabel(s.date))+'</strong><p>'+h('Beschikbaarheid: '+availability(db,s.user,s.date))+'</p><p>'+h(question?(base?'Blijft / wordt ingepland: '+clock(base):'Nog niet ingepland; wacht op toestemming'):'Wordt ingepland: '+clock(s))+'</p>'+(question?'<p class="offer-note">'+h('Vraag aan medewerker: werken '+clock(s))+'</p>':'')+'</section>';
  }).join('')+(outside?'<label><input type="checkbox" name="confirm" required> Ik heb de afwijkende beschikbaarheid gecontroleerd.</label>':'')+'<input type="hidden" name="through" value="'+end+'">','Publiceren',id));return true;
 }
 if(action==='proposal'){
  const o=db.offers.find(x=>x.id===id);
  if(o.fallback&&o.turn==='employee'){
   const requester=name(db,o.requestedBy||db.people.find(p=>p.role==='admin').id);
   open('Roosterwijziging','<p>'+h(dateLabel(o.row.date))+'</p><p>'+h('Je bent beschikbaar '+clock(o.availability||o.fallback)+'. '+requester+' vraagt of je '+clock(o.row)+' kunt werken.')+'</p><p>'+h('Je dienst blijft '+clock(o.fallback)+' totdat je accepteert.')+'</p>'+form('yes','','Ja, '+clock(o.row),id)+form('no','','Nee, behoud '+clock(o.fallback),id));return true;
  }
  open('Dienstvoorstel','<p>'+h(name(db,o.row.user)+' · '+dateLabel(o.row.date)+' · '+clock(o.row)+(o.row.deadline?' · Stand-by · Bericht vóór '+o.row.deadline:''))+'</p>'+form('yes','','Accepteren',id)+form('no','','Afwijzen',id)+(o.turn==='employee'?form('counter',times(o.row),'Andere tijden voorstellen',id):''));return true;
 }
 return false;
}
