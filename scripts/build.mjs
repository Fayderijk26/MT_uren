import {config} from '../config.js';
import {cp, mkdir, rm, writeFile} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true}); await mkdir('dist');
for(const file of ['index.html','style.css','app.js','manager.js','contract.js','availability.js','ui.js','demo.js','assets','integration/auth.js','excel']) {
  await cp(file,'dist/'+file,{recursive:true,filter:p=>!/(?:\/tests?\/|\.test\.|\.md$)/.test(p)});
}
await writeFile('dist/config.js','export const config = '+JSON.stringify({DEMO_PREVIEW:process.env.DEMO_PREVIEW===undefined?config.DEMO_PREVIEW:process.env.DEMO_PREVIEW==='1',SUPABASE_URL:process.env.SUPABASE_URL||config.SUPABASE_URL,SUPABASE_KEY:process.env.SUPABASE_KEY||config.SUPABASE_KEY})+';\n');
