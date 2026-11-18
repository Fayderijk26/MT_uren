import {availabilityDialog} from './dialogs-availability.js';
import {planningDialog} from './dialogs-planning.js';
import {contactButtons} from './contacts.js';
import {hoursDialog} from './dialogs-hours.js';
import {adminDialog} from './dialogs-admin.js';
import {managePage} from './manage.js';
import {storageKey,read,write as persist} from './storage.js';
import {opening,wholeDay} from './settings.js';
import {calendarPage,dayContent} from './calendar.js';
import {ic} from '../ui.js';
import {availability,weekPage} from './week.js';
import {fallbackShift,weeklyConflicts,needsQuestion,ruleFor,today,add,available,affected,remaining,apply,minutes} from './model.js';
import {h,button,form,field,pauseField,select,times,clock,dateLabel,labels,name,weekNames,requestName,duration,chip} from './view.js';
import {todayPage} from './today.js';
import {availabilityPage} from './availability.js';
import {rosterPage} from './roster.js';
import {hoursPage} from './hours.js';

const key=storageKey,modal=document.querySelector('#dialog');
let returnRequest=null;
let db=read(), actorId=sessionStorage.getItem('pilot-person')||'eva', snapshots={};
const view={page:'today',day:today(),month:today().slice(0,7)};
const pages={today:'Vandaag',mine:'Mijn rooster',hours:'Gewerkte uren',availability:'Vrij & beschikbaarheid',team:'Teamrooster',reviews:'Uren goedkeuren',requests:'Aanvragen beoordelen',manage:'Medewerkers'};
function render(){
 db=read();
 let actor=db.people.find(p=>p.id===actorId&&p.active!==false);
 if(!actor){actor=db.people.find(p=>p.active!==false);actorId=actor.id;}
 const nav=['today',actor.role==='employee'?'mine':'team','hours','availability',...(actor.role!=='employee'?['manage']:[])];
 view.compact=window.matchMedia('(max-width: 700px)').matches;
 const page=view.page;
 const body=page==='manage'?managePage(db,actor):page==='mine'?calendarPage(db,actor,view):page==='team'&&actor.role!=='employee'?weekPage(db,view,actor.role!=='admin',actor):page==='today'?todayPage(db,actor):['mine','team'].includes(page)?rosterPage(db,actor,view):['hours','reviews'].includes(page)?hoursPage(db,actor,view):availabilityPage(db,actor,view);
 document.querySelector('#app').innerHTML='<header class="vheader"><img src="./assets/logo.webp" alt="Monkey Town"><label>Demoprofiel <select id="profile">'+db.people.filter(p=>p.active!==false).map(p=>'<option value="'+p.id+'" '+(p.id===actorId?'selected':'')+'>'+h(p.name)+' · '+({admin:'Bedrijfsleider',lead:'Dagleiding',employee:'Medewerker'}[p.role])+'</option>').join('')+'</select></label></header><nav class="vnav" aria-label="Hoofdmenu">'+nav.map(k=>'<button data-act="page" data-id="'+k+'" aria-current="'+(page===k?'page':'false')+'">'+ic(({today:'home',team:'calendar',mine:'calendar',hours:'clock',availability:'calendar',manage:'users'})[k],16)+(k==='hours'&&actor.role!=='employee'?'Uren':pages[k])+'</button>').join('')+'</nav><main id="main" class="shell vmain">'+body+'</main>';
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
 const actor=db.people.find(p=>p.id===actorId),ctx={db,actor,action,id,open,modal,view};
 if(hoursDialog(ctx)||adminDialog(ctx)||planningDialog({...ctx,show,suggestWindow})||availabilityDialog({...ctx,show,toggleTimes,lateNotice,setSnapshots:value=>{snapshots=value;}})){updateNet();return;}
 if(action==='hoursTab'){view.hoursTab=id;view.page='hours';render();return;}
 if(action==='missingPage'){view.hoursTab='missing';view.page='hours';render();return;}
 if(action==='step'){const [key,step]=id.split('|'),input=modal.querySelector('[name='+key+']');const n=Math.max(0,Math.min(1425,minutes(input.value||'00:00')+Number(step)));input.value=String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');updateNet();return;}

 if(action==='pause'){
  const input=modal.querySelector('[name=pause]');
  if(id==='other'){input.focus();input.select()}else input.value=id;
  modal.querySelectorAll('[data-act=pause]').forEach(b=>b.classList.toggle('primary',b.dataset.id===id));
  updateNet();return;
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
 if(action==='availabilityDetail'){
  const [date,user]=id.split('|');open(name(db,user)+' · '+dateLabel(date),'<p>'+h(availability(db,user,date))+'</p>'+(actor.role==='admin'&&date>=today()?button('Inplannen','planExtra',id,true):'')+contactButtons(db,actor,user));return;
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
  body+=contactButtons(db,actor,row.user);
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
 if(action==='page'){view.page=id;if(id==='reviews')view.hoursTab='pending';render();window.scrollTo(0,0);return}
 if(action==='close'){modal.close();if(returnRequest){const id=returnRequest;returnRequest=null;show('decision',id)}return}
 if(action==='approve'||action==='seen'){save(action,{id});return}

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
 modal.querySelector('#window').textContent=rule?(rule.off?'Niet beschikbaar':wholeDay(db,{...rule,date})?'Hele dag ('+clock(opening(db,date))+')':'Beschikbaar '+clock(rule)):'Geen beschikbaarheid opgegeven';
 if(fill&&rule&&!rule.off){f.elements.start.value=rule.start;f.elements.end.value=rule.end;}
}
async function save(op,p,sourceForm){
 try{
  const write=()=>{
   let next=apply(read(),actorId,op,p);
   if(op==='draft'&&returnRequest)next=apply(next,actorId,'publish',{date:p.date,through:p.date,onlyId:p.id,confirm:true});
   persist(next);
  };
  if(navigator.locks)await navigator.locks.request(key,write);else write();
  if(modal.open)modal.close();render();
  if(op==='draft'&&returnRequest){const id=returnRequest;returnRequest=null;show('decision',id)}
  if(op==='generate'){const result=read().generation;open('Conceptweek klaar','<p>'+result.created+' conceptdiensten toegevoegd.</p><p>'+result.skipped.length+' overgeslagen.</p>'+result.skipped.map(x=>'<p>'+h(x)+'</p>').join(''));}
 }catch(e){showError(e,sourceForm);}
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(b)show(b.dataset.act,b.dataset.id)});
document.addEventListener('change',e=>{
 const el=e.target;if(el.id==='profile'){actorId=el.value;sessionStorage.setItem('pilot-person',actorId);view.page='today';render()}
 if(el.dataset.view&&el.value){view[el.dataset.view]=el.value;render()}
 updateNet();if(el.name==='date')lateNotice();if(el.name==='mode')toggleTimes();if(el.name==='user')suggestWindow(true);if(['start','end'].includes(el.name)&&modal.querySelector('#window'))suggestWindow(false);
});
modal.addEventListener('submit',e=>{
 e.preventDefault();const f=e.target,p=Object.fromEntries(new FormData(f));let op=f.dataset.op;p.id=f.dataset.id;
 if(op==='draft')p.user=f.elements.user.value;
 const window=opening(db,op==='weekly'?Number(p.weekday):p.date||today());
 if(p.mode==='from')p.end=window.end;if(p.mode==='until')p.start=window.start;p.off=p.mode==='off';
 if(op==='accept'||op==='reject'){p.accept=op==='accept';op='decide';p.choices=Object.fromEntries(Object.entries(snapshots).map(([id,before])=>[id,{before,value:p['choice-'+id]}]));}
 if(op==='publish'){p.date=p.id;p.confirm=Boolean(p.confirm)}
 if(['yes','no','counter'].includes(op)){p.answer=op;op='offer'}
 save(op,p,f);
});
function updateNet(){
 const output=modal.querySelector('#net-preview');if(!output)return;
 const start=modal.querySelector('[name=start]').value,end=modal.querySelector('[name=end]').value,pause=Number(modal.querySelector('[name=pause]').value||0);
 const gross=minutes(end)-minutes(start);output.textContent=start&&end&&gross>0?'Netto '+duration(Math.max(0,gross-pause)):'Kies begin- en eindtijd.';
 const warning=modal.querySelector('#pause-warning');warning.hidden=!(gross>=330&&modal.querySelector('[name=pause]').value==='0');
 warning.textContent='Je dienst was '+duration(gross)+'. Klopt het dat je geen pauze hebt gehad? Je kunt deze uren gewoon indienen.';
}
function showError(error,sourceForm){
 const form=sourceForm||modal.querySelector('form');
 if(!modal.open||!form){open('Controleer de gegevens','<p>'+h(error.message)+'</p>');return;}
 form.querySelectorAll('.field-error').forEach(el=>el.remove());
 form.querySelectorAll('[aria-invalid]').forEach(el=>el.removeAttribute('aria-invalid'));
 const key=error.field||(/pauze/i.test(error.message)?'pause':/reden/i.test(error.message)?'reason':/overlap|tijd/i.test(error.message)?'start':/naam/i.test(error.message)?'name':/telefoon/i.test(error.message)?'phone':/mail/i.test(error.message)?'email':/contract/i.test(error.message)?'weeklyHours':'');
 const input=key?form.elements[key]:null;
 if(input){input.setAttribute('aria-invalid','true');const msg=document.createElement('p');msg.className='field-error';msg.setAttribute('role','alert');msg.textContent=error.message;input.closest('label').append(msg);input.focus();}
 else{const msg=form.querySelector('.err');form.prepend(msg);msg.textContent=error.message;}
}
modal.addEventListener('input',updateNet);
window.matchMedia('(max-width: 700px)').addEventListener('change',render);
window.addEventListener('storage',render);render();
