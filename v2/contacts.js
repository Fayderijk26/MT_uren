import {h} from './view.js';
export function contactButtons(db,actor,user,text){
 if(actor.role==='employee')return '';
 const p=db.people.find(p=>p.id===user);if(!p?.phone)return '<small class="muted">Geen telefoonnummer ingevuld</small>';
 let phone=p.phone.replace(/\D/g,'');if(phone.startsWith('00'))phone=phone.slice(2);else if(phone.startsWith('0'))phone='31'+phone.slice(1);
 return '<a class="secondary" href="tel:+'+h(phone)+'">Bellen</a><a class="secondary" target="_blank" rel="noopener" href="https://wa.me/'+h(phone)+'?text='+encodeURIComponent(text||'Hoi '+p.name+', ik heb een vraag over je rooster.')+'">'+(text?'Herinner via WhatsApp':'WhatsApp')+'</a>';
}
