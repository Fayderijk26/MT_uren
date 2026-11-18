/* Optioneel: npm install --no-save playwright. Gebruik CHROMIUM_PATH voor een bestaande Chromium. */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const excelDir=fileURLToPath(new URL('../excel/',import.meta.url));
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH}: {})});
try {
 const page=await browser.newPage();
 await page.route('https://rooster.test/**',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/') return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Exceltest</title>'});
   const file=path.join(excelDir,url.pathname.replace(/^\/excel\//,''));
   if(!file.startsWith(excelDir)) return route.abort();
   return route.fulfill({contentType:file.endsWith('.js')?'text/javascript':'application/octet-stream',body:await fs.readFile(file)});
 });
 await page.goto('https://rooster.test');
 const example = await page.evaluate(async()=>{
   const {readRoster,parseSlot}=await import('/excel/roster.js');
   const blob=await (await fetch('/excel/Demorooster_week46.xlsx')).blob();
   const parsed=await readRoster(blob);
   const invalid=['23:77','18:00','19:00-12:00','anders','K SB 99:99'];
   return {parsed,second:await readRoster(blob),invalid:invalid.map(raw=>parseSlot(raw).kind)};
 });
 assert.deepEqual(example.second,example.parsed);
 assert.equal(example.parsed.length,18);
 assert.deepEqual(example.invalid,Array(5).fill('unknown'));
 const match=(raw)=>example.parsed.find(r=>r.raw===raw);
 assert.equal(match('K:10:00').area,'Keuken');
 assert.equal(match('K:10:00').end,'18:00');
 assert.equal(match('K SB').kind,'standby');
 assert.equal(match('SB 12:00').deadline,'12:00');
 assert.equal(match('SB 12:00').start,'');
 assert.equal(match('kantoor').kind,'unknown');
 assert.equal(match('x').kind,'off');
 assert.equal(match('09:30/openen').task,'Openen');
 assert.equal(match('kantoor 15:00-sluit').task,'Sluiten');
 assert.equal(match('11:00').date,'2026-11-11');
 if(process.env.ROSTER_TEST_INPUT){
   const source=await fs.readFile(process.env.ROSTER_TEST_INPUT);
   const count=await page.evaluate(async bytes=>{
     const {readRoster}=await import('/excel/roster.js');
     const data=await readRoster(new Blob([Uint8Array.from(bytes)]));
     return {count:data.length,unknown:data.filter(r=>r.kind==='unknown').length,first:data.map(r=>r.date).sort()[0]};
   },Array.from(source));
   assert.equal(count.unknown,0);assert.equal(count.first,'2018-10-08');console.log('Origineel bestand:',count.count,'roostercellen, alle codes herkend.');
 }
 const download=page.waitForEvent('download');
 await page.evaluate(async()=>{
   const {exportMonth}=await import('/excel/roster.js');
   await exportMonth([{employeeId:'001',name:'=TEST',date:'2026-11-11',start:'09:00',end:'17:45',breakMinutes:30,netMinutes:495}],
     [{employeeId:'001',name:'=TEST',workedMinutes:1935,normMinutes:2400,absenceMinutes:0,balanceMinutes:-465}], '2026-11');
 });
 const result=await download;
 assert.match(result.suggestedFilename(),/2026-11\.xlsx$/);
 if(process.env.ROSTER_TEST_EXPORT) await result.saveAs(process.env.ROSTER_TEST_EXPORT);
 console.log('Geslaagd: voorbeeld, kalenderdatums, vrije dagen, werkplekken, stand-by, openen/sluiten, ongeldige waarden en maandexport.');
} finally {await browser.close();}
