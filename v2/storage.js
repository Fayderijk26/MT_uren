import {pilotRoster,migratePilot} from './pilot.js';
export const storageKey='monkeytown-pilot-nov2026';
export function migrate(data){
 migratePilot(data);
 data.months??={};data.audit??=[];data.settings??={};
 for(const p of data.people){p.active??=true;p.contracts??=[];}
 for(const r of [...data.rules,...data.extra]){if(r.start==='00:00')r.start='08:30';if(r.end==='23:59')r.end='18:00';}
 if(!data.openingMigration){for(const r of [...data.rules,...data.extra])if(r.start==='08:30'&&r.end==='18:00'&&r.wholeDay===undefined)r.wholeDay=true;data.openingMigration=true;}
 return data;
}
export function read(){
 const raw=localStorage.getItem(storageKey),data=migrate(raw?JSON.parse(raw):pilotRoster());
 const next=JSON.stringify(data);if(raw!==next)localStorage.setItem(storageKey,next);
 if(!data.openingMigration){for(const r of [...data.rules,...data.extra])if(r.start==='08:30'&&r.end==='18:00'&&r.wholeDay===undefined)r.wholeDay=true;data.openingMigration=true;}
 return data;
}
export function write(data){localStorage.setItem(storageKey,JSON.stringify(data));}
