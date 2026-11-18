import {fmt,h} from '../ui.js';
export {h};
export const dateLabel=d=>fmt(d,{weekday:'short',day:'numeric',month:'short'});
export const clock=s=>s.start+'–'+s.end;
export const labels={pending:'Wacht op beoordeling',approved:'Goedgekeurd',rejected:'Afgewezen',returned:'Opnieuw controleren'};
export const button=(label,act,id='',primary=false)=>'<button type="button" class="'+(primary?'primary':'secondary')+'" data-act="'+h(act)+'" data-id="'+h(id)+'">'+h(label)+'</button>';
export const card=(title,body)=>'<section class="card"><h2>'+title+'</h2>'+body+'</section>';
export const line=(title,description,actions='')=>'<article class="vrow"><div><b>'+h(title)+'</b><small>'+h(description)+'</small></div><div class="vactions">'+actions+'</div></article>';
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
export function pauseField(value=''){
 return '<div class="pausechoices" aria-label="Pauze">'+[0,15,30,45,60].map(n=>button(n+' min','pause',String(n))).join('')+button('Anders','pause','other')+'</div>'+field('Pauze in minuten','pause','number',value,'required min="0"');
}
export const select=(label,name,opts)=>'<label class="field"><span>'+label+'</span><select name="'+name+'">'+opts.map(([k,v])=>'<option value="'+h(k)+'">'+h(v)+'</option>').join('')+'</select></label>';
export const times=(s={})=>'<div class="pair">'+field('Van','start','time',s.start||'','required')+field('Tot','end','time',s.end||'','required')+'</div>';
export const form=(action,body,label,id='')=>'<form data-op="'+action+'" data-id="'+h(id)+'">'+body+'<p role="alert" class="err"></p><button class="primary">'+label+'</button></form>';
export const name=(db,id)=>db.people.find(p=>p.id===id)?.name||'';
export const sortDate=(a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start);
export const weekNames=['Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag','Zondag'];
export const requestName=r=>r.kind==='weekly'?weekNames[r.weekday-1]+' · '+(r.off?'Vrij':r.start?clock(r):'Hele dag beschikbaar'):dateLabel(r.date)+(r.through!==r.date?' t/m '+dateLabel(r.through):'')+(r.start?' · '+clock(r):' · Hele dag vrij');
export const requestStatus=r=>r.status==='pending'?'Wacht op akkoord':labels[r.status];
