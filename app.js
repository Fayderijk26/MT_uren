import {choices,availabilityText,changesFor,dayCount} from './availability.js';
import {h,ic,roles,today,dateAdd,monday,fmt,duration,mins,status,badge,btn,initials,modal,field,input,options,toast} from './ui.js';
import {workedMinutes,demoAccounts,demoState,demoAct,selectDemo} from './demo.js';
import {createClient} from './integration/auth.js';
import {config} from './config.js';
import {management,manageClick,manageSubmit} from './manager.js';
const api=createClient(config), live=api.configured && (new URLSearchParams(location.search).has('live') || (!config.DEMO_PREVIEW && !new URLSearchParams(location.search).has('demo'))), app=document.querySelector('#app'), dlg=document.querySelector('dialog');
const view={page:'overview',day:today(),week:monday(today()),month:today().slice(0,7),filter:'all'};
let state,me,busy=false;
const rolePages={overview:['Overzicht','LayoutDashboard'],hours:['Mijn uren','Clock3'],availability:['Beschikbaarheid','CalendarDays'],roster:['Rooster','CalendarDays'],review:['Dagcontrole','ListChecks'],month:['Maandstaat','FileSpreadsheet'],team:['Team','Users']};
const person=id=>state.people.find(p=>p.id===id)?.name||'Medewerker';
const own=()=>state.shifts.filter(s=>s.user===me.id);
const action=async(a,p)=>{const payload={...p,requestId:crypto.randomUUID()};return live?api.act(a,payload):demoAct(a,payload)};
const ctx=()=>({rosterRows,state,me,view,person,action,refresh,live,api,showEntry});
async function refresh(){state=live?await api.state():await demoState();me=state.people.find(p=>p.id===state.me);if(!me)throw Error('Je profiel is niet actief.');render();popupAlerts()}
function header(){const active=personalAlerts().some(e=>!e.seen)||openActions().length>0;const allowed=['overview','hours','roster','availability',...(me.role==='employee'?[]:['review']),...(me.role==='admin'?['month','team']:[])];return '<header><div class="topbar"><button class="brand" data-act="page" data-page="overview" aria-label="Naar overzicht"><img src="./assets/logo.webp" alt="Monkey Town"></button><div class="brandsep"></div><span class="wordmark">Werkplek</span><div class="topright">'+btn('','notifications','Bell',active?'icon bell active-bell':'icon bell',active?'aria-label="Meldingen, nieuwe berichten of openstaande acties"':'aria-label="Meldingen"')+'<button class="account" data-act="account"><b class="avatar">'+h(initials(me.name))+'</b><span><strong>'+h(me.name)+'</strong><small>'+h(roles[me.role])+'</small></span>'+ic('ChevronDown',15)+'</button></div></div><nav aria-label="Hoofdnavigatie"><div>'+allowed.map(key=>'<button data-act="page" data-page="'+key+'" class="'+(view.page===key?'selected':'')+'" '+(view.page===key?'aria-current="page"':'')+'>'+ic(rolePages[key][1],17)+rolePages[key][0]+'</button>').join('')+'</div></nav></header>'}
const niceDate=d=>fmt(d,{weekday:'long',day:'numeric',month:'long'});
const area=s=>s.area||({extra:'Invaldienst',off:'Vrij gevraagd',standby:'Stand-by'}[s.kind])||'Speelvloer';
const planned=s=>s.kind==='off'?'Vrij gevraagd':s.start?h(s.start)+' – '+h(s.end||'…'):s.kind==='standby'&&s.deadline?'Bericht vóór '+h(s.deadline):'Tijden open';
function title(kicker,title,sub=''){return '<div class="page-title"><div class="eyebrow">'+h(kicker)+'</div><h1>'+h(title)+'</h1>'+(sub?'<p>'+h(sub)+'</p>':'')+'</div>'}
function stat(label,val,desc,icon,color,action){const tag=action?'button':'article';return '<'+tag+(action?' type="button" data-act="'+h(action)+'"':'')+' class="stat"><span class="tileicon '+color+'">'+ic(icon,23)+'</span><div><span class="statlabel">'+h(label)+'</span><strong>'+h(val)+'</strong><small>'+h(desc)+'</small></div></'+tag+'>'}
function offerSummary(s){
  const offer=state.offers?.[s.id]?.offer;
  return offer?(offer.counter?'Tegenvoorstel in behandeling':'Dienstvoorstel bekijken')+' · '+offer.start+' – '+offer.end:'Vrijmelding bekijken';
}
function rosterRows(rows){
  const slots=state.acceptedSlots||{};
  const approved=new Set(Object.values(slots));
  return rows.filter(s=>!(s.kind==='off'&&approved.has(s.id)&&!state.offers?.[s.id]?.offer)).map(s=>{
    const off=rows.find(o=>o.kind==='off'&&o.user===s.user&&o.date===s.date);
    if(slots[s.id])return {...s,leaveLabel:'Op jouw verzoek vrij, behalve '+s.start+'–'+s.end};
    if(off&&['shift','standby','extra'].includes(s.kind)&&!s.entry)return {...s,leaveLabel:'Roosterconflict · vrij gevraagd, geen akkoord voor deze dienst'};
    return s;
  });
}
const leaveLabels={pending:'Wacht op reactie',approved:'Vastgelegd',counter:'Tegenvoorstel',rejected:'Afgewezen',replaced:'Vervangen',booked:'Dienst ingepland'};
const noticePeriod=l=>l.days==null?'':l.days+' dagen van tevoren aangevraagd · '+(l.days<21?'te laat':'op tijd');
function availabilityCard(l){
  const attrs='data-id="'+h(l.id)+'"';
  const canAnswer=(l.status==='pending'&&me.role==='admin')||(l.status==='counter'&&l.user===me.id);
  const existing=state.shifts.filter(s=>s.user===l.user&&s.date===l.date&&!['off','cancelled'].includes(s.kind));
  return '<article class="manage-row"><b>'+h(person(l.user))+' · '+h(niceDate(l.date))+'</b><p>'+h(availabilityText(l))+' · '+h(leaveLabels[l.status])+'</p><small>'+h(noticePeriod(l))+'</small>'
    +(l.reason?'<p>'+h(l.reason)+'</p>':'')+(l.response?'<p>'+h(l.response)+'</p>':'')
    +(canAnswer&&existing.length?'<p>Ingepland: '+existing.map(planned).join(', ')+'</p>':'')
    +(canAnswer?btn('Akkoord','leaveYes','Check','primary',attrs)+btn('Afwijzen','leaveNo','X','secondary',attrs)+(l.status==='pending'?btn('Andere tijden voorstellen','leaveCounter','Clock3','secondary',attrs):''):'')+'</article>';
}
function leavePanel(){
  const rows=(state.leave||[]).filter(l=>l.status!=='replaced'&&(l.user===me.id||me.role==='admin')).sort((a,b)=>a.date.localeCompare(b.date));
  return title('ROOSTER','Beschikbaarheid')+'<section class="card">'+btn('Beschikbaarheid doorgeven','leaveForm','Plus','primary')+rows.map(availabilityCard).join('')+(rows.length?'':'<p>Geen beschikbaarheid opgegeven.</p>')+'</section>';
}
function updateAvailabilityForm(f){
  const mode=f.elements.mode?.value;
  for(const name of ['start','end']){
    const el=f.elements[name];if(!el)continue;
    el.disabled=!(mode==='range'||(name==='start'?mode==='from':mode==='until'));
    el.required=!el.disabled;el.closest('label').hidden=el.disabled;
  }
  const date=f.elements.date?.value,warning=f.querySelector('[data-warning]');
  if(warning){const days=dayCount(date,today());warning.textContent=date&&days>=0&&days<21?'Je geeft dit '+days+' dagen van tevoren door. De termijn is 21 dagen. Je kunt het verzoek versturen. De bedrijfsleider bekijkt wat mogelijk is.':'';}
}
function availabilityDialog(act,id){
  const l=state.leave?.find(x=>x.id===id),request=act==='leaveForm',counter=act==='leaveCounter',reject=act==='leaveNo';
  const spec=request||counter;
  const changes=l&&!l.slot?changesFor(state.shifts,l):[];
  const existing=l?state.shifts.filter(s=>s.user===l.user&&s.date===l.date&&s.kind==='off'):[];
  const effect=changes.map(c=>c.before.slice(1).join('–')+' → '+(c.after?c.after.join('–'):'dienst vervalt')).concat(l&&l.mode!=='off'&&existing.length?['Vrijmelding vervalt voor deze datum']:[]);
  modal(request?'Beschikbaarheid doorgeven':counter?'Andere tijden voorstellen':reject?'Aanvraag afwijzen':'Akkoord bevestigen',
    '<form id="'+(request?'leaveRequest':reject?'leaveReject':'leaveApprove')+'" data-id="'+h(id||'')+'" data-revision="'+h(l?.revision||1)+'" data-counter="'+counter+'" data-changes="'+h(JSON.stringify(changes))+'">'+
    (request?field('Datum',input('date','date','','min="'+today()+'" required')):'<p>'+h(person(l.user))+' · '+h(niceDate(l.date))+' · '+h(availabilityText(l))+'</p>')+
    (spec?field('Beschikbaarheid','<select name="mode">'+options(choices,counter?'range':'all')+'</select>')+field('Vanaf',input('start','time',l?.start||''))+field('Tot',input('end','time',l?.end||'')):'')+
    (!spec&&!reject?'<p>'+h(effect.join(' · ')||(l?.slot?'Bij akkoord wordt deze dienst ingepland.':'De geplande diensten blijven ongewijzigd.'))+'</p>':'')+
    (spec||reject?field(reject?'Reden':'Toelichting (optioneel)',input('reason','text','','maxlength="1000" '+(reject?'required':''))):'')+
    '<p data-warning></p><p class="err"></p><button class="primary">'+(request?'Versturen':counter?'Tegenvoorstel versturen':reject?'Afwijzen':'Akkoord')+'</button></form>');
  updateAvailabilityForm(dlg.querySelector('form'));
}
function availabilityAlerts(){
  return (state.leave||[]).filter(l=>(me.role==='admin'&&l.status==='pending')||(l.user===me.id&&((l.revision||1)>1||l.slot)&&['counter','approved','rejected'].includes(l.status))||(me.role==='admin'&&l.user!==me.id&&(l.revision||1)>2&&['approved','rejected','booked'].includes(l.status))||(me.role!=='employee'&&l.slot&&['rejected','booked'].includes(l.status))).map(l=>({availability:true,id:l.id,key:'availability:'+l.id+':'+(l.revision||1),seen:l.seen,text:availabilityText(l)+' · '+noticePeriod(l),title:person(l.user)+' · '+leaveLabels[l.status],date:l.date}));
}
function week(){const days=Array.from({length:7},(_,i)=>dateAdd(view.week,i));const rows=rosterRows(own().filter(s=>s.date===view.day&&s.kind!=='cancelled'));return '<section class="card week"><div class="cardhead"><div><div class="eyebrow green">PLANNING</div><h2>Mijn werkweek</h2></div><div class="arrows">'+btn('','prev','ChevronLeft','icon','aria-label="Vorige week"')+btn('','next','ChevronRight','icon','aria-label="Volgende week"')+'</div></div><div class="weekscope">'+h(fmt(days[0],{day:'numeric',month:'short'}))+' – '+h(fmt(days[6],{day:'numeric',month:'long',year:'numeric'}))+'</div><div class="days">'+days.map(d=>{const off=own().find(s=>s.date===d&&s.kind==='off'),requested=state.leave?.some(l=>l.user===me.id&&l.date===d&&l.status==='pending');const on=own().some(s=>s.date===d&&s.kind!=='cancelled');return '<button class="day '+(view.day===d?'active':'')+'" data-act="day" data-day="'+d+'" aria-pressed="'+(view.day===d)+'"><small>'+fmt(d,{weekday:'short'}).replace('.','')+'</small><strong>'+Number(d.slice(-2))+'</strong><i class="'+(off&&state.offers?.[off.id]?.offer?'dot proposal':off||requested?'dot leave':on?'dot':'')+'"></i></button>'}).join('')+'</div><div class="subhead">'+h(niceDate(view.day))+'</div>'+(state.leave||[]).filter(l=>l.user===me.id&&l.date===view.day&&l.status!=='replaced').map(l=>'<p>'+h(availabilityText(l))+' · '+h(leaveLabels[l.status])+'</p>').join('')+ (rows.length?rows.map(s=>'<div class="shiftrow"><span class="shifticon">'+ic('BriefcaseBusiness',19)+'</span><div><b>'+planned(s)+'</b><small>'+h([area(s),s.task,s.leaveLabel].filter(Boolean).join(' · '))+'</small></div>'+badge(status(s))+(s.kind==='off'?btn(offerSummary(s),'conversation','Mail','secondary','data-id="'+h(s.id)+'"'):['shift','extra'].includes(s.kind)?btn('','entry','ChevronRight','icon','data-id="'+h(s.id)+'" aria-label="Open dienst"'):'')+'</div>').join(''):'<p class="empty">Je staat deze dag niet ingepland.</p>')+'</section>'}
function recent(){const rows=own().filter(s=>s.entry).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3);return '<section class="card recent"><div class="cardhead"><div><div class="eyebrow orange">REGISTRATIES</div><h2>Laatste uren</h2></div><span class="lineicon">'+ic('History')+'</span></div>'+ (rows.length?rows.map(s=>'<button data-act="entry" data-id="'+h(s.id)+'" class="recentrow"><span class="datetile"><small>'+fmt(s.date,{month:'short'}).replace('.','')+'</small><b>'+Number(s.date.slice(-2))+'</b></span><span class="recentinfo"><b>'+h(duration(s.entry.net))+' gewerkt</b><small>'+h(s.entry.start)+' – '+h(s.entry.end)+'</small></span>'+badge(status(s))+'</button>').join(''):'<p class="empty">Je hebt nog geen uren ingediend.</p>')+btn('Alle uren bekijken','page','ArrowRight','textbutton','data-page="hours"')+'</section>'}
function overview(){const requests=own().filter(s=>s.kind==='off'&&state.offers?.[s.id]?.offer&&!state.offers[s.id].offer.counter).length;const month=own().filter(s=>s.date.startsWith(today().slice(0,7))),approved=month.filter(s=>status(s)==='approved'),pending=month.filter(s=>status(s)==='pending'),scheduled=own().filter(s=>s.date>=monday(today())&&s.date<=dateAdd(monday(today()),6)&&['shift','extra'].includes(s.kind));return '<section class="hero"><div class="jungle"></div><div class="herocontent"><div class="hero-date">'+ic('CalendarDays',15)+h(niceDate(today()))+'</div><h1>Hoi, '+h(me.name.split(' ')[0])+'!</h1><p>Je werkweek en uren in één overzicht.</p>'+btn('Uren registreren','register','Plus','primary')+'</div></section><div class="sectionheading"><h2>Mijn overzicht</h2><span>'+ic('CalendarDays',15)+h(fmt(today(),{month:'long',year:'numeric'}))+'</span></div><div class="stats">'+stat('Goedgekeurde uren',duration(approved.reduce((n,s)=>n+s.entry.net,0)), 'Deze maand','CircleCheck','mint')+(me.role==='employee'?stat('Mijn ingediende diensten',String(pending.length),'Wachten op beoordeling','Clock3','peach'):stat('Nog te beoordelen',String(reviewQueue().length),'Open de lijst met diensten','Clock3','peach','reviewqueue'))+stat('Ingeplande diensten',String(scheduled.length),requests?(requests===1?'1 dienstvoorstel te beoordelen':requests+' dienstvoorstellen te beoordelen'):'Deze week','CalendarDays','yellow',requests?'offerqueue':null)+'</div><div class="twocol">'+week()+recent()+'</div>'}
function myBalance(){
const rows=own().filter(s=>s.date.startsWith(view.month)&&s.entry?.status==='approved');
const total=rows.reduce((a,s)=>a+s.entry.net,0),n=state.norms[view.month+':'+me.id];
const contract=(state.contracts||[]).filter(c=>c.user===me.id&&c.effective<=view.month+'-31').sort((a,b)=>b.effective.localeCompare(a.effective))[0]?.contract||me.contract;
return '<div class="plannedline"><span>Goedgekeurd <b>'+duration(total)+'</b>'+(n?' · Norm '+duration(n.norm)+' · Afwezig '+duration(n.paid)+' · Saldo '+(total+n.paid<n.norm?'−':'+')+duration(total+n.paid-n.norm):contract==='fixed'?' · Norm ontbreekt':'')+'</span></div>';
}
function hours(){const rows=own().filter(s=>s.date.startsWith(view.month)&&!['off','cancelled','standby'].includes(s.kind)&&(view.filter==='all'||status(s)===view.filter)).sort((a,b)=>b.date.localeCompare(a.date));return title('REGISTRATIES','Mijn uren')+'<section class="card"><div class="toolbar">'+field('Maand',input('month','month',view.month,'data-view="month"'))+field('Status','<select data-view="filter">'+options([['all','Alle statussen'],['pending','Ter beoordeling'],['approved','Goedgekeurd'],['missing','Ontbreekt'],['returned','Aanpassen'],['planned','Gepland']],view.filter)+'</select>')+btn('Uren registreren','register','Plus','primary')+'</div>'+myBalance()+rows.map(s=>'<button class="listrow" data-act="entry" data-id="'+h(s.id)+'"><span><b>'+h(niceDate(s.date))+'</b><small>'+planned(s)+' · '+h(area(s))+'</small></span>'+badge(status(s))+'<b>'+(s.entry?duration(s.entry.net):'—')+'</b>'+ic('ChevronRight',16)+'</button>').join('')+(!rows.length?'<p class="empty">Geen diensten voor deze selectie.</p>':'')+'</section>'}
function render(){app.innerHTML=header()+'<main id="main" class="shell">'+(view.page==='availability'?leavePanel():view.page==='overview'?overview():view.page==='hours'?hours():view.page==='roster'&&me.role!=='admin'?title('PLANNING','Mijn rooster')+week():management(ctx()))+'</main><footer><span>Monkey Town Uithoorn</span><span>'+(live?'Urenregistratie':'Demomodus · fictieve gegevens')+'</span></footer>'}
function login(form='code',email=''){app.innerHTML='<main class="auth card"><img width="130" src="./assets/logo.webp" alt="Monkey Town"><h1>Inloggen</h1><form id="login" data-mode="'+h(form)+'">'+field('E-mailadres',input('email','email',email,'required autocomplete="email"'))+(['verify','invite','reset'].includes(form)?field('Code uit je e-mail',input('code','text','','inputmode="numeric" required autocomplete="one-time-code"')):'')+(['password','reset'].includes(form)?field(form==='reset'?'Nieuw wachtwoord':'Wachtwoord',input('password','password','','required minlength="12"')):'')+'<p class="err" role="alert"></p><button class="primary">'+({code:'Stuur inlogcode',verify:'Inloggen',invite:'Uitnodiging accepteren',reset:'Wachtwoord opslaan',recover:'Stuur herstelcode',password:'Inloggen'}[form])+'</button></form><div class="actions">'+[['code','Inlogcode'],['invite','Uitnodiging'],...(['localhost','127.0.0.1'].includes(location.hostname)?[['password','Wachtwoord'],['recover','Herstelcode']]:[])].map(([k,v])=>btn(v,'authmode',null,'textbutton','data-mode="'+k+'"')).join('')+'</div></main>'}
function showEntry(s){if(s.kind==='off')return conversation(s.id);const isOwn=s.user===me.id,locked=state.closed.includes(s.date.slice(0,7));const e=s.entry||{},can=isOwn&&!locked&&s.kind!=='cancelled'&&e.status!=='approved';modal(can?'Uren registreren':'Dienst bekijken','<p class="dialogsub">'+h(niceDate(s.date))+' · '+h(person(s.user))+' '+badge(status(s))+'</p><p class="plannedline">'+ic('CalendarDays',17)+' Gepland '+planned(s)+' · '+h(area(s))+'</p>'+(['returned','rejected'].includes(e.status)?'<p class="notice">Reden: '+h(e.reason)+'</p>':'')+'<form id="entry" data-id="'+h(s.id)+'" data-version="'+h(e.version||0)+'"><fieldset '+(can?'':'disabled')+'><div class="pair">'+field('Begintijd',input('start','time',e.start||s.start,'required'))+field('Eindtijd',input('end','time',e.end||s.end,'required'))+'</div>'+field('Pauze in minuten',input('pause','number',e.pause??'','min="0" step="1" required placeholder="Bijv. 30"'))+'</fieldset><div class="net"><span>Netto gewerkt</span><strong id="net">—</strong></div><p class="err" role="alert"></p><div class="actions">'+(can?'<button class="primary">'+ic('Check',17)+'Uren indienen</button>':'')+(manages(s)&&e.status==='pending'&&!locked?btn('Goedkeuren','approve','Check','primary','data-id="'+h(s.id)+'"'):'')+(me.role==='admin'&&!isOwn&&!locked&&e.status==='approved'?btn('Heropenen voor correctie','return','RefreshCw','secondary','data-id="'+h(s.id)+'"'):'')+(s.entry?btn('Geschiedenis','history','History','secondary','data-id="'+h(s.id)+'"'):'')+btn('Berichten / reageren','conversation','Mail','secondary','data-id="'+h(s.id)+'"')+'</div></form>');updateNet()}
function updateNet(){const f=dlg.querySelector('#entry');if(!f)return;const s=state.shifts.find(s=>s.id===f.dataset.id);try{const n=workedMinutes(s.date,f.start.value,f.end.value,f.elements.pause.value);dlg.querySelector('#net').textContent=duration(n)}catch{dlg.querySelector('#net').textContent='—'}}
function register(){const ss=own().filter(s=>s.entry?.status!=='approved'&&s.date<=today()&&['shift','extra'].includes(s.kind)).sort((a,b)=>b.date.localeCompare(a.date));modal('Kies een dienst','<div class="choices">'+ss.slice(0,40).map(s=>'<button class="listrow" data-act="entry" data-id="'+h(s.id)+'"><span><b>'+h(niceDate(s.date))+'</b><small>'+planned(s)+'</small></span>'+badge(status(s))+'</button>').join('')+'</div>'+btn('Ongeplande dienst toevoegen','extra','Plus'))}
function go(page){view.page=page;dlg.close();render();scrollTo({top:0,behavior:'instant'})}
const presented=new Set();
function manages(s){
  return me.role==='admin' || s.user!==me.id && me.role==='lead' && state.leads[s.date]?.includes(me.id);
}
function reviewQueue(){
  return state.shifts.filter(s=>manages(s) && status(s)==='pending');
}
const alertTitles={return:'Controleer je uren',reject:'Uren afgewezen',cancel:'Dienst vervallen',message:'Bericht',restore:'Dienst hersteld',plan:'Planning gewijzigd'};
function personalAlerts(){
  return availabilityAlerts().concat((state.notifications||[]).filter(e=>{
    const shift=state.shifts.find(s=>s.id===e.id);
    if(!shift || !alertTitles[e.action])return false;
    return shift.user===me.id || (e.action==='message' && e.actor===shift.user && manages(shift));
  }).sort((a,b)=>(b.at||'').localeCompare(a.at||'') || Number(b.key)-Number(a.key)));
}
function localTime(at){
  if(!at || Number.isNaN(Date.parse(at)))return '';
  return new Intl.DateTimeFormat('nl-NL',{timeZone:'Europe/Amsterdam',dateStyle:'short',timeStyle:'short'}).format(new Date(at));
}
function alertRows(rows){
  return rows.map(e=>{
    if(e.availability)return '<button class="listrow" data-act="availabilityAlert" data-id="'+h(e.id)+'" data-key="'+h(e.key)+'"><span><b>'+h(e.title)+'</b><small>'+h(niceDate(e.date))+' · '+h(e.text)+'</small></span>'+ic('ChevronRight')+'</button>';
    const shift=state.shifts.find(s=>s.id===e.id);
    return '<button class="listrow" data-act="alert" data-id="'+h(e.id)+'" data-key="'+h(e.key)+'"><span><b>'+h(e.actorName||person(e.actor))+' · '+h(alertTitles[e.action])+'</b><small>'+h(niceDate(shift.date))+'</small>'+ (e.text?'<small>'+h(e.text)+'</small>':'')+'</span>'+ic('ChevronRight')+'</button>';
  }).join('');
}
function popupAlerts(){
  const rows=personalAlerts().filter(e=>!e.seen&&!presented.has(me.id+e.key));
  if(!rows.length||dlg.open)return;
  rows.forEach(e=>presented.add(me.id+e.key));
  modal('Nieuwe berichten',alertRows(rows)+btn('Later bekijken','dismiss'));
}
function rosterDetails(s){if(s.kind==='off')return conversation(s.id);
  modal('Dienst bekijken','<p>'+h(niceDate(s.date))+' · '+h(person(s.user))+'</p><p>'+h(area(s))+' · '+planned(s)+'</p><p>'+h(s.task)+'</p>'+btn('Berichten','conversation','Mail','secondary','data-id="'+h(s.id)+'"'));
}
async function conversation(id,selected){
const s=state.shifts.find(s=>s.id===id),events=selected?[{...selected,after:{message:selected.text}}]:(await action('history',{id})).filter(e=>alertTitles[e.action]);
const proposal=s.kind==='off'?state.offers?.[id]?.offer:null;
let answer='';
if(proposal){
  answer='<p><strong>'+ (proposal.counter?'Tegenvoorstel':'Voorgestelde dienst')+' · '+h(proposal.start)+' – '+h(proposal.end)+'</strong></p>';
  const attrs='data-id="'+h(id)+'" data-token="'+h(proposal.token)+'"';
  if(!proposal.counter && s.user===me.id){
    answer+=btn('Deze tijden accepteren','acceptOffer','Check','primary',attrs)+btn('Vrij houden','declineOffer','X','secondary',attrs)+btn('Andere tijden voorstellen','counterForm','Clock3','secondary',attrs);
  }else if(proposal.counter && manages(s)){
    answer+=btn('Tegenvoorstel goedkeuren','approveCounter','Check','primary',attrs)+btn('Tegenvoorstel afwijzen','rejectForm','X','secondary',attrs);
  }
}
modal('Dienst · '+niceDate(s.date),'<p>'+h(person(s.user))+'</p>'+events.map(e=>'<div class="historyitem"><b>'+h(e.actorName||person(e.actor))+' · '+h(({return:'Aanpassing gevraagd',reject:'Uren afgewezen',cancel:'Dienst vervallen',message:'Bericht',restore:'Hersteld',submit:'Ingediend',selfApprove:'Zelf goedgekeurd',approve:'Goedgekeurd'})[e.action]||e.action)+'</b><small>'+h(localTime(e.at))+'</small><p>'+h(e.after?.message||e.after?.reason||e.after?.entry?.reason||'')+'</p></div>').join('')+answer+(s.user===me.id&&!['off','standby','cancelled'].includes(s.kind)?btn(s.entry?.status==='approved'?'Uren bekijken':s.entry?'Uren bekijken of aanpassen':'Uren invullen','entry','Pencil','primary','data-id="'+h(id)+'"'):'')+(s.kind!=='off'&&manages(s)?btn(s.entry?.status==='pending'?'Uren beoordelen':'Dienst en uren bekijken','entry','Clock3','primary','data-id="'+h(id)+'"'):'')+(me.role!=='employee'&&(s.kind==='cancelled'||s.entry?.status==='rejected')?'<form id="restore" data-id="'+h(id)+'">'+field('Reden voor herstel',input('reason','text','','required'))+'<p class="err"></p><button class="primary">Dienst herstellen</button></form>':'')+'<form id="message" data-id="'+h(id)+'">'+field('Bericht',input('message','text','','required maxlength="1000"'))+'<p class="err"></p><button class="secondary">Bericht versturen</button></form>');
}
function openActions(){
  return [...reviewQueue(),...state.shifts.filter(s=>(s.user===me.id&&['missing','returned'].includes(status(s)))||(manages(s)&&status(s)==='missing'))];
}
function notify(reviewOnly=false){
  const q=reviewOnly?reviewQueue():openActions();
  const messages=reviewOnly?'':alertRows(personalAlerts());
  modal(reviewOnly?'Nog te beoordelen':'Meldingen',(messages?'<h3>Berichten</h3>'+messages:'')+(reviewOnly?'':'<h3>Openstaande acties</h3>')+(q.length?q.map(s=>'<button class="listrow" data-act="'+(s.user===me.id?'entry':'reviewday')+'" data-id="'+h(s.id)+'" data-day="'+h(s.date)+'"><span><b>'+h(person(s.user))+'</b><small>'+h(niceDate(s.date))+'</small></span>'+badge(status(s))+'</button>').join('') :'<p>Geen overige openstaande acties.</p>'))}
function fail(e){const msg=e.message||String(e),err=dlg.open?dlg.querySelector('.err'):app.querySelector('.err');if(err)err.textContent=msg;else toast(msg)}
document.addEventListener('click',async ev=>{const b=ev.target.closest('[data-act]');if(!b||busy)return;const {act,id,day,page}=b.dataset;
try{if(act==='dismiss')dlg.close();else if(['leaveForm','leaveYes','leaveNo','leaveCounter'].includes(act))availabilityDialog(act,id);else if(act==='availabilitySlot'){modal('Dienst voorstellen','<form id="availabilitySlot" data-id="'+h(id)+'"><p>'+h(person(id))+' · '+h(niceDate(view.day))+'</p>'+field('Vanaf',input('start','time','','required'))+field('Tot',input('end','time','','required'))+field('Bericht',input('reason','text','','maxlength="1000"'))+'<p class="err"></p><button class="primary">Voorstel versturen</button></form>')}else if(act==='availabilityAlert'){await action('seen',{key:b.dataset.key});await refresh();const l=state.leave.find(x=>x.id===id);modal('Beschikbaarheid',availabilityCard(l))}else if(act==='authmode')login(b.dataset.mode);else if(act==='page')go(page);else if(act==='day'){view.day=day;render()}else if(act==='prev'||act==='next'){const n=act==='prev'?-7:7;view.day=dateAdd(view.day,n);view.week=dateAdd(view.week,n);render()}else if(act==='register')register();else if(act==='entry')showEntry(state.shifts.find(s=>s.id===id));else if(act==='account')modal(live?'Mijn account':'Wissel van demoprofiel',live?'<p>'+h(me.name)+' · '+h(roles[me.role])+'</p>'+btn('Afmelden','logout','LogOut'):'<p class="dialogsub">Test dezelfde dienst vanuit een andere rol. De fictieve gegevens blijven in deze browser.</p>'+(api.configured?'<p><a href="?live=1">Inloggen met een persoonlijk account</a></p>':'')+demoAccounts().map(p=>'<button class="listrow" data-act="switch" data-id="'+h(p.id)+'"><b class="avatar">'+h(initials(p.name))+'</b><span><b>'+h(p.name)+'</b><small>'+h(roles[p.role])+'</small></span>'+(p.id===me.id?ic('Check'):'')+'</button>').join(''));else if(act==='switch'){selectDemo(id);view.page='overview';dlg.close();await refresh()}else if(act==='logout'){try{await api.logout()}finally{state=me=null;dlg.close();login()}}else if(act==='notifications')notify();else if(act==='reviewqueue')notify(true);else if(act==='reviewday'){view.day=day;go('review')}else if(act==='offerqueue'){modal('Dienstvoorstellen',own().filter(s=>s.kind==='off'&&state.offers?.[s.id]?.offer&&!state.offers[s.id].offer.counter).map(s=>btn(niceDate(s.date)+' · '+offerSummary(s),'conversation','Mail','listrow','data-id="'+h(s.id)+'"')).join(''))}else if(act==='counterForm'||act==='rejectForm'){const counter=act==='counterForm';modal(counter?'Andere tijden voorstellen':'Tegenvoorstel afwijzen','<form id="'+(counter?'counterOffer':'rejectCounter')+'" data-id="'+h(id)+'" data-token="'+h(b.dataset.token)+'">'+(counter?field('Van',input('start','time','','required'))+field('Tot',input('end','time','','required')):field('Reden',input('reason','text','','required maxlength="300"')))+'<p class="err"></p><button class="primary">'+(counter?'Voorstel versturen':'Afwijzen')+'</button></form>')}else if(['approveCounter','acceptOffer','declineOffer'].includes(act)){busy=true;try{await action(act,{id,token:b.dataset.token});dlg.close();await refresh();toast(act!=='declineOffer'?'Dienst ingepland.':'Je houdt vrij.')}finally{busy=false}}else if(act==='conversation'){await conversation(id)}else if(act==='alert'){await action('seen',{key:b.dataset.key});await refresh();const notice=personalAlerts().find(e=>e.key===b.dataset.key);if(notice?.action==='plan')rosterDetails(state.shifts.find(s=>s.id===id));else await conversation(id,notice)}else if(act==='extra'){modal('Ongeplande dienst','<form id="extra">'+field('Datum',input('date','date',today(),'max="'+today()+'" required'))+field('Werkplek',input('area','text','Speelvloer','required'))+'<div class="pair">'+field('Begin',input('start','time','','required'))+field('Einde',input('end','time','','required'))+'</div>'+field('Pauze in minuten',input('pause','number','','required min="0" step="1"'))+'<p class="err"></p><button class="primary">Extra dienst indienen</button></form>')}else if(act==='history'){const events=await action('history',{id});modal('Wijzigingsgeschiedenis',events.map(e=>'<div class="historyitem"><b>'+h(({submit:'Ingediend',selfApprove:'Zelf goedgekeurd',approve:'Goedgekeurd',return:'Aanpassing gevraagd'}[e.action])||e.action)+'</b><small>'+h([localTime(e.at||e.time||e.created_at),person(e.actor)].filter(Boolean).join(' · '))+'</small></div>').join('')||'<p>Geen wijzigingen gevonden.</p>')}else await manageClick(act,b,ctx())}catch(e){fail(e)}});
document.addEventListener('submit',async ev=>{ev.preventDefault();if(busy)return;busy=true;const f=ev.target,p=Object.fromEntries(new FormData(f)),button=f.querySelector('button:not([type="button"])');if(button)button.disabled=true;
try{if(f.id==='availabilitySlot'){await action('leaveRequest',{...p,proposeShift:true,mode:'range',date:view.day,user:f.dataset.id});dlg.close();await refresh();toast('Voorstel verstuurd.')}else if(['leaveRequest','leaveReject','leaveApprove'].includes(f.id)){await action(f.id,{...p,id:f.dataset.id,revision:Number(f.dataset.revision),alternative:f.dataset.counter==='true',changes:JSON.parse(f.dataset.changes||'[]')});dlg.close();await refresh();toast('Beschikbaarheid bijgewerkt.')}else if(f.id==='login'){const m=f.dataset.mode;if(m==='code'){await api.sendCode(p.email);login('verify',p.email)}else if(m==='recover'){await api.recover(p.email);login('reset',p.email)}else{if(m==='reset'){await api.verifyRecovery(p.email,p.code);await api.setPassword(p.password)}else if(m==='password')await api.loginPassword(p.email,p.password);else if(m==='invite')await api.verifyInvitation(p.email,p.code);else await api.verifyCode(p.email,p.code);await refresh()}}else if(f.id==='entry'){await action('submit',{...p,id:f.dataset.id,pause:Number(p.pause),version:Number(f.dataset.version)});await refresh();dlg.close();toast('Je uren zijn ingediend.')}else if(f.id==='extra'){const id=crypto.randomUUID();await action('extra',{...p,pause:Number(p.pause),id,user:me.id});await refresh();dlg.close();toast('Extra dienst ingediend ter beoordeling.')}else if(f.id==='message'){await action('message',{id:f.dataset.id,message:p.message});await refresh();await conversation(f.dataset.id)}else if(['counterOffer','rejectCounter'].includes(f.id)){await action(f.id,{...p,id:f.dataset.id,token:f.dataset.token});dlg.close();await refresh();toast('Antwoord verstuurd.')}else if(f.id==='offer'){await action('offer',{id:f.dataset.id,...p});dlg.close();await refresh();toast('Voorstel verstuurd.')}else await manageSubmit(f,p,ctx())}catch(e){fail(e)}finally{busy=false;if(button)button.disabled=false}});
document.addEventListener('input',e=>{if(e.target.form?.querySelector('[data-warning]'))updateAvailabilityForm(e.target.form);if(e.target.closest('#entry'))updateNet()});
document.addEventListener('change',e=>{const k=e.target.dataset.view;if(k&&e.target.value){view[k]=e.target.value;render()}});
dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close()});
window.addEventListener('storage',async()=>{if(!dlg.open){try{await refresh()}catch{if(live){state=me=null;login()}}}});
async function start(){try{if(live&&!api.loggedIn())login();else await refresh()}catch(e){if(live){login();fail(e)}else app.innerHTML='<main><p>'+h(e.message)+'</p></main>'}}
start();

setInterval(()=>{if(state&&!busy&&!dlg.open&&!document.hidden)refresh().catch(()=>{});},30000);
