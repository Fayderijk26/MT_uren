import {card,line,button,subtabs,roleNames} from './view.js';

// Subkopjes onder Rooster, alleen voor de bedrijfsleider.
export const rosterTabs=(actor,page)=>actor.role==='admin'
 ?subtabs([['Teamrooster','team',0],['Medewerkers','people',0]],page):'';

// Eén regel per persoon: rol, contracturen en telefoonnummer, met de knop Wijzigen.
const personRow=p=>'<div class="compact">'+line(p.name,
 roleNames[p.role]+' · '+p.contractHours+' uur per week'+(p.phone?' · '+p.phone:''),button('Wijzigen','person',p.id))+'</div>';

export function peoplePage(db,actor){
 const add=button('Medewerker toevoegen','person','',true);
 return rosterTabs(actor,'people')+card('Medewerkers',add+db.people.map(personRow).join(''));
}
