import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// ui.js laadt bij het starten de iconen met fetch; in Node lezen we het bestand zelf.
globalThis.fetch=async url=>({json:async()=>JSON.parse(fs.readFileSync(new URL(url),'utf8'))});
const {pilotRoster}=await import('../v2/pilot.js');
const {apply,mustRead,weeklyFor}=await import('../v2/model.js');
const {dialogs}=await import('../v2/dialogs.js');
const {weekPage}=await import('../v2/week.js');
const {calendarPage}=await import('../v2/calendar.js');
const {todayPage}=await import('../v2/today.js');

const person=(db,id)=>db.people.find(p=>p.id===id);
const week='2026-11-30';
const text='Drukke week: zaterdag een groot kinderfeest.\n- Iedereen om 08:30 binnen\n- Keuken extra schoonmaken';
const image='data:image/jpeg;base64,'+'A'.repeat(100);
// Maandag 23 november. Eva plant Elise in op maandag 30 november en publiceert de week.
function planned(t){
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-23T12:00:00+01:00')});
 return apply(pilotRoster(),'eva','draft',{user:'elise',date:week,start:'08:30',end:'17:30',area:'Keuken'});
}
const publish=(db,extra={})=>apply(db,'eva','publish',{date:week,through:week,...extra});

test('Eva kan een week pas publiceren met een weekly',t=>{
 const db=planned(t);
 assert.throws(()=>publish(db),/Schrijf eerst de weekly voor deze week\./);
 assert.match(dialogs.pubWeek(db,person(db,'eva'),week).body,/<textarea name="weekly" required/);
 const next=publish(db,{weekly:text,image});
 const w=weeklyFor(next,week);
 assert.deepEqual([w.week,w.text,w.image,w.version,w.by],[week,text,image,1,'eva']);
 assert.deepEqual(w.reads,{});
});

test('Elise ziet het rooster van die week pas na Ik heb de weekly gelezen',t=>{
 let db=publish(planned(t),{weekly:text,image});
 const elise=person(db,'elise'),view={calendarDate:week,calendarMode:'week'};
 assert.ok(mustRead(db,'elise',week));
 assert.ok(!mustRead(db,'eva',week),'de bedrijfsleider hoeft hem niet te lezen');
 let html=calendarPage(db,elise,view);
 assert.match(html,/Week 49 · ma 30 nov – zo 6 dec/);
 assert.match(html,/<li>Iedereen om 08:30 binnen<\/li>/);
 assert.match(html,/<img class="weeklyimg" src="data:image\/jpeg/);
 assert.match(html,/data-act="weeklyRead" data-id="2026-11-30"/);
 assert.doesNotMatch(html,/08:30–17:30 · Ingepland/,'rooster nog verborgen');
 assert.match(todayPage(db,elise),/Nieuwe weekly/);
 db=apply(db,'elise','weeklyRead',{week});
 assert.ok(!mustRead(db,'elise',week));
 html=calendarPage(db,elise,view);
 assert.match(html,/08:30–17:30 · Ingepland/);
 assert.ok(html.indexOf('personal-calendar')<html.indexOf('Week 49'),'de weekly staat onder het rooster');
 assert.doesNotMatch(todayPage(db,elise),/Nieuwe weekly/);
});

test('Ook een leidinggevende leest eerst de weekly; het teamrooster van die week is tot dan verborgen',t=>{
 const db=publish(planned(t),{weekly:text});
 const html=weekPage(db,{day:week},true,person(db,'iris'));
 assert.match(html,/Ik heb de weekly gelezen/);
 assert.doesNotMatch(html,/weekgrid/);
 const read=apply(db,'iris','weeklyRead',{week});
 assert.match(weekPage(read,{day:week},true,person(read,'iris')),/weekgrid/);
});

test('Eva ziet wie de weekly heeft gelezen en kan hem aanpassen',t=>{
 const db=apply(publish(planned(t),{weekly:text}),'elise','weeklyRead',{week});
 const html=weekPage(db,{day:week},false,person(db,'eva'));
 assert.match(html,/Gelezen door 1 van 5/);
 assert.match(html,/Nog niet gelezen: Iris Z/);
 assert.match(html,/data-act="weeklyEdit" data-id="2026-11-30"/);
});

test('Alleen het rooster bijwerken: de weekly hoeft niet opnieuw gelezen te worden',t=>{
 let db=apply(publish(planned(t),{weekly:text}),'elise','weeklyRead',{week});
 db=apply(db,'eva','draft',{user:'elise',date:'2026-12-03',start:'08:30',end:'17:30',area:'Keuken'});
 db=publish(db);
 assert.ok(!mustRead(db,'elise',week));
 assert.doesNotMatch(dialogs.pubWeek(db,person(db,'eva'),week).body,/<textarea/);
});

test('Weekly aanpassen: Eva kiest of iedereen hem opnieuw moet lezen',t=>{
 let db=apply(publish(planned(t),{weekly:text}),'elise','weeklyRead',{week});
 assert.match(dialogs.weeklyEdit(db,person(db,'eva'),week).body,/Moet iedereen de weekly opnieuw lezen\?/);
 assert.throws(()=>apply(db,'eva','weeklySave',{week,text:'Tikfout verbeterd'}),
  /Kies of iedereen de weekly opnieuw moet lezen\./);
 const quiet=apply(db,'eva','weeklySave',{week,text:'Tikfout verbeterd',reread:'nee'});
 assert.equal(weeklyFor(quiet,week).text,'Tikfout verbeterd');
 assert.ok(!mustRead(quiet,'elise',week),'alleen aangepast: rooster blijft zichtbaar');
 const again=apply(db,'eva','weeklySave',{week,text:'Zaterdag gaat niet door',reread:'ja'});
 assert.equal(weeklyFor(again,week).version,2);
 assert.ok(mustRead(again,'elise',week),'opnieuw lezen: rooster weer geblokkeerd');
 assert.throws(()=>apply(db,'iris','weeklySave',{week,text:'x',reread:'nee'}),/Alleen voor de bedrijfsleider\./);
});

test('Per week een eigen weekly; een afbeelding mag erbij, maar niet te groot',t=>{
 let db=publish(planned(t),{weekly:text});
 db=apply(db,'eva','draft',{user:'elise',date:'2026-12-07',start:'08:30',end:'17:30',area:'Keuken'});
 assert.throws(()=>apply(db,'eva','publish',{date:'2026-12-07'}),/Schrijf eerst de weekly/);
 db=apply(db,'eva','publish',{date:'2026-12-07',weekly:'Rustige week.'});
 assert.equal(weeklyFor(db,'2026-12-07').text,'Rustige week.');
 assert.equal(weeklyFor(db,week).text,text);
 assert.throws(()=>apply(db,'eva','weeklySave',{week,text,reread:'nee',image:'data:image/png;base64,'
  +'A'.repeat(900000)}),/De afbeelding is te groot\./);
 assert.throws(()=>apply(db,'eva','weeklySave',{week,text,reread:'nee',image:'javascript:alert(1)'}),
  /Kies een afbeelding/);
 assert.equal(weeklyFor(apply(db,'eva','weeklySave',{week,text,reread:'nee',image:''}),week).image,'');
});
