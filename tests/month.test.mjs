import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// ui.js laadt bij het starten de iconen met fetch; in Node lezen we het bestand zelf.
globalThis.fetch=async url=>({json:async()=>JSON.parse(fs.readFileSync(new URL(url),'utf8'))});
const {pilotRoster}=await import('../v2/pilot.js');
const {apply}=await import('../v2/model.js');
const {monthPage}=await import('../v2/month.js');

const view={page:'month',month:'2026-11'};
const page=db=>monthPage(db,db.people.find(p=>p.id==='eva'),view);
// De rij van een open dienst: alles vanaf de naam en datum tot het einde van die rij.
const openRow=(html,label)=>html.split('<h2>Nog open')[1].split(label)[1]?.split('</article>')[0]||'';

test('Maandoverzicht staat in een tabel met per medewerker een rij en een klikbare norm',()=>{
 const html=page(pilotRoster());
 assert.match(html,/<table class="monthgrid">/);
 for(const head of ['Medewerker','Goedgekeurd','Norm','Verschil','Open'])assert.match(html,new RegExp('<th>'+head+'</th>'));
 assert.equal(html.split('<tr class="person">').length-1,5);
 assert.match(html,/data-act="norm" data-id="elise">104u</);
});

test('Bij elke open dienst staat de juiste knop voor de bedrijfsleider',()=>{
 let db=apply(pilotRoster(),'sylvia','hours',{id:'sylvia-2026-11-17',start:'08:30',end:'18:00',pause:30});
 db=apply(db,'eva','return',{id:'sylvia-2026-11-17',reason:'pauze klopt niet'});
 const html=page(db);
 assert.match(openRow(html,'Elise B · ma 16 nov'),/data-act="inspect"[^>]*>Beoordelen</);
 assert.match(openRow(html,'Eva G. · di 17 nov'),/data-act="entry"[^>]*>Uren invullen</);
 assert.match(openRow(html,'Sylvia · wo 18 nov'),/wa\.me[^"]*nog%20invullen[^>]*>Herinner</);
 assert.match(openRow(html,'Sylvia · di 17 nov'),/wa\.me[^"]*aanpassen[^>]*>Herinner</);
});

test('Open diensten in het maandoverzicht tonen hun status als label',()=>{
 const html=page(pilotRoster());
 assert.match(openRow(html,'Elise B · ma 16 nov'),/<span class="chip chip-wait">Wacht op beoordeling<\/span>/);
 assert.match(openRow(html,'Eva G. · di 17 nov'),/<span class="chip chip-bad">Ontbreekt<\/span>/);
});
