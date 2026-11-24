import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// ui.js laadt bij het starten de iconen met fetch; in Node lezen we het bestand zelf.
globalThis.fetch=async url=>({json:async()=>JSON.parse(fs.readFileSync(new URL(url),'utf8'))});
const {pilotRoster}=await import('../v2/pilot.js');
const {apply,absentMinutes,missing,ownTodo,monthSummary,leads,mayReview}=await import('../v2/model.js');
const {todayPage}=await import('../v2/today.js');
const {weekPage}=await import('../v2/week.js');
const {sickAskBody}=await import('../v2/view.js');

// Donderdag 19 november, 12:00. Elise werkt vandaag 08:30–18:00 en zaterdag 10:00–18:00. Iris is vandaag dagleiding.
const thursday=t=>t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-19T12:00:00+01:00')});
const person=(db,id)=>db.people.find(p=>p.id===id);
const saturday='elise-2026-11-21';

test('Ziek telt de geplande tijd min de pauzeregel: boven 3 uur 15 minuten, vanaf 6 uur 30 minuten',()=>{
 assert.equal(absentMinutes({start:'08:30',end:'15:00'}),360);
 assert.equal(absentMinutes({start:'10:00',end:'18:00'}),450);
 assert.equal(absentMinutes({start:'14:00',end:'17:00'}),180);
 assert.equal(absentMinutes({start:'14:00',end:'17:15'}),180);
});

test('Iris meldt Elise ziek voor zaterdag en Eva betaalt door: niet bij Nog in te vullen of ontbrekend, wel 7u 30m ziek',t=>{
 thursday(t);
 let db=apply(pilotRoster(),'iris','sick',{id:saturday});
 assert.deepEqual(db.shifts.find(s=>s.id===saturday).sick.by,'iris');
 db=apply(db,'eva','sickDecide',{id:saturday,paid:true});
 t.mock.timers.setTime(Date.parse('2026-11-23T12:00:00+01:00'));
 assert.ok(!ownTodo(db,person(db,'elise')).some(s=>s.id===saturday));
 assert.ok(!missing(db,person(db,'eva')).some(m=>m.shift.id===saturday));
 const row=monthSummary(db,'2026-11').find(r=>r.user==='elise');
 assert.equal(row.sick,450);
 assert.ok(!row.open.some(o=>o.shift.id===saturday));
});

test('Elise is al aan het werk: zelf ziek melden kan niet, Iris als dagleiding en Eva wel',t=>{
 thursday(t);
 const db=pilotRoster(),today='elise-2026-11-19';
 assert.throws(()=>apply(db,'elise','sick',{id:today}),/Bel de leidinggevende/);
 assert.ok(apply(db,'iris','sick',{id:today}).shifts.find(s=>s.id===today).sick);
 assert.ok(apply(db,'eva','sick',{id:today}).shifts.find(s=>s.id===today).sick);
});

test('Sylvia is vandaag geen dagleiding en Isis is medewerker: zij kunnen Elise niet ziek melden',t=>{
 thursday(t);
 const db=pilotRoster();
 for(const id of ['sylvia','isis'])assert.throws(()=>apply(db,id,'sick',{id:'elise-2026-11-19'}),/niet ziek melden/);
});

test('Iris meldt Elise ziek: Elise ziet een melding op Vandaag en de dienst als Ziek gemeld',t=>{
 thursday(t);
 const db=apply(pilotRoster(),'iris','sick',{id:'elise-2026-11-19'});
 const html=todayPage(db,person(db,'elise'));
 assert.match(html,/Ziek gemeld door Iris Z/);
 const mine=html.split('<h2>Mijn dienst vandaag')[1].split('</section>')[0];
 assert.match(mine,/chip-off">Ziek gemeld/);
 assert.doesNotMatch(mine,/data-act="entry"/);
});

test('Eva en Iris zien op Vandaag wie ziek is gemeld, en het rooster toont Ziek gemeld',t=>{
 thursday(t);
 const db=apply(pilotRoster(),'eva','sick',{id:saturday});
 for(const id of ['eva','iris'])
  assert.match(todayPage(db,person(db,id)).split('<h2>Ziek gemeld')[1]||'',/Elise B · za 21 nov/,id);
 assert.doesNotMatch(todayPage(db,person(db,'isis')),/<h2>Ziek gemeld/);
 assert.match(weekPage(db,{day:'2026-11-21'}),/10:00–18:00<\/b>(?:(?!<\/button>).)*Ziek gemeld/s);
});

test('Wie zichzelf ziek meldt (een leidinggevende), ziet dat ze ook moet bellen met de leidinggevende van de dag',()=>{
 const db=pilotRoster(),s=db.shifts.find(x=>x.id===saturday);
 const call=/Ziek melden doe je ook telefonisch bij de leidinggevende van de dag\. Dit mag niet alleen via deze app\./;
 assert.match(sickAskBody(db,s,true),call);
 assert.match(sickAskBody(db,s,true),/data-op="sick"/);
 assert.doesNotMatch(sickAskBody(db,s,false),call,'meldt de leiding iemand ziek, dan hoeft dit er niet');
});

test('Voor een ziek gemelde dienst kun je geen uren indienen en het rooster niet wijzigen',t=>{
 thursday(t);
 const db=apply(pilotRoster(),'eva','sick',{id:'elise-2026-11-19'});
 assert.throws(()=>apply(db,'elise','hours',{id:'elise-2026-11-19',start:'08:30',end:'11:00',pause:0}),/ziek gemeld/);
 const s=db.shifts.find(x=>x.id===saturday);
 const sat=apply(db,'eva','sick',{id:saturday});
 assert.throws(()=>apply(sat,'eva','draft',{...s,id:saturday,end:'17:00'}),/ziek gemeld/);
});

test('Niet ziek melden bij stand-by, ingediende uren of als de dienst al ziek gemeld is',t=>{
 thursday(t);
 const db=pilotRoster();
 assert.throws(()=>apply(db,'eva','sick',{id:'elise-2026-11-16'}),/al uren/);
 const twice=apply(db,'eva','sick',{id:saturday});
 assert.throws(()=>apply(twice,'eva','sick',{id:saturday}),/al ziek gemeld/);
 db.shifts.find(s=>s.id===saturday).deadline='09:00';
 assert.throws(()=>apply(db,'eva','sick',{id:saturday}),/stand-by/);
});

test('Ziekmelding intrekken: door wie het meldde of de bedrijfsleider, daarna ontbreken de uren weer',t=>{
 thursday(t);
 let db=apply(pilotRoster(),'iris','sick',{id:'elise-2026-11-19'});
 assert.throws(()=>apply(db,'elise','sickUndo',{id:'elise-2026-11-19'}),/Alleen/);
 assert.ok(!apply(db,'iris','sickUndo',{id:'elise-2026-11-19'}).shifts.find(s=>s.id==='elise-2026-11-19').sick);
 db=apply(db,'eva','sickUndo',{id:'elise-2026-11-19'});
 t.mock.timers.setTime(Date.parse('2026-11-20T12:00:00+01:00'));
 assert.ok(missing(db,person(db,'eva')).some(m=>m.shift.id==='elise-2026-11-19'));
});

test('Iris is ziek gemeld: die dag is zij geen dagleiding en keurt ze geen uren goed',t=>{
 thursday(t);
 const db=apply(pilotRoster(),'eva','sick',{id:'iris-2026-11-19'});
 assert.ok(!leads(db,'2026-11-19').includes('iris'));
 assert.ok(!mayReview(db,person(db,'iris'),db.shifts.find(s=>s.id==='elise-2026-11-19')));
});

test('In een afgesloten maand kan niemand ziek melden of een ziekmelding intrekken',t=>{
 thursday(t);
 let db=apply(pilotRoster(),'eva','sick',{id:'elise-2026-11-19'});
 db=apply(db,'eva','approve',{id:'elise-2026-11-16'});
 t.mock.timers.setTime(Date.parse('2026-12-02T12:00:00+01:00'));
 db=apply(db,'eva','closeMonth',{month:'2026-11',confirm:true});
 assert.throws(()=>apply(db,'eva','sick',{id:'iris-2026-11-19'}),/afgesloten/);
 assert.throws(()=>apply(db,'eva','sickUndo',{id:'elise-2026-11-19'}),/afgesloten/);
});

const {hoursPage}=await import('../v2/hours.js');
const {dialogs}=await import('../v2/dialogs.js');
// Maandag 23 november: de uren van donderdag 19 november ontbreken nog.
const monday=t=>t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-23T12:00:00+01:00')});
const absent=(db,id)=>hoursPage(db,person(db,id),{page:'reviews',month:'2026-11'}).split('<h2>Ontbreekt')[1];

const rowOf=(html,who)=>html.split('<b>'+who+'</b>')[1].split('</article>')[0];

test('Elise belde ziek maar vergat de app: bij meerdere ontbrekende dagen staat één knop Ziek melden',t=>{
 monday(t);
 let db=pilotRoster();
 const row=rowOf(absent(db,'eva'),'Elise B');
 assert.match(row,/Herinner/);
 assert.equal(row.match(/Ziek melden/g).length,1,'één knop, niet een per dag');
 assert.match(row,/data-act="sickPick" data-id="elise">Ziek melden</);
 assert.match(todayPage(db,person(db,'eva')).split('<h2>Uren ontbreken')[1],/data-act="sickPick"/);
});

test('Eén ontbrekende dag: de knop noemt de dag, zoals Ziek melden ma 16 nov',t=>{
 monday(t);
 const db=pilotRoster();
 db.shifts=db.shifts.filter(s=>s.user!=='isis'||s.date==='2026-11-21');
 assert.match(rowOf(absent(db,'eva'),'Isis N'),/data-act="sickAsk" data-id="isis-2026-11-21">Ziek melden za 21 nov</);
});

test('Eva tikt op Ziek melden bij Elise: ze kiest dagen met vinkjes en meldt ze in één keer ziek',t=>{
 monday(t);
 let db=pilotRoster();
 const {title,body}=dialogs.sickPick(db,person(db,'eva'),'elise');
 assert.equal(title,'Ziek melden');
 for(const day of ['19','21'])assert.match(body,new RegExp('name="ids" value="elise-2026-11-'+day+'"'));
 assert.doesNotMatch(body,/checked/,'niets vooraf aangevinkt');
 assert.throws(()=>apply(db,'eva','sickMany',{ids:[]}),/Kies minstens één dag/);
 db=apply(db,'eva','sickMany',{ids:['elise-2026-11-19','elise-2026-11-21']});
 assert.ok(db.shifts.find(s=>s.id==='elise-2026-11-19').sick&&db.shifts.find(s=>s.id==='elise-2026-11-21').sick);
 assert.doesNotMatch(absent(db,'eva'),/elise-2026-11-19|elise-2026-11-21/);
});

test('Ziek melden van meerdere dagen gaat helemaal of niet: één dag die niet mag, dan wordt niets gemeld',t=>{
 monday(t);
 const db=pilotRoster();
 assert.throws(()=>apply(db,'iris','sickMany',{ids:['elise-2026-11-19','sylvia-2026-11-18']}),/niet ziek melden/);
});

test('Bij Ontbreekt ziet de dagleiding alleen de dagen waarop zij dagleiding was',t=>{
 monday(t);
 const db=pilotRoster(),body=dialogs.sickPick(db,person(db,'iris'),'sylvia').body;
 assert.match(body,/value="sylvia-2026-11-20"/);
 assert.doesNotMatch(body,/sylvia-2026-11-18/,'Iris werkte woensdag niet');
});
