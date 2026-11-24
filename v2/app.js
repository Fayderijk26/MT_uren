import {pilotRoster,migratePilot} from './pilot.js';
import {calendarPage} from './calendar.js';
import {ic} from '../ui.js';
import {weekPage} from './week.js';
import {needsQuestion,ruleFor,today,add,apply,minutes,badges,pauseFor,pauseQuestion,dayTimes,
 weekTimes,needsInstead} from './model.js';
import {h,button,clock,duration,badge,roleNames,areaChoice,name} from './view.js';
import {todayPage} from './today.js';
import {peoplePage,rosterTabs} from './people.js';
import {availabilityPage} from './availability.js';
import {rosterPage} from './roster.js';
import {hoursPage} from './hours.js';
import {monthPage,exportData} from './month.js';
import {dialogs} from './dialogs.js';

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
 data.normOverrides??=[];data.closedMonths??=[];data.monthReopens??=[];data.saldoCorrections??=[];
 data.leaveCorrections??=[];data.days??=[];data.weeklies??=[];
 for(const p of data.people){
  p.contractHours??=pilotRoster().people.find(x=>x.id===p.id)?.contractHours;
  p.contract??=pilotRoster().people.find(x=>x.id===p.id)?.contract||(p.contractHours>0?'vast':'uren');
  p.active??=true;p.phone??='';p.areas??=pilotRoster().people.find(x=>x.id===p.id)?.areas||['Vloer'];
 }
 // Ronde 10: Mieke (leiding zonder urenregistratie) ontbreekt in oudere demogegevens; zet haar erbij met haar diensten.
 if(!data.people.some(p=>p.id==='mieke')){
  const fresh=pilotRoster(),own=x=>x.user==='mieke';
  data.people.push(fresh.people.find(p=>p.id==='mieke'));
  data.rules.push(...fresh.rules.filter(own));data.shifts.push(...fresh.shifts.filter(own));
 }
 // Oude werkplekken (Speelvloer, Dagleiding, ...): de werkplek van die medewerker, Keuken blijft Keuken als dat kan.
 for(const s of [...data.shifts,...data.drafts,...data.offers.map(o=>o.row)]){
  const own=data.people.find(p=>p.id===s.user)?.areas||['Vloer'];
  if(!own.includes(s.area))s.area=own[0];
 }
 if(JSON.stringify(data)!==stored)localStorage.setItem(key,JSON.stringify(data));
 return data;
};
// Een dienst aanpassen vanuit een aanvraag: daarna gaat het venster terug naar die aanvraag.
let returnRequest=null;
function backToRequest(){
 if(!returnRequest)return;
 const id=returnRequest;returnRequest=null;show('decision',id);
}
let db=read(), actorId=sessionStorage.getItem('pilot-person')||'eva';
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
  :page==='team'&&staff?rosterTabs(actor,'team')+weekPage(db,view,!admin,actor)
  :page==='people'&&admin?peoplePage(db,actor)
  :page==='today'?todayPage(db,actor)
  :['mine','team'].includes(page)?rosterPage(db,actor,view)
  :['hours','reviews'].includes(page)?hoursPage(db,actor,view)
  :page==='month'&&admin?monthPage(db,actor,view)
  :availabilityPage(db,actor,view);
 document.querySelector('#app').innerHTML='<header class="vheader"><img src="./assets/logo.webp" alt="Monkey Town">'
  +profilePicker()+'</header><nav class="vnav" aria-label="Hoofdmenu">'+tabBar(actor,nav,page)+'</nav>'
  +'<main id="main" class="shell vmain">'+body+'</main>';
}
// Demo: kiezen als wie je de app bekijkt. Verdwijnt als er echt ingelogd wordt (ronde 8).
function profilePicker(){
 const option=p=>'<option value="'+p.id+'" '+(p.id===actorId?'selected':'')+'>'+name(db,p.id)+' · '+roleNames[p.role]
  +'</option>';
 const people=db.people.filter(p=>p.active!==false||p.id===actorId);
 return '<label>Demoprofiel <select id="profile">'+people.map(option).join('')+'</select></label>';
}
function open(title,content){
 modal.innerHTML='<div class="modalhead"><h2>'+h(title)+'</h2>'+button('Sluiten','close')+'</div>'+content;
 modal.setAttribute('aria-label',title);
 if(!modal.open)modal.showModal();
}
// Na het openen van een venster: velden die op elkaar reageren.
const fillAvailability=()=>{toggleTimes();lateNotice()};
function fillDraft(id){
 if(db.shifts.some(s=>s.id===id))modal.querySelector('[name=user]').disabled=true;
 suggestWindow(!db.drafts.some(s=>s.id===id)&&!db.shifts.some(s=>s.id===id));
}
const afterOpen={entry:showNet,inspect:showNet,unplanned:showNet,leave:fillAvailability,weekly:fillAvailability,
 extra:fillAvailability,draft:fillDraft,newDraft:fillDraft};
// Een knop met data-act: een venster openen (dialogs.js), of iets in de schil doen.
function show(action,id){
 db=read();
 if(dialogs[action]){
  const dialog=dialogs[action](db,db.people.find(p=>p.id===actorId),id);
  if(dialog){open(dialog.title,dialog.body);afterOpen[action]?.(id)}
  return;
 }
 if(action==='pause'){choosePause(id);return}
 if(action==='pauseOk'){
  const f=modal.querySelector('#pausecheck').closest('form');f.elements.pauseOk.value='1';f.requestSubmit();return;
 }
 if(action==='reveal'){
  const box=modal.querySelector('#'+id);box.hidden=false;box.querySelector('select,input')?.focus();return;
 }
 if(action==='askChange'||action==='askReject'){
  const box=modal.querySelector('#'+action);box.hidden=false;box.querySelector('[name=reason]').focus();return;
 }
 if(action==='calendarMode'){view.calendarMode=id;render();return}
 if(action==='calendarMove'){view.calendarDate=movedDate(id);render();return}
 if(action==='requestShift'){
  const [requestId,shiftId]=id.split('|');returnRequest=requestId;show('draft',shiftId);return;
 }
 if(action==='week'||action==='day'){view.day=id;view.single=action==='day';render();return}
 if(action==='page'){view.page=id;render();window.scrollTo(0,0);return}
 if(action==='close'){modal.close();backToRequest();return}
 if(action==='approve'||action==='seen'){save(action,{id});return}
 if(action==='weeklyRead'){save('weeklyRead',{week:id});return}
 if(action==='sickPaid'||action==='sickUnpaid'){save('sickDecide',{id,paid:action==='sickPaid'});return}
 if(action==='reactivate'){save('setActive',{id,active:true});return}
 if(action==='export'){exportMonthFile(view.month,id);return}
 if(action==='planExtra'){
  const [date,user]=id.split('|');show('newDraft',date);
  modal.querySelector('[name=user]').value=user;pickArea();suggestWindow(true);
 }
}
// Kalender een week of maand verder of terug; 0 is terug naar vandaag.
function movedDate(step){
 const date=view.calendarDate||today();
 if(step==='0')return today();
 if(view.calendarMode==='week')return add(date,Number(step)*7);
 const d=new Date(date.slice(0,7)+'-01T12:00Z');d.setUTCMonth(d.getUTCMonth()+Number(step));
 return d.toISOString().slice(0,10);
}
function lateNotice(){
 const el=modal.querySelector('#late');
 const late=el&&modal.querySelector('[name=date]').value<add(today(),21);
 if(el)el.textContent=late?'Je vraagt minder dan drie weken van tevoren vrij. Je aanvraag wordt wel verstuurd.':'';
}
// Weekly-afbeelding (ronde 14): verkleinen tot maximaal 1000 pixels breed, als JPEG, zodat hij klein blijft.
function shrinkImage(input){
 const file=input.files[0],target=input.form.elements.image;
 target.value='';
 if(!file)return;
 input.dataset.busy='1';
 const img=new Image(),url=URL.createObjectURL(file);
 img.onload=()=>{
  const scale=Math.min(1,1000/img.width),c=document.createElement('canvas');
  c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);
  c.getContext('2d').drawImage(img,0,0,c.width,c.height);
  target.value=c.toDataURL('image/jpeg',0.75);URL.revokeObjectURL(url);delete input.dataset.busy;
 };
 img.onerror=()=>{delete input.dataset.busy;input.value='';open('Afbeelding','<p>Dit bestand kan niet worden gelezen.'
  +' Kies een foto of plaatje.</p>')};
 img.src=url;
}
// Oproepkracht vraagt vrij op een vaste dag (ronde 13): eerst de vraag tonen; daarna de andere dagen meesturen.
function askInstead(p){
 const box=modal.querySelector('#instead');
 for(const k of Object.keys(p))if(/^(idate|istart|iend)\d$/.test(k)||k==='insteadAsk')delete p[k];
 if(!box||!needsInstead(db,actorId,p.date,p.through||p.date))return true;
 if(box.hidden){box.hidden=false;box.scrollIntoView({block:'center'});return false}
 const ask=box.querySelector('[name=insteadAsk]').value,v=n=>box.querySelector('[name='+n+']').value;
 if(ask==='nee')p.instead='nee';
 if(ask==='ja')p.instead=[0,1,2].filter(i=>v('idate'+i))
  .map(i=>({date:v('idate'+i),start:v('istart'+i),end:v('iend'+i)}));
 return true;
}
function toggleTimes(){
 const mode=modal.querySelector('[name=mode]').value;
 modal.querySelector('#wish')?.toggleAttribute('hidden',['all','off'].includes(mode));
 for(const [n,show] of [['start',['from','range'].includes(mode)],['end',['until','range'].includes(mode)]]){
  const el=modal.querySelector('[name='+n+']');el.closest('label').hidden=!show;el.required=show;el.disabled=!show;
 }
}
// Medewerker in het conceptformulier gewijzigd: de werkplekknoppen passen zich aan.
function pickArea(){
 const box=modal.querySelector('#areapick');
 if(box)box.innerHTML=areaChoice(db,modal.querySelector('[name=user]').value);
}
function suggestWindow(fill){
 const f=modal.querySelector('form'), user=f.elements.user.value,date=f.elements.date.value;
 const rule=ruleFor(db,{user,date});
 const question=!f.dataset.id&&needsQuestion(db,{user,date,start:f.elements.start.value,end:f.elements.end.value});
 f.querySelector('.primary').textContent=question?'Vraag versturen':'Concept bewaren';
 modal.querySelector('h2').textContent=question?'Vragen om te werken':'Dienst inplannen';
 const whole=rule?.start==='00:00'&&rule?.end==='23:59';
 modal.querySelector('#window').textContent=!rule?'Geen beschikbaarheid opgegeven':rule.off?'Niet beschikbaar'
  :whole?'Hele dag ('+clock(dayTimes(date))+')':'Beschikbaar '+clock(rule);
 if(fill&&rule&&!rule.off){
  f.elements.start.value=rule.start==='00:00'?'10:00':rule.start;
  f.elements.end.value=rule.end==='23:59'?dayTimes(date).end:rule.end;
 }
}
// Pauze kiezen: knop kleuren en het verborgen veld zetten. Zelf kiezen zet het meebewegen uit (SPEC 9c).
function choosePause(id,byHand=true){
 const field=modal.querySelector('[name=pause]'),other=modal.querySelector('[name=pauseOther]');
 modal.querySelector('#pauseother').hidden=id!=='other';
 field.value=id==='other'?other.value:id;
 if(byHand){delete field.dataset.auto;if(id==='other')other.focus()}
 modal.querySelectorAll('[data-act=pause]').forEach(b=>{b.classList.toggle('primary',b.dataset.id===id);
  b.classList.toggle('secondary',b.dataset.id!==id)});
 showNet();
}
// Nieuwe tijden: de pauze volgt de pauzeregel, zolang er niet zelf een pauze is gekozen.
function followPause(){
 const field=modal.querySelector('[name=pause][data-auto]');if(!field)return;
 const {start,end}=field.form.elements;
 if(start.value&&end.value&&end.value>start.value)
  choosePause(String(pauseFor(minutes(end.value)-minutes(start.value))),false);
}
// Regel met netto uren onder de pauze, bijgewerkt bij elke keuze. Een wijziging haalt de pauzevraag weg.
function showNet(){
 const check=modal.querySelector('#pausecheck');
 if(check){check.hidden=true;check.closest('form').elements.pauseOk.value=''}
 const el=modal.querySelector('#net');if(!el)return;
 const f=el.closest('form'),[start,end,pause]=['start','end','pause'].map(n=>f.elements[n].value);
 if(!start||!end||pause===''||end<=start){el.textContent='Netto: kies begin, eind en pauze.';return}
 const net=minutes(end)-minutes(start)-Number(pause);
 el.textContent=net>0?'Netto '+duration(net):'Controleer de pauze.';
}
// kind: 'pay' (loonadministratie) of 'full' (uitgebreid), zie SPEC 9h.
async function exportMonthFile(month,kind){
 try{
  const {exportMonth}=await import('../excel/roster.js');
  await exportMonth(month,exportData(db,month)[kind]);
 }catch(e){open('Export mislukt','<p>'+h(e.message)+'</p>')}
}
async function save(op,p){
 try{
  const write=()=>{
   let next=apply(read(),actorId,op,p);
   // Dienst aangepast vanuit een aanvraag: meteen publiceren, daarna terug naar de aanvraag.
   if(op==='draft'&&returnRequest)next=apply(next,actorId,'publish',
    {date:p.date,through:p.date,onlyId:p.id,confirm:true});
   localStorage.setItem(key,JSON.stringify(next));
  };
  if(navigator.locks)await navigator.locks.request(key,write);else write();
  if(modal.open)modal.close();render();
  if(op==='draft')backToRequest();
 }catch(e){
  const el=modal.open?modal.querySelector('.err'):null;
  if(el)el.textContent=e.message;else open('Controleer de gegevens','<p>'+h(e.message)+'</p>');
 }
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(b)show(b.dataset.act,b.dataset.id)});
document.addEventListener('change',e=>{
 const el=e.target,time=['start','end'].includes(el.name);
 if(el.id==='profile'){actorId=el.value;sessionStorage.setItem('pilot-person',actorId);view.page='today';render()}
 if(el.dataset.view&&el.value){view[el.dataset.view]=el.value;render()}
 if(el.name==='date')lateNotice();
 if(el.name==='mode')toggleTimes();
 if(el.name==='user'){pickArea();suggestWindow(true)}
 if(time&&modal.querySelector('#window'))suggestWindow(false);
 if(time){followPause();showNet()}
});
// Extra beschikbaarheid: de tijden alleen tonen bij Andere tijden.
document.addEventListener('change',e=>{
 if(e.target.name==='whole')modal.querySelector('#extratimes').hidden=e.target.value==='whole';
 // Dag instellen (ronde 12): alleen de tijden bij aangepaste openingstijden, alleen Doorbetalen bij dicht.
 if(e.target.name==='status'&&modal.querySelector('#dayhours')){
  modal.querySelector('#dayhours').hidden=e.target.value!=='hours';
  modal.querySelector('#daypaid')?.toggleAttribute('hidden',e.target.value!=='closed');
 }
 if(e.target.name==='imagefile')shrinkImage(e.target);
 if(e.target.name==='insteadAsk')modal.querySelector('#insteadrows').hidden=e.target.value!=='ja';
 if(e.target.name==='special'&&modal.querySelector('#specialother')){
  const other=e.target.value==='anders',box=modal.querySelector('#specialother');
  box.hidden=!other;box.querySelector('input').required=other;
 }
 if(e.target.name==='type'&&modal.querySelector('#special')){
  const box=modal.querySelector('#special'),why=box.querySelector('[name=specialReason]');
  box.hidden=e.target.value!=='bijzonder';
  why.required=!box.hidden&&box.querySelector('[name=special]').value==='anders';
 }
});
document.addEventListener('input',e=>{
 if(e.target.name!=='pauseOther')return;
 modal.querySelector('[name=pause]').value=e.target.value;showNet();
});
// Vrij goedkeuren: per dienst de keuze (choice-id) en de dienst zoals hij was toen het venster openging (before-id).
const shiftChoices=p=>Object.fromEntries(Object.keys(p).filter(k=>k.startsWith('before-')).map(k=>k.slice(7))
 .map(id=>[id,{before:p['before-'+id],value:p['choice-'+id]}]));
modal.addEventListener('submit',e=>{
 e.preventDefault();const f=e.target,p=Object.fromEntries(new FormData(f));let op=f.dataset.op;p.id=f.dataset.id;
 delete p.pauseOther;
 // Weekly (ronde 14): de verkleinde afbeelding staat in image; leeg = niets veranderen, tenzij weghalen.
 if('imagefile' in p){
  delete p.imagefile;
  if(p.noImage)p.image='';else if(!p.image)delete p.image;
  delete p.noImage;
 }
 if(op==='weeklySave')p.week=p.id;
 if(f.elements.imagefile?.dataset.busy){open('Even geduld','<p>De afbeelding wordt nog verwerkt.</p>');return}
 if('pauseOk' in p){
  const question=p.pauseOk?'':pauseQuestion(p.start,p.end,p.pause);delete p.pauseOk;
  const box=modal.querySelector('#pausecheck');
  if(question){box.querySelector('p').textContent=question;box.hidden=false;return}
 }
 if(op==='draft')p.user=f.elements.user.value;
 // Vanaf of tot: het andere einde is de standaard werkdag van die dag (bij vaste beschikbaarheid: die weekdag).
 const std=op==='weekly'?weekTimes(p.weekday):dayTimes(p.date||today());
 if(p.mode==='from')p.end=std.end;if(p.mode==='until')p.start=std.start;p.off=p.mode==='off';
 if(op==='accept'||op==='reject'){p.accept=op==='accept';op='decide';p.choices=shiftChoices(p)}
 if(op==='publish'){p.date=p.id;p.confirm=Boolean(p.confirm)}
 if(op==='approveAll')p.ids=p.ids.split(',');
 if(op==='sickMany')p.ids=new FormData(f).getAll('ids');
 if(op==='planFromRules')p.week=p.id;
 if(op==='setActive')p.active=p.active==='true';
 if(op==='savePerson'){p.areas=new FormData(f).getAll('areas');p.tracksHours=p.tracksHours!=='no';
  p.fixed=new FormData(f).getAll('fixed')}
 if(op==='planExtra'||op==='declineExtra')[p.user,p.date]=p.id.split('|');
 if(op==='saldoReset'||op==='leaveSet')p.user=p.id;
 if(op==='setDay')p.date=p.id;
 if(op==='setNorm'){p.user=p.id;p.month=view.month;p.minutes=Math.round(Number(p.hours)*60)}
 if(op==='closeMonth'||op==='reopenMonth'){p.month=p.id;p.confirm=Boolean(p.confirm)}
 if(['yes','no','counter'].includes(op)){p.answer=op;op='offer'}
 if(op==='leave'&&!askInstead(p))return;
 save(op,p);
});
window.addEventListener('storage',render);render();
