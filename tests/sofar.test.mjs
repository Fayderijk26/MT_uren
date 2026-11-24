import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// ui.js laadt bij het starten de iconen met fetch; in Node lezen we het bestand zelf.
globalThis.fetch=async url=>({json:async()=>JSON.parse(fs.readFileSync(new URL(url),'utf8'))});
const {pilotRoster}=await import('../v2/pilot.js');
const {apply,monthSummary,normSoFar}=await import('../v2/model.js');
const {hoursPage}=await import('../v2/hours.js');

const person=(db,id)=>db.people.find(p=>p.id===id);
// Dinsdag 24 november. Sylvia (32 uur, norm november 138u 40m): 17 en 18 nov wachtdag, 20 en 22 nov doorbetaald.
function sylvia(t){
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-24T12:00:00+01:00')});
 let db=pilotRoster();
 for(const [day,paid] of [['17',false],['18',false],['20',true],['22',true]]){
  db=apply(db,'eva','sick',{id:'sylvia-2026-11-'+day});
  db=apply(db,'eva','sickDecide',{id:'sylvia-2026-11-'+day,paid});
 }
 return db;
}

test('Norm tot nu toe: de maandnorm naar rato van de dagen tot en met vandaag',t=>{
 const db=sylvia(t);
 assert.equal(normSoFar(db,'sylvia','2026-11'),Math.round(8320*24/30));
 assert.equal(normSoFar(db,'sylvia','2026-10'),8320,'voorbije maand: de hele norm');
 assert.equal(normSoFar(db,'sylvia','2026-12'),0,'maand die nog moet komen');
});

test('Sylvia ziet Norm tot nu toe, het echte verschil tot nu toe en hoeveel daarvan wachtdagen zijn',t=>{
 const db=sylvia(t),r=monthSummary(db,'2026-11').find(x=>x.user==='sylvia');
 assert.equal(r.sickUnpaid,18*60,"twee diensten van 08:30–18:00, elk 9u");
 const html=hoursPage(db,person(db,'sylvia'),{page:'hours',month:'2026-11'});
 assert.match(html,/Norm tot nu toe<\/span><b>110u 56m<\/b>/);
 assert.match(html,/Verschil tot nu toe<\/span><b>−94u 26m<\/b>/);
 assert.match(html,/Waarvan wachtdagen: −18u 0m/);
 assert.match(html,/Norm hele maand: 138u 40m/);
});

test('Na de maand: gewoon Norm en Verschil van de hele maand',t=>{
 const db=sylvia(t);
 t.mock.timers.setTime(Date.parse('2026-12-02T12:00:00+01:00'));
 const html=hoursPage(db,person(db,'sylvia'),{page:'hours',month:'2026-11'});
 assert.match(html,/Norm<\/span><b>138u 40m<\/b>/);
 assert.match(html,/Verschil<\/span><b>−122u 10m<\/b>/);
});
