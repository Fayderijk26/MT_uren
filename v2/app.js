import {pilotRoster,migratePilot} from './pilot.js';
import {calendarPage,dayContent} from './calendar.js';
import {ic} from '../ui.js';
import {availability,weekPage} from './week.js';
import {fallbackShift,weeklyConflicts,needsQuestion,ruleFor,today,add,available,affected,remaining,apply} from './model.js';
import {h,button,form,field,pauseField,select,times,clock,dateLabel,labels,name,weekNames,requestName} from './view.js';
import {todayPage} from './today.js';
import {availabilityPage} from './availability.js';
import {rosterPage} from './roster.js';
import {hoursPage} from './hours.js';

const key='monkeytown-pilot-nov2026', modal=document.querySelector('#dialog');
if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(pilotRoster()));
const read=()=>{
 const stored=localStorage.getItem(key),data=JSON.parse(stored);
 for(const r of [...data.rules,...data.extra]){
  if(r.start==='00:00')r.start='08:30';
  if(r.end==='23:59')r.end='18:00';
 }
 migratePilot(data);
 if(JSON.stringify(data)!==stored)localStorage.setItem(key,JSON.stringify(data));
 return data;
};
let returnRequest=null;
let db=read(), actorId=sessionStorage.getItem('pilot-person')||'eva', snapshots={};
const view={page:'today',day:today(),month:today().slice(0,7)};
const pages={today:'Vandaag',mine:'Mijn rooster',hours:'Gewerkte uren',availability:'Vrij & beschikbaarheid',team:'Teamrooster',reviews:'Uren goedkeuren',requests:'Aanvragen beoordelen'};
function render(){
 db=read();
 const actor=db.people.find(p=>p.id===actorId);
 const nav=['today',actor.role==='employee'?'mine':'team','hours','availability'];
 const page=view.page;
 const body=page==='mine'?calendarPage(db,actor,view):page==='team'&&actor.role!=='employee'?weekPage(db,view,actor.role!=='admin'):page==='today'?todayPage(db,actor):['mine','team'].includes(page)?rosterPage(db,actor,view):['hours','reviews'].includes(page)?hoursPage(db,actor,view):availabilityPage(db,actor,view);
 document.querySelector('#app').innerHTML='<header class="vheader"><img src="./assets/logo.webp" alt="Monkey Town"><label>Demoprofiel <select id="profile">'+db.people.map(p=>'<option value="'+p.id+'" '+(p.id===actorId?'selected':'')+'>'+p.name+' · '+({admin:'Bedrijfsleider',lead:'Dagleiding',employee:'Medewerker'}[p.role])+'</option>').join('')+'</select></label></header><nav class="vnav" aria-label="Hoofdmenu">'+nav.map(k=>'<button data-act="page" data-id="'+k+'" aria-current="'+(page===k?'page':'false')+'">'+ic(({today:'home',team:'calendar',mine:'calendar',hours:'clock',availability:'calendar'})[k],16)+(k==='hours'&&actor.role!=='employee'?'Uren':pages[k])+'</button>').join('')+'</nav><main id="main" class="shell vmain">'+body+'</main>';
}
function open(title,content){
 modal.innerHTML='<div class="modalhead"><h2>'+h(title)+'</h2>'+button('Sluiten','close')+'</div>'+content;
 modal.setAttribute('aria-label',title);
 if(!modal.open)modal.showModal();
}
const reason=(required=false)=>field(required?'Reden':'Toelichting (optioneel)','reason','text','',required?'required':'');
function show(action,id){
 db=read();
 const shift=db.shifts.find(s=>s.id===id), entry=db.hours[id], draft=db.drafts.find(s=>s.id===id);
 if(action==='pause'){
  const input=modal.querySelector('[name=pause]');
  if(id==='other'){input.focus();input.select()}else input.value=id;
  modal.querySelectorAll('[data-act=pause]').forEach(b=>b.classList.toggle('primary',b.dataset.id===id));
  return;
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
  open('Mijn dienst','<p>'+h(dateLabel(shift.date)+' · '+clock(shift)+' · '+shift.area)+'</p><p>Aangegeven beschikbaarheid: '+h(availability(db,actorId,shift.date))+'</p>'+(shift.date<=today()&&!shift.deadline?button('Gewerkte uren','entry',id):''));return;
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
  const status=canEdit&&draft?'Conceptdienst':'Ingepland';
  const availabilityText=availability(db,row.user,row.date);
  let body='<p>'+status+' van <strong>'+h(row.start)+' tot '+h(row.end)+'</strong></p><p>Aangegeven beschikbaarheid: '+h(availabilityText==='Onbekend'?'Geen beschikbaarheid opgegeven':availabilityText)+'</p>';
  if(row.deadline)body+='<p><b class="sb">SB</b> · Bericht vóór '+h(row.deadline)+'</p>';
  if(row.date>=today()&&db.people.find(p=>p.id===actorId).role==='admin'){
   if(!entry)body+=button('Dienst wijzigen','draft',id,true);
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
  const editable=action==='entry'&&(!entry||entry.status==='returned');
  let info='<p>'+h(name(db,shift.user)+' · '+dateLabel(shift.date))+'</p><p>Gepland '+clock(shift)+' · '+h(shift.area)+'</p>';
  if(entry)info+='<p>'+h(labels[entry.status])+' · '+clock(entry)+' · '+entry.pause+' min pauze</p>';
  if(entry?.reason)info+='<p>'+h(entry.reason)+'</p>';
  if(editable)info+=form('hours',times(entry||shift)+pauseField(entry?.pause??''),'Uren indienen',id);
  if(action==='inspect'&&entry?.status==='pending')info+=button('Goedkeuren','approve',id,true)+form('return',reason(true),'Terugsturen voor hercontrole',id)+(shift.unplanned?form('rejectHours',reason(true),'Ongeplande dienst afwijzen',id):'');
  open(editable?'Uren invullen':'Gewerkte uren',info);return;
 }
 if(action==='unplanned'){open('Ongeplande dienst',form(action,field('Datum','date','date',today(),'required max="'+today()+'"')+times()+pauseField()+field('Werkplek','area','text','','required'),'Uren indienen'));return}
 if(action==='approve'||action==='seen'){save(action,{id});return}
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
  open('Aanvraag beoordelen','<p>'+h(name(db,r.user)+' · '+requestName(r))+'</p><p>'+h(r.reason)+'</p>'+form('accept',effects,'Aanvraag goedkeuren',id)+form('reject',reason(true),'Aanvraag afwijzen',id));return;
 }
 if(['leave','weekly','extra'].includes(action)){
  let body=field(action==='weekly'?'Geldig vanaf':'Datum','date','date',id||today(),'required min="'+today()+'"');
  if(action==='weekly')body+=select('Weekdag','weekday',weekNames.map((n,i)=>[i+1,n]));
  if(action==='leave')body+=field('Tot en met (bij meerdere dagen)','through','date');
  const modes=action==='leave'?[['all','Hele dag vrij'],['range','Deel van de dag']]:[['all','Hele dag (08:30–18:00)'],['from','Beschikbaar vanaf'],['until','Beschikbaar tot'],['range','Tussen twee tijden']];
  if(action==='weekly')modes.push(['off','Niet beschikbaar']);
  if(action==='leave')body+='<p id="late" role="status"></p>';
  body+=select('Beschikbaarheid','mode',modes)+field('Begintijd','start','time')+field('Eindtijd','end','time')+(action==='extra'?'':reason());
  open({leave:'Vrij vragen',weekly:'Vaste beschikbaarheid wijzigen',extra:'Extra beschikbaar'}[action],form(action,body,'Versturen'));toggleTimes();lateNotice();return;
 }
 if(action==='planExtra'){const [date,user]=id.split('|');show('newDraft',date);modal.querySelector('[name=user]').value=user;suggestWindow(true);return}
 if(action==='draft'||action==='newDraft'){
  const s=draft||shift,d=s?.date||id;
  open('Conceptdienst',form('draft',select('Medewerker','user',db.people.map(p=>[p.id,p.name]))+field('Datum','date','date',d,'readonly')+'<p id="window"></p>'+times(s||{start:'08:30',end:'18:00'})+field('Werkplek','area','text',s?.area||'Speelvloer','required')+field('Stand-by? Bericht vóór (optioneel)','deadline','time',s?.deadline||''),'Concept bewaren',s?.id||''));
  if(s)modal.querySelector('[name=user]').value=s.user;
  if(shift)modal.querySelector('[name=user]').disabled=true;
  suggestWindow(!s);return;
 }
 if(action==='pubDay'||action==='pubWeek'){
  const end=action==='pubDay'?id:add(id,6), rows=db.drafts.filter(s=>s.date>=id&&s.date<=end);
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
   const requester=name(db,o.requestedBy||db.people.find(p=>p.role==='admin').id);
   open('Roosterwijziging','<p>'+h(dateLabel(o.row.date))+'</p><p>'+h('Je bent beschikbaar '+clock(o.availability||o.fallback)+'. '+requester+' vraagt of je '+clock(o.row)+' kunt werken.')+'</p><p>'+h('Je dienst blijft '+clock(o.fallback)+' totdat je accepteert.')+'</p>'+form('yes','','Ja, '+clock(o.row),id)+form('no','','Nee, behoud '+clock(o.fallback),id));return;
  }
  open('Dienstvoorstel','<p>'+h(name(db,o.row.user)+' · '+dateLabel(o.row.date)+' · '+clock(o.row)+(o.row.deadline?' · Stand-by · Bericht vóór '+o.row.deadline:''))+'</p>'+form('yes','','Accepteren',id)+form('no','','Afwijzen',id)+(o.turn==='employee'?form('counter',times(o.row),'Andere tijden voorstellen',id):''));return;
 }
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
function suggestWindow(fill){
 const f=modal.querySelector('form'), user=f.elements.user.value,date=f.elements.date.value;
 const rule=ruleFor(db,{user,date});
 const question=!f.dataset.id&&needsQuestion(db,{user,date,start:f.elements.start.value,end:f.elements.end.value});
 f.querySelector('.primary').textContent=question?'Vraag versturen':'Concept bewaren';
 modal.querySelector('h2').textContent=question?'Vragen om te werken':'Dienst inplannen';
 modal.querySelector('#window').textContent=rule?(rule.off?'Niet beschikbaar':rule.start==='00:00'&&rule.end==='23:59'?'Hele dag (08:30–18:00)':'Beschikbaar '+clock(rule)):'Geen beschikbaarheid opgegeven';
 if(fill&&rule&&!rule.off){f.elements.start.value=rule.start==='00:00'?'10:00':rule.start;f.elements.end.value=rule.end==='23:59'?'18:00':rule.end;}
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
 if(el.name==='date')lateNotice();if(el.name==='mode')toggleTimes();if(el.name==='user')suggestWindow(true);if(['start','end'].includes(el.name)&&modal.querySelector('#window'))suggestWindow(false);
});
modal.addEventListener('submit',e=>{
 e.preventDefault();const f=e.target,p=Object.fromEntries(new FormData(f));let op=f.dataset.op;p.id=f.dataset.id;
 if(op==='draft')p.user=f.elements.user.value;
 if(p.mode==='from')p.end='18:00';if(p.mode==='until')p.start='08:30';p.off=p.mode==='off';
 if(op==='accept'||op==='reject'){p.accept=op==='accept';op='decide';p.choices=Object.fromEntries(Object.entries(snapshots).map(([id,before])=>[id,{before,value:p['choice-'+id]}]));}
 if(op==='publish'){p.date=p.id;p.confirm=Boolean(p.confirm)}
 if(['yes','no','counter'].includes(op)){p.answer=op;op='offer'}
 save(op,p);
});
window.addEventListener('storage',render);render();
