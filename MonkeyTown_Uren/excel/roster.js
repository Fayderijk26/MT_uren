import './vendor/jszip.min.js';

const weekdays = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'];
const dayMs = 86400000;
const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const blank = {start:'', end:'', area:'', task:'', deadline:''};
const clockPattern = '(?:[01]?\\d|2[0-3]):[0-5]\\d';
const workPattern = new RegExp('^(' + clockPattern + ')(?:\\s*[-/]\\s*(' + clockPattern + '|sluit|openen))?$','i');
const standbyPattern = new RegExp('^sb(?:[ :/-]+(' + clockPattern + '))?$','i');
const tidyClock = t => t.padStart(5,'0');
function clockFromMinutes(minutes) {
  return [Math.floor(minutes/60),minutes%60].map(n=>String(n).padStart(2,'0')).join(':');
}

export function parseSlot(value) {
  const numericTime = typeof value === 'number' && value >= 0 && value < 1;
  const raw = numericTime ? clockFromMinutes(Math.round(value * 1440)) : String(value ?? '').trim();
  const result = {raw, ...blank};
  if (!raw) return null;
  let text = raw.toLowerCase().replace(/\s+/g,' ').trim();
  if (text === 'x') return {...result,kind:'off'};
  if (/^k(?:\s*:|\s+)/.test(text)) {
    result.area = 'Keuken';
    text = text.replace(/^k(?:\s*:\s*|\s+)/, '');
  } else if (/^kantoor(?:\/vloer)?\b/.test(text)) {
    result.area = text.startsWith('kantoor/vloer') ? 'Kantoor/vloer' : 'Kantoor';
    text = text.replace(/^kantoor(?:\/vloer)?\s*(?:v\.a\.?\s*)?/, '');
    if (!text) return {...result,kind:'office'};
  }
  const standby = text.match(standbyPattern);
  if (standby) return {...result,kind:'standby',deadline:standby[1] ? tidyClock(standby[1]) : ''};
  const work = text.match(workPattern);
  if (!work) return {...result,kind:'unknown'};
  const start = tidyClock(work[1]);
  const marker = work[2];
  const end = marker?.includes(':') ? tidyClock(marker) : '18:00';
  if (start >= end) return {...result,kind:'unknown'};
  const task = marker === 'openen' ? 'Openen' : marker === 'sluit' ? 'Sluiten' : '';
  return {...result,kind:'shift',start,end,task};
}

const elements = (node,name) => Array.from(node.getElementsByTagNameNS('*',name));
async function getXml(zip,path,optional=false) {
  const entry = zip.file(path);
  if (!entry && optional) return null;
  if (!entry) throw Error('Dit bestand mist een verplicht werkmaponderdeel.');
  if (entry._data.uncompressedSize > 8*1024*1024) throw Error('Het Excel-werkblad is te groot.');
  const xml = new DOMParser().parseFromString(await entry.async('string'),'application/xml');
  if (elements(xml,'parsererror').length) throw Error('Het werkblad bevat ongeldige XML.');
  return xml;
}
function cellValue(cell,strings) {
  const type = cell.getAttribute('t');
  const v = elements(cell,'v')[0]?.textContent;
  if (type === 'inlineStr') return elements(cell,'t').map(x=>x.textContent).join('');
  if (type === 's') return strings[Number(v)] ?? '';
  if (v === undefined || v === '') return '';
  return !type || type==='n' ? Number(v) : v;
}
function isoDate(value,date1904) {
  if (Number.isInteger(value) && value>0 && value<110000) {
    return new Date((value - (date1904 ? 24107 : 25569)) * dayMs).toISOString().slice(0,10);
  }
  const match = String(value??'').match(/^(\d{4}-\d{2}-\d{2})(?:T.*)?$/);
  if (match && !Number.isNaN(Date.parse(match[1])) && new Date(match[1]).toISOString().startsWith(match[1])) return match[1];
  throw Error('Een dagkolom mist een geldige Excel-datum onder de dagnaam.');
}

export async function readRoster(file) {
  if (file.size > 4*1024*1024) throw Error('Kies een weekrooster kleiner dan 4 MB.');
  let zip;
  try { zip = await globalThis.JSZip.loadAsync(await file.arrayBuffer()); }
  catch { throw Error('Kies een geldig .xlsx-bestand.'); }
  const workbook = await getXml(zip,'xl/workbook.xml');
  const date1904 = ['1','true'].includes(elements(workbook,'workbookPr')[0]?.getAttribute('date1904'));
  const relations = elements(await getXml(zip,'xl/_rels/workbook.xml.rels'),'Relationship');
  const shared = await getXml(zip,'xl/sharedStrings.xml',true);
  const strings = shared ? elements(shared,'si').map(si=>elements(si,'t').map(t=>t.textContent).join('')) : [];
  for (const sheet of elements(workbook,'sheet')) {
    const id = sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
    const target = relations.find(r=>r.getAttribute('Id')===id)?.getAttribute('Target');
    if (!target) continue;
    const path = new URL(target,'https://workbook.local/xl/workbook.xml').pathname.slice(1);
    const rows = elements(await getXml(zip,path),'row').map(row=>{
      const data = {};
      for (const c of elements(row,'c')) {
        const col = c.getAttribute('r')?.match(/^[A-Z]+/)?.[0];
        if (col) data[col] = cellValue(c,strings);
      }
      return data;
    });
    const header = rows.findIndex(row=>weekdays.every(day=>Object.values(row).some(v=>String(v).trim().toLowerCase()===day)));
    if (header<0) continue;
    const dates = weekdays.map((day,index)=>{
      const col = Object.keys(rows[header]).find(c=>String(rows[header][c]).trim().toLowerCase()===day);
      const date = isoDate(rows[header+1]?.[col],date1904);
      if ((new Date(date).getUTCDay()+6)%7 !== index) throw Error('De datum onder '+day+' valt op een andere weekdag.');
      return {col,date};
    });
    if (new Date(dates[6].date)-new Date(dates[0].date)!==6*dayMs) throw Error('De datums vormen geen aaneengesloten roosterweek.');
    const records = [];
    for (const row of rows.slice(header+2)) {
      const name = String(row.A??'').trim();
      for (const {col,date} of dates) {
        const slot = parseSlot(row[col]);
        if (!slot) continue;
        if (!name) throw Error('Een ingevulde dienst mist een medewerkersnaam in kolom A.');
        records.push({name,date,...slot});
      }
    }
    records.dates = dates.map(day => day.date);
    return records;
  }
  throw Error('Geen weekrooster gevonden. Gebruik de weekmatrix met maandag t/m zondag en daaronder de zeven datums.');
}

const xmlHead = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const sheetNs = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const docRel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const pkgRel = 'http://schemas.openxmlformats.org/package/2006/relationships';
function esc(value) {
  return String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
}
function colLabel(i) {
  let col='';
  for (let n=i+1;n>0;n=Math.floor((n-1)/26)) col=String.fromCharCode(65+(n-1)%26)+col;
  return col;
}
const styles = '<styleSheet xmlns="'+sheetNs+'"><numFmts count="3"><numFmt numFmtId="164" formatCode="[h]:mm"/><numFmt numFmtId="165" formatCode="hh:mm"/><numFmt numFmtId="166" formatCode="dd-mm-yyyy"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF18634B"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6">'+[0,0,164,165,166,2].map((format,i)=>'<xf xfId="0" numFmtId="'+format+'" fontId="'+(i===1?1:0)+'" fillId="'+(i===1?2:0)+'" borderId="0" applyNumberFormat="1"/>').join('')+'</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
const number = (v,style)=>({v,style});
function sheetXml(rows,widths) {
  const cols = widths.map((w,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+w+'" customWidth="1"/>').join('');
  const body = rows.map((row,r)=>'<row r="'+(r+1)+'">'+row.map((val,c)=>{
    if (val===undefined || val===null || val==='') return '';
    const ref=colLabel(c)+(r+1);
    if (typeof val==='object' && Number.isFinite(val.v)) return '<c r="'+ref+'" s="'+val.style+'"><v>'+val.v+'</v></c>';
    return '<c r="'+ref+'" s="'+(r===0?1:0)+'" t="inlineStr"><is><t xml:space="preserve">'+esc(val)+'</t></is></c>';
  }).join('')+'</row>').join('');
  return xmlHead+'<worksheet xmlns="'+sheetNs+'"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>'+cols+'</cols><sheetData>'+body+'</sheetData></worksheet>';
}
async function createBook(sheets) {
  const zip = new globalThis.JSZip();
  const main = 'application/vnd.openxmlformats-officedocument.spreadsheetml.';
  zip.file('[Content_Types].xml',xmlHead+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="'+main+'sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="'+main+'styles+xml"/>'+sheets.map((_,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="'+main+'worksheet+xml"/>').join('')+'</Types>');
  zip.file('_rels/.rels',xmlHead+'<Relationships xmlns="'+pkgRel+'"><Relationship Id="rId1" Type="'+docRel+'/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.file('xl/workbook.xml',xmlHead+'<workbook xmlns="'+sheetNs+'" xmlns:r="'+docRel+'"><sheets>'+sheets.map((s,i)=>'<sheet name="'+esc(s.name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets></workbook>');
  zip.file('xl/_rels/workbook.xml.rels',xmlHead+'<Relationships xmlns="'+pkgRel+'">'+sheets.map((_,i)=>'<Relationship Id="rId'+(i+1)+'" Type="'+docRel+'/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+'<Relationship Id="styles" Type="'+docRel+'/styles" Target="styles.xml"/></Relationships>');
  zip.file('xl/styles.xml',xmlHead+styles);
  sheets.forEach((s,i)=>zip.file('xl/worksheets/sheet'+(i+1)+'.xml',sheetXml(s.rows,s.widths)));
  return zip.generateAsync({type:'blob',compression:'DEFLATE',mimeType:mime});
}
function download(blob,filename) {
  const href = URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=href; a.download=filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(href),60000);
}
const clockNumber = t=>{const [h,m]=t.split(':').map(Number);return number((h*60+m)/1440,3);};
const duration = n=>n==null ? null : number(n/1440,2);
const dateNumber = iso=>number(Date.parse(iso)/dayMs+25569,4);

export async function exportMonth(rows,summary,month,metadata) {
  if (!/^\d{4}-(0[1-9]|1[012])$/.test(month)) throw Error('Kies een geldige maand.');
  const entries = rows.filter(r=>r.date.startsWith(month+'-'));
  const detail = [['Medewerker-ID','Naam','Datum','Begin','Einde','Pauze','Netto gewerkt'],...entries.map(r=>[r.employeeId,r.name,dateNumber(r.date),clockNumber(r.start),clockNumber(r.end),duration(r.breakMinutes),duration(r.netMinutes)])];
  const totals = [['Medewerker-ID','Naam','Gewerkt','Maandnorm','Afwezigheid','Saldo (uren)'],...summary.map(s=>[s.employeeId,s.name,duration(s.workedMinutes),duration(s.normMinutes),duration(s.absenceMinutes),s.balanceMinutes==null?null:number(s.balanceMinutes/60,5)])];
  const sheets = [
    {name:'Maandstaat',rows:totals,widths:[38,26,16,16,18,18]},
    {name:'Diensten',rows:detail,widths:[38,26,16,12,12,12,18]}
  ];
  let suffix = '';
  if (metadata !== undefined) {
    const {revision,closed} = metadata;
    if (!Number.isSafeInteger(revision) || revision < 0 || typeof closed !== 'boolean') {
      throw Error('De maandexport mist een geldige revisie of afsluitstatus.');
    }
    const status = closed ? 'Afgesloten' : 'Voorlopig';
    sheets.push({
      name:'Exportinformatie',
      rows:[['Maand','Status','Revisie'],[month,status,number(revision,0)]],
      widths:[16,20,14]
    });
    suffix = '-' + status.toLowerCase() + '-v' + revision;
  }
  const blob = await createBook(sheets);
  download(blob,'MonkeyTown-uren-'+month+suffix+'.xlsx');
  return blob;
}

export function downloadExample() {
  const a = document.createElement('a');
  a.href = new URL('./Demorooster_week46.xlsx',import.meta.url).href;
  a.download = 'Demorooster_week46.xlsx';
  a.click();
}
