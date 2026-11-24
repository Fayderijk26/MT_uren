import {mayRemind,minutes,today,warnings,toReview,teamMissing,badges,busy,ended,asPlanned,monthSummary,leaveItems,
 absentMinutes,tracksHours,maySick,monthOver,mayEnter,saldo,vacationLeft,
 normSoFar,closed} from './model.js';
import {button,card,line,link,clock,name,dateLabel,field,sortDate,approvalText,chip,subtabs,sickButton,
 duration,h,sickStatus} from './view.js';
// "di 17 nov", "di 17 nov en wo 18 nov", "ma 16 nov, di 17 nov en wo 18 nov".
const dayList=shifts=>shifts.map(s=>dateLabel(s.date)).join(', ').replace(/, ([^,]*)$/,' en $1');
// WhatsApp-herinnering voor één of meer diensten van dezelfde medewerker.
export function remindLink(db,shifts,status='missing'){
 const person=db.people.find(p=>p.id===shifts[0].user),todo=status==='returned'?'nog aanpassen':'nog invullen';
 const text='Hoi '+person.name.split(' ')[0]+', wil je je uren van '+dayList(shifts)+' '+todo+'?';
 const phone=(person.phone||'').replace(/\D/g,'');
 return link('Herinner','https://wa.me/'+phone+'?text='+encodeURIComponent(text));
}
// Ontbrekende uren per medewerker bij elkaar: één regel en één herinnering voor alle dagen.
export function missingByPerson(list){
 const groups=new Map();
 for(const m of list)groups.set(m.shift.user,[...(groups.get(m.shift.user)||[]),m]);
 return [...groups.values()];
}
export function missingRow(db,actor,group){
 const {shift,late}=group[0],when=late===0?'vandaag':late===1?'1 dag te laat':late+' dagen te laat';
 const remind=group.map(m=>m.shift).filter(s=>mayRemind(db,actor,s));
 const text=group.length===1?dateLabel(shift.date)+' · '+clock(shift)+' · '+when
  :group.map(m=>dateLabel(m.shift.date)).join(', ');
 // Vergeten ziek te melden in de app: bij één dag een knop met die dag, bij meer dagen één knop die een
 // venster opent om de dagen te kiezen. Alleen als deze persoon dat mag (regel in model.js).
 const days=group.map(m=>m.shift).filter(s=>maySick(db,actor,s));
 const sick=days.length>1?button('Ziek melden','sickPick',shift.user)
  :days.map(s=>sickButton(db,actor,s,'Ziek melden '+dateLabel(s.date))).join('');
 // Na de maand vult de bedrijfsleider de uren zelf in (SPEC 9e).
 // Bij meer dagen één knop die een venster met de dagen opent, net als Ziek melden.
 const open=group.map(m=>m.shift).filter(s=>s.user!==actor.id&&mayEnter(db,actor,s));
 const fill=open.length>1?button('Uren invullen','fillPick',shift.user)
  :open.map(s=>button('Uren invullen','entry',s.id)).join('');
 const row=line(name(db,shift.user),text,(remind.length?remindLink(db,remind):'')+fill+sick);
 return '<div class="compact">'+row+'</div>';
}
export function reviewRow(db,s){
 const e=db.hours[s.id],net=minutes(e.end)-minutes(e.start)-e.pause;
 const parts=[clock(e),e.pause+' min pauze',Math.floor(net/60)+'u '+net%60+'m',
  clock(s)===clock(e)?'Volgens rooster':'Gepland '+clock(s)];
 if(e.approvedBy)parts.push(approvalText(db,e));
 for(const w of warnings(db,s))parts.push('Let op: '+w);
 const actions=button('Goedkeuren','approve',s.id,true)+button('Bekijken','inspect',s.id);
 return line(name(db,s.user)+' · '+dateLabel(s.date),parts.join(' · '),actions);
}
// Wie geen uren bijhoudt (SPEC ronde 10), heeft geen Mijn uren; alleen Uren goedkeuren (en Maandoverzicht).
export function tabs(db,actor,page){
 if(actor.role==='employee')return '';
 const count=badges(db,actor);
 const own=tracksHours(db,actor.id)?[['Mijn uren','hours',count.mine]]:[];
 const items=[...own,['Uren goedkeuren','reviews',count.review]];
 if(actor.role==='admin')items.push(['Maandoverzicht','month',0]);
 return subtabs(items,page);
}
// Na de maand kan de medewerker niets meer: een lege dienst staat er als Niet ingevuld en telt niet mee (SPEC 9e).
function ownHoursRow(db,actor,s){
 const status=s.sick?'sick':db.hours[s.id]?.status||(ended(s)?'missing':busy(s)?'busy':'');
 const gone=['missing','returned'].includes(status)&&!mayEnter(db,actor,s)&&monthOver(s.date);
 const text=clock(db.hours[s.id]||s)+(s.sick?' · '+sickStatus(s):gone?' · telt niet mee':'');
 const label=gone?chip('missing','Niet ingevuld'):status?chip(status):'';
 const row=line(dateLabel(s.date),text,button('Bekijken','entry',s.id),label);
 return '<div class="compact">'+row+'</div>';
}
// Verlofdag: telt altijd 8 uur (SPEC 9g).
const leaveRow=d=>'<div class="compact">'+line(dateLabel(d.date),'Verlofdag · telt '+duration(d.minutes),'',
 chip('leave'))+'</div>';
// Wachtdagen bij ziekte: hoeveel diensten en uren niet meetellen.
const waitDays=r=>(r.waitShifts===1?'1 wachtdag telt':r.waitShifts+' wachtdagen tellen')
 +' niet mee ('+duration(r.sickUnpaid)+')';
// Dichte dagen op een vaste werkdag (ronde 12).
const shutDays=r=>(r.closedDays===1?'1 dag':r.closedDays+' dagen')+' dicht, '
 +(r.closedPaid?'doorbetaald ('+duration(r.closedPaid)+')':r.closedDays===1?'telt niet mee':'tellen niet mee');
// Mijn uren: het totaal dat vastligt (goedgekeurd, ziek, verlof) met een balk; wat nog wacht staat eronder apart.
// De getallen komen uit monthSummary, dezelfde als in het maandoverzicht van de bedrijfsleider.
function summaryCard(db,actor,month){
 const r=monthSummary(db,month).find(x=>x.user===actor.id)||{approved:0,sick:0,leave:0,pending:0,open:[]};
 const parts=[['ok','Gewerkt',r.approved],['sick','Ziek gemeld',r.sick],['leave','Verlof',r.leave+(r.special||0)]];
 const total=r.approved+r.sick+r.leave+(r.special||0)+(r.closedPaid||0);
 const monthName=new Intl.DateTimeFormat('nl-NL',{month:'long'}).format(new Date(month+'-15T12:00Z'));
 const bar=total?'<div class="hourbar" aria-hidden="true">'+parts.filter(p=>p[2])
  .map(([tone,,m])=>'<span class="seg-'+tone+'" style="flex:'+m+'"></span>').join('')+'</div>':'';
 const part=([tone,label,m])=>'<div class="'+(m?'':'zero')+'"><span><i class="dot dot-'+tone+'"></i>'+h(label)
  +'</span><b>'+duration(m)+'</b></div>';
 // Nog te doen: diensten zonder uren en uren waarvoor aanpassen is gevraagd.
 // Een aantal diensten, geen uren: die zijn nog onbekend.
 const count=(n,one,more)=>n===1?'1 dienst '+one:n+' diensten '+more;
 const missing=r.open.filter(o=>o.status==='missing').length,returned=r.open.filter(o=>o.status==='returned').length;
 const todo=[missing&&count(missing,'ontbreekt nog','ontbreken nog'),returned&&count(returned,'aanpassen','aanpassen')]
  .filter(Boolean);
 const gone=actor.role!=='admin'&&monthOver(month+'-01'),left=missing+returned;
 const open=gone&&left?'<p class="hourmissing">'+(left===1?'1 dienst niet ingevuld · telt niet mee'
  :left+' diensten niet ingevuld · tellen niet mee')+'</p>'
  :todo.length?'<p class="hourmissing">'+todo.join(' · ')+' · vul ze in bij Diensten</p>':'';
 const wait=(r.pending?'<p class="hourwait">'+duration(r.pending)
  +' wacht op beoordeling · telt mee zodra het is goedgekeurd</p>':'')
  +(r.sickWaiting?'<p class="hourwait">'+duration(r.sickWaiting)
  +' ziek wacht op besluit van de bedrijfsleider</p>':'');
 // Vast contract (SPEC 9f): saldo aan het begin, totaal van de maand, in het klein de norm en hoe je er tot nu toe
 // voor staat, en na de maand het nieuwe saldo.
 const plus=m=>(m>0?'+':m<0?'−':'')+duration(Math.abs(m)),begin=saldo(db,actor.id,month);
 const vast=begin!==null&&r.diff!==null&&r.diff!==undefined,over=monthOver(month+'-01');
 const stat=(label,v,cls='')=>'<div class="hourstat '+cls+'"><span>'+label+'</span><b>'+v+'</b></div>';
 const start=vast?stat('Saldo begin '+monthName,plus(begin)):'';
 const soFar=normSoFar(db,actor.id,month),ahead=total-soFar;
 const small=vast?[['Norm '+monthName+': '+duration(r.norm)],
  [!over&&soFar>0&&'Tot nu toe: '+duration(total)+' van '+duration(soFar)+' ('+plus(ahead)+')'],
  [r.sickUnpaid&&waitDays(r)],[r.closedDays&&shutDays(r)]]
  .map(([x])=>x).filter(Boolean).map(x=>'<p class="hournote">'+h(x)+'</p>').join(''):'';
 const closedNow=closed(db,month+'-01');
 const end=vast&&over?stat('Saldo einde '+monthName,plus(begin+r.diff),'hourend')
  +(closedNow?'':'<p class="hournote">Nog niet afgesloten: dit kan nog veranderen.</p>'):'';
 const free=vacationLeft(db,actor.id),vacation=free===null?'':stat('Vakantiedagen over',String(free));
 const head='<div class="cardhead hourshead"><h2>Mijn uren</h2>'
  +field('Maand','month','month',month,'data-view="month"')+'</div>';
 return '<section class="card">'+head+start+'<div class="hoursummary"><div><small>Totaal '+h(monthName)+'</small>'
  +'<b class="hourtotal">'+duration(total)+'</b></div>'+bar
  +'<div class="hourparts">'+parts.map(part).join('')+'</div></div>'
  +small+open+wait+end+vacation+'</section>';
}
// Diensten van de maand: gewerkt tot vandaag, en ook ziek gemelde diensten en verlofdagen. Nieuwste bovenaan.
function shiftsCard(db,actor,month){
 const shifts=db.shifts.filter(s=>!s.deadline&&s.user===actor.id&&s.date.startsWith(month)&&(s.date<=today()||s.sick))
  .map(s=>({...s,html:ownHoursRow(db,actor,s)}));
 const leave=leaveItems(db,actor.id,month).map(d=>({...d,html:leaveRow(d)}));
 const rows=shifts.concat(leave).sort(sortDate).reverse().map(x=>x.html).join('');
 const head='<div class="cardhead"><h2>Diensten</h2>'+button('Ongeplande dienst invullen','unplanned')+'</div>';
 return '<section class="card">'+head+(rows||'<p>Nog geen diensten deze maand.</p>')+'</section>';
}
export function hoursPage(db,actor,view){
 const own=tracksHours(db,actor.id);
 if(!own&&actor.role==='employee')return card('Uren','Voor jou worden geen uren bijgehouden.');
 if(view.page==='reviews'||!own){
  const absent=teamMissing(db,actor);
  const same=asPlanned(db,actor).length;
  const all=same?button('Alles goedkeuren ('+same+')','approveAll','',true):'';
  return tabs(db,actor,'reviews')+card('Uren goedkeuren',all+(toReview(db,actor).map(s=>reviewRow(db,s)).join('')
   ||'Alle uren zijn beoordeeld.'))
   +card('Ontbreekt ('+absent.length+')',missingByPerson(absent).map(g=>missingRow(db,actor,g)).join('')
    ||'Er ontbreken geen uren.');
 }
 return tabs(db,actor,'hours')+summaryCard(db,actor,view.month)+shiftsCard(db,actor,view.month);
}
