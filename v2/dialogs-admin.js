import {personForm,settingsForm,invitation} from './manage.js';
import {exportMonth} from './administration.js';
import {button,form,field,h} from './view.js';
export function adminDialog({db,actor,action,id,open,modal,view}){
 if(!['person','settings','invite','closeMonth','reopenMonth','exportSummary','exportDetail','generatePrevious','generateAvailability'].includes(action))return false;
 if(actor.role!=='admin'){open('Niet beschikbaar','<p>Alleen de bedrijfsleider kan deze actie uitvoeren.</p>');return true;}
 if(action==='person'){
  open(id?'Medewerker wijzigen':'Medewerker toevoegen',personForm(db,id));const p=db.people.find(p=>p.id===id);
  if(p){modal.querySelector('[name=role]').value=p.role;modal.querySelector('[name=active]').value=p.active===false?'no':'yes';}return true;
 }
 if(action==='settings'){open('Openingstijden',settingsForm(db));return true;}
 if(action==='invite'){open('Uitnodiging voorbereiden',invitation(db,id));return true;}
 if(action.startsWith('export')){
  const data=exportMonth(db,actor,id),summary=action==='exportSummary',blob=new Blob([summary?data.summary:data.detail],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='MonkeyTown-'+id+'-'+(summary?'totalen':'uurregels')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return true;
 }
 if(action.startsWith('generate')){
  open('Conceptweek maken','<p>Alleen passende diensten worden als concept toegevoegd. Overlap, vrije dagen, onbekende beschikbaarheid en bestaande vragen worden overgeslagen.</p>'+(action==='generateAvailability'?'<p>Ruim beschikbaar betekent minimaal 6 uur aaneengesloten binnen de openingstijden, op een vaste werkdag.</p>':'')+form('generate','<input type="hidden" name="date" value="'+h(view.day)+'"><input type="hidden" name="source" value="'+(action==='generatePrevious'?'previous':'availability')+'">','Conceptweek maken'));return true;
 }
 open(action==='closeMonth'?'Maand afsluiten':'Maand heropenen',form(action,'<p>'+h(id)+'</p>'+(action==='closeMonth'?'<p>Alle uren moeten zijn afgehandeld. Na afsluiten zijn uren en diensten in deze maand vergrendeld.</p>':field('Reden','reason','text','','required'))+'<input type="hidden" name="month" value="'+h(id)+'">',action==='closeMonth'?'Afsluiten':'Heropenen'));
 return true;
}
