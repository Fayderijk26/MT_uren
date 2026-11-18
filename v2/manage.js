import {today} from './model.js';
import {opening} from './settings.js';
import {card,button,line,field,select,h,weekNames,chip,form} from './view.js';
import {contactButtons} from './contacts.js';
export function managePage(db,actor){
 if(actor.role==='employee')return '';
 return card('Medewerkers',(actor.role==='admin'?button('Medewerker toevoegen','person','',true)+button('Openingstijden','settings'):'')+db.people.map(p=>line(p.name,({admin:'Bedrijfsleider',lead:'Dagleiding',employee:'Medewerker'})[p.role],chip(p.active===false?'rejected':'approved',p.active===false?'Inactief':'Actief')+contactButtons(db,actor,p.id)+(actor.role==='admin'?button('Wijzigen','person',p.id)+button('Uitnodiging voorbereiden','invite',p.id):''))).join(''));
}
export function personForm(db,id){
 const p=db.people.find(p=>p.id===id)||{},contract=(p.contracts||[]).filter(c=>c.from<=today()).sort((a,b)=>b.from.localeCompare(a.from))[0];
 return form('person',field('Naam','name','text',p.name||'','required')+select('Rol','role',[['employee','Medewerker'],['lead','Dagleiding'],['admin','Bedrijfsleider']])+field('Telefoonnummer (alleen voor leiding)','phone','tel',p.phone||'','placeholder="+31612345678"')+field('E-mailadres','email','email',p.email||'')+field('Contracturen per week','weeklyHours','number',contract?.weeklyHours??0,'min="0" max="80" step="0.25" required')+field('Contract geldig vanaf','from','date',today(),'required')+select('Status','active',[['yes','Actief'],['no','Inactief']]),'Opslaan',id);
}
export function settingsForm(db){
 let body='<p>Deze tijden gelden voor nieuwe keuzes “hele dag” en conceptroosters. Bestaande diensten en gewerkte uren blijven staan.</p>';
 for(let d=1;d<=7;d++){const o=opening(db,d);body+='<fieldset><legend>'+weekNames[d-1]+'</legend><div class="pair">'+field('Open','start'+d,'time',o.start)+field('Sluit','end'+d,'time',o.end)+'</div><label><input type="checkbox" name="closed'+d+'" '+(o.closed?'checked':'')+'> Gesloten</label></fieldset>';}
 return form('settings',body,'Openingstijden opslaan');
}
export function invitation(db,id){
 const p=db.people.find(p=>p.id===id);
 const subject='Uitnodiging Monkey Town urenapp';
 const body='Hoi '+p.name+',\n\nWil je de Monkey Town urenapp samen met mij testen?\nhttps://fayderijk26.github.io/MT_uren/\n\nDit is nog een demo: gegevens worden per browser opgeslagen en er is nog geen persoonlijke login. We spreken samen af hoe we testen.\n';
 return '<p>Bereid een e-mail voor in je eigen mailprogramma. Er wordt niets automatisch verzonden.</p><p><strong>Dit maakt nog geen inlogaccount.</strong> De proefapp werkt lokaal per browser; echte uitnodigingen vereisen de gedeelde database en inlogkoppeling.</p>'+(p.email?'<a class="primary" href="mailto:'+encodeURIComponent(p.email)+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body)+'">E-mail openen</a>':'<p>Vul eerst het e-mailadres van deze medewerker in.</p>'+button('Medewerker wijzigen','person',id));
}
