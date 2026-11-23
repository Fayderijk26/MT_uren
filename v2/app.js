import {pilotRoster,migratePilot} from './pilot.js';
import {calendarPage,dayContent} from './calendar.js';
import {ic} from '../ui.js';
import {availability,weekPage} from './week.js';
import {fallbackShift,weeklyConflicts,needsQuestion,ruleFor,today,add,available,affected,remaining,apply,TIMES,
 mayReopen,warnings,closed,minutes,badges,asPlanned,activePeople,futureShifts,AREAS,absentMinutes,mayPaidLeave}
 from './model.js';
import {h,button,form,field,pauseField,select,times,clock,dateLabel,name,weekNames,requestName,approvalText,duration,chip,badge,requestLength,line,roleNames,
 areaChoice,sickButton,leaveNames} from './view.js';
import {todayPage} from './today.js';
import {peoplePage,rosterTabs} from './people.js';
import {availabilityPage} from './availability.js';
import {rosterPage} from './roster.js';
import {hoursPage} from './hours.js';
import {monthPage,exportData,closeMonthBody} from './month.js';

const key='monkeytown-pilot-nov2026', modal=document.querySelector('#dialog');
if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(pilotRoster()));
const read=()=>{
 const stored=localStorage.getItem(key),data=JSON.parse(stored);
 for(const r of [...data.rules,...data.extra]){
  if(r.start==='00:00')r.start='08:30';
  if(r.end==='23:59')r.end='18:00';
 }
 migratePilot(data);
 // Oudere demogegevens: nieuwe lijsten en contracturen uit de proefdata aanvullen.
 data.normOverrides??=[];data.closedMonths??=[];data.monthReopens??=[];
 for(const p of data.people){
  p.contractHours??=pilotRoster().people.find(x=>x.id===p.id)?.contractHours;
  p.contract??=pilotRoster().people.find(x=>x.id===p.id)?.contract||(p.contractHours>0?'vast':'uren');
  p.active??=true;p.phone??='';p.areas??=pilotRoster().people.find(x=>x.id===p.id)?.areas||['Vloer'];
 }
 // Oude werkplekken (Speelvloer, Dagleiding, ...): de werkplek van die medewerker, Keuken blijft Keuken als dat kan.
 for(const s of [...data.shifts,...data.drafts,...data.offers.map(o=>o.row)]){
  const own=data.people.find(p=>p.id===s.user)?.areas||['Vloer'];
  if(!own.includes(s.area))s.area=own[0];
 }
 if(JSON.stringify(data)!==stored)localStorage.setItem(key,JSON.stringify(data));
 return data;
};
let returnRequest=null;
let db=read(), actorId=sessionStorage.getItem('pilot-person')||'eva', snapshots={};
const view={page:'today',day:today(),month:today().slice(0,7)};
// Tabbalk: onderaan op een telefoon, bovenaan op een groot scherm. Bolletjes tellen wat nog te doen is.
const tabs={today:['Vandaag','LayoutDashboard'],mine:['Rooster','CalendarDays'],team:['Rooster','CalendarDays'],
 hours:['Uren','Clock3'],availability:['Aanvragen','Palmtree']};
const tabOf={reviews:'hours',month:'hours',requests:'availability',people:'team'};
function tabBar(actor,nav,page){
 const count=badges(db,actor),current=tabOf[page]||page;
 const counted=k=>badge(k==='hours'?count.hours:k==='availability'?count.requests:0);
 return nav.map(k=>'<button data-act="page" data-id="'+k+'" aria-current="'+(current===k?'page':'false')+'">'
  +'<span class="tabicon">'+ic(tabs[k][1],18)+counted(k)+'</span>'+tabs[k][0]+'</button>').join('');
}
function render(){
 db=read();
 const actor=db.people.find(p=>p.id===actorId);
 const nav=['today',actor.role==='employee'?'mine':'team','hours','availability'];
 const page=view.page;
 const admin=actor.role==='admin',staff=actor.role!=='employee';
 const body=page==='mine'?calendarPage(db,actor,view)
  :page==='team'&&staff?rosterTabs(actor,'team')+weekPage(db,view,!admin)
  :page==='people'&&admin?peoplePage(db,actor)
  :page==='today'?todayPage(db,actor)
  :['mine','team'].includes(page)?rosterPage(db,actor,view)
  :['hours','reviews'].includes(page)?hoursPage(db,actor,view)
  :page==='month'&&admin?monthPage(db,actor,view)
  :availabilityPage(db,actor,view);
 document.querySelector('#app').innerHTML='<header class="vheader"><img src="./assets/logo.webp" alt="Monkey Town"><label>Demoprofiel <select id="profile">'+db.people.filter(p=>p.active!==false||p.id===actorId).map(p=>'<option value="'+p.id+'" '+(p.id===actorId?'selected':'')+'>'+p.name+' · '+roleNames[p.role]+'</option>').join('')+'</select></label></header><nav class="vnav" aria-label="Hoofdmenu">'+tabBar(actor,nav,page)+'</nav><main id="main" class="shell vmain">'+body+'</main>';
}
// Op inactief zetten: eerst laten zien welke diensten nog in de toekomst staan.
function inactiveBox(p){
 if(p.id===actorId)return '';
 const future=futureShifts(db,p.id);
 if(future.length)return '<h3>Op inactief zetten</h3><p>'+h(p.name)+' heeft nog '+future.length
  +' dienst(en) in de toekomst. Haal die eerst weg of geef ze aan iemand anders:</p>'
  +future.map(s=>'<p>'+h(dateLabel(s.date)+' · '+clock(s))+'</p>').join('');
 return '<h3>Op inactief zetten</h3><p>'+h(p.name)+' verdwijnt uit het rooster. Oude uren blijven bewaard.</p>'
  +form('setActive','<input type="hidden" name="active" value="">','Op inactief zetten',p.id,false);
}
function open(title,content){
 modal.innerHTML='<div class="modalhead"><h2>'+h(title)+'</h2>'+button('Sluiten','close')+'</div>'+content;
 modal.setAttribute('aria-label',title);
 if(!modal.open)modal.showModal();
}
// Ziek gemeld: wie het meldde en hoeveel uur het telt.
const sickText=s=>'<p>'+chip('sick')+' door '+h(name(db,s.sick.by))+' · telt '+duration(absentMinutes(s))+'</p>';
const reason=(required=false)=>field(required?'Reden':'Toelichting (optioneel)','reason','text','',required?'required':'');
function show(action,id){
 db=read();
 const shift=db.shifts.find(s=>s.id===id), entry=db.hours[id], draft=db.drafts.find(s=>s.id===id);
 if(action==='pause'){
  const other=modal.querySelector('[name=pauseOther]');
  modal.querySelector('#pauseother').hidden=id!=='other';
  modal.querySelector('[name=pause]').value=id==='other'?other.value:id;
  if(id==='other')other.focus();
  modal.querySelectorAll('[data-act=pause]').forEach(b=>{b.classList.toggle('primary',b.dataset.id===id);
   b.classList.toggle('secondary',b.dataset.id!==id)});
  showNet();return;
 }
 if(action==='askChange'||action==='askReject'){
  const box=modal.querySelector('#'+action);box.hidden=false;box.querySelector('[name=reason]').focus();return;
 }
 if(action==='calendarMode'){view.calendarMode=id;render();return}
 if(action==='calendarMove'){
  let date=view.calendarDate||today();
  if(id==='0')date=today();
  else if(view.calendarMode==='week')date=add(date,Number(id)*7);
  else{const d=new Date(date.slice(0,7)+'-01T12:00Z');d.setUTCMonth(d.getUTCMonth()+Number(id));date=d.toISOString().slice(0,10)}
  view.calendarDate=date;render();return;
 }
 if(action==='calendarDay'){
  const items=dayContent(db,actorId,id);
  let body=items.map(i=>'<p>'+h(i.text)+'</p>'+(i.shift?button('Dienst bekijken','ownShift',i.shift.id):i.offer&&i.offer.turn==='employee'?button('Reageren','proposal',i.offer.id):'')).join('');
  if(id>=today())body+=button('Vrij vragen','leave',id)+button('Beschikbaarheid opgeven','extra',id);
  open(dateLabel(id),body);return;
 }
 if(action==='ownShift'){
  const me=db.people.find(p=>p.id===actorId),hours=shift.date<=today()&&!shift.deadline&&!shift.sick;
  open('Mijn dienst','<p>'+h(dateLabel(shift.date)+' · '+clock(shift)+' · '+shift.area)+'</p><p>Aangegeven beschikbaarheid: '+h(availability(db,actorId,shift.date))+'</p>'+(shift.sick?sickText(shift):'')+(hours?button('Gewerkte uren','entry',id):'')+sickButton(db,me,shift));return;
 }
 if(action==='requestShift'){
  const [requestId,shiftId]=id.split('|');returnRequest=requestId;show('draft',shiftId);return;
 }
 if(action==='past')return;
 if(action==='week'||action==='day'){view.day=id;view.single=action==='day';render();return}
 if(action==='shiftDetails'){
  const canEdit=db.people.find(p=>p.id===actorId).role==='admin';
  const row=canEdit?(draft||shift):shift;
  if(!row)return;
  const status=canEdit&&draft?'Conceptdienst':row.sick?'Ziek gemeld':'Ingepland';
  const availabilityText=availability(db,row.user,row.date);
  let body='<p>'+status+' van <strong>'+h(row.start)+' tot '+h(row.end)+'</strong></p><p>Aangegeven beschikbaarheid: '+h(availabilityText==='Onbekend'?'Geen beschikbaarheid opgegeven':availabilityText)+'</p>';
  if(row.deadline)body+='<p><b class="sb">SB</b> · Bericht vóór '+h(row.deadline)+'</p>';
  if(row.sick)body+=sickText(row);
  if(!draft)body+=sickButton(db,db.people.find(p=>p.id===actorId),row);
  if(canEdit&&entry)body+=button('Uren bekijken','inspect',id);
  if(row.date>=today()&&db.people.find(p=>p.id===actorId).role==='admin'){
   if(!entry&&!row.sick)body+=button('Dienst wijzigen','draft',id,true);
   body+=button('Extra dienst toevoegen','planExtra',row.date+'|'+row.user);
  }
  if(!draft&&row.deadline&&db.people.find(p=>p.id===actorId).role==='admin')body+=button('Stand-by afhandelen','standby',id);
  open(name(db,row.user)+' · '+dateLabel(row.date),body);return;
 }
 if(action==='standby'){
  open('Stand-by', '<p>'+h(name(db,shift.user))+' · Bericht vóór '+h(shift.deadline)+'</p>'+form('call',times(shift),'Oproepen',id)+form('release','','Niet nodig',id));return;
 }
 if(action==='page'){view.page=id;render();window.scrollTo(0,0);return}
 if(action==='close'){modal.close();if(returnRequest){const id=returnRequest;returnRequest=null;show('decision',id)}return}
 if(action==='entry'||action==='inspect'){
  const editable=action==='entry'&&!shift.sick&&!closed(db,shift.date)&&(!entry||entry.status==='returned');
  let info='<p>'+h(name(db,shift.user)+' · '+dateLabel(shift.date))+'</p><p>Gepland '+clock(shift)+' · '+h(shift.area)+'</p>';
  if(shift.sick)info+=sickText(shift);
  if(entry)info+='<p>'+chip(entry.status)+' '+clock(entry)+' · '+entry.pause+' min pauze</p>';
  if(entry?.reason)info+='<p>'+h(entry.reason)+'</p>';
  if(closed(db,shift.date))info+='<p class="notice">Deze maand is afgesloten.</p>';
  if(approvalText(db,entry))info+='<p>'+h(approvalText(db,entry))+'</p>';
  if(action==='inspect')info+=warnings(db,shift).map(w=>'<p class="notice">Let op: '+h(w)+'</p>').join('');
  if(editable)info+=form('hours',times(entry||shift)+pauseField(entry?.pause??''),'Uren indienen',id);
  if(action==='inspect'&&entry?.status==='pending')info+=reviewChoices(shift);
  const actor=db.people.find(p=>p.id===actorId);
  if(mayReopen(db,actor,shift))info+=form('reopen',reason(true),'Heropenen',id);
  open(editable?'Uren invullen':'Gewerkte uren',info);showNet();return;
 }
 if(action==='unplanned'){open('Ongeplande dienst',form(action,field('Datum','date','date',today(),'required max="'+today()+'"')+times()+pauseField()+areaChoice(db,actorId),'Uren indienen'));showNet();return}
 if(action==='approve'||action==='seen'){save(action,{id});return}
 if(action==='sickAsk'||action==='sickUndoAsk'){
  const what='<p><b>'+h(name(db,shift.user))+'</b><br>'+h(dateLabel(shift.date)+' · '+clock(shift))+'</p>';
  if(action==='sickUndoAsk'){open('Ziekmelding intrekken',what+form('sickUndo','','Ziekmelding intrekken',id));return}
  const call=shift.user===actorId?'<p>Bel ook de leiding.</p>':'';
  open('Ziek melden',what+'<p>Telt '+h(duration(absentMinutes(shift)))+' ziek.</p>'+call+form('sick','','Ziek melden',id));
  return;
 }
 if(action==='reactivate'){save('setActive',{id,active:true});return}
 if(action==='norm'){
  const body=field('Norm in uren','hours','number','','required min="0" step="0.25"')+reason(true);
  open('Norm aanpassen · '+name(db,id),form('setNorm',body,'Norm opslaan',id));return;
 }
 if(action==='export'){exportMonthFile(id);return}
 if(action==='closeMonth'){open('Maand afsluiten',form('closeMonth',closeMonthBody(db,id),'Maand afsluiten',id));return}
 if(action==='reopenMonth'){
  const warn='<p class="notice">Alleen gebruiken als het echt nodig is. Dit wordt vastgelegd.</p>';
  open('Noodknop: maand heropenen',form('reopenMonth',warn+reason(true),'Maand heropenen',id));return;
 }
 if(action==='decision'){
  const r=db.requests.find(x=>x.id===id);snapshots={};
  let effects='';
  if(r.kind==='weekly'){
   const conflicts=weeklyConflicts(db,r);
   effects+=conflicts.map(s=>'<p>'+h(dateLabel(s.date)+' · '+clock(s))+'</p>'+button('Dienst bekijken en aanpassen','requestShift',r.id+'|'+s.id)).join('');
   if(conflicts.length)effects+='<label><input type="checkbox" name="keep" value="yes" required> Nieuwe beschikbaarheid goedkeuren en deze '+conflicts.length+' diensten behouden</label>';
  }
  for(const s of r.kind==='leave'?affected(db,r):[]){
   snapshots[s.id]=JSON.stringify(s);const parts=remaining(s,r);
   const opts=parts.map((t,i)=>[String(i),'Werken '+clock(t)]);
   if(parts.length===2)opts.unshift(['all','Beide diensten · '+parts.map(clock).join(' en ')]);
   opts.push(['none','Dienst vervalt']);
   effects+=button('Dienst bekijken en aanpassen','requestShift',r.id+'|'+s.id)+select(dateLabel(s.date)+' · '+clock(s),'choice-'+s.id,opts);
  }
  // Wie, wanneer en hoe lang; twee knoppen. De reden voor afwijzen verschijnt pas na Aanvraag afwijzen.
  const what=requestName(r)+(requestLength(r)?' · '+requestLength(r):'');
  const zero=r.kind==='leave'&&r.type==='verlof'&&!affected(db,r).length
   ?'<p class="notice">Er staan nog geen diensten in deze periode: dit verlof telt nu 0 uur.</p>':'';
  const info='<p><b>'+h(name(db,r.user))+'</b><br>'+h(what)+'</p>'+(r.reason?'<p>Reden: '+h(r.reason)+'</p>':'')+zero;
  const choices='<div class="decide">'+form('accept',effects,'Aanvraag goedkeuren',id)
   +button('Aanvraag afwijzen','askReject',id)+'</div>';
  const no='<div id="askReject" hidden>'+form('reject',reason(true),'Afwijzen versturen',id)+'</div>';
  open('Aanvraag beoordelen',info+choices+no);return;
 }
 if(['leave','weekly','extra'].includes(action)){
  let body=field(action==='weekly'?'Geldig vanaf':'Datum','date','date',id||today(),'required min="'+today()+'"');
  if(action==='weekly')body+=select('Weekdag','weekday',weekNames.map((n,i)=>[i+1,n]));
  if(action==='leave')body+=leaveType()+field('Tot en met (bij meerdere dagen)','through','date');
  const modes=action==='leave'?[['all','Hele dag vrij'],['range','Deel van de dag']]:[['all','Hele dag ('+TIMES.start+'–'+TIMES.end+')'],['from','Beschikbaar vanaf'],['until','Beschikbaar tot'],['range','Tussen twee tijden']];
  if(action==='weekly')modes.push(['off','Niet beschikbaar']);
  if(action==='leave')body+='<p id="late" role="status"></p>';
  body+=select('Beschikbaarheid','mode',modes)+field('Begintijd','start','time')+field('Eindtijd','end','time')+(action==='extra'?'':reason());
  open({leave:'Vrij vragen',weekly:'Vaste beschikbaarheid wijzigen',extra:'Extra beschikbaar'}[action],form(action,body,'Versturen'));toggleTimes();lateNotice();return;
 }
 if(action==='person'){
  // Medewerker toevoegen (zonder id) of wijzigen.
  const p=db.people.find(x=>x.id===id)||{name:'',role:'employee',contract:'vast',contractHours:'',phone:''};
  const body=field('Naam','name','text',p.name,'required')
   +select('Rol','role',Object.entries(roleNames))
   +select('Contract','contract',[['vast','Vast (met maandnorm)'],['uren','Uren (betaald per gewerkt uur)']])
   +field('Contracturen per week','contractHours','number',p.contractHours,'required min="0" max="40" step="0.5"')
   +field('Telefoonnummer (niet verplicht)','phone','tel',p.phone||'','inputmode="tel"')
   +'<p class="hint">Alleen leiding en bedrijfsleider zien het nummer. Het wordt gebruikt voor Herinner.</p>'
   +areaBoxes(p.areas||['Vloer']);
  open(id?'Medewerker wijzigen':'Medewerker toevoegen',form('savePerson',body,'Opslaan',id)+(id?inactiveBox(p):''));
  modal.querySelector('[name=role]').value=p.role;modal.querySelector('[name=contract]').value=p.contract;return;
 }
 if(action==='planFromRules'){
  open('Concept uit vaste beschikbaarheid','<p>Iedereen wordt als concept ingepland op de vaste dagen en tijden van '
   +h(dateLabel(id)+' – '+dateLabel(add(id,6)))+'. Werkplek: vloer, of keuken voor wie alleen in de keuken werkt.</p>'
   +'<p>Vrije dagen, voorbije dagen en dagen waarop iemand al staat, worden overgeslagen. Je publiceert zelf.</p>'
   +form('planFromRules','','Concept maken',id));return;
 }
 if(action==='approveAll'){
  // Eerst laten zien welke uren precies volgens rooster zijn, dan bevestigen.
  const list=asPlanned(db,db.people.find(p=>p.id===actorId));
  const rows=list.map(s=>line(name(db,s.user)+' · '+dateLabel(s.date),
   clock(db.hours[s.id])+' · '+db.hours[s.id].pause+' min pauze'));
  const ids='<input type="hidden" name="ids" value="'+h(list.map(s=>s.id).join(','))+'">';
  open('Alles goedkeuren','<p>Deze uren zijn precies volgens rooster:</p>'+rows.join('')
   +form('approveAll',ids,'Alles goedkeuren ('+list.length+')'));return;
 }
 if(action==='extraDecision'){
  // Inplannen (hele opgegeven tijd of andere tijden daarbinnen) of niet inplannen.
  const [user,date]=id.split('|'),e=db.extra.find(x=>x.user===user&&x.date===date);
  const info='<p><b>'+h(name(db,user))+'</b><br>'+h(dateLabel(date)+' · beschikbaar '+clock(e))+'</p>';
  const choice=select('Tijden','whole',[['whole','Hele opgegeven tijd ('+clock(e)+')'],['other','Andere tijden']]);
  const body=choice+'<div id="extratimes" hidden>'+times(e)+'</div>'+areaChoice(db,user);
  const choices=form('planExtra',body,'Inplannen',id)+form('declineExtra','','Niet inplannen',id,false);
  open('Extra beschikbaarheid',info+'<div class="decide">'+choices+'</div>');return;
 }
 if(action==='planExtra'){const [date,user]=id.split('|');show('newDraft',date);modal.querySelector('[name=user]').value=user;pickArea();suggestWindow(true);return}
 if(action==='draft'||action==='newDraft'){
  const s=draft||shift,d=s?.date||id;
  open('Conceptdienst',form('draft',select('Medewerker','user',activePeople(db).map(p=>[p.id,p.name]))+field('Datum','date','date',d,'readonly')+'<p id="window"></p>'+times(s||{start:TIMES.start,end:TIMES.end})+'<div id="areapick">'+areaChoice(db,s?.user||activePeople(db)[0]?.id,s?.area)+'</div>'+field('Stand-by? Bericht vóór (optioneel)','deadline','time',s?.deadline||''),'Concept bewaren',s?.id||''));
  if(s)modal.querySelector('[name=user]').value=s.user;
  if(shift)modal.querySelector('[name=user]').disabled=true;
  suggestWindow(!s);return;
 }
 if(action==='pubWeek'){
  const end=add(id,6), rows=db.drafts.filter(s=>s.date>=id&&s.date<=end);
  const waiting=db.offers.filter(o=>o.row.date>=id&&o.row.date<=end);
  const summary=rows.length+' conceptdienst(en) voor publicatie.'+waiting.map(o=>' '+clock(o.row)+' · Wacht op '+(o.turn==='admin'?'bedrijfsleider':name(db,o.row.user))+'.').join('');
  const outside=rows.some(s=>!available(db,s));
  open('Rooster publiceren',form('publish','<p>'+h(summary)+'</p>'+rows.map(s=>{
   const question=needsQuestion(db,s)||!available(db,s),base=db.shifts.find(x=>x.id===s.id)||fallbackShift(db,s);
   return '<section class="publish-row"><strong>'+h(name(db,s.user)+' · '+dateLabel(s.date))+'</strong><p>'+h('Beschikbaarheid: '+availability(db,s.user,s.date))+'</p><p>'+h(question?(base?'Blijft / wordt ingepland: '+clock(base):'Nog niet ingepland; wacht op toestemming'):'Wordt ingepland: '+clock(s))+'</p>'+(question?'<p class="offer-note">'+h('Vraag aan medewerker: werken '+clock(s))+'</p>':'')+'</section>';
  }).join('')+(outside?'<label><input type="checkbox" name="confirm" required> Ik heb de afwijkende beschikbaarheid gecontroleerd.</label>':'')+'<input type="hidden" name="through" value="'+end+'">','Publiceren',id));return;
 }
 if(action==='proposal'){
  const o=db.offers.find(x=>x.id===id);
  if(o.fallback&&o.turn==='employee'){
   const requester=o.requestedBy?name(db,o.requestedBy):'de bedrijfsleider';
   open('Roosterwijziging','<p>'+h(dateLabel(o.row.date))+'</p><p>'+h('Je bent beschikbaar '+clock(o.availability||o.fallback)+'. '+requester+' vraagt of je '+clock(o.row)+' kunt werken.')+'</p><p>'+h('Je dienst blijft '+clock(o.fallback)+' totdat je accepteert.')+'</p>'+form('yes','','Ja, '+clock(o.row),id)+form('no','','Nee, behoud '+clock(o.fallback),id));return;
  }
  open('Dienstvoorstel','<p>'+h(name(db,o.row.user)+' · '+dateLabel(o.row.date)+' · '+clock(o.row)+(o.row.deadline?' · Stand-by · Bericht vóór '+o.row.deadline:''))+'</p>'+form('yes','','Accepteren',id)+form('no','','Afwijzen',id)+(o.turn==='employee'?form('counter',times(o.row),'Andere tijden voorstellen',id):''));return;
 }
}
// Soort vrij: verlof (betaald) alleen bij een vast contract; de regel staat in model.js.
function leaveType(){
 const paid=mayPaidLeave(db,actorId);
 const types=(paid?['verlof','onbetaald']:['onbetaald']).map(t=>'<option value="'+t+'">'+h(leaveNames[t])+'</option>');
 const choose=paid?'<option value="">Kies verlof of onbetaald</option>':'';
 const hint=paid?'':'<p class="hint">Betaald verlof kan alleen bij een vast contract.</p>';
 return '<label class="field"><span>Soort</span><select name="type" required>'+choose+types.join('')+'</select></label>'+hint;
}
function lateNotice(){
 const el=modal.querySelector('#late');
 if(el)el.textContent=modal.querySelector('[name=date]').value<add(today(),21)?'Je vraagt minder dan drie weken van tevoren vrij. Je aanvraag wordt wel verstuurd.':'';
}
function toggleTimes(){
 const mode=modal.querySelector('[name=mode]').value;
 for(const [n,show] of [['start',['from','range'].includes(mode)],['end',['until','range'].includes(mode)]]){
  const el=modal.querySelector('[name='+n+']');el.closest('label').hidden=!show;el.required=show;el.disabled=!show;
 }
}
// Medewerker in het conceptformulier gewijzigd: de werkplekknoppen passen zich aan.
function pickArea(){
 const box=modal.querySelector('#areapick');
 if(box)box.innerHTML=areaChoice(db,modal.querySelector('[name=user]').value);
}
// Vinkjes voor de werkplekken van een medewerker.
const areaBoxes=own=>'<fieldset class="field areas"><span>Werkplek</span>'+AREAS.map(a=>'<label><input type="checkbox"'
 +' name="areas" value="'+a+'"'+(own.includes(a)?' checked':'')+'> '+a+'</label>').join('')+'</fieldset>';
function suggestWindow(fill){
 const f=modal.querySelector('form'), user=f.elements.user.value,date=f.elements.date.value;
 const rule=ruleFor(db,{user,date});
 const question=!f.dataset.id&&needsQuestion(db,{user,date,start:f.elements.start.value,end:f.elements.end.value});
 f.querySelector('.primary').textContent=question?'Vraag versturen':'Concept bewaren';
 modal.querySelector('h2').textContent=question?'Vragen om te werken':'Dienst inplannen';
 modal.querySelector('#window').textContent=rule?(rule.off?'Niet beschikbaar':rule.start==='00:00'&&rule.end==='23:59'?'Hele dag ('+TIMES.start+'–'+TIMES.end+')':'Beschikbaar '+clock(rule)):'Geen beschikbaarheid opgegeven';
 if(fill&&rule&&!rule.off){f.elements.start.value=rule.start==='00:00'?'10:00':rule.start;f.elements.end.value=rule.end==='23:59'?TIMES.end:rule.end;}
}
// Beoordelen: eerst alleen de keuzes; het verplichte veld Reden verschijnt pas na 'Aanpassen vragen' of 'Afwijzen'.
function reviewChoices(shift){
 const id=shift.id,reject=shift.unplanned;
 const choices=button('Goedkeuren','approve',id,true)+button('Aanpassen vragen','askChange',id)
  +(reject?button('Afwijzen','askReject',id):'');
 const ask='<div id="askChange" hidden>'+form('return',reason(true),'Versturen',id)+'</div>';
 const no=reject?'<div id="askReject" hidden>'+form('rejectHours',reason(true),'Afwijzen versturen',id)+'</div>':'';
 return '<div class="vactions">'+choices+'</div>'+ask+no;
}
// Regel met netto uren onder de pauze, bijgewerkt bij elke keuze.
function showNet(){
 const el=modal.querySelector('#net');if(!el)return;
 const f=el.closest('form'),[start,end,pause]=['start','end','pause'].map(n=>f.elements[n].value);
 if(!start||!end||pause===''||end<=start){el.textContent='Netto: kies begin, eind en pauze.';return}
 const net=minutes(end)-minutes(start)-Number(pause);
 el.textContent=net>0?'Netto '+duration(net):'Controleer de pauze.';
}
async function exportMonthFile(month){
 try{
  const {exportMonth}=await import('../excel/roster.js');
  const {rows,summary,metadata}=exportData(db,month);
  await exportMonth(rows,summary,month,metadata);
 }catch(e){open('Export mislukt','<p>'+h(e.message)+'</p>')}
}
async function save(op,p){
 try{
  const write=()=>{
   let next=apply(read(),actorId,op,p);
   if(op==='draft'&&returnRequest)next=apply(next,actorId,'publish',{date:p.date,through:p.date,onlyId:p.id,confirm:true});
   localStorage.setItem(key,JSON.stringify(next));
  };
  if(navigator.locks)await navigator.locks.request(key,write);else write();
  if(modal.open)modal.close();render();
  if(op==='draft'&&returnRequest){const id=returnRequest;returnRequest=null;show('decision',id)}
 }catch(e){const el=modal.open?modal.querySelector('.err'):null;if(el)el.textContent=e.message;else open('Controleer de gegevens','<p>'+h(e.message)+'</p>');}
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(b)show(b.dataset.act,b.dataset.id)});
document.addEventListener('change',e=>{
 const el=e.target;if(el.id==='profile'){actorId=el.value;sessionStorage.setItem('pilot-person',actorId);view.page='today';render()}
 if(el.dataset.view&&el.value){view[el.dataset.view]=el.value;render()}
 if(el.name==='date')lateNotice();if(el.name==='mode')toggleTimes();if(el.name==='user'){pickArea();suggestWindow(true)}if(['start','end'].includes(el.name)&&modal.querySelector('#window'))suggestWindow(false);
 if(['start','end'].includes(el.name))showNet();
});
// Extra beschikbaarheid: de tijden alleen tonen bij Andere tijden.
document.addEventListener('change',e=>{
 if(e.target.name==='whole')modal.querySelector('#extratimes').hidden=e.target.value==='whole';
});
document.addEventListener('input',e=>{
 if(e.target.name!=='pauseOther')return;
 modal.querySelector('[name=pause]').value=e.target.value;showNet();
});
modal.addEventListener('submit',e=>{
 e.preventDefault();const f=e.target,p=Object.fromEntries(new FormData(f));let op=f.dataset.op;p.id=f.dataset.id;
 delete p.pauseOther;
 if(op==='draft')p.user=f.elements.user.value;
 if(p.mode==='from')p.end=TIMES.end;if(p.mode==='until')p.start=TIMES.start;p.off=p.mode==='off';
 if(op==='accept'||op==='reject'){p.accept=op==='accept';op='decide';p.choices=Object.fromEntries(Object.entries(snapshots).map(([id,before])=>[id,{before,value:p['choice-'+id]}]));}
 if(op==='publish'){p.date=p.id;p.confirm=Boolean(p.confirm)}
 if(op==='approveAll')p.ids=p.ids.split(',');
 if(op==='planFromRules')p.week=p.id;
 if(op==='setActive')p.active=p.active==='true';
 if(op==='savePerson')p.areas=new FormData(f).getAll('areas');
 if(op==='planExtra'||op==='declineExtra')[p.user,p.date]=p.id.split('|');
 if(op==='setNorm'){p.user=p.id;p.month=view.month;p.minutes=Math.round(Number(p.hours)*60)}
 if(op==='closeMonth'||op==='reopenMonth'){p.month=p.id;p.confirm=Boolean(p.confirm)}
 if(['yes','no','counter'].includes(op)){p.answer=op;op='offer'}
 save(op,p);
});
window.addEventListener('storage',render);render();
