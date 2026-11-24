// Teksten bij een dienstvoorstel (ronde 15): waarom het een vraag is. Alleen weergave; de reden komt uit model.js.
import {offerReason,weekday} from './model.js';
import {name,weekNames,dateLabel} from './view.js';
import {availability} from './week.js';

const EXTRA=['unknown','free','unavailable'];
export const isExtra=(db,o)=>EXTRA.includes(offerReason(db,o).kind);
// Voor de medewerker: wie vraagt wat.
export function askText(db,o){
 const by=o.requestedBy?name(db,o.requestedBy):'De bedrijfsleider',kind=offerReason(db,o).kind;
 if(EXTRA.includes(kind))return by+' vraagt of je deze dienst kunt werken.';
 if(kind==='leave')return 'Je had vrij gevraagd. '+by+' vraagt of je toch wilt werken.';
 return 'Dit is buiten je aangegeven beschikbaarheid. '+by+' vraagt of je wilt werken.';
}
// Voor de bedrijfsleider: de reden in één zin.
export function reasonText(db,o){
 const who=name(db,o.row.user),why=offerReason(db,o),day=weekNames[weekday(o.row.date)-1].toLowerCase();
 return {unknown:'Extra dienst: '+who+' heeft voor deze dag geen beschikbaarheid opgegeven.',
  free:'Extra dienst: '+day+' is geen vaste werkdag van '+who+'.',
  unavailable:'Extra dienst: '+who+' gaf aan niet beschikbaar te zijn.',
  leave:who+' had vrij gevraagd voor deze dag.',
  outside:'Buiten de beschikbaarheid van '+who+': '+availability(db,o.row.user,o.row.date).toLowerCase()+'.'}[why.kind];
}
// Regel op Vandaag en bij Aanvragen.
const KIND={leave:'Op je vrije dag',outside:'Andere tijden gevraagd'};
export function offerTitle(db,o,admin){
 const kind=offerReason(db,o).kind;
 const day=(isExtra(db,o)?'Extra dienst':KIND[kind])+' · '+dateLabel(o.row.date);
 return admin?day+' · '+name(db,o.row.user):day;
}
