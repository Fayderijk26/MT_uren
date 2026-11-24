import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// ui.js laadt bij het starten de iconen met fetch; in Node lezen we het bestand zelf.
globalThis.fetch=async url=>({json:async()=>JSON.parse(fs.readFileSync(new URL(url),'utf8'))});
const {pilotRoster}=await import('../v2/pilot.js');
const {hoursPage}=await import('../v2/hours.js');

test('Sylvia mist twee dagen: Eva ziet één regel voor Sylvia en stuurt één herinnering voor beide dagen',t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-19T12:00:00+01:00')});
 const db=pilotRoster(),eva=db.people.find(p=>p.id==='eva');
 const missing=hoursPage(db,eva,{page:'reviews',month:'2026-11'}).split('<h2>Ontbreekt')[1];
 assert.equal(missing.split('<b>Sylvia').length-1,1,'één regel voor Sylvia');
 assert.match(missing,/di 17 nov, wo 18 nov/);
 const text=decodeURIComponent(missing.match(/wa\.me\/\d*\?text=([^"]*)/)[1]);
 assert.equal(text,'Hoi Sylvia, wil je je uren van di 17 nov en wo 18 nov nog invullen?');
});

test('Bij Uren goedkeuren staat bovenaan de knop Alles goedkeuren met het aantal uren volgens rooster',t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-19T12:00:00+01:00')});
 const db=pilotRoster(),eva=db.people.find(p=>p.id==='eva');
 const html=hoursPage(db,eva,{page:'reviews',month:'2026-11'}).split('<h2>Uren goedkeuren')[1];
 assert.match(html,/^<\/h2>[\s\S]*?data-act="approveAll"[^>]*>Alles goedkeuren \(1\)</);
});

test('Bij Diensten staat de knop Bekijken naast de dienst, zoals Herinner',t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-19T12:00:00+01:00')});
 const db=pilotRoster(),iris=db.people.find(p=>p.id==='iris');
 const html=hoursPage(db,iris,{page:'hours',month:'2026-11'});
 assert.match(html,/<div class="compact"><article class="vrow"><div><b>ma 16 nov[\s\S]*?data-act="entry"/);
});

const {apply,monthSummary}=await import('../v2/model.js');
// Maandag 23 november. Sylvia: di 17 goedgekeurd (9u), wo 18 en vr 20 ziek, zo 22 wacht op beoordeling.
function sylviaMonth(t){
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-23T12:00:00+01:00')});
 let db=apply(pilotRoster(),'sylvia','hours',{id:'sylvia-2026-11-17',start:'08:30',end:'18:00',pause:30});
 db=apply(db,'eva','approve',{id:'sylvia-2026-11-17'});
 for(const id of ['sylvia-2026-11-18','sylvia-2026-11-20']){
  db=apply(db,'eva','sick',{id});db=apply(db,'eva','sickDecide',{id,paid:true});
 }
 return apply(db,'sylvia','hours',{id:'sylvia-2026-11-22',start:'08:30',end:'18:00',pause:30});
}
const mine=db=>hoursPage(db,db.people.find(p=>p.id==='sylvia'),{page:'hours',month:'2026-11'});
const between=(html,from,to)=>html.split(from)[1].split(to)[0];

test('Maandoverzicht rekent ook uit wat nog wacht op beoordeling',t=>{
 const row=monthSummary(sylviaMonth(t),'2026-11').find(r=>r.user==='sylvia');
 assert.deepEqual([row.approved,row.sick,row.leave,row.pending],[540,990,0,540]);
});

test('Sylvia ziet bij Mijn uren het totaal: goedgekeurd plus ziek plus verlof, wat wacht staat apart',t=>{
 const html=mine(sylviaMonth(t)),summary=between(html,'<h2>Mijn uren','</section>');
 assert.match(summary,/<b class="hourtotal">25u 30m<\/b>/);
 for(const [label,value] of [['Goedgekeurd','9u 0m'],['Ziek gemeld','16u 30m'],['Verlof','0u 0m']])
  assert.match(summary,new RegExp(label+'</span><b>'+value+'</b>'),label);
 assert.match(summary,/9u 0m wacht op beoordeling · telt mee zodra het is goedgekeurd/);
 assert.match(summary,/name="month"/,'de maandkeuze staat in de kop van het overzicht');
 assert.ok(html.indexOf('<h2>Mijn uren')<html.indexOf('<h2>Diensten'),'eerst het overzicht, dan de diensten');
});

test('Onder Diensten staan ook ziek gemelde diensten en verlofdagen, met hoeveel ze tellen',t=>{
 let db=sylviaMonth(t);
 t.mock.timers.setTime(Date.parse('2026-11-19T12:00:00+01:00'));
 db=apply(db,'sylvia','leave',{date:'2026-11-25',type:'verlof'});
 const shift=db.shifts.find(s=>s.id==='sylvia-2026-11-25');
 db=apply(db,'eva','decide',{id:db.requests.at(-1).id,accept:true,
  choices:{[shift.id]:{before:JSON.stringify(shift),value:'none'}}});
 t.mock.timers.setTime(Date.parse('2026-11-23T12:00:00+01:00'));
 const list=between(mine(db),'<h2>Diensten','</section>');
 assert.match(list,/wo 25 nov<\/b><small>08:30–18:00 · telt 9u 0m<\/small>[\s\S]*?chip-leave">Verlof \(betaald\)/);
 assert.match(list,/vr 20 nov<\/b><small>10:00–18:00 · telt 7u 30m<\/small>[\s\S]*?chip-off">Ziek gemeld/);
 assert.match(between(mine(db),'<h2>Mijn uren','</section>'),/Verlof<\/span><b>9u 0m<\/b>/);
 assert.match(list,/data-act="unplanned"/);
});

test('De knop Ongeplande dienst invullen staat rechts naast de kop Diensten',t=>{
 assert.match(mine(sylviaMonth(t)),/<div class="cardhead"><h2>Diensten<\/h2><button[^>]*data-act="unplanned"/);
});

test('Elise mist twee diensten: Mijn uren toont dat apart, ze tellen niet mee in het totaal',t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-23T12:00:00+01:00')});
 const db=pilotRoster(),elise=db.people.find(p=>p.id==='elise');
 const summary=between(hoursPage(db,elise,{page:'hours',month:'2026-11'}),'<h2>Mijn uren','</section>');
 assert.match(summary,/<p class="hourmissing">2 diensten ontbreken nog · vul ze in bij Diensten<\/p>/);
 assert.match(summary,/<b class="hourtotal">0u 0m<\/b>/);
 const one=apply(db,'elise','hours',{id:'elise-2026-11-19',start:'08:30',end:'18:00',pause:30});
 const returned=apply(one,'eva','return',{id:'elise-2026-11-16',reason:'pauze'});
 assert.match(between(hoursPage(returned,elise,{page:'hours',month:'2026-11'}),'<h2>Mijn uren','</section>'),
  /1 dienst ontbreekt nog · 1 dienst aanpassen · vul ze in bij Diensten/);
});
