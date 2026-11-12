const symbols=await fetch(new URL('./assets/icons.json',import.meta.url)).then(r=>r.json());
export const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function ic(name,size=19){return '<svg aria-hidden="true" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(symbols[name]||[]).map(([tag,attrs])=>'<'+tag+' '+Object.entries(attrs).map(([k,v])=>k+'="'+h(v)+'"').join(' ')+'/>').join('')+'</svg>'}
export const roles={admin:'Bedrijfsleider',lead:'Leidinggevende',employee:'Medewerker'};
export const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Amsterdam'}).format(new Date());
export function dateAdd(d,n){const dt=new Date(d+'T12:00:00Z');dt.setUTCDate(dt.getUTCDate()+n);return dt.toISOString().slice(0,10)}
export function monday(d){return dateAdd(d,-((new Date(d+'T12:00:00Z').getUTCDay()+6)%7))}
export const fmt=(d,opts)=>new Intl.DateTimeFormat('nl-NL',{...opts,timeZone:'Europe/Amsterdam'}).format(new Date(d+'T12:00:00Z'));
export const duration=n=>Math.floor(Math.abs(n)/60)+'u'+(Math.abs(n)%60?' '+Math.abs(n)%60+'m':'');
export const mins=t=>!t?NaN:Number(t.slice(0,2))*60+Number(t.slice(3,5));
export const labelStatus={rejected:'Afgewezen',pending:'Ter beoordeling',approved:'Goedgekeurd',returned:'Aanpassen',planned:'Gepland',missing:'Ontbreekt',standby:'Stand-by',off:'Vrij gevraagd',cancelled:'Vervallen',office:'Kantoor'};
export function status(s){if(s.entry)return s.entry.status;if(['standby','off','cancelled'].includes(s.kind))return s.kind;const time=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Amsterdam',hour:'2-digit',minute:'2-digit'}).format(new Date());if(typeof s.missing==='boolean')return s.missing?'missing':'planned';return s.end&&(s.date<today()||s.date===today()&&s.end<=time)?'missing':'planned'}
export function badge(s){return '<span class="badge '+h(s)+'"><i></i>'+h(labelStatus[s]||s)+'</span>'}
export const btn=(label,action,icon,cls='secondary',attrs='')=>'<button type="button" class="'+h(cls)+'" data-act="'+h(action)+'" '+attrs+'>'+(icon?ic(icon,16):'')+h(label)+'</button>';
export const initials=name=>name.trim().split(/\s+/).map(x=>x[0]).filter((_,i,a)=>i===0||i===a.length-1).join('').toUpperCase();
export function modal(title,body){const d=document.querySelector('dialog');d.innerHTML='<div class="modalhead"><h2>'+h(title)+'</h2>'+btn('','dismiss','X','icon','aria-label="Sluiten"')+'</div>'+body;if(!d.open)d.showModal()}
export const field=(label,inner)=>'<label class="field"><span>'+h(label)+'</span>'+inner+'</label>';
export const input=(name,type,value='',attrs='')=>'<input name="'+h(name)+'" type="'+h(type)+'" value="'+h(value)+'" '+attrs+'>';
export const options=(items,value)=>items.map(([v,l])=>'<option value="'+h(v)+'" '+(v===value?'selected':'')+'>'+h(l)+'</option>').join('');
export function toast(msg){const t=document.querySelector('#toast');t.textContent=msg;t.classList.add('on');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('on'),4500)}
