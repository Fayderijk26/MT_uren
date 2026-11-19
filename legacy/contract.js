// Rekenvoorbeeld voor de bedrijfsleider. Alleen een opgeslagen norm telt mee.
export function normExample(contracts,user,month){
  const history=contracts.filter(c=>c.user===user).sort((a,b)=>a.effective.localeCompare(b.effective));
  const days=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).getUTCDate();
  let total=0,fixed=false;
  for(let day=1;day<=days;day++){
    const date=month+'-'+String(day).padStart(2,'0');
    const record=history.filter(c=>c.effective<=date).at(-1);
    if(record?.contract!=='fixed')continue;
    fixed=true;
    if(!record.weeklyMinutes)return {missing:true};
    total+=record.weeklyMinutes*52/12/days;
  }
  return {minutes:fixed?Math.round(total):null};
}
