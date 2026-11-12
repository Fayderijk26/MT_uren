// Fictional, browser-only rehearsal. This module never contacts Supabase.
const DATA = 'monkeytown.demo.roster.v1';
const SESSION = 'monkeytown.demo.person.v1';
const ZONE = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});
const kinds = ['shift', 'off', 'standby', 'extra', 'cancelled'];
const roles = ['employee', 'lead', 'admin'];
const contracts = ['zero', 'fixed'];
const working = s => ['shift', 'extra'].includes(s.kind);
const monthOf = date => date.slice(0, 7);
const nowLocal = (time = new Date()) => ZONE.format(time);
const today = () => nowLocal().slice(0, 10);
const actorId = () => sessionStorage.getItem(SESSION) || 'mila';
const uid = () => crypto.randomUUID();
function assert(ok, message) {
  if (!ok) throw new Error(message);
}
function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}
function minute(value) {
  assert(/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value), 'Kies een geldige tijd in uren en minuten.');
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}
function instant(date, time) {
  minute(time);
  assert(validDate(date), 'Kies een geldige datum.');
  const label = date + ' ' + time;
  const naive = Date.parse(date + 'T' + time + ':00Z');
  // CET/CEST. Verify round-trip to reject nonexistent and double local times.
  const candidates = [naive - 3600000, naive - 7200000].filter(t => nowLocal(t) === label);
  assert(candidates.length === 1, 'Deze lokale tijd bestaat niet of komt twee keer voor door klokverzet.');
  return candidates[0];
}
function relativeDate(base, difference) {
  const d = new Date(base + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + difference);
  return d.toISOString().slice(0, 10);
}
function demoSeed() {
  const day = today();
  const people = [
    ['mila','Mila Vos','employee','zero'],
    ['bram','Bram Meijer','lead','fixed'],
    ['noor','Noor Post','admin','fixed'],
    ['sam','Sam Bakker','employee','zero'],
    ['inez','Inez Smit','employee','zero']
  ].map(([id,name,role,contract]) => ({id,name,role,contract,active:true}));
  const db = {people, shifts:[], leave:[], closed:[], norms:{}, audit:[], receipts:{}, closures:[], periodVersions:{},
    contracts:people.map(p=>({user:p.id,effective:relativeDate(day,-30),contract:p.contract,weeklyMinutes:p.contract==='fixed'?2160:0}))};
  const shifts = [
    [-10,'mila','09:00','17:00','Speelvloer','', 'approved'],
    [-8,'mila','10:00','17:00','Keuken','', 'approved'],
    [-6,'mila','09:00','18:00','Speelvloer','Openen','approved'],
    [-5,'mila','10:00','17:30','Horeca','','approved'],
    [-3,'mila','09:30','17:30','Speelvloer','','approved'],
    [-2,'mila','10:00','18:00','Keuken','','pending'],
    [-1,'mila','09:00','18:00','Speelvloer','',null],
    [-1,'sam','09:30','17:30','Horeca','','pending'],
    [-1,'inez','11:00','16:00','Keuken','','returned'],
    [0,'mila','09:00','18:00','Speelvloer','Openen',null],
    [0,'bram','09:00','18:00','Speelvloer','Sluiten',null],
    [0,'noor','09:00','17:00','Kantoor','',null],
    [0,'sam','10:00','18:00','Keuken','',null],
    [0,'inez','','','Keuken','',null,'standby','11:00'],
    [1,'mila','10:00','18:00','Keuken','',null],
    [2,'mila','09:30','18:00','Speelvloer','Sluiten',null],
    [3,'mila','','','Keuken','',null,'standby','11:00'],
    [4,'mila','','','','',null,'off'],
    [5,'mila','09:00','18:00','Speelvloer','',null],
    [7,'mila','10:30','18:00','Horeca','',null],
    [8,'mila','09:00','18:00','Keuken','',null],
    [10,'mila','09:30','18:00','Speelvloer','',null]
  ];
  for (const [offset,user,start,end,area,task,status,kind='shift',deadline=''] of shifts) {
    const date = relativeDate(day, offset);
    const s = {id:'voorbeeld-' + date + '-' + user,user,date,start,end,area,task,kind,deadline,entry:null};
    db.shifts.push(s);

    if (status) {
      const at = new Date(instant(date, end)).toISOString();
      s.entry = {start,end,pause:30,status:'pending',version:1,reason:'',net:minute(end)-minute(start)-30};
      db.audit.push({action:'submit',id:s.id,user,actor:user,date,at,version:1,old:null,new:{...s.entry}});
      if (status !== 'pending') {
        const old = {...s.entry};
        Object.assign(s.entry, {status,version:2,reason:status === 'returned'?'Controleer je pauze.':''});
        db.audit.push({action:status === 'returned'?'return':'approve',id:s.id,user,actor:'bram',date,at,version:2,old,new:{...s.entry}});
      }
    }
  }
  db.norms[monthOf(day)+':bram'] = {norm:8640,paid:0};
  return db;
}
function save(db) { localStorage.setItem(DATA, JSON.stringify(db)); }
function read() {
  const raw = localStorage.getItem(DATA);
  if(raw){
    const db=JSON.parse(raw);
    for(const s of db.shifts.filter(x=>x.kind==='office')){
      s.kind='shift';s.area='Kantoor';
      s.start=s.start||s.entry?.start||'';s.end=s.end||s.entry?.end||'';
    }
    return db;
  }
  const db = demoSeed();
  save(db);
  return db;
}
function getActor(db) {
  const person = db.people.find(p => p.id === actorId() && p.active);
  assert(person, 'Dit demo-account is gedeactiveerd. Kies een ander testprofiel.');
  return person;
}
function canManage(db, actor, date) {
  return actor.role === 'admin' || (actor.role === 'lead' && db.shifts.some(s=>s.date===date&&s.user===actor.id&&working(s)&&s.start&&s.end));
}
function writable(db, date) {
  assert(!db.closed.includes(monthOf(date)), 'Deze maand is afgesloten. De bedrijfsleider kan de maand heropenen.');
}
function activePerson(db, id) {
  const person = db.people.find(p => p.id === id && p.active);
  assert(person, 'Selecteer een actieve medewerker.');
  return person;
}
function record(db,actor,action,id,date,oldValue,newValue,user=null) {
  db.audit.push({action,id,date,user,actor:actor.id,actorName:actor.name,at:new Date().toISOString(),
    version:newValue?.entry?.version ?? newValue?.version ?? null,
    old:structuredClone(oldValue),new:structuredClone(newValue)});
}
function validateInterval(date,start,end) {
  const a = instant(date,start), b = instant(date,end);
  assert(b>a, 'Einde moet later zijn dan begin op dezelfde dag.');
  return [a,b];
}
function planRow(db,row) {
  assert(typeof row.id === 'string' && row.id.trim().length>0 && row.id.length<=200,'Een dienst-ID ontbreekt.');
  assert(validDate(row.date), 'Kies een geldige roosterdatum.');
  activePerson(db,row.user);
  const kind = row.kind || 'shift', start = row.start || '', end = row.end || (start?'18:00':'');
  assert(kinds.includes(kind), 'Deze roostercode moet eerst worden gecontroleerd.');
  const result = {id:row.id,user:row.user,date:row.date,kind,start,end,raw:row.raw || '',area:row.area || '',task:row.task || '',deadline:row.deadline || ''};
  if (['shift','extra'].includes(kind) || (kind==='office' && (start||end))) validateInterval(row.date,start,end);
  if (['standby','off'].includes(kind)) assert(!start && !end, 'Een stand-by- of vrijmelding heeft geen geplande werktijden.');
  assert(result.area.length<=160 && result.task.length<=160 && result.raw.length<=250,'De omschrijving is te lang.');
  if (result.deadline) {
    assert(['standby','shift','cancelled'].includes(kind),'Een berichttijd hoort bij stand-by.');
    instant(row.date,result.deadline);
  }
  return result;
}
function stateFor(db,actor) {
  const shifts = db.shifts.filter(s=>s.user===actor.id || canManage(db,actor,s.date));
  const ids = new Set(shifts.map(s=>s.user));
  ids.add(actor.id);
  const leads={};
  for(const s of db.shifts){
    if(!working(s)||!s.start||!s.end||!shifts.some(v=>v.date===s.date))continue;
    if(!db.people.some(p=>p.id===s.user&&p.active&&p.role==='lead'))continue;
    (leads[s.date]??=[]);if(!leads[s.date].includes(s.user))leads[s.date].push(s.user);
    ids.add(s.user);
  }
  const people = actor.role === 'admin' ? db.people : db.people.filter(p=>ids.has(p.id)).map(p=>
    p.id === actor.id ? p : {id:p.id,name:p.name,role:p.role,active:p.active,contract:null});
  const norms = Object.fromEntries(Object.entries(db.norms).filter(([key])=>actor.role==='admin'||key.endsWith(':'+actor.id)));
  const mayAssign = actor.role === 'admin' || (actor.role === 'lead' &&
    Object.entries(leads).some(([date,ids])=>ids.includes(actor.id)&&!db.closed.includes(monthOf(date))));
  const rosterPeople = mayAssign ? db.people.filter(p=>p.active).map(({id,name})=>({id,name})) : [];
  const offers={};
  for(const e of db.audit){
    if((e.new?.offer||e.new?.decision)&&shifts.some(s=>s.id===e.id&&s.kind==='off'))offers[e.id]=e.new;
  }
  const acceptedSlots=Object.fromEntries(db.audit.filter(e=>e.action==='acceptedSlot'&&shifts.some(s=>s.id===e.id&&working(s))).map(e=>[e.id,e.new.off]));
  return {leave:(db.leave||[]).filter(l=>l.user===actor.id||actor.role==='admin'),acceptedSlots,offers,notifications:(db.audit||[]).filter(e=>e.actor!==actor.id&&shifts.some(s=>s.id===e.id)&&(['return','reject','cancel','plan','restore','message'].includes(e.action)||e.action==='submit'&&e.user!==actor.id)).map((e,i)=>({...e,actorName:e.actorName||db.people.find(p=>p.id===e.actor)?.name,key:e.at+e.id+e.action,text:e.new?.reason||e.new?.entry?.reason||e.new?.message||'',seen:(db.seen||[]).includes(actor.id+e.at+e.id+e.action)})),me:actor.id,people,rosterPeople,shifts,leads,closed:db.closed,norms,periodVersions:db.periodVersions || {},
    contracts:(db.contracts||[]).filter(c=>actor.role==='admin'||c.user===actor.id)};
}
export function demoState() { const db=read();return stateFor(db,getActor(db)); }
export function demoAccounts() {
  return read().people.filter(p=>p.active).map(({id,name,role})=>({id,name,role}));
}
export function selectDemo(id) {
  activePerson(read(),id);
  sessionStorage.setItem(SESSION,id);
  return demoState();
}
export function resetDemo() {
  localStorage.removeItem(DATA);
  sessionStorage.removeItem(SESSION);
  return demoState();
}
function nonnegativeInteger(value,label) {
  assert(typeof value==='number' && Number.isSafeInteger(value) && value>=0,label+' moet een positief geheel getal of nul zijn.');
  return value;
}
function adminOnly(actor) {assert(actor.role==='admin','Alleen de bedrijfsleider mag dit wijzigen.');}
function findShift(db,id) {
  const s=db.shifts.find(item=>item.id===id);
  assert(s,'Deze dienst is niet beschikbaar.');
  return s;
}
function checkVersion(entry,payload) {
  assert(Number.isInteger(payload.version) && payload.version === (entry?.version || 0),'Deze registratie is inmiddels gewijzigd. Vernieuw het overzicht.');
}
function change(db,actor,action,p) {
  if(['leaveRequest','leaveApprove','leaveReject'].includes(action)){
    db.leave??=[];
    if(action==='leaveRequest'){
      assert(validDate(p.date)&&p.date>=relativeDate(today(),21),'Vraag minimaal 21 dagen vooruit vrij.');
      writable(db,p.date);
      assert(!db.leave.some(l=>l.user===actor.id&&l.date===p.date&&l.status!=='rejected')&&!db.shifts.some(s=>s.user===actor.id&&s.date===p.date&&s.kind==='off'),'Voor deze dag is al vrij gevraagd.');
      const l={id:uid(),user:actor.id,date:p.date,status:'pending',reason:String(p.reason||'')};
      db.leave.push(l);record(db,actor,action,l.id,l.date,null,l,l.user);
    }else{
      adminOnly(actor);const l=db.leave.find(x=>x.id===p.id);
      assert(l?.status==='pending','Deze aanvraag is al verwerkt.');writable(db,l.date);
      const old={...l};
      if(action==='leaveApprove'){
        assert(!db.shifts.some(s=>s.user===l.user&&s.date===l.date&&s.kind!=='cancelled'),'Er staat al een dienst. Wijzig die eerst in het rooster.');
        change(db,actor,'plan',{shifts:[{id:l.id,user:l.user,date:l.date,kind:'off'}]});l.status='approved';
      }else{assert(String(p.reason||'').trim(),'Geef een reden.');l.status='rejected';l.response=p.reason}
      record(db,actor,action,l.id,l.date,old,l,l.user);
    }
    return stateFor(db,actor);
  }
  if(action==='approveExact'){
    const s=findShift(db,p.id);
    assert(s.user!==actor.id&&s.entry?.start===s.start&&s.entry?.end===s.end,'De uren wijken af.');
    return change(db,actor,'approve',p);
  }
  if(['offer','acceptOffer','declineOffer','counterOffer','approveCounter','rejectCounter'].includes(action)){
    const s=findShift(db,p.id);
    writable(db,s.date);
    assert(s.kind==='off','Deze vrijmelding is gewijzigd.');
    const latest=db.audit.filter(e=>e.id===s.id && (e.new?.offer || e.new?.decision)).at(-1)?.new;
    if(action==='offer'){
      assert(canManage(db,actor,s.date)&&s.user!==actor.id,'Geen toegang.');
      validateInterval(s.date,p.start,p.end);
      const offer={token:uid(),start:p.start,end:p.end};
      record(db,actor,'message',s.id,s.date,null,{offer,message:'Kun je van '+p.start+' tot '+p.end+' werken? '+String(p.message||'').trim()},s.user);
    }else{
      assert(latest?.offer && latest.offer.token===p.token,'Dit voorstel is niet meer beschikbaar.');
      const counter=latest.offer.counter===true;
      const manager=action==='approveCounter'||action==='rejectCounter';
      assert(counter===manager && (manager?canManage(db,actor,s.date)&&actor.id!==s.user:actor.id===s.user),'Geen toegang tot deze beslissing.');
      if(action==='counterOffer'){
        validateInterval(s.date,p.start,p.end);
        const offer={token:uid(),start:p.start,end:p.end,counter:true};
        record(db,actor,'message',s.id,s.date,null,{offer,message:'Ander voorstel · '+p.start+' – '+p.end},s.user);
        return stateFor(db,actor);
      }
      if(action==='rejectCounter')assert(String(p.reason||'').trim(),'Geef een reden voor afwijzing.');
      const {start,end,token}=latest.offer;
      const accepted=action==='acceptOffer'||action==='approveCounter';
      if(accepted){
        const next={...s,id:token,kind:'shift',start,end,raw:'',area:'',task:'',deadline:'',entry:null};
        db.shifts.push(next);
        record(db,actor,'acceptedSlot',token,s.date,null,{off:s.id,start,end},s.user);
      }
      record(db,actor,'message',s.id,s.date,null,{decision:action,message:(accepted?'Voorstel geaccepteerd':manager?'Ander voorstel afgewezen':'Vrij gehouden')+' · '+start+' – '+end+(p.reason?' · '+p.reason:'')},s.user);
    }
    return stateFor(db,actor);
  }
  if(action==='seen'){db.seen||=[];db.seen.push(actor.id+p.key);return stateFor(db,actor);}
  if(['message','restore','reject'].includes(action)){
    const s=findShift(db,p.id),old=structuredClone(s);
    assert(s.user===actor.id||canManage(db,actor,s.date),'Geen toegang.');
    writable(db,s.date);
    if(action==='message'){
      assert(typeof p.message==='string'&&p.message.trim()&&p.message.length<=1000,'Vul een bericht in van maximaal 1000 tekens.');
      record(db,actor,action,s.id,s.date,old,{message:p.message.trim()},s.user);
    }else{
      assert(canManage(db,actor,s.date)&&s.user!==actor.id,'Geen beoordelingsrechten.');
      assert(String(p.reason||'').trim(),'Vul een reden in.');
      if(action==='reject'){
        assert(s.kind==='extra','Vraag bij geplande uren een aanpassing.');
        assert(s.entry?.version===p.version,'De registratie is gewijzigd.');
        assert(s.entry?.status==='pending','Deze uren wachten niet op beoordeling.');
        Object.assign(s.entry,{status:'rejected',reason:p.reason,version:s.entry.version+1});
      }else{
        assert(s.kind==='cancelled'||s.entry?.status==='rejected','Deze dienst is al actief.');
        if(s.kind==='cancelled')s.kind='shift';
        if(s.entry)Object.assign(s.entry,{status:'pending',reason:p.reason,version:s.entry.version+1});
      }
      record(db,actor,action,s.id,s.date,old,s,s.user);
    }
    return stateFor(db,actor);
  }
  if (action==='history' || action==='audit') {
    const s=findShift(db,p.id);
    assert(s.user===actor.id || canManage(db,actor,s.date),'Geen toegang tot deze historie.');
    return db.audit.filter(e=>e.id===s.id).map(e=>({...e,before:e.old,after:e.new}));
  }
  if (action==='plan') {
    if(actor.role!=='admin'){
      assert(p.shifts?.length===1&&!p.cancelIds?.length,'Alleen voor de bedrijfsleider.');
      const old=findShift(db,p.shifts[0].id);
      assert(canManage(db,actor,old.date)&&old.kind!=='off'&&p.shifts[0].kind!=='off','Geen dagrechten.');
    }
    assert(Array.isArray(p.shifts),'Het rooster ontbreekt.');
    const ids=new Set();
    for(const row of p.shifts) {
      const newShift=planRow(db,row);
      assert(!ids.has(row.id),'Een dienst staat twee keer in dezelfde import.');
      ids.add(row.id);
      const old=db.shifts.find(s=>s.id===row.id);
      if(old && Object.entries(newShift).every(([k,v])=>old[k]===v)) continue;
      writable(db,row.date);
      if(old) {
        writable(db,old.date);
        assert(row.user===old.user && row.date===old.date,'Gebruik de ruilfunctie om een andere medewerker in te plannen.');
        if(row.before) {
          for(const key of Object.keys(newShift)) {
            assert((row.before[key] || '')===(old[key] || ''),'De planning is intussen gewijzigd. Open het importvoorbeeld opnieuw.');
          }
        }
        assert(!old.entry || (row.user===old.user && row.date===old.date && working(newShift)), 'Deze wijziging conflicteert met ingediende uren.');
      }
      const before=old?{...old}:null;
      const next=old || {entry:null};
      Object.assign(next,newShift);
      if(!old) db.shifts.push(next);
      record(db,actor,'plan',row.id,row.date,before,next,row.user);
    }
    for(const id of p.cancelIds || []) if(findShift(db,id).kind!=='cancelled') change(db,actor,'cancel',{id,reason:'Verdwenen uit rooster-import'});
  } else if(action==='extra') {
    const date=p.date, user=p.user || actor.id;
    assert(user===actor.id || canManage(db,actor,date),'Geen toestemming voor deze medewerker.');
    writable(db,date);
    const next=planRow(db,{...p,user,kind:'extra'});
    const prior=db.shifts.find(s=>s.id===p.id);
    assert(!prior, 'Een dienst met dit nummer bestaat al.');
    assert(!db.shifts.some(s=>s.user===user&&s.date===date&&working(s)&&s.start&&next.start<(s.entry?.end||s.end)&&next.end>(s.entry?.start||s.start)),'Je hebt al een overlappende dienst. Pas die registratie aan.');
    db.shifts.push({...next,entry:null});
    record(db,actor,action,p.id,date,null,next,user);
    if(p.pause!==undefined)change(db,actor,'submit',{id:p.id,start:p.start,end:p.end,pause:p.pause,version:0});
  } else if(['submit','approve','return','cancel','call','swap'].includes(action)) {
    const s=findShift(db,p.id), old=structuredClone(s);
    assert(action==='submit'?s.user===actor.id:canManage(db,actor,s.date),'Je hebt geen toegang tot deze dienst.');
    writable(db,s.date);
    if(action==='submit') {
      assert(s.entry?.status!=='approved','Deze uren zijn al goedgekeurd. Alleen de bedrijfsleider kan ze heropenen.');
      assert(working(s),'Deze dienst staat niet als gewerkte dienst gepland.');
      const allowed=['id','start','end','pause','version','requestId'];
      assert(Object.keys(p).every(key=>allowed.includes(key)), 'Ongeldige velden voor een inzending.');
      if(s.entry?.status==='pending' && p.version===s.entry.version-1 && s.entry.start===p.start &&
        s.entry.end===p.end && s.entry.pause===p.pause) return stateFor(db,actor);
      checkVersion(s.entry,p);
      const [a,b]=validateInterval(s.date,p.start,p.end);
      assert(b<=Date.now(),'De eindtijd ligt in de toekomst.');
      const pause=nonnegativeInteger(p.pause,'De pauze');
      const net=(b-a)/60000-pause;
      assert(net>0,'De pauze moet korter zijn dan de dienst.');
      const overlaps=db.shifts.some(other=>other.id!==s.id && other.user===s.user && other.date===s.date && other.entry &&
        other.entry.start<p.end && p.start<other.entry.end);
      assert(!overlaps,'Je hebt voor deze periode al uren ingediend.');
      s.entry={start:p.start,end:p.end,pause,net,status:'pending',version:p.version+1,reason:'',reviewer:null,changedAt:new Date().toISOString()};
    } else if(action==='approve' || action==='return') {
      assert(s.user!==actor.id||(actor.role==='admin'&&action==='approve'),'Iemand anders moet je eigen uren beoordelen.');
      checkVersion(s.entry,p);
      assert(s.entry?.status==='pending'||(s.entry?.status==='approved'&&actor.role==='admin'&&action==='return'),'Deze dienst wacht niet op beoordeling.');
      const reason=String(p.reason||'').trim();
      assert(reason.length<=1000,'Houd de toelichting onder 1000 tekens.');
      assert(action!=='return'||reason,'Vul een reden voor terugsturen in.');
      Object.assign(s.entry,{status:action==='approve'?'approved':'returned',version:p.version+1,reason,reviewer:actor.id,changedAt:new Date().toISOString()});
    } else {
      if(action==='cancel') {
        assert(!s.entry,'Bij deze dienst horen al ingediende uren. Verwerk die eerst.');
        assert(String(p.reason||'').trim(),'Vul een reden in.');
        s.reason=p.reason;
        s.kind='cancelled';
      }
      if(action==='call') {
        assert(s.kind==='standby','Alleen een stand-by-dienst kan worden opgeroepen.');
        validateInterval(s.date,p.start,p.end);
        Object.assign(s,{kind:'shift',start:p.start,end:p.end});
      }
      if(action==='swap') {
        assert(working(s),'Kies een actieve dienst.');
        activePerson(db,p.user);
        assert(p.user!==s.user,'Kies een andere medewerker voor een ruil.');
        if(s.entry) {
          const replacement={...s,id:uid(),user:p.user,entry:null};
          db.shifts.push(replacement);
          record(db,actor,'swap',s.id,s.date,old,replacement,s.user);
          record(db,actor,'replacement',replacement.id,s.date,old,replacement,p.user);
          return stateFor(db,actor);
        }
        s.user=p.user;
      }
    }
    record(db,actor,action==='approve'&&s.user===actor.id?'selfApprove':action,s.id,s.date,old,s,s.user);
  } else if(['norm','close','reopen'].includes(action)) {
    adminOnly(actor);
    assert(/^\d{4}-(?:0[1-9]|1[0-2])$/.test(p.month),'Ongeldige maand.');
    const date=p.month+'-01', reason=String(p.reason||'').trim();
    if(action==='reopen') {
      assert(db.closed.includes(p.month),'Deze maand is al open.');
      assert(reason,'Geef een reden voor heropening.');
      db.closed=db.closed.filter(m=>m!==p.month);
      record(db,actor,action,p.month,date,{closed:true},{closed:false,reason});
    } else {
      writable(db,date);
      if(action==='norm') {
        assert(db.people.some(person=>person.id===p.user),'Onbekende medewerker.');
        assert(p.norm<=44640 && p.paid<=44640,'De uren zijn hoger dan het aantal minuten in een maand.');
        const key=p.month+':'+p.user;
        assert(reason,'Vul een reden voor de norm in.');
        const next={reason,norm:nonnegativeInteger(p.norm,'De maandnorm'),paid:nonnegativeInteger(p.paid,'Afwezigheid')};
        record(db,actor,action,key,date,db.norms[key]||null,next,p.user);
        db.norms[key]=next;
      } else {
        const current=db.shifts.filter(s=>monthOf(s.date)===p.month && working(s));
        const open=current.filter(s=>s.entry?.status!=='approved');
        assert(!open.length || reason,'Er zijn openstaande diensten. Los ze op of geef een reden voor de uitzondering.');
        db.closed.push(p.month);
        db.periodVersions[p.month]=(db.periodVersions[p.month] || 0)+1;
        const snapshot={month:p.month,reason,at:new Date().toISOString(),rows:structuredClone(current),
          norms:Object.fromEntries(Object.entries(db.norms).filter(([key])=>key.startsWith(p.month+':')))};
        db.closures.push(snapshot);
        record(db,actor,action,p.month,date,{closed:false},{closed:true,reason});
      }
    }
  } else if(action==='invite' || action==='profile') {
    adminOnly(actor);
    const existing=action==='profile'?db.people.find(person=>person.id===p.user):null;
    if(action==='profile') assert(existing,'Onbekend profiel.');
    const person={...(existing||{id:p.user||uid(),role:'employee',contract:'zero',active:true})};
    for(const key of ['role','contract','name','active']) if(p[key]!==undefined) person[key]=p[key];
    assert(typeof person.name==='string' && person.name.trim(),'Vul een naam in.');
    person.name=person.name.trim();
    assert(person.name.length<=160,'De naam is te lang.');
    assert(roles.includes(person.role) && contracts.includes(person.contract) && typeof person.active==='boolean','Ongeldig profiel.');
    assert(action!=='invite' || !db.people.some(w=>w.id===person.id),'Dit profiel bestaat al.');
    assert(db.people.some(w=>w.id!==person.id && w.active && w.role==='admin') || (person.active&&person.role==='admin'),
      'Er moet ten minste één actieve bedrijfsleider blijven.');
    if(!existing || person.contract!==existing.contract || p.weeklyMinutes!==undefined) {
      const effective=p.effective || today();
      assert(validDate(effective),'Ongeldige ingangsdatum.');
      assert(effective<=today(),'Gebruik een ingangsdatum op of voor vandaag.');
      assert(!db.closed.some(m=>m>=monthOf(effective)),'Contractwijziging raakt een afgesloten maand.');
      assert(!db.contracts.some(c=>c.user===person.id && c.effective>effective),'Een latere contractafspraak bestaat al.');
      assert(p.weeklyMinutes==null || p.weeklyMinutes<=10080,'De contracturen zijn hoger dan het aantal minuten in een week.');
      const record={user:person.id,effective,contract:person.contract,weeklyMinutes:nonnegativeInteger(p.weeklyMinutes??0,'De contractminuten')};
      const previous=db.contracts.find(c=>c.user===person.id && c.effective===effective);
      if(previous) Object.assign(previous,record);else db.contracts.push(record);
    }
    record(db,actor,action,person.id,today(),existing,person,person.id);
    if(existing) Object.assign(existing,person);else db.people.push(person);
  } else throw new Error('Onbekende demo-actie.');
  return stateFor(db,actor);
}
export async function demoAct(action,payload={}) {
  const startedBy=actorId();
  const update=()=>{
    const db=read(), actor=getActor(db);
    assert(actor.id===startedBy,'Het testprofiel is gewisseld. Open de handeling opnieuw.');
    const key=payload.requestId ? actor.id+':'+payload.requestId : null;
    if(key) assert(typeof payload.requestId==='string' && payload.requestId.length<=120,'Ongeldig aanvraagnummer.');
    if(key && db.receipts[key]) {
      const receipt=db.receipts[key];
      assert(receipt.action===action && receipt.body===JSON.stringify(payload),'Dit verzoeknummer is al gebruikt.');
      return stateFor(db,actor);
    }
    const firstEvent=db.audit.length;
    const result=change(db,actor,action,payload);
    for(const event of db.audit.slice(firstEvent)){
      if(!['plan','extra','restore','call','swap','replacement','acceptedSlot'].includes(event.action))continue;
      const s=db.shifts.find(row=>row.id===event.id);
      if(!s)continue;
      const others=db.shifts.filter(row=>row.id!==s.id&&row.user===s.user&&row.date===s.date);
      const consent=(shift,off)=>db.audit.some(e=>e.action==='acceptedSlot'&&e.id===shift.id&&e.new.off===off.id&&e.new.start===shift.start&&e.new.end===shift.end);
      if(event.old?.kind==='off'&&!['off','cancelled'].includes(s.kind) || (working(s)||s.kind==='standby')&&others.some(o=>o.kind==='off'&&!consent(s,o)) || s.kind==='off'&&others.some(o=>(working(o)||o.kind==='standby')&&!consent(o,s)))
        throw Error('Deze medewerker heeft vrij gevraagd. Open de vrijmelding en stel werktijden voor.');
      if(working(s)&&others.some(o=>working(o)&&s.start&&o.start&&s.start<o.end&&s.end>o.start))
        throw Error('Deze dienst overlapt een bestaande dienst. Pas de bestaande dienst aan.');
    }
    if(action!=='history' && action!=='audit') {
      if(key) db.receipts[key]={action,body:JSON.stringify(payload)};
      save(db);
    }
    return result;
  };
  if(typeof window !== 'undefined' && globalThis.navigator?.locks) return navigator.locks.request(DATA,update);
  return update();
}

export function workedMinutes(date,start,end,pause){
  if(String(pause).trim()===''||!Number.isInteger(Number(pause))||Number(pause)<0)throw Error('Controleer de pauze.');
  const net=(instant(date,end)-instant(date,start))/60000-Number(pause);
  if(net<=0)throw Error('Controleer de werktijden.');
  return net;
}
