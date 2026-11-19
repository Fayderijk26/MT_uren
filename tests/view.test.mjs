import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// ui.js laadt bij het starten de iconen met fetch; in Node lezen we het bestand zelf.
globalThis.fetch=async url=>({json:async()=>JSON.parse(fs.readFileSync(new URL(url),'utf8'))});
const {pauseField}=await import('../v2/view.js');

const chosen=html=>[...html.matchAll(/class="primary"[^>]*data-id="([^"]*)"/g)].map(m=>m[1]);

test('Pauze: kopje en knoppen, het veld "Pauze in minuten" alleen na Anders',()=>{
 const html=pauseField('');
 assert.match(html,/<span>Pauze<\/span>/);
 for(const n of [0,15,30,45,60])assert.match(html,new RegExp('>'+n+' min<'));
 assert.match(html,/>Anders</);
 assert.match(html,/<label class="field" id="pauseother" hidden>/);
 assert.match(html,/<p class="net" id="net">/);
 assert.deepEqual(chosen(html),[]);
});

test('Pauze: een bekende pauze kleurt die knop, een andere pauze kleurt Anders en toont het veld',()=>{
 assert.deepEqual(chosen(pauseField(30)),['30']);
 const other=pauseField(20);
 assert.deepEqual(chosen(other),['other']);
 assert.match(other,/<label class="field" id="pauseother">/);
});

const {chip}=await import('../v2/view.js');
test('Eén set statuslabels: overal dezelfde tekst en kleur',()=>{
 assert.equal(chip('approved'),'<span class="chip chip-ok">Goedgekeurd</span>');
 assert.equal(chip('pending'),'<span class="chip chip-wait">Wacht op beoordeling</span>');
 assert.equal(chip('returned'),'<span class="chip chip-bad">Aanpassen gevraagd</span>');
 assert.equal(chip('missing'),'<span class="chip chip-bad">Ontbreekt</span>');
 assert.equal(chip('rejected'),'<span class="chip chip-off">Afgewezen</span>');
 assert.equal(chip('pending','Wacht op akkoord'),'<span class="chip chip-wait">Wacht op akkoord</span>');
});
