import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSlot} from '../excel/roster.js';

test('Lege vakken, afwezigheid en stand-by leiden niet tot een werktijd',()=>{
  assert.equal(parseSlot('   '),null);
  assert.equal(parseSlot('x').kind,'off');
  for(const [raw,area,deadline] of [['SB','',''],['K SB','Keuken',''],[' SB 11:30 ','','11:30'],['K: SB 11:30','Keuken','11:30']]){
    const row=parseSlot(raw);
    assert.equal(row.kind,'standby');
    assert.deepEqual([row.start,row.end,row.area,row.deadline],['','',area,deadline]);
  }
});
test('Keuken, kantoor en taaknotaties leveren de afgesproken tijden',()=>{
  for(const [raw,start,end,area,task] of [[11/24,'11:00','18:00','',''],['08:30/15:00','08:30','15:00','',''],['10:00-15:30','10:00','15:30','',''],['K:10:00','10:00','18:00','Keuken',''],['kantoor/vloer v.a 12:00','12:00','18:00','Kantoor/vloer',''],['09:30/openen','09:30','18:00','','Openen'],['kantoor 15:00-sluit','15:00','18:00','Kantoor','Sluiten']]){
    const row=parseSlot(raw);
    assert.deepEqual([row.kind,row.start,row.end,row.area,row.task],['shift',start,end,area,task]);
  }
  const office=parseSlot('kantoor');
  assert.deepEqual([office.kind,office.start,office.end],['office','','']);
});
test('Onbekende of ongeldige tijden wachten op beoordeling',()=>{
  for(const raw of ['08:70','25:05','K SB 28:30','18:00','20:00-19:00','anders']) assert.equal(parseSlot(raw).kind,'unknown');
});
