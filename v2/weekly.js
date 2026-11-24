// De Weekly (ronde 14): het bericht van de bedrijfsleider bij een gepubliceerde week. Alleen weergave.
import {add,today,monday,weeklyFor,mustRead,weeklyReaders,displayName} from './model.js';
import {h,button,dateLabel} from './view.js';

// ISO-weeknummer (week 1 is de week met de eerste donderdag van het jaar).
export function weekNumber(week){
 const thursday=new Date(add(week,3)+'T12:00Z'),jan1=new Date(thursday.getUTCFullYear()+'-01-01T12:00Z');
 return 1+Math.floor((thursday-jan1)/864e5/7);
}
export const weeklyTitle=week=>'Weekly · week '+weekNumber(week)+' ('+dateLabel(week)+' – '+dateLabel(add(week,6))+')';

// Tekst met regels die met "- " beginnen: die worden een opsomming.
function body(text){
 let html='',list=[];
 const flush=()=>{if(list.length)html+='<ul>'+list.map(x=>'<li>'+h(x)+'</li>').join('')+'</ul>';list=[]};
 for(const raw of text.split('\n')){
  const line=raw.trim();
  if(/^[-•*]\s+/.test(line)){list.push(line.replace(/^[-•*]\s+/,''));continue}
  flush();
  if(line)html+='<p>'+h(line)+'</p>';
 }
 flush();
 return html;
}
// Bij de bedrijfsleider: wie hem al heeft gelezen.
function readers(db,w){
 const all=weeklyReaders(db),done=all.filter(p=>(w.reads[p.id]||0)>=w.version);
 const open=all.filter(p=>!done.includes(p));
 return '<p class="weeklyreads">Gelezen door '+done.length+' van '+all.length
  +(open.length?'<br>Nog niet gelezen: '+h(open.map(p=>displayName(db,p.id)).join(', ')):'')+'</p>';
}
export function weeklyCard(db,actor,week){
 const w=weeklyFor(db,week);
 if(!w)return '';
 const admin=actor.role==='admin',unread=mustRead(db,actor.id,week);
 const img=w.image?'<img class="weeklyimg" src="'+h(w.image)+'" alt="Afbeelding bij de weekly">':'';
 const foot=admin?readers(db,w)+button('Weekly aanpassen','weeklyEdit',week)
  :unread?button('Ik heb de weekly gelezen','weeklyRead',week,true):'';
 const head='Week '+weekNumber(week)+' · '+dateLabel(week)+' – '+dateLabel(add(week,6));
 return '<section class="weekly'+(unread?' unread':'')+'"><p class="weeklytag">Weekly</p>'
  +'<h3 class="weeklyhead">'+h(head)+'</h3>'
  +(unread?'<p class="weeklyhint">Lees eerst de weekly. Daarna zie je het rooster van deze week.</p>':'')
  +'<div class="weeklytext">'+body(w.text)+'</div>'+img+foot+'</section>';
}
// Weken met een weekly die deze persoon nog moet lezen (vanaf deze week).
export function unreadWeeks(db,actor){
 return [...new Set((db.weeklies||[]).map(w=>w.week))].filter(week=>week>=monday(today())
  &&mustRead(db,actor.id,week)).sort();
}
