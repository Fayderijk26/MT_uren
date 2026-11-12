import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('dist');
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.webp':'image/webp','.json':'application/json','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost');const f=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!f.startsWith(root+'/'))throw Error();const b=await readFile(f);res.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'});res.end(b)}catch{res.writeHead(404);res.end('Niet gevonden')}}).listen(Number(process.argv.includes('--port')?process.argv[process.argv.indexOf('--port')+1]:process.env.PORT||5173),process.argv.includes('--host')?process.argv[process.argv.indexOf('--host')+1]:'127.0.0.1');
