import {today,add,available,affected,remaining,weeklyConflicts,ruleFor,fallbackShift} from './model.js';
import {opening} from './settings.js';
import {button,form,field,times,select,clock,h,name,dateLabel,weekNames,requestName} from './view.js';
const reason=(required=false)=>field(required?'Reden':'Toelichting (optioneel)','reason','text','',required?'required':'');
export function availabilityDialog({db,actor,action,id,open,modal,show,toggleTimes,lateNotice,setSnapshots}){
 if(action==='decision'){
  const r=db.requests.find(x=>x.id===id);const snapshots={};setSnapshots(snapshots);
  let effects='';
  if(r.kind==='weekly'){
   const conflicts=weeklyConflicts(db,r);
   effects+=conflicts.map(s=>'<p>'+h(dateLabel(s.date)+' · '+clock(s))+'</p>'+button('Dienst bekijken en aanpassen','requestShift',r.id+'|'+s.id)).join('');
   if(conflicts.length)effects+='<label><input type="checkbox" name="keep" value="yes" required> Nieuwe beschikbaarheid goedkeuren en deze '+conflicts.length+' diensten behouden</label>';
  }
  for(const s of r.kind==='leave'?affected(db,r):[]){
   snapshots[s.id]=JSON.stringify(s);const parts=remaining(s,r);
   const opts=parts.map((t,i)=>[String(i),'Werken '+clock(t)]);
   if(parts.length===2)opts.unshift(['all','Beide diensten · '+parts.map(clock).join(' en ')]);
   opts.push(['none','Dienst vervalt']);
   effects+=button('Dienst bekijken en aanpassen','requestShift',r.id+'|'+s.id)+select(dateLabel(s.date)+' · '+clock(s),'choice-'+s.id,opts);
  }
  open('Aanvraag beoordelen','<p>'+h(name(db,r.user)+' · '+requestName(r))+'</p><p>'+h(r.reason)+'</p>'+form('accept',effects,'Aanvraag goedkeuren',id)+form('reject',reason(true),'Aanvraag afwijzen',id));return true;
 }
 if(['leave','weekly','extra'].includes(action)){
  let body=field(action==='weekly'?'Geldig vanaf':'Datum','date','date',id||today(),'required min="'+today()+'"');
  if(action==='weekly')body+=select('Weekdag','weekday',weekNames.map((n,i)=>[i+1,n]));
  if(action==='leave')body+=field('Tot en met (bij meerdere dagen)','through','date');
  const modes=action==='leave'?[['all','Hele dag vrij'],['range','Deel van de dag']]:[['all','Hele dag ('+clock(opening(db,id||today()))+')'],['from','Beschikbaar vanaf'],['until','Beschikbaar tot'],['range','Tussen twee tijden']];
  if(action==='weekly')modes.push(['off','Niet beschikbaar']);
  if(action==='leave')body+='<p id="late" role="status"></p>';
  body+=select('Beschikbaarheid','mode',modes)+field('Begintijd','start','time')+field('Eindtijd','end','time')+(action==='extra'?'':reason());
  open({leave:'Vrij vragen',weekly:'Vaste beschikbaarheid wijzigen',extra:'Extra beschikbaar'}[action],form(action,body,'Versturen'));toggleTimes();lateNotice();return true;
 }

 return false;
}
