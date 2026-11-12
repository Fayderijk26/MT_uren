export const choices=[['all','Hele dag beschikbaar'],['from','Beschikbaar vanaf'],['until','Beschikbaar tot'],['range','Beschikbaar tussen'],['off','Hele dag vrij aanvragen']];
export const dayCount=(date,today)=>(Date.parse(date+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000;
export function bounds(p){
  const mode=p.mode||'off';
  const start=['from','range'].includes(mode)?p.start:'';
  const end=['until','range'].includes(mode)?p.end:'';
  const valid=t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t);
  if(!choices.some(([key])=>key===mode)||(['from','range'].includes(mode)&&!valid(start))||(['until','range'].includes(mode)&&!valid(end))||(start&&end&&start>=end))throw Error('Controleer de beschikbaarheid en de tijden.');
  return {mode,start,end};
}
export function availabilityText(l){
  switch(l.mode){
    case 'all':return 'Hele dag beschikbaar';
    case 'from':return 'Beschikbaar vanaf '+l.start;
    case 'until':return 'Beschikbaar tot '+l.end;
    case 'range':return 'Beschikbaar van '+l.start+' tot '+l.end;
    default:return 'Hele dag vrij';
  }
}
export function changesFor(shifts,l){
  const changes=[];
  for(const s of shifts.filter(s=>s.date===l.date&&s.user===l.user&&!['cancelled','off'].includes(s.kind))){
    const start=l.start&&l.start>s.start?l.start:s.start,end=l.end&&l.end<s.end?l.end:s.end;
    if((l.mode||'off')==='off'||(l.mode!=='all'&&(!s.start||!s.end||start>=end)))changes.push({id:s.id,before:[s.kind,s.start||'',s.end||''],after:null});
    else if(start!==s.start||end!==s.end)changes.push({id:s.id,before:[s.kind,s.start,s.end],after:[start,end]});
  }
  return changes.sort((a,b)=>a.id.localeCompare(b.id));
}
