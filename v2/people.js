import {activePeople} from './model.js';
import {card,line,button,subtabs,roleNames,areaNames} from './view.js';

// Subkopjes onder Rooster, alleen voor de bedrijfsleider.
export const rosterTabs=(actor,page)=>actor.role==='admin'
 ?subtabs([['Teamrooster','team',0],['Medewerkers','people',0]],page):'';

// Eén regel per persoon: rol, contracturen en telefoonnummer, met de knop Wijzigen.
const personRow=p=>'<div class="compact">'+line(p.name,
 roleNames[p.role]+' · '+(p.contract==='uren'?'Uren':'Vast')+' · '+p.contractHours+' uur per week · '+areaNames(p.areas)
  +(p.tracksHours===false?' · Geen uren':'')+(p.phone?' · '+p.phone:''),button('Wijzigen','person',p.id))+'</div>';

export function peoplePage(db,actor){
 const add=button('Medewerker toevoegen','person','',true);
 const inactive=db.people.filter(p=>p.active===false)
  .map(p=>'<div class="compact">'+line(p.name,roleNames[p.role],button('Weer actief maken','reactivate',p.id))
   +'</div>');
 return rosterTabs(actor,'people')+card('Medewerkers',add+activePeople(db).map(personRow).join(''))
  +(inactive.length?card('Inactief',inactive.join('')):'');
}
