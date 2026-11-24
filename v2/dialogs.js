// De vensters (dialogen) van de app. Elk venster is een functie (db, wie, id) die {title, body} teruggeeft,
// of null als er niets te tonen is. Ze maken alleen HTML: de regels staan in model.js, de schil in app.js.
import {weeklyConflicts,needsQuestion,today,add,available,affected,remaining,TIMES,mayReopen,warnings,closed,
 asPlanned,activePeople,futureShifts,AREAS,absentMinutes,tracksHours,fallbackShift,sickable,pauseFor,
 minutes,dayOf,mayEnter,missing,saldo,vacationLeft,leaveDays,dayTimes,dayInfo,closedPeople,ruleFor,weekday,
 weekTimes} from './model.js';
import {h,button,form,field,pauseField,select,times,clock,dateLabel,name,weekNames,requestName,approvalText,
 duration,chip,requestLength,line,roleNames,areaChoice,sickButton,sickAskBody,leaveTypeField,sickStatus,
 sickDecision} from './view.js';
import {dayContent} from './calendar.js';
import {availability} from './week.js';
import {closeMonthBody} from './month.js';

const shiftOf=(db,id)=>db.shifts.find(s=>s.id===id);
const reason=(required=false)=>field(required?'Reden':'Toelichting (optioneel)','reason','text','',
 required?'required':'');
// Ziek gemeld: wie het meldde, wanneer, en of het meetelt. De bedrijfsleider ziet de knoppen voor het besluit.
export const sickText=(db,s,actor)=>'<p>'+chip('sick')+' door '+h(name(db,s.sick.by))+' op '
 +h(dateLabel(dayOf(s.sick.at)))+' · '+h(sickStatus(s))+'</p>'
 +(actor&&!closed(db,s.date)&&sickDecision(db,actor,s)?'<div class="vactions">'+sickDecision(db,actor,s)+'</div>':'');

// Een dag in Mijn rooster: wat er die dag staat, en vanaf vandaag Vrij vragen en Beschikbaarheid opgeven.
function calendarDay(db,actor,day){
 const item=i=>'<p>'+h(i.text)+'</p>'+(i.shift?button('Dienst bekijken','ownShift',i.shift.id)
  :i.offer?.turn==='employee'?button('Reageren','proposal',i.offer.id):'');
 let body=dayContent(db,actor.id,day).map(item).join('');
 if(day>=today())body+=(tracksHours(db,actor.id)?button('Vrij vragen','leave',day):'')
  +button('Beschikbaarheid opgeven','extra',day);
 return {title:dateLabel(day),body};
}

// Mijn dienst: wanneer, beschikbaarheid, ziek gemeld, en de knoppen Gewerkte uren en Ziek melden.
function ownShift(db,actor,id){
 const shift=shiftOf(db,id);
 const canEnter=shift.date<=today()&&!shift.deadline&&!shift.sick&&tracksHours(db,actor.id);
 const body='<p>'+h(dateLabel(shift.date)+' · '+clock(shift)+' · '+shift.area)+'</p>'
  +'<p>Aangegeven beschikbaarheid: '+h(availability(db,actor.id,shift.date))+'</p>'
  +(shift.sick?sickText(db,shift,actor):'')
  +(canEnter?button('Gewerkte uren','entry',id):'')
  +sickButton(db,actor,shift);
 return {title:'Mijn dienst',body};
}

// Dienst in het teamrooster. De bedrijfsleider ziet ook het concept en kan wijzigen, toevoegen en stand-by afhandelen.
function shiftDetails(db,actor,id){
 const admin=actor.role==='admin',draft=db.drafts.find(s=>s.id===id),entry=db.hours[id];
 const row=admin?draft||shiftOf(db,id):shiftOf(db,id);
 if(!row)return null;
 const status=admin&&draft?'Conceptdienst':row.sick?'Ziek gemeld':'Ingepland';
 const known=availability(db,row.user,row.date);
 let body='<p>'+status+' van <strong>'+h(row.start)+' tot '+h(row.end)+'</strong></p>'
  +'<p>Aangegeven beschikbaarheid: '+h(known==='Onbekend'?'Geen beschikbaarheid opgegeven':known)+'</p>';
 if(row.deadline)body+='<p><b class="sb">SB</b> · Bericht vóór '+h(row.deadline)+'</p>';
 if(row.sick)body+=sickText(db,row,actor);
 if(!draft)body+=sickButton(db,actor,row);
 if(admin&&entry)body+=button('Uren bekijken','inspect',id);
 if(admin&&row.date>=today()){
  if(!entry&&!row.sick)body+=button('Dienst wijzigen','draft',id,true);
  body+=button('Extra dienst toevoegen','planExtra',row.date+'|'+row.user);
 }
 if(admin&&!draft&&row.deadline)body+=button('Stand-by afhandelen','standby',id);
 return {title:name(db,row.user)+' · '+dateLabel(row.date),body};
}

// Stand-by afhandelen: oproepen (met tijden) of niet nodig.
function standby(db,actor,id){
 const shift=shiftOf(db,id);
 const body='<p>'+h(name(db,shift.user))+' · Bericht vóór '+h(shift.deadline)+'</p>'
  +form('call',times(shift),'Oproepen',id)+form('release','','Niet nodig',id);
 return {title:'Stand-by',body};
}

// Beoordelen: eerst alleen de keuzes; het verplichte veld Reden verschijnt pas na Aanpassen vragen of Afwijzen.
function reviewChoices(shift){
 const id=shift.id,reject=shift.unplanned;
 const choices=button('Goedkeuren','approve',id,true)+button('Aanpassen vragen','askChange',id)
  +(reject?button('Afwijzen','askReject',id):'');
 const ask='<div id="askChange" hidden>'+form('return',reason(true),'Versturen',id)+'</div>';
 const no=reject?'<div id="askReject" hidden>'+form('rejectHours',reason(true),'Afwijzen versturen',id)+'</div>':'';
 return '<div class="vactions">'+choices+'</div>'+ask+no;
}
// Uren invullen (entry) of bekijken en beoordelen (inspect).
function hoursDialog(db,actor,id,action){
 const shift=shiftOf(db,id),entry=db.hours[id];
 const editable=action==='entry'&&mayEnter(db,actor,shift);
 let body='<p>'+h(name(db,shift.user)+' · '+dateLabel(shift.date))+'</p>'
  +'<p>Gepland '+clock(shift)+' · '+h(shift.area)+'</p>';
 if(shift.sick)body+=sickText(db,shift,actor);
 if(entry)body+='<p>'+chip(entry.status)+' '+clock(entry)+' · '+entry.pause+' min pauze</p>';
 if(entry?.reason)body+='<p>'+h(entry.reason)+'</p>';
 if(closed(db,shift.date))body+='<p class="notice">Deze maand is afgesloten.</p>';
 if(approvalText(db,entry))body+='<p>'+h(approvalText(db,entry))+'</p>';
 if(action==='inspect')body+=warnings(db,shift).map(w=>'<p class="notice">Let op: '+h(w)+'</p>').join('');
 const pause=entry?pauseField(entry.pause):pauseField(pauseFor(minutes(shift.end)-minutes(shift.start)),true);
 if(editable)body+=form('hours',times(entry||shift)+pause,'Uren indienen',id);
 if(action==='inspect'&&entry?.status==='pending')body+=reviewChoices(shift);
 if(mayReopen(db,actor,shift))body+=form('reopen',reason(true),'Heropenen',id);
 return {title:editable?'Uren invullen':'Gewerkte uren',body};
}

// Ongeplande dienst: een gewerkte dag (vandaag of eerder) met tijden, pauze en werkplek.
function unplanned(db,actor){
 const date=field('Datum','date','date',today(),'required max="'+today()+'"');
 const body=date+times()+pauseField(0,true)+areaChoice(db,actor.id);
 return {title:'Ongeplande dienst',body:form('unplanned',body,'Uren indienen')};
}

// Ziek melden, of de ziekmelding intrekken.
function sickAsk(db,actor,id){
 const shift=shiftOf(db,id);
 return {title:'Ziek melden',body:sickAskBody(db,shift)};
}
function sickUndoAsk(db,actor,id){
 const shift=shiftOf(db,id);
 const what='<p><b>'+h(name(db,shift.user))+'</b><br>'+h(dateLabel(shift.date)+' · '+clock(shift))+'</p>';
 return {title:'Ziekmelding intrekken',body:what+form('sickUndo','','Ziekmelding intrekken',id)};
}

// Na de maand: de lege diensten van één persoon die de bedrijfsleider nog kan invullen (SPEC 9e).
function fillPick(db,actor,user){
 const days=missing(db,actor).map(m=>m.shift).filter(s=>s.user===user&&mayEnter(db,actor,s));
 const row=s=>'<div class="compact">'+line(dateLabel(s.date),clock(s),button('Uren invullen','entry',s.id))+'</div>';
 return {title:'Uren invullen voor '+name(db,user),body:'<p>Diensten die je leeg laat, tellen niet mee.</p>'
  +days.map(row).join('')};
}
// Meerdere ontbrekende dagen van één persoon ziek melden: per dag een vinkje, niets vooraf aangevinkt.
function sickPick(db,actor,user){
 const day=s=>'<label><input type="checkbox" name="ids" value="'+h(s.id)+'"> '
  +h(dateLabel(s.date)+' · '+clock(s)+' · telt '+duration(absentMinutes(s)))+'</label>';
 const days='<fieldset class="field areas picklist"><span>Welke dagen was '+h(name(db,user))+' ziek?</span>'
  +sickable(db,actor,user).map(day).join('')+'</fieldset>';
 return {title:'Ziek melden',body:form('sickMany',days,'Ziek melden')};
}

// Maandoverzicht: norm aanpassen, maand afsluiten en de noodknop maand heropenen.
function norm(db,actor,id){
 const body=field('Norm in uren','hours','number','','required min="0" step="0.25"')+reason(true);
 return {title:'Norm aanpassen · '+name(db,id),body:form('setNorm',body,'Norm opslaan',id)};
}
// Saldo plus- en minuren van één medewerker: de stand, de correcties, en op 0 zetten met reden (SPEC 9f).
function saldoDialog(db,actor,user){
 const own=saldo(db,user);
 if(own===null)return null;
 const fixes=db.saldoCorrections.filter(c=>c.user===user).map(c=>'<p>'+h(dateLabel(dayOf(c.at))+' · op 0 gezet door '
  +name(db,c.by)+' · '+c.reason)+'</p>').join('');
 const reset=own?form('saldoReset',reason(true),'Saldo op 0 zetten',user):'';
 return {title:'Saldo '+name(db,user),body:'<p>Saldo plus- en minuren: <b>'+h((own>0?'+':'')+duration(own))
  +'</b></p><p>Telt de afgesloten maanden. Zet het op 0 als het is uitbetaald of verrekend.</p>'+fixes+reset};
}
function closeMonth(db,actor,month){
 return {title:'Maand afsluiten',body:form('closeMonth',closeMonthBody(db,month),'Maand afsluiten',month)};
}
function reopenMonth(db,actor,month){
 const warn='<p class="notice">Alleen gebruiken als het echt nodig is. Dit wordt vastgelegd.</p>';
 return {title:'Noodknop: maand heropenen',body:form('reopenMonth',warn+reason(true),'Maand heropenen',month)};
}

// Gevolgen van een vaste-dagenaanvraag: diensten die buiten de nieuwe beschikbaarheid vallen.
function weeklyEffects(db,r){
 const conflicts=weeklyConflicts(db,r);
 const rows=conflicts.map(s=>'<p>'+h(dateLabel(s.date)+' · '+clock(s))+'</p>'
  +button('Dienst bekijken en aanpassen','requestShift',r.id+'|'+s.id)).join('');
 const keep=conflicts.length?'<label><input type="checkbox" name="keep" value="yes" required> Nieuwe beschikbaarheid'
  +' goedkeuren en deze '+conflicts.length+' diensten behouden</label>':'';
 return rows+keep;
}
// Gevolgen van vrij: per dienst kiezen wat er blijft. De dienst zoals hij nu is, gaat mee als controle (before-...).
function leaveEffects(db,r){
 return affected(db,r).map(s=>{
  const parts=remaining(s,r),opts=parts.map((t,i)=>[String(i),'Werken '+clock(t)]);
  if(parts.length===2)opts.unshift(['all','Beide diensten · '+parts.map(clock).join(' en ')]);
  opts.push(['none','Dienst vervalt']);
  return '<input type="hidden" name="before-'+h(s.id)+'" value="'+h(JSON.stringify(s))+'">'
   +button('Dienst bekijken en aanpassen','requestShift',r.id+'|'+s.id)
   +select(dateLabel(s.date)+' · '+clock(s),'choice-'+s.id,opts);
 }).join('');
}
// Aanvraag beoordelen: wie, wanneer en hoe lang; twee knoppen. De reden voor afwijzen verschijnt pas na afwijzen.
function decision(db,actor,id){
 const r=db.requests.find(x=>x.id===id),leave=r.kind==='leave';
 const effects=r.kind==='weekly'?weeklyEffects(db,r):leave?leaveEffects(db,r):'';
 const what=requestName(r)+(requestLength(r)?' · '+requestLength(r):'');
 const zero=leave&&r.type==='overuren'&&!affected(db,r).length
  ?'<p class="notice">Er staan nog geen diensten in deze periode: dit telt nu 0 uur.</p>':'';
 const own=leave&&r.type==='overuren'?saldo(db,r.user):null;
 const plus=own===null?'':'<p>Saldo plus- en minuren van '+h(name(db,r.user))+': '+(own>0?'+':'')+duration(own)
  +'</p>';
 // Vakantiedagen (SPEC 9g): wat deze aanvraag kost en wat er nog over is.
 const left=leave&&r.type==='verlof'?vacationLeft(db,r.user):null;
 const cost=left===null?'':'<p>Telt '+leaveDays(db,r)+' vakantiedagen. '+h(name(db,r.user))
  +' heeft er nog '+left+'.</p>';
 // Oproepkracht vrij op een vaste dag (ronde 13): heeft die een andere dag opgegeven?
 const other=x=>dateLabel(x.date)+' ('+clock(x)+')';
 const instead=!r.instead?'':'<p>Vraagt vrij voor '+h(dateLabel(r.date))+(r.through!==r.date?' t/m '
  +h(dateLabel(r.through)):'')+' en heeft '+(r.instead.length?'een':'geen')+' andere dag opgegeven.'
  +(r.instead.length?' Heeft in plaats daarvan aangegeven wel '+h(list(r.instead.map(other)))
   +' te kunnen werken. Wil je deze vrije dag goedkeuren?':'')+'</p>';
 const info='<p><b>'+h(name(db,r.user))+'</b><br>'+h(what)+'</p>'+(r.reason?'<p>Reden: '+h(r.reason)+'</p>':'')+zero
  +cost+plus+instead;
 const type=leave?leaveTypeField(db,r.user,r.type,r.special,true,r.specialReason):'';
 const choices='<div class="decide">'+form('accept',type+effects,'Aanvraag goedkeuren',id)
  +button('Aanvraag afwijzen','askReject',id)+'</div>';
 const no='<div id="askReject" hidden>'+form('reject',reason(true),'Afwijzen versturen',id)+'</div>';
 return {title:'Aanvraag beoordelen',body:info+choices+no};
}

// Oproepkracht vraagt vrij op een vaste dag (ronde 13): verschijnt bij versturen. Ja: een of meer andere dagen
// met tijden (aangegeven beschikbaarheid). Nee: niets extra.
function insteadBox(db,user){
 if(db.people.find(p=>p.id===user)?.contract!=='uren')return '';
 const row=i=>'<div class="pair insteadrow">'+field('Andere dag','idate'+i,'date','','min="'+today()+'"')
  +field('Van','istart'+i,'time')+field('Tot','iend'+i,'time')+'</div>';
 return '<div id="instead" hidden><p class="notice">Je vraagt vrij op een vaste dag. Kan je een andere dag van de'
  +' week toevallig wel werken? Dat helpt ons het rooster rond te krijgen.</p>'
  +select('Andere dag mogelijk?','insteadAsk',[['','Kies…'],['ja','Ja'],['nee','Nee']])
  +'<div id="insteadrows" hidden>'+[0,1,2].map(row).join('')
  +'<p class="hint">Vul één of meer dagen in. Je wordt niet meteen ingepland: dit is je beschikbaarheid.</p>'
  +'</div></div>';
}
// Vrij vragen, vaste beschikbaarheid wijzigen of extra beschikbaar: datum, keuze hele dag of tijden.
const availabilityTitles={leave:'Vrij vragen',weekly:'Vaste beschikbaarheid wijzigen',extra:'Extra beschikbaar'};
function availabilityDialog(db,actor,day,action){
 let body=field(action==='weekly'?'Geldig vanaf':'Datum','date','date',day||today(),'required min="'+today()+'"');
 if(action==='weekly')body+=select('Weekdag','weekday',weekNames.map((n,i)=>[i+1,n]));
 const left=action==='leave'?vacationLeft(db,actor.id,['approved','pending']):null;
 if(left!==null)body+='<p>Je hebt nog '+left+' vakantiedagen.</p>';
 if(action==='leave')body+=leaveTypeField(db,actor.id)+field('Tot en met (bij meerdere dagen)','through','date');
 const modes=action==='leave'?[['all','Hele dag vrij'],['range','Deel van de dag']]
  :[['all','Hele dag (08:30–17:30, weekend tot 18:00)'],['from','Beschikbaar vanaf'],['until','Beschikbaar tot'],
   ['range','Tussen twee tijden']];
 if(action!=='leave')modes.push(['off','Niet beschikbaar']);
 // Beschikbaarheid is een wens, geen garantie (ronde 13).
 const wish='<p class="hint">Let op: je wordt niet standaard van 08:30 tot 18:00 ingepland. Dit is alleen je'
  +' beschikbaarheid.</p><p class="hint" id="wish" hidden>Let op: je wordt niet meteen op deze tijd ingepland.'
  +' We proberen rekening te houden met je wensen.</p>';
 const once=action==='extra'?'<p class="hint">Voor één dag: ook om later te beginnen of eerder weg te gaan op een'
  +' vaste dag (kies Beschikbaar vanaf of tot), of Niet beschikbaar op een dag die geen vaste werkdag is.</p>':'';
 if(action==='leave')body+='<p id="late" role="status"></p>';
 body+=select('Beschikbaarheid','mode',modes)+field('Begintijd','start','time')+field('Eindtijd','end','time')
  +(action==='leave'?insteadBox(db,actor.id):wish+once)+(action==='extra'?'':reason());
 return {title:availabilityTitles[action],body:form(action,body,'Versturen')};
}

// Vaste werkdagen (ronde 13) = de vaste beschikbaarheid: per weekdag een vinkje met tijden.
function fixedBoxes(db,user){
 const day=n=>{
  const date=add(today(),(n-weekday(today())+7)%7),r=user?ruleFor({...db,extra:[]},{user,date}):null;
  const on=!!r&&!r.off,std=weekTimes(n);
  return '<div class="fixedday"><label><input type="checkbox" name="fixed" value="'+n+'"'+(on?' checked':'')+'> '
   +weekNames[n-1]+'</label>'+field('Van','start'+n,'time',on?r.start:std.start)
   +field('Tot','end'+n,'time',on?r.end:std.end)+'</div>';
 };
 return '<fieldset class="field fixeddays"><span>Vaste werkdagen</span>'+[1,2,3,4,5,6,7].map(day).join('')
  +'<p class="hint">Dit is de vaste beschikbaarheid. De medewerker kan een wijziging vragen.</p></fieldset>';
}
// Vinkjes voor de werkplekken van een medewerker.
const areaBoxes=own=>'<fieldset class="field areas"><span>Werkplek</span>'+AREAS.map(a=>'<label><input type="checkbox"'
 +' name="areas" value="'+a+'"'+(own.includes(a)?' checked':'')+'> '+a+'</label>').join('')+'</fieldset>';
// Op inactief zetten: eerst laten zien welke diensten nog in de toekomst staan. Niet voor jezelf.
function inactiveBox(db,actor,p){
 if(p.id===actor.id)return '';
 const future=futureShifts(db,p.id);
 if(future.length)return '<h3>Op inactief zetten</h3><p>'+h(name(db,p.id))+' heeft nog '+future.length
  +' dienst(en) in de toekomst. Haal die eerst weg of geef ze aan iemand anders:</p>'
  +future.map(s=>'<p>'+h(dateLabel(s.date)+' · '+clock(s))+'</p>').join('');
 return '<h3>Op inactief zetten</h3><p>'+h(name(db,p.id))+' verdwijnt uit het rooster. Oude uren blijven bewaard.</p>'
  +form('setActive','<input type="hidden" name="active" value="">','Op inactief zetten',p.id,false);
}
// Medewerker toevoegen (zonder id) of wijzigen.
// Saldo vakantiedagen van één medewerker; de bedrijfsleider zet het op een nieuw aantal met reden (SPEC 9g).
function vacationBox(db,id){
 const left=vacationLeft(db,id);
 if(left===null)return '';
 const set=field('Nieuw saldo (dagen)','days','number',left,'required step="0.5"')+reason(true);
 return '<h3>Vakantiedagen</h3><p>Vakantiedagen over: <b>'+left+'</b></p>'
  +'<p class="hint">Wat over is, gaat mee naar het volgende jaar.</p>'+form('leaveSet',set,'Saldo aanpassen',id);
}
function person(db,actor,id){
 const p=db.people.find(x=>x.id===id)||{name:'',role:'employee',contract:'vast',contractHours:'',phone:''};
 const body=field('Naam','name','text',p.name,'required')
  +select('Rol','role',Object.entries(roleNames),p.role)
  +select('Contract','contract',[['vast','Vast (met maandnorm)'],['uren','Oproep (betaald per gewerkt uur)']],p.contract)
  +select('Uren bijhouden','tracksHours',[['yes','Ja'],['no','Nee (niet per uur betaald)']],
   p.tracksHours===false?'no':'yes')
  +'<p class="hint">Bij nee: wel in het rooster en alle rechten van de rol, maar geen uren en niet in het'
  +' maandoverzicht.</p>'
  +field('Contracturen per week','contractHours','number',p.contractHours,'required min="0" max="40" step="0.5"')
  +field('Telefoonnummer (niet verplicht)','phone','tel',p.phone||'','inputmode="tel"')
  +'<p class="hint">Alleen leiding en bedrijfsleider zien het nummer. Het wordt gebruikt voor Herinner.</p>'
  +areaBoxes(p.areas||['Vloer'])+fixedBoxes(db,p.id)
  +'<p class="hint">Vakantiedagen (alleen bij vast contract). Startsaldo: wat er dit jaar nog over is.</p>'
  +field('Vakantiedagen per jaar','vacationDays','number',p.vacationDays??'','min="0" step="0.5"')
  +field('Startsaldo vakantiedagen','leaveStartBalance','number',p.leaveStartBalance??'','min="0" step="0.5"')
  +'<p class="hint">Voor de export naar de loonadministratie:</p>'
  +[['Personeelsnummer','staffNumber'],['Voornaam','firstName'],['Achternaam','lastName'],['Voorletters','initials']]
   .map(([label,key])=>field(label,key,'text',p[key]||'')).join('');
 const title=id?'Medewerker wijzigen':'Medewerker toevoegen';
 return {title,body:form('savePerson',body,'Opslaan',id)+(id?vacationBox(db,id)+inactiveBox(db,actor,p):'')};
}

// Concept uit vaste beschikbaarheid voor de week vanaf maandag 'week'.
function planFromRules(db,actor,week){
 const body='<p>Iedereen wordt als concept ingepland op de vaste dagen en tijden van '
  +h(dateLabel(week)+' – '+dateLabel(add(week,6)))+'. Werkplek: vloer, of keuken voor wie alleen in de keuken'
  +' werkt.</p><p>Vrije dagen, voorbije dagen en dagen waarop iemand al staat, worden overgeslagen. Je publiceert'
  +' zelf.</p>'+form('planFromRules','','Concept maken',week);
 return {title:'Concept uit vaste beschikbaarheid',body};
}

// Alles goedkeuren: eerst laten zien welke uren precies volgens rooster zijn, dan bevestigen.
function approveAll(db,actor){
 const list=asPlanned(db,actor);
 const rows=list.map(s=>line(name(db,s.user)+' · '+dateLabel(s.date),
  clock(db.hours[s.id])+' · '+db.hours[s.id].pause+' min pauze'));
 const ids='<input type="hidden" name="ids" value="'+h(list.map(s=>s.id).join(','))+'">';
 const body='<p>Deze uren zijn precies volgens rooster:</p>'+rows.join('')
  +form('approveAll',ids,'Alles goedkeuren ('+list.length+')');
 return {title:'Alles goedkeuren',body};
}

// Extra beschikbaarheid: inplannen (hele opgegeven tijd of andere tijden daarbinnen) of niet inplannen.
function extraDecision(db,actor,id){
 const [user,date]=id.split('|'),e=db.extra.find(x=>x.user===user&&x.date===date);
 const info='<p><b>'+h(name(db,user))+'</b><br>'+h(dateLabel(date)+' · beschikbaar '+clock(e))+'</p>';
 const choice=select('Tijden','whole',[['whole','Hele opgegeven tijd ('+clock(e)+')'],['other','Andere tijden']]);
 const body=choice+'<div id="extratimes" hidden>'+times(e)+'</div>'+areaChoice(db,user);
 const choices=form('planExtra',body,'Inplannen',id)+form('declineExtra','','Niet inplannen',id,false);
 return {title:'Extra beschikbaarheid',body:info+'<div class="decide">'+choices+'</div>'};
}

// Conceptdienst maken of wijzigen. De schil vult daarna de beschikbaarheid in (#window).
// Dag instellen (ronde 12): normaal, aangepaste openingstijden of dicht. Bij dicht: wie werkt er normaal en
// worden hun uren doorbetaald of zijn het min-uren?
const list=names=>names.length<2?names.join(''):names.slice(0,-1).join(', ')+' en '+names.at(-1);
function dayEdit(db,actor,date){
 const d=dayInfo(db,date)||{status:'normal'},who=closedPeople(db,date).map(id=>name(db,id));
 const status=select('Deze dag','status',[['normal','Normaal open'],['hours','Aangepaste openingstijden'],
  ['closed','Dicht']],d.status);
 const hours='<div id="dayhours"'+(d.status==='hours'?'':' hidden')+'>'+field('Open vanaf','open','time',d.open||TIMES.open)
  +field('Open tot','close','time',d.close||TIMES.close)+'</div>';
 const paid=who.length?'<div id="daypaid"'+(d.status==='closed'?'':' hidden')+'><p class="notice">Je zet nu deze dag dicht. Dit is een normale werkdag voor '+h(list(who))
  +'. Wil je hun uren gewoon doorbetalen of zijn dit min-uren?</p>'
  +select('Doorbetalen?','paid',[['','Kies…'],['ja','Doorbetalen (8 uur)'],['nee','Min-uren']],
   d.paid===undefined?'':d.paid?'ja':'nee')+'</div>':'';
 const body=status+hours+paid;
 return {title:'Dag instellen · '+dateLabel(date),body:form('setDay',body,'Opslaan',date)};
}
function draft(db,actor,id){
 const s=db.drafts.find(x=>x.id===id)||shiftOf(db,id),date=s?.date||id;
 const people=select('Medewerker','user',activePeople(db).map(p=>[p.id,name(db,p.id)]),s?.user);
 const area='<div id="areapick">'+areaChoice(db,s?.user||activePeople(db)[0]?.id,s?.area)+'</div>';
 const body=people+field('Datum','date','date',date,'readonly')+'<p id="window"></p>'
  +times(s||dayTimes(date))+area
  +field('Stand-by? Bericht vóór (optioneel)','deadline','time',s?.deadline||'');
 return {title:'Conceptdienst',body:form('draft',body,'Concept bewaren',s?.id||'')};
}

// Week publiceren: wat er ingepland wordt en welke vragen naar medewerkers gaan.
function publishRow(db,s){
 const question=needsQuestion(db,s)||!available(db,s),base=db.shifts.find(x=>x.id===s.id)||fallbackShift(db,s);
 const plan=question?(base?'Blijft / wordt ingepland: '+clock(base):'Nog niet ingepland; wacht op toestemming')
  :'Wordt ingepland: '+clock(s);
 return '<section class="publish-row"><strong>'+h(name(db,s.user)+' · '+dateLabel(s.date))+'</strong>'
  +'<p>'+h('Beschikbaarheid: '+availability(db,s.user,s.date))+'</p><p>'+h(plan)+'</p>'
  +(question?'<p class="offer-note">'+h('Vraag aan medewerker: werken '+clock(s))+'</p>':'')+'</section>';
}
function pubWeek(db,actor,week){
 const end=add(week,6),rows=db.drafts.filter(s=>s.date>=week&&s.date<=end);
 const waiting=db.offers.filter(o=>o.row.date>=week&&o.row.date<=end);
 const who=o=>o.turn==='admin'?'bedrijfsleider':name(db,o.row.user);
 const summary=rows.length+' conceptdienst(en) voor publicatie.'
  +waiting.map(o=>' '+clock(o.row)+' · Wacht op '+who(o)+'.').join('');
 const check=rows.some(s=>!available(db,s))
  ?'<label><input type="checkbox" name="confirm" required> Ik heb de afwijkende beschikbaarheid gecontroleerd.'
   +'</label>':'';
 const body='<p>'+h(summary)+'</p>'+rows.map(s=>publishRow(db,s)).join('')+check
  +'<input type="hidden" name="through" value="'+end+'">';
 return {title:'Rooster publiceren',body:form('publish',body,'Publiceren',week)};
}

// Voorstel voor het rooster: de medewerker (of de bedrijfsleider bij andere tijden) antwoordt.
function proposal(db,actor,id){
 const o=db.offers.find(x=>x.id===id);
 if(o.fallback&&o.turn==='employee'){
  const requester=o.requestedBy?name(db,o.requestedBy):'de bedrijfsleider';
  const ask='Je bent beschikbaar '+clock(o.availability||o.fallback)+'. '+requester+' vraagt of je '+clock(o.row)
   +' kunt werken.';
  const body='<p>'+h(dateLabel(o.row.date))+'</p><p>'+h(ask)+'</p>'
   +'<p>'+h('Je dienst blijft '+clock(o.fallback)+' totdat je accepteert.')+'</p>'
   +form('yes','','Ja, '+clock(o.row),id)+form('no','','Nee, behoud '+clock(o.fallback),id);
  return {title:'Roosterwijziging',body};
 }
 const standbyText=o.row.deadline?' · Stand-by · Bericht vóór '+o.row.deadline:'';
 const body='<p>'+h(name(db,o.row.user)+' · '+dateLabel(o.row.date)+' · '+clock(o.row)+standbyText)+'</p>'
  +form('yes','','Accepteren',id)+form('no','','Afwijzen',id)
  +(o.turn==='employee'?form('counter',times(o.row),'Andere tijden voorstellen',id):'');
 return {title:'Dienstvoorstel',body};
}

// Welke knop (data-act) welk venster opent.
export const dialogs={
 calendarDay,ownShift,shiftDetails,standby,unplanned,sickAsk,sickUndoAsk,sickPick,fillPick,norm,closeMonth,reopenMonth,
 decision,
 person,planFromRules,approveAll,extraDecision,pubWeek,proposal,saldo:saldoDialog,dayEdit,
 entry:(db,actor,id)=>hoursDialog(db,actor,id,'entry'),
 inspect:(db,actor,id)=>hoursDialog(db,actor,id,'inspect'),
 leave:(db,actor,id)=>availabilityDialog(db,actor,id,'leave'),
 weekly:(db,actor,id)=>availabilityDialog(db,actor,id,'weekly'),
 extra:(db,actor,id)=>availabilityDialog(db,actor,id,'extra'),
 draft,newDraft:draft
};
