import {fmt,h} from '../ui.js';
export {h};
export const dateLabel=d=>fmt(d,{weekday:'short',day:'numeric',month:'short'});
export const clock=s=>s.start+'–'+s.end;
export const duration=m=>(m<0?'−':'')+Math.floor(Math.abs(m)/60)+'u '+Math.abs(m)%60+'m';
export const labels={pending:'Wacht op beoordeling',approved:'Goedgekeurd',rejected:'Afgewezen',
 returned:'Aanpassen gevraagd',missing:'Ontbreekt',busy:'Dienst bezig'};
// Eén set statuslabels: dezelfde tekst en kleur overal in de app.
const tones={missing:'bad',pending:'wait',returned:'bad',approved:'ok',rejected:'off',busy:'busy'};
export const chip=(status,text=labels[status])=>'<span class="chip chip-'+tones[status]+'">'+h(text)+'</span>';
// Rood bolletje met een aantal; niets als er niets te doen is.
export const badge=n=>n?'<span class="badge" aria-label="'+n+' te doen">'+n+'</span>':'';
// Subkopjes boven een pagina: [tekst, pagina, aantal]. Het gekozen kopje is donker.
const subtab=([label,page,n],current)=>'<button type="button" class="'+(page===current?'primary':'secondary')
 +'" data-act="page" data-id="'+page+'"><span class="tabicon">'+h(label)+badge(n)+'</span></button>';
export const subtabs=(items,current)=>'<div class="weeknav">'+items.map(i=>subtab(i,current)).join('')+'</div>';
export const button=(label,act,id='',primary=false)=>'<button type="button" class="'+(primary?'primary':'secondary')+'" data-act="'+h(act)+'" data-id="'+h(id)+'">'+h(label)+'</button>';
export const link=(label,href)=>
 '<a class="secondary" href="'+h(href)+'" target="_blank" rel="noopener">'+h(label)+'</a>';
export const card=(title,body)=>'<section class="card"><h2>'+title+'</h2>'+body+'</section>';
export const line=(title,description,actions='',status='')=>'<article class="vrow"><div><b>'+h(title)+'</b><small>'
 +h(description)+'</small>'+(status?'<div class="chips">'+status+'</div>':'')
 +'</div><div class="vactions">'+actions+'</div></article>';
export function field(label,name,type,value='',extra=''){
 if(type==='time'){
  const options=['<option value="">Kies tijd</option>'];
  for(let m=0;m<1440;m+=15){
   const time=String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
   options.push('<option '+(time===value?'selected ':'')+'value="'+time+'">'+time+'</option>');
  }
  if(value&&!options.some(o=>o.includes('value="'+value+'"')))options.push('<option selected value="'+h(value)+'">'+h(value)+' (bestaand)</option>');
  return '<label class="field"><span>'+h(label)+'</span><select name="'+name+'" '+extra+'>'+options.join('')+'</select></label>';
 }
 return '<label class="field"><span>'+h(label)+'</span><input name="'+name+'" type="'+type+'" value="'+h(value)+'" '+extra+'></label>';
}
// Pauze: knoppen 0–60 min en Anders. De gekozen knop is donkergroen; het minutenveld verschijnt alleen bij Anders.
// De gekozen pauze staat in het verborgen veld 'pause'; daaronder de regel met netto uren (#net).
export function pauseField(value=''){
 const known=['0','15','30','45','60'],v=String(value),other=v!==''&&!known.includes(v);
 const choices=known.map(n=>button(n+' min','pause',n,v===n)).join('')+button('Anders','pause','other',other);
 return '<div class="field"><span>Pauze</span><div class="pausechoices">'+choices+'</div></div>'
  +'<input type="hidden" name="pause" value="'+h(v)+'">'
  +'<label class="field" id="pauseother"'+(other?'':' hidden')+'><span>Pauze in minuten</span>'
  +'<input name="pauseOther" type="number" min="0" step="1" value="'+(other?h(v):'')+'"></label>'
  +'<p class="net" id="net"></p>';
}
export const select=(label,name,opts)=>'<label class="field"><span>'+label+'</span><select name="'+name+'">'+opts.map(([k,v])=>'<option value="'+h(k)+'">'+h(v)+'</option>').join('')+'</select></label>';
export const times=(s={})=>'<div class="pair">'+field('Van','start','time',s.start||'','required')+field('Tot','end','time',s.end||'','required')+'</div>';
export const form=(action,body,label,id='')=>'<form data-op="'+action+'" data-id="'+h(id)+'">'+body+'<p role="alert" class="err"></p><button class="primary">'+label+'</button></form>';
export const name=(db,id)=>db.people.find(p=>p.id===id)?.name||'';
export const moment=iso=>new Intl.DateTimeFormat('nl-NL',
 {timeZone:'Europe/Amsterdam',weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})
 .format(new Date(iso));
// Wie keurde goed (of eerder goed) en wie heropende, als korte tekst.
export function approvalText(db,e){
 if(!e?.approvedBy)return '';
 const by=name(db,e.approvedBy)+' · '+moment(e.approvedAt);
 if(e.status==='approved')return 'Goedgekeurd door '+by;
 return 'Eerder goedgekeurd door '+by+(e.reopenedBy?' · Heropend door '+name(db,e.reopenedBy):'');
}
export const sortDate=(a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start);
export const weekNames=['Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag','Zondag'];
export const requestName=r=>r.kind==='weekly'?weekNames[r.weekday-1]+' · '+(r.off?'Vrij':r.start?clock(r):'Hele dag beschikbaar'):dateLabel(r.date)+(r.through!==r.date?' t/m '+dateLabel(r.through):'')+(r.start?' · '+clock(r):' · Hele dag vrij');
export const requestStatus=r=>r.status==='pending'?'Wacht op akkoord':labels[r.status];
export const requestChip=r=>chip(r.status,requestStatus(r));
