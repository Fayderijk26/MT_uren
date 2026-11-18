// One definition of opening hours. Existing scheduled/recorded times never change with settings.
export const DEFAULT_OPENING={start:'08:30',end:'18:00'};
export function opening(db,dateOrDay){
 const day=typeof dateOrDay==='number'?dateOrDay:(new Date(dateOrDay+'T12:00Z').getUTCDay()||7);
 return db.settings?.opening?.[day]||DEFAULT_OPENING;
}
export function wholeDay(db,row){const o=opening(db,row.date||row.weekday);return !o.closed&&row.start===o.start&&row.end===o.end;}
