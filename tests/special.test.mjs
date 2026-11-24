import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// ui.js laadt bij het starten de iconen met fetch; in Node lezen we het bestand zelf.
globalThis.fetch=async url=>({json:async()=>JSON.parse(fs.readFileSync(new URL(url),'utf8'))});
const {pilotRoster}=await import('../v2/pilot.js');
const {apply,monthSummary,vacationLeft}=await import('../v2/model.js');
const {dialogs}=await import('../v2/dialogs.js');
const {requestName}=await import('../v2/view.js');

const person=(db,id)=>db.people.find(p=>p.id===id);
// Maandag 23 november. Elise (vast, werkt ma/do/za) vraagt bijzonder verlof voor do 10 december.
function asked(t){
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-23T12:00:00+01:00')});
 return apply(pilotRoster(),'elise','leave',{date:'2026-12-10',type:'bijzonder',special:'rouwverlof'});
}
const decide=(db,paid)=>apply(db,'eva','decide',{id:db.requests.at(-1).id,accept:true,choices:{},
 type:'bijzonder',special:'rouwverlof',paid});
const elise=db=>monthSummary(db,'2026-12').find(r=>r.user==='elise');

test('Bijzonder verlof goedkeuren: Eva kiest of het betaald wordt',t=>{
 const db=asked(t);
 assert.throws(()=>decide(db,undefined),/Kies of dit bijzonder verlof betaald wordt\./);
 const body=dialogs.decision(db,person(db,'eva'),db.requests.at(-1).id).body;
 assert.match(body,/<select name="paid"><option value="">Kies…<\/option><option value="ja">Betaald: telt 8 uur per werkdag/);
 assert.match(body,/<option value="nee">Niet betaald: gaat van het saldo plus- en minuren af<\/option>/);
});

test('Betaald bijzonder verlof telt 8 uur per werkdag en gaat niet van de vakantiedagen af',t=>{
 const db=decide(asked(t),'ja');
 assert.equal(elise(db).special,480);
 assert.equal(elise(db).diff,480-elise(db).norm);
 assert.equal(vacationLeft(db,'elise'),16);
 assert.match(requestName(db.requests.at(-1)),/Bijzonder verlof \(rouwverlof\) · betaald/);
});

test('Niet betaald bijzonder verlof telt 0 uur: het gaat van het saldo plus- en minuren af',t=>{
 const db=decide(asked(t),'nee');
 assert.equal(elise(db).special,0);
 assert.equal(elise(db).diff,-elise(db).norm);
 assert.match(requestName(db.requests.at(-1)),/Bijzonder verlof \(rouwverlof\) · niet betaald/);
});

test('Bijzonder verlof Anders: een verplicht tekstvak met de reden, en pas dan de zin over medische informatie',t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-23T12:00:00+01:00')});
 const db=pilotRoster(),body=dialogs.leave(db,person(db,'elise'),'2026-12-10').body;
 assert.match(body,/<div id="specialother" hidden><label class="field"><span>Reden bijzonder verlof<\/span><input name="specialReason"/);
 assert.match(body.split('<div id="specialother"')[1],/Vermeld geen medische informatie\./);
 assert.doesNotMatch(body.split('<div id="specialother"')[0],/medische/,'niet als Anders niet is gekozen');
 const p={date:'2026-12-10',type:'bijzonder',special:'anders'};
 assert.throws(()=>apply(db,'elise','leave',p),/Geef een reden voor het bijzonder verlof\./);
 const next=apply(db,'elise','leave',{...p,specialReason:' Verhuizing '});
 assert.equal(next.requests.at(-1).specialReason,'Verhuizing');
 assert.match(requestName(next.requests.at(-1)),/Bijzonder verlof \(anders: Verhuizing\)/);
});
