import {today,mayReview} from './model.js';
import {opening} from './settings.js';
import {netMinutes} from './administration.js';
import {form,field,button,timeStepper,pauseField,netPreview,name,dateLabel,clock,h,chip,duration} from './view.js';
const reason=()=>field('Reden','reason','text','','required');
const at=t=>t?new Date(t).toLocaleString('nl-NL',{timeZone:'Europe/Amsterdam'}):'Niet vastgelegd';
export function hoursDialog({db,actor,action,id,open}){
 const s=db.shifts.find(s=>s.id===id),e=db.hours[id];
 if(action==='unplanned'){
  open('Ongeplande dienst',form('unplanned',field('Datum','date','date',today(),'required max="'+today()+'"')+timeStepper(opening(db,today()))+pauseField()+netPreview+field('Werkplek','area','text','Speelvloer','required'),'Uren indienen'));return true;
 }
 if(action==='reopenHours'){open('Uren heropenen','<p>De medewerker kan de uren opnieuw invullen. De eerdere versie en goedkeuring blijven bewaard.</p>'+form(action,reason(),'Heropenen',id));return true;}
 if(!['entry','inspect'].includes(action))return false;
 if(!s)return true;
 const locked=db.months?.[s.date.slice(0,7)]?.closed;
 const editable=!locked&&action==='entry'&&s.user===actor.id&&(!e||e.status==='returned');
 let body='<p>'+h(name(db,s.user)+' · '+dateLabel(s.date))+'</p>'+chip(e?.status)+'<p>'+h('Gepland '+clock(s)+' · '+s.area)+'</p>';
 if(e){
  body+='<p>'+h(clock(e)+' · '+e.pause+' min pauze · Netto '+duration(netMinutes(e)))+'</p>'+chip(clock(e)===clock(s)?'approved':'pending',clock(e)===clock(s)?'Volgens rooster':'Gepland '+clock(s));
  if(e.reason)body+='<p class="reason"><strong>Reden:</strong> '+h(e.reason)+'</p>';
  if(e.approvedAt||e.status==='approved')body+='<p>Goedgekeurd door '+h(e.approvedBy?name(db,e.approvedBy):'niet vastgelegd (oude registratie)')+' · '+h(at(e.approvedAt))+'</p>';
 }
 if(locked)body+='<p>Deze maand is afgesloten. De bedrijfsleider kan de maand heropenen.</p>';
 if(editable)body+=form('hours',timeStepper(e||s)+pauseField(e?.pause??'')+netPreview,'Uren indienen',id);
 if(!locked&&action==='inspect'&&e?.status==='pending'&&mayReview(db,actor,s))body+=button('Goedkeuren','approve',id,true)+form('return',reason(),'Aanpassen vragen',id)+(s.unplanned?form('rejectHours',reason(),'Ongeplande dienst afwijzen',id):'');
 if(!locked&&actor.role==='admin'&&e?.status==='approved')body+=button('Heropenen met reden','reopenHours',id);
 if(e?.history?.length)body+='<details><summary>Geschiedenis ('+e.history.length+')</summary>'+e.history.slice().reverse().map(v=>'<article class="history"><b>'+h(({hours:'Uren ingediend',unplanned:'Ongeplande uren ingediend',approve:'Goedgekeurd',return:'Aanpassen gevraagd',rejectHours:'Afgewezen',reopenHours:'Heropend'})[v.action]||v.action)+'</b><p>'+h(name(db,v.by)+' · '+at(v.at))+'</p>'+(v.reason?'<p>'+h(v.reason)+'</p>':'')+(v.previous?'<p>Eerdere versie: '+h(clock(v.previous)+' · '+v.previous.pause+' min pauze')+'</p>':'')+'</article>').join('')+'</details>';
 open(editable?'Uren invullen':'Gewerkte uren',body);return true;
}
