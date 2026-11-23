import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// ui.js laadt bij het starten de iconen met fetch; in Node lezen we het bestand zelf.
globalThis.fetch=async url=>({json:async()=>JSON.parse(fs.readFileSync(new URL(url),'utf8'))});
const {pilotRoster}=await import('../v2/pilot.js');
const {apply}=await import('../v2/model.js');
const {availabilityPage}=await import('../v2/availability.js');

const person=(db,id)=>db.people.find(p=>p.id===id);

test('Bedrijfsleider ziet bij Aanvragen de subkopjes Mijn aanvragen en Beoordelen, met de vrije dag van Isis',t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-19T12:00:00+01:00')});
 const db=apply(pilotRoster(),'isis','leave',{date:'2026-12-24',through:'2026-12-26',reason:'Kerst'});
 const mine=availabilityPage(db,person(db,'eva'),{page:'availability'});
 assert.match(mine,/data-id="requests"><span class="tabicon">Beoordelen<span class="badge"[^>]*>1</);
 const review=availabilityPage(db,person(db,'eva'),{page:'requests'});
 assert.match(review,/Isis N[\s\S]*do 24 dec t\/m za 26 dec · Hele dag · Onbetaald vrij · 3 dagen/);
 assert.match(review,/data-act="decision"/);
 assert.doesNotMatch(availabilityPage(db,person(db,'isis'),{page:'availability'}),/Beoordelen/);
});

test('Onder Mijn aanvragen staan alleen open aanvragen en aanvragen waarvan de datum nog komt',t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-19T12:00:00+01:00')});
 let db=apply(pilotRoster(),'isis','leave',{date:'2026-12-24',reason:'Kerst'});
 db=apply(db,'eva','decide',{id:db.requests.at(-1).id,accept:true});
 const html=()=>availabilityPage(db,person(db,'isis'),{page:'availability'});
 assert.match(html(),/do 24 dec/);
 t.mock.timers.setTime(Date.parse('2026-12-25T12:00:00+01:00'));
 assert.doesNotMatch(html(),/do 24 dec/);
});

test('Extra beschikbaar op een gepubliceerde dag: Eva ziet het bij Beoordelen, Isis ziet het label',t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-19T12:00:00+01:00')});
 let db=apply(pilotRoster(),'isis','extra',{date:'2026-11-20',start:'12:00',end:'18:00'});
 const review=availabilityPage(db,person(db,'eva'),{page:'requests'});
 assert.match(review,/Isis N · vr 20 nov[\s\S]*12:00–18:00[\s\S]*data-act="extraDecision" data-id="isis\|2026-11-20"/);
 const isis=()=>availabilityPage(db,person(db,'isis'),{page:'availability'});
 assert.match(isis(),/chip-wait">Wacht op bedrijfsleider/);
 db=apply(db,'eva','declineExtra',{user:'isis',date:'2026-11-20'});
 assert.match(isis(),/chip-off">Niet ingepland/);
});

test('Onder Mijn aanvragen ziet de bedrijfsleider alleen haar eigen aanvragen, geen extra beschikbaarheid van anderen',t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-19T12:00:00+01:00')});
 const db=apply(pilotRoster(),'isis','extra',{date:'2026-12-10'});
 const mine=availabilityPage(db,person(db,'eva'),{page:'availability'});
 assert.doesNotMatch(mine,/Extra beschikbaar voor het rooster/);
 assert.doesNotMatch(mine,/Isis/);
});
